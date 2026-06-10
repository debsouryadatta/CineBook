import { BookingStatus, SeatHoldStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { ticketQueue } from "./queue.js";
import { AppError } from "../utils/errors.js";
import { calculateTotalAmount, toBookingError } from "./bookingUtils.js";
import { expireSeatHolds } from "./seatHoldService.js";

type CreateBookingInput = {
  showId: string;
  seatIds: string[];
  userId: string;
  holdIds?: string[];
};

export async function createBooking({ showId, seatIds, userId, holdIds = [] }: CreateBookingInput) {
  await expireSeatHolds(showId);

  const booking = await prisma
    .$transaction(async (tx) => {
      const show = await tx.show.findUnique({
        where: { id: showId },
        include: { screen: true }
      });
      if (!show || show.startsAt <= new Date()) throw new AppError(400, "Show is not available");

      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds }, screenId: show.screenId }
      });
      if (seats.length !== seatIds.length) throw new AppError(400, "Invalid seat selection");

      const activeHolds = await tx.seatHold.findMany({
        where: { showId, seatId: { in: seatIds }, active: true },
        select: { id: true, seatId: true, userId: true }
      });
      const foreignHold = activeHolds.find((hold) => hold.userId !== userId);
      if (foreignHold) throw new AppError(409, "Some selected seats are temporarily held");

      if (holdIds.length) {
        const ownedHeldSeatIds = new Set(activeHolds.filter((hold) => hold.userId === userId && holdIds.includes(hold.id)).map((hold) => hold.seatId));
        const missingHeldSeat = seatIds.find((seatId) => !ownedHeldSeatIds.has(seatId));
        if (missingHeldSeat) throw new AppError(400, "Seat hold is missing or expired");
      }

      const totalAmount = calculateTotalAmount(show, seats);
      const created = await tx.booking.create({
        data: {
          userId,
          showId: show.id,
          totalAmount,
          status: BookingStatus.PENDING,
          confirmationCode: `CB-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase()}`,
          seats: {
            create: seats.map((seat) => ({
              showId: show.id,
              seatId: seat.id,
              price: show.basePrice + seat.priceModifier
            }))
          }
        },
        include: {
          show: { include: { movie: true, screen: { include: { theater: true } } } },
          seats: { include: { seat: true } }
        }
      });

      await tx.seatHold.updateMany({
        where: { showId, seatId: { in: seatIds }, userId, active: true },
        data: { active: false, status: SeatHoldStatus.CONVERTED }
      });

      return created;
    })
    .catch((error) => {
      throw toBookingError(error);
    });

  await ticketQueue.add("confirm-ticket", { bookingId: booking.id }, { attempts: 3, backoff: { type: "exponential", delay: 1000 } });
  return booking;
}

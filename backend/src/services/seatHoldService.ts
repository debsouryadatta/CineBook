import { SeatHoldStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

export const HOLD_MINUTES = 5;

export async function expireSeatHolds(showId?: string) {
  await prisma.seatHold.updateMany({
    where: {
      active: true,
      status: SeatHoldStatus.ACTIVE,
      expiresAt: { lte: new Date() },
      ...(showId ? { showId } : {})
    },
    data: {
      active: false,
      status: SeatHoldStatus.EXPIRED
    }
  });
}

export async function createSeatHold({ showId, seatIds, userId }: { showId: string; seatIds: string[]; userId: string }) {
  await expireSeatHolds(showId);

  const show = await prisma.show.findUnique({ where: { id: showId }, include: { screen: true } });
  if (!show || show.startsAt <= new Date()) throw new AppError(400, "Show is not available");

  const seats = await prisma.seat.findMany({ where: { id: { in: seatIds }, screenId: show.screenId } });
  if (seats.length !== seatIds.length) throw new AppError(400, "Invalid seat selection");

  const activeBookings = await prisma.bookingSeat.count({
    where: { showId, seatId: { in: seatIds }, active: true }
  });
  if (activeBookings) throw new AppError(409, "Some selected seats are already booked");

  const conflictingHolds = await prisma.seatHold.count({
    where: { showId, seatId: { in: seatIds }, active: true, userId: { not: userId } }
  });
  if (conflictingHolds) throw new AppError(409, "Some selected seats are temporarily held");

  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
  const holds = await prisma.$transaction(async (tx) => {
    await tx.seatHold.updateMany({
      where: { showId, seatId: { in: seatIds }, userId, active: true },
      data: { active: false, status: SeatHoldStatus.RELEASED }
    });

    return Promise.all(
      seats.map((seat) =>
        tx.seatHold.create({
          data: { showId, seatId: seat.id, userId, expiresAt },
          include: { seat: true }
        })
      )
    );
  });

  return { holds, expiresAt };
}

export async function releaseSeatHolds({ holdIds, userId }: { holdIds: string[]; userId: string }) {
  await expireSeatHolds();
  const result = await prisma.seatHold.updateMany({
    where: { id: { in: holdIds }, userId, active: true },
    data: { active: false, status: SeatHoldStatus.RELEASED }
  });

  return { released: result.count };
}

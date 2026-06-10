import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { expireSeatHolds } from "../services/seatHoldService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const showsRouter = Router();

showsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const showId = String(req.params.id);
    await expireSeatHolds(showId);
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        movie: true,
        screen: {
          include: {
            theater: true,
            seats: { orderBy: [{ row: "asc" }, { number: "asc" }] }
          }
        },
        bookingSeats: {
          where: { active: true, booking: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } } },
          select: { seatId: true }
        },
        holds: {
          where: { active: true, expiresAt: { gt: new Date() } },
          select: { seatId: true, expiresAt: true }
        }
      }
    });
    if (!show) throw new AppError(404, "Show not found");

    const reserved = new Set([...show.bookingSeats.map((seat) => seat.seatId), ...show.holds.map((hold) => hold.seatId)]);
    const seats = show.screen.seats.map((seat) => ({
      ...seat,
      price: show.basePrice + seat.priceModifier,
      isReserved: reserved.has(seat.id)
    }));

    res.json({
      show: {
        ...show,
        screen: { ...show.screen, seats },
        bookingSeats: undefined
      }
    });
  })
);

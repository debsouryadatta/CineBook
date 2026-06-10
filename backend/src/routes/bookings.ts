import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { logActivity } from "../services/activityLog.js";
import { createBooking } from "../services/bookingService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  showId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(8),
  holdIds: z.array(z.string().min(1)).max(8).optional()
});

const bookingAttemptLimit = rateLimit({
  keyPrefix: "booking-attempt",
  limit: 5,
  windowSeconds: 60 * 60,
  key: (req) => req.user?.id ?? req.ip ?? "anonymous"
});

bookingsRouter.use(requireAuth);

bookingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        show: {
          include: {
            movie: true,
            screen: { include: { theater: true } }
          }
        },
        seats: { include: { seat: true } }
      }
    });
    res.json({ bookings });
  })
);

bookingsRouter.post(
  "/",
  bookingAttemptLimit,
  asyncHandler(async (req, res) => {
    const input = createBookingSchema.parse(req.body);
    const booking = await createBooking({ showId: input.showId, seatIds: input.seatIds, holdIds: input.holdIds, userId: req.user!.id });
    await logActivity({
      actorId: req.user!.id,
      action: "booking.create",
      entityType: "Booking",
      entityId: booking.id,
      metadata: { showId: input.showId, seatIds: input.seatIds }
    });
    res.status(201).json({ booking });
  })
);

bookingsRouter.patch(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user!.id },
      include: { show: true }
    });
    if (!booking) throw new AppError(404, "Booking not found");
    if (booking.status === BookingStatus.CANCELLED) throw new AppError(400, "Booking already cancelled");
    if (booking.show.startsAt <= new Date()) throw new AppError(400, "Past shows cannot be cancelled");

    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.bookingSeat.updateMany({
        where: { bookingId: booking.id },
        data: { active: false }
      });

      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: "SUCCEEDED" },
        data: { status: "REFUNDED", refundedAt: new Date() }
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, paymentStatus: "REFUNDED" },
        include: { seats: { include: { seat: true } }, show: { include: { movie: true } } }
      });
    });

    await logActivity({ actorId: req.user!.id, action: "booking.cancel", entityType: "Booking", entityId: booking.id });
    res.json({ booking: cancelled });
  })
);

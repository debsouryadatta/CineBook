import { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/errors.js";

const CIRCUIT_KEY = "payments:circuit";
const FAILURE_KEY = "payments:failures";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transactionId() {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getCardOutcome(cardNumber: string) {
  const normalized = cardNumber.replace(/\D/g, "");
  if (normalized.endsWith("0002")) return "fail";
  if (normalized.endsWith("3000")) return Math.random() < 0.5 ? "fail" : "success";
  return "success";
}

async function recordFailure() {
  const failures = await redis.incr(FAILURE_KEY);
  if (failures === 1) await redis.expire(FAILURE_KEY, 60);
  if (failures >= 3) await redis.set(CIRCUIT_KEY, "open", "EX", 30);
}

export async function processPayment({ bookingId, userId, cardNumber }: { bookingId: string; userId: string; cardNumber: string }) {
  if ((await redis.get(CIRCUIT_KEY)) === "open") {
    throw new AppError(503, "Payments are temporarily unavailable. Please try again shortly.");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { payments: true }
  });

  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status === BookingStatus.CANCELLED) throw new AppError(400, "Cancelled bookings cannot be paid");
  if (booking.payments.some((payment) => payment.status === PaymentStatus.SUCCEEDED)) throw new AppError(400, "Booking is already paid");

  await delay(1000 + Math.floor(Math.random() * 1500));

  const outcome = getCardOutcome(cardNumber);
  const cardLast4 = cardNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const payment = await prisma.payment.create({
    data: {
      bookingId,
      userId,
      amount: booking.totalAmount,
      cardLast4,
      transactionId: transactionId(),
      status: outcome === "success" ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
      failureReason: outcome === "success" ? undefined : "Test card declined"
    }
  });

  if (outcome !== "success") {
    await recordFailure();
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: PaymentStatus.FAILED } });
    throw new AppError(402, "Payment failed for this test card");
  }

  await redis.del(FAILURE_KEY);
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: PaymentStatus.SUCCEEDED },
    include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true } } }
  });

  return { payment, booking: updatedBooking };
}

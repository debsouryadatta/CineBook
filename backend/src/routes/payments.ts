import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../services/activityLog.js";
import { processPayment } from "../services/paymentService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const paymentsRouter = Router();

const paymentSchema = z.object({
  bookingId: z.string().min(1),
  cardNumber: z.string().min(12)
});

paymentsRouter.use(requireAuth);

paymentsRouter.post(
  "/process",
  asyncHandler(async (req, res) => {
    const input = paymentSchema.parse(req.body);
    const result = await processPayment({ bookingId: input.bookingId, userId: req.user!.id, cardNumber: input.cardNumber });
    await logActivity({
      actorId: req.user!.id,
      action: "payment.process",
      entityType: "Payment",
      entityId: result.payment.id,
      metadata: { bookingId: input.bookingId, transactionId: result.payment.transactionId, amount: result.payment.amount }
    });
    res.status(201).json(result);
  })
);

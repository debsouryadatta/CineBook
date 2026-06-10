import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { createSeatHold, releaseSeatHolds } from "../services/seatHoldService.js";
import { logActivity } from "../services/activityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const holdsRouter = Router();

const holdSchema = z.object({
  showId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(8)
});

const releaseSchema = z.object({
  holdIds: z.array(z.string().min(1)).min(1).max(8)
});

holdsRouter.use(requireAuth);

holdsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = holdSchema.parse(req.body);
    const result = await createSeatHold({ showId: input.showId, seatIds: input.seatIds, userId: req.user!.id });
    await logActivity({
      actorId: req.user!.id,
      action: "seat_hold.create",
      entityType: "Show",
      entityId: input.showId,
      metadata: { seatIds: input.seatIds, holdIds: result.holds.map((hold) => hold.id) }
    });
    res.status(201).json(result);
  })
);

holdsRouter.post(
  "/release",
  asyncHandler(async (req, res) => {
    const input = releaseSchema.parse(req.body);
    const result = await releaseSeatHolds({ holdIds: input.holdIds, userId: req.user!.id });
    await logActivity({
      actorId: req.user!.id,
      action: "seat_hold.release",
      entityType: "SeatHold",
      metadata: { holdIds: input.holdIds, released: result.released }
    });
    res.json(result);
  })
);

import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { bustCache } from "../config/redis.js";
import { requireAuth, requireManagerOrAdmin } from "../middleware/auth.js";
import { logActivity } from "../services/activityLog.js";
import { getShowtimeEndAt, isWithinSchedulingWindow, showtimesOverlap } from "../services/showtimeUtils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const managerRouter = Router();

const showInputSchema = z.object({
  movieId: z.string().min(1),
  screenId: z.string().min(1),
  startsAt: z.string().datetime(),
  basePrice: z.number().int().positive()
});

managerRouter.use(requireAuth, requireManagerOrAdmin);

async function assertScreenAccess(userId: string, role: Role, screenId: string) {
  if (role === Role.ADMIN) return;
  const assignment = await prisma.screenManager.findUnique({ where: { userId_screenId: { userId, screenId } } });
  if (!assignment) throw new AppError(403, "You can only manage assigned screens");
}

async function assertShowCanBeChanged(showId: string, userId: string, role: Role) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] } }, select: { id: true }, take: 1 },
      screen: true
    }
  });
  if (!show) throw new AppError(404, "Show not found");
  await assertScreenAccess(userId, role, show.screenId);
  if (show.bookings.length) throw new AppError(409, "Shows with bookings cannot be changed or deleted");
  return show;
}

async function validateShowWindow(input: z.infer<typeof showInputSchema>, excludeShowId?: string) {
  const startsAt = new Date(input.startsAt);
  if (startsAt <= new Date()) throw new AppError(400, "Showtime must be in the future");
  if (!isWithinSchedulingWindow(startsAt)) throw new AppError(400, "Shows can only be scheduled up to 30 days ahead");

  const movie = await prisma.movie.findUnique({ where: { id: input.movieId }, select: { id: true, durationMin: true } });
  if (!movie) throw new AppError(400, "Invalid movie");

  const endsAt = getShowtimeEndAt({ startsAt, durationMin: movie.durationMin, cleaningBufferMin: 30 });
  const nearbyShows = await prisma.show.findMany({
    where: {
      screenId: input.screenId,
      ...(excludeShowId ? { id: { not: excludeShowId } } : {}),
      startsAt: { lt: endsAt }
    },
    select: { id: true, startsAt: true, movie: { select: { durationMin: true } } }
  });

  const overlappingShow = nearbyShows.find((item) =>
    showtimesOverlap(
      { startsAt, durationMin: movie.durationMin, cleaningBufferMin: 30 },
      { startsAt: item.startsAt, durationMin: item.movie.durationMin, cleaningBufferMin: 30 }
    )
  );
  if (overlappingShow) throw new AppError(409, "A show already overlaps on that screen or cleaning buffer");

  return startsAt;
}

managerRouter.get(
  "/screens",
  asyncHandler(async (req, res) => {
    const screens = await prisma.screen.findMany({
      where: req.user!.role === Role.ADMIN ? {} : { managers: { some: { userId: req.user!.id } } },
      include: { theater: true, shows: { include: { movie: true }, orderBy: { startsAt: "asc" } } },
      orderBy: [{ theater: { city: "asc" } }, { name: "asc" }]
    });
    res.json({ screens });
  })
);

managerRouter.post(
  "/shows",
  asyncHandler(async (req, res) => {
    const input = showInputSchema.parse(req.body);
    await assertScreenAccess(req.user!.id, req.user!.role, input.screenId);
    const startsAt = await validateShowWindow(input);

    const show = await prisma.show.create({
      data: { movieId: input.movieId, screenId: input.screenId, startsAt, basePrice: input.basePrice },
      include: { movie: true, screen: { include: { theater: true } } }
    });
    await logActivity({ actorId: req.user!.id, action: "manager.show.create", entityType: "Show", entityId: show.id });
    await bustCache("movies:*");
    res.status(201).json({ show });
  })
);

managerRouter.patch(
  "/shows/:id",
  asyncHandler(async (req, res) => {
    const input = showInputSchema.partial().parse(req.body);
    const show = await assertShowCanBeChanged(String(req.params.id), req.user!.id, req.user!.role);
    const next = {
      movieId: input.movieId ?? show.movieId,
      screenId: input.screenId ?? show.screenId,
      startsAt: input.startsAt ?? show.startsAt.toISOString(),
      basePrice: input.basePrice ?? show.basePrice
    };
    await assertScreenAccess(req.user!.id, req.user!.role, next.screenId);
    const startsAt = await validateShowWindow(next, show.id);

    const updated = await prisma.show.update({
      where: { id: show.id },
      data: { ...next, startsAt },
      include: { movie: true, screen: { include: { theater: true } } }
    });
    await logActivity({ actorId: req.user!.id, action: "manager.show.update", entityType: "Show", entityId: show.id });
    await bustCache("movies:*");
    res.json({ show: updated });
  })
);

managerRouter.delete(
  "/shows/:id",
  asyncHandler(async (req, res) => {
    const show = await assertShowCanBeChanged(String(req.params.id), req.user!.id, req.user!.role);
    await prisma.show.delete({ where: { id: show.id } });
    await logActivity({ actorId: req.user!.id, action: "manager.show.delete", entityType: "Show", entityId: show.id });
    await bustCache("movies:*");
    res.status(204).send();
  })
);

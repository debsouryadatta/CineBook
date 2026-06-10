import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { bustCache } from "../config/redis.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { logActivity } from "../services/activityLog.js";
import { getShowtimeEndAt, isWithinSchedulingWindow, showtimesOverlap } from "../services/showtimeUtils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [users, movies, shows, bookings, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.movie.count(),
      prisma.show.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { totalAmount: true } })
    ]);
    res.json({ users, movies, shows, bookings, revenue: revenue._sum.totalAmount ?? 0 });
  })
);

adminRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    const [movies, screens] = await Promise.all([
      prisma.movie.findMany({
        orderBy: { title: "asc" },
        select: { id: true, title: true, slug: true }
      }),
      prisma.screen.findMany({
        orderBy: [{ theater: { city: "asc" } }, { theater: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          theater: { select: { id: true, name: true, city: true } }
        }
      })
    ]);

    res.json({ movies, screens });
  })
);

adminRouter.get(
  "/bookings",
  asyncHandler(async (_req, res) => {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { select: { id: true, name: true, email: true } },
        show: {
          include: {
            movie: { select: { id: true, title: true, slug: true } },
            screen: { include: { theater: true } }
          }
        },
        seats: { include: { seat: true } }
      }
    });

    res.json({ bookings });
  })
);

const movieSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  synopsis: z.string().min(1),
  language: z.string().min(1),
  genre: z.string().min(1),
  rating: z.string().min(1),
  durationMin: z.number().int().positive(),
  posterUrl: z.string().url(),
  backdropUrl: z.string().url(),
  trailerUrl: z.string().url().optional(),
  cast: z.array(z.string()).default([]),
  releaseDate: z.string().datetime()
});

const showSchema = z.object({
  movieId: z.string().min(1),
  screenId: z.string().min(1),
  startsAt: z.string().datetime(),
  basePrice: z.number().int().positive()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(Role).optional(),
  disabled: z.boolean().optional(),
  screenIds: z.array(z.string().min(1)).optional()
});

const theaterSchema = z.object({
  chain: z.string().min(1).default("CineBook"),
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1)
});

const screenSchema = z.object({
  theaterId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1).default("Standard"),
  format: z.string().min(1).default("2D"),
  equipment: z.array(z.string()).default([]),
  rows: z.number().int().min(1).max(12).default(6),
  seatsPerRow: z.number().int().min(1).max(20).default(10)
});

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerified: true,
        role: true,
        disabled: true,
        managedScreens: { include: { screen: { include: { theater: true } } } },
        createdAt: true
      }
    });

    res.json({ users });
  })
);

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    const userId = String(req.params.id);

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          name: input.name,
          role: input.role,
          disabled: input.disabled
        },
        select: { id: true, name: true, email: true, role: true, disabled: true }
      });

      if (input.screenIds) {
        await tx.screenManager.deleteMany({ where: { userId } });
        if (input.role === Role.HALL_MANAGER || updated.role === Role.HALL_MANAGER) {
          await tx.screenManager.createMany({
            data: input.screenIds.map((screenId) => ({ userId, screenId })),
            skipDuplicates: true
          });
        }
      }

      return updated;
    });

    await logActivity({ actorId: req.user!.id, action: "admin.user.update", entityType: "User", entityId: user.id, metadata: input });
    res.json({ user });
  })
);

adminRouter.get(
  "/theaters",
  asyncHandler(async (_req, res) => {
    const theaters = await prisma.theater.findMany({ include: { screens: true }, orderBy: [{ city: "asc" }, { name: "asc" }] });
    res.json({ theaters });
  })
);

adminRouter.post(
  "/theaters",
  asyncHandler(async (req, res) => {
    const input = theaterSchema.parse(req.body);
    const theater = await prisma.theater.create({ data: input });
    await logActivity({ actorId: req.user!.id, action: "admin.theater.create", entityType: "Theater", entityId: theater.id });
    await bustCache("movies:*");
    res.status(201).json({ theater });
  })
);

adminRouter.post(
  "/screens",
  asyncHandler(async (req, res) => {
    const input = screenSchema.parse(req.body);
    const screen = await prisma.screen.create({
      data: {
        theaterId: input.theaterId,
        name: input.name,
        type: input.type,
        format: input.format,
        equipment: input.equipment,
        seats: {
          create: Array.from({ length: input.rows }).flatMap((_, rowIndex) => {
            const row = String.fromCharCode(65 + rowIndex);
            const type = rowIndex === 0 ? "Front Row" : rowIndex >= input.rows - 1 ? "Recliner" : rowIndex >= input.rows - 2 ? "Premium" : "Standard";
            const priceModifier = type === "Front Row" ? -60 : type === "Premium" ? 120 : type === "Recliner" ? 240 : 0;
            return Array.from({ length: input.seatsPerRow }).map((__, seatIndex) => ({
              row,
              number: seatIndex + 1,
              type,
              priceModifier
            }));
          })
        }
      },
      include: { theater: true, seats: true }
    });

    await logActivity({ actorId: req.user!.id, action: "admin.screen.create", entityType: "Screen", entityId: screen.id });
    await bustCache("movies:*");
    res.status(201).json({ screen });
  })
);

adminRouter.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const starts = {
      daily: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      weekly: new Date(now.getTime() - 7 * 24 * 60 * 60_000),
      monthly: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    const entries = await Promise.all(
      Object.entries(starts).map(async ([period, since]) => {
        const [bookings, revenue] = await Promise.all([
          prisma.booking.count({ where: { createdAt: { gte: since } } }),
          prisma.booking.aggregate({ where: { createdAt: { gte: since } }, _sum: { totalAmount: true } })
        ]);
        return [period, { bookings, revenue: revenue._sum.totalAmount ?? 0, since }] as const;
      })
    );

    res.json({ reports: Object.fromEntries(entries) });
  })
);

adminRouter.get(
  "/activity",
  asyncHandler(async (_req, res) => {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } }
    });
    res.json({ logs });
  })
);

adminRouter.post(
  "/movies",
  asyncHandler(async (req, res) => {
    const input = movieSchema.parse(req.body);
    const movie = await prisma.movie.create({
      data: { ...input, releaseDate: new Date(input.releaseDate) }
    });
    await logActivity({ actorId: req.user!.id, action: "admin.movie.create", entityType: "Movie", entityId: movie.id });
    await bustCache("movies:*");
    res.status(201).json({ movie });
  })
);

adminRouter.post(
  "/shows",
  asyncHandler(async (req, res) => {
    const input = showSchema.parse(req.body);
    const startsAt = new Date(input.startsAt);

    if (startsAt <= new Date()) throw new AppError(400, "Showtime must be in the future");
    if (!isWithinSchedulingWindow(startsAt)) throw new AppError(400, "Shows can only be scheduled up to 30 days ahead");

    const [movie, screen] = await Promise.all([
      prisma.movie.findUnique({ where: { id: input.movieId }, select: { id: true, durationMin: true } }),
      prisma.screen.findUnique({ where: { id: input.screenId }, select: { id: true } }),
    ]);

    if (!movie || !screen) throw new AppError(400, "Invalid movie or screen");

    const endsAt = getShowtimeEndAt({ startsAt, durationMin: movie.durationMin, cleaningBufferMin: 30 });
    const nearbyShows = await prisma.show.findMany({
      where: {
        screenId: input.screenId,
        startsAt: {
          lt: endsAt
        }
      },
      select: {
        id: true,
        startsAt: true,
        movie: { select: { durationMin: true } }
      }
    });

    const overlappingShow = nearbyShows.find((item) => {
      return showtimesOverlap(
        { startsAt, durationMin: movie.durationMin, cleaningBufferMin: 30 },
        { startsAt: item.startsAt, durationMin: item.movie.durationMin, cleaningBufferMin: 30 }
      );
    });

    if (overlappingShow) throw new AppError(409, "A show already overlaps on that screen or cleaning buffer");

    const show = await prisma.show.create({
      data: {
        movieId: input.movieId,
        screenId: input.screenId,
        startsAt,
        basePrice: input.basePrice
      },
      include: {
        movie: { select: { id: true, title: true, slug: true } },
        screen: { include: { theater: true } }
      }
    });

    await bustCache("movies:*");
    await logActivity({ actorId: req.user!.id, action: "admin.show.create", entityType: "Show", entityId: show.id });
    res.status(201).json({ show });
  })
);

import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { getCached, setCached } from "../config/redis.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const moviesRouter = Router();

moviesRouter.get(
  "/meta/cities",
  asyncHandler(async (_req, res) => {
    const [theaters, movies, screens] = await Promise.all([
      prisma.theater.findMany({
        distinct: ["city"],
        select: { city: true, chain: true },
        orderBy: { city: "asc" }
      }),
      prisma.movie.findMany({ select: { genre: true, language: true, rating: true } }),
      prisma.screen.findMany({ select: { type: true, format: true } })
    ]);
    res.json({
      cities: Array.from(new Set(theaters.map((theater) => theater.city))).sort(),
      chains: Array.from(new Set(theaters.map((theater) => theater.chain))).sort(),
      genres: Array.from(new Set(movies.map((movie) => movie.genre))).sort(),
      languages: Array.from(new Set(movies.map((movie) => movie.language))).sort(),
      ratings: Array.from(new Set(movies.map((movie) => movie.rating))).sort(),
      screenTypes: Array.from(new Set(screens.map((screen) => screen.type))).sort(),
      formats: Array.from(new Set(screens.map((screen) => screen.format))).sort()
    });
  })
);

moviesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const city = String(req.query.city ?? "");
    const q = String(req.query.q ?? "");
    const genre = String(req.query.genre ?? "");
    const language = String(req.query.language ?? "");
    const rating = String(req.query.rating ?? "");
    const chain = String(req.query.chain ?? "");
    const screenType = String(req.query.screenType ?? "");
    const format = String(req.query.format ?? "");
    const releaseDate = String(req.query.releaseDate ?? "");
    const cacheKey = `movies:${city}:${q}:${genre}:${language}:${rating}:${chain}:${screenType}:${format}:${releaseDate}`;
    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const showFilter = {
      startsAt: { gte: new Date() },
      screen: {
        ...(screenType ? { type: { equals: screenType, mode: "insensitive" as const } } : {}),
        ...(format ? { format: { equals: format, mode: "insensitive" as const } } : {}),
        theater: {
          ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
          ...(chain ? { chain: { equals: chain, mode: "insensitive" as const } } : {})
        }
      }
    };

    const movies = await prisma.movie.findMany({
      where: {
        title: q ? { contains: q, mode: "insensitive" } : undefined,
        genre: genre ? { equals: genre, mode: "insensitive" } : undefined,
        language: language ? { equals: language, mode: "insensitive" } : undefined,
        rating: rating ? { equals: rating, mode: "insensitive" } : undefined,
        releaseDate: releaseDate ? { gte: new Date(`${releaseDate}T00:00:00.000Z`) } : undefined,
        shows: { some: showFilter }
      },
      orderBy: { releaseDate: "desc" },
      include: {
        shows: {
          where: showFilter,
          select: { id: true },
          take: 1
        }
      }
    });

    const payload = { movies };
    await setCached(cacheKey, payload, 90);
    res.json(payload);
  })
);

moviesRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const movie = await prisma.movie.findUnique({
      where: { slug },
      include: {
        shows: {
          where: { startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          include: {
            screen: { include: { theater: true } }
          }
        }
      }
    });
    if (!movie) throw new AppError(404, "Movie not found");
    res.json({ movie });
  })
);

import { BookingStatus, PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";
import { createBooking } from "./bookingService.js";
import { logActivity } from "./activityLog.js";
import { getOpenAIClient, OPENAI_MODEL } from "./openai.js";
import { processPayment } from "./paymentService.js";
import { createSeatHold, expireSeatHolds, releaseSeatHolds } from "./seatHoldService.js";

type ChatToolName =
  | "search_movies"
  | "get_movie_details"
  | "get_cast_info"
  | "get_reviews"
  | "get_showtimes"
  | "suggest_similar_movies"
  | "show_trending"
  | "show_upcoming"
  | "list_languages"
  | "list_genres"
  | "find_theatres"
  | "get_screen_info"
  | "check_seat_availability"
  | "hold_seats"
  | "release_seats"
  | "create_booking"
  | "check_booking_status"
  | "cancel_booking"
  | "view_booking_history"
  | "start_payment"
  | "confirm_payment"
  | "apply_promo_code"
  | "update_preferences"
  | "contact_support"
  | "personalized_recommendations";

type ChatInput = {
  userId: string;
  message: string;
  conversationId?: string;
};

type ChatToolArgs = {
  query?: string | null;
  movieId?: string | null;
  movieTitle?: string | null;
  showId?: string | null;
  city?: string | null;
  theaterChain?: string | null;
  theaterName?: string | null;
  screenType?: string | null;
  format?: string | null;
  language?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  date?: string | null;
  timeOfDay?: "morning" | "afternoon" | "evening" | "night" | null;
  seatType?: string | null;
  seatIds?: string[] | null;
  holdIds?: string[] | null;
  bookingId?: string | null;
  cardNumber?: string | null;
  promoCode?: string | null;
  people?: number | null;
  preferenceKey?: string | null;
  preferenceValue?: string | null;
  issue?: string | null;
  mood?: string | null;
};

type ToolExecutionContext = {
  userId: string;
  conversationId: string;
  conversationContext: Record<string, unknown>;
};

type ExecutedTool = {
  name: ChatToolName;
  args: ChatToolArgs;
  result: unknown;
};

export type PublicExecutedChatTool = {
  toolName: ChatToolName;
  toolDescription: string;
  args: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
};

export type ChatStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "assistant_mode"; assistantMode: string }
  | { type: "tool_start"; tool: Omit<PublicExecutedChatTool, "result"> }
  | { type: "tool_result"; tool: PublicExecutedChatTool }
  | { type: "message_delta"; delta: string }
  | { type: "message_done"; conversationId: string; assistantMode: string; tools: PublicExecutedChatTool[]; message: string };

type ChatOptions = {
  onEvent?: (event: ChatStreamEvent) => void | Promise<void>;
};

type ToolHandler = (args: ChatToolArgs, context: ToolExecutionContext) => Promise<unknown>;

type CineBookToolDefinition = {
  toolName: ChatToolName;
  toolDescription: string;
  toolParameters: z.ZodTypeAny;
  execute: ToolHandler;
};

export type PublicChatToolDefinition = {
  toolName: ChatToolName;
  toolDescription: string;
  toolParameters: Record<string, unknown>;
};

type MovieWithShows = Prisma.MovieGetPayload<{
  include: {
    shows: {
      include: {
        screen: {
          include: {
            theater: true;
          };
        };
      };
    };
  };
}>;

type ShowWithDetails = Prisma.ShowGetPayload<{
  include: {
    movie: true;
    screen: {
      include: {
        theater: true;
      };
    };
  };
}>;

type BookingWithDetails = Prisma.BookingGetPayload<{
  include: {
    payments: true;
    seats: {
      include: {
        seat: true;
      };
    };
    show: {
      include: {
        movie: true;
        screen: {
          include: {
            theater: true;
          };
        };
      };
    };
  };
}>;

const MAX_TOOL_LOOPS = 8;
const MAX_HISTORY_MESSAGES = 10;

const nullableString = (description: string) => z.string().nullable().describe(description);
const nullableStringArray = (description: string) => z.array(z.string()).nullable().describe(description);
const timeOfDayParameter = z.enum(["morning", "afternoon", "evening", "night"]).nullable().describe("Requested time window.");

const noParameters = z.object({}).strict();

const searchMoviesParameters = z
  .object({
    query: nullableString("Original movie search phrase from the user."),
    movieTitle: nullableString("Specific movie title, when the user named one."),
    genre: nullableString("Genre filter such as Action, Comedy, Drama, Horror, or Sci-Fi."),
    language: nullableString("Language filter."),
    ageRating: nullableString("Age rating filter such as U, UA, UA 13+, UA 16+, or A."),
    date: nullableString("Release or show date as YYYY-MM-DD when possible, or a phrase like today, tomorrow, weekend, or Friday."),
    city: nullableString("City or nearby location requested by the user."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    screenType: nullableString("Screen type such as Standard, IMAX, 4DX, or Dolby Atmos."),
    format: nullableString("Movie format such as 2D or 3D.")
  })
  .strict();

const movieLookupParameters = z
  .object({
    movieId: nullableString("Movie ID from a previous tool result."),
    movieTitle: nullableString("Movie title when the ID is not known."),
    query: nullableString("Natural-language phrase that identifies the movie.")
  })
  .strict();

const similarMoviesParameters = z
  .object({
    movieId: nullableString("Movie ID from a previous tool result."),
    movieTitle: nullableString("Movie title when the ID is not known."),
    query: nullableString("Natural-language phrase that identifies the movie or desired vibe."),
    genre: nullableString("Genre to use for similarity when no movie is selected."),
    language: nullableString("Language to use for similarity when relevant.")
  })
  .strict();

const showtimesParameters = z
  .object({
    movieId: nullableString("Movie ID from a previous tool result."),
    movieTitle: nullableString("Movie title when the ID is not known."),
    query: nullableString("Natural-language showtime request."),
    date: nullableString("Show date as YYYY-MM-DD when possible, or a phrase like today, tomorrow, weekend, or Friday."),
    timeOfDay: timeOfDayParameter,
    city: nullableString("City or nearby location."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    screenType: nullableString("Screen type such as Standard, IMAX, 4DX, or Dolby Atmos."),
    format: nullableString("Movie format such as 2D or 3D."),
    language: nullableString("Movie language."),
    genre: nullableString("Movie genre.")
  })
  .strict();

const theatreSearchParameters = z
  .object({
    movieId: nullableString("Movie ID from a previous tool result."),
    movieTitle: nullableString("Movie title when the ID is not known."),
    query: nullableString("Natural-language theatre request."),
    city: nullableString("City or nearby location."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    date: nullableString("Show date as YYYY-MM-DD when possible."),
    timeOfDay: timeOfDayParameter
  })
  .strict();

const screenInfoParameters = z
  .object({
    showId: nullableString("Known show ID from a previous showtime result."),
    city: nullableString("City or nearby location."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    screenType: nullableString("Screen type such as Standard, IMAX, 4DX, or Dolby Atmos."),
    format: nullableString("Movie format such as 2D or 3D.")
  })
  .strict();

const seatAvailabilityParameters = z
  .object({
    showId: nullableString("Known show ID from a previous showtime result."),
    movieId: nullableString("Movie ID when show ID is not known."),
    movieTitle: nullableString("Movie title when show ID is not known."),
    date: nullableString("Show date as YYYY-MM-DD when possible."),
    timeOfDay: timeOfDayParameter,
    city: nullableString("City or nearby location."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    screenType: nullableString("Screen type such as Standard, IMAX, 4DX, or Dolby Atmos."),
    format: nullableString("Movie format such as 2D or 3D."),
    seatType: nullableString("Seat type such as Front Row, Standard, Premium, or Recliner.")
  })
  .strict();

const holdSeatsParameters = z
  .object({
    showId: nullableString("Known show ID from a previous showtime result."),
    movieId: nullableString("Movie ID when show ID is not known."),
    movieTitle: nullableString("Movie title when show ID is not known."),
    date: nullableString("Show date as YYYY-MM-DD when possible."),
    timeOfDay: timeOfDayParameter,
    city: nullableString("City or nearby location."),
    theaterChain: nullableString("Theatre chain such as PVR, INOX, or Cinepolis."),
    theaterName: nullableString("Specific theatre or cinema name."),
    seatType: nullableString("Seat type such as Front Row, Standard, Premium, or Recliner."),
    seatIds: nullableStringArray("Specific seat IDs selected from check_seat_availability."),
    people: z.number().int().min(1).max(8).nullable().describe("Number of seats to hold.")
  })
  .strict();

const releaseSeatsParameters = z
  .object({
    holdIds: nullableStringArray("Seat hold IDs returned by hold_seats.")
  })
  .strict();

const createBookingParameters = z
  .object({
    showId: nullableString("Known show ID from a previous showtime result."),
    seatIds: nullableStringArray("Seat IDs to book."),
    holdIds: nullableStringArray("Seat hold IDs returned by hold_seats.")
  })
  .strict();

const bookingLookupParameters = z
  .object({
    bookingId: nullableString("Booking ID or confirmation code.")
  })
  .strict();

const confirmPaymentParameters = z
  .object({
    bookingId: nullableString("Booking ID or confirmation code."),
    cardNumber: nullableString("Test card number for simulated payment.")
  })
  .strict();

const promoCodeParameters = z
  .object({
    bookingId: nullableString("Booking ID or confirmation code."),
    promoCode: nullableString("Promo code to validate or apply.")
  })
  .strict();

const preferenceParameters = z
  .object({
    preferenceKey: nullableString("Preference name, such as genre, language, city, timeOfDay, theaterChain, or seatType."),
    preferenceValue: nullableString("Preference value to remember.")
  })
  .strict();

const supportParameters = z
  .object({
    issue: nullableString("Support issue summary."),
    query: nullableString("Original support/help request.")
  })
  .strict();

const recommendationParameters = z
  .object({
    mood: nullableString("Mood or vibe for recommendations."),
    query: nullableString("Natural-language recommendation request."),
    genre: nullableString("Preferred genre."),
    language: nullableString("Preferred language."),
    city: nullableString("Preferred city.")
  })
  .strict();

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contextText(context: Record<string, unknown>, key: string) {
  return nullableText(context[key]);
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nextWeekday(target: number, now = new Date()) {
  const start = startOfDay(now);
  const delta = (target - start.getDay() + 7) % 7 || 7;
  return addDays(start, delta);
}

function dateWindow(input?: string | null) {
  const now = new Date();
  if (!input) return { gte: now };

  const text = input.toLowerCase();
  if (text.includes("today")) return { gte: now, lt: addDays(startOfDay(now), 1) };
  if (text.includes("tomorrow")) {
    const start = addDays(startOfDay(now), 1);
    return { gte: start, lt: addDays(start, 1) };
  }
  if (text.includes("weekend")) {
    const saturday = nextWeekday(6, now);
    return { gte: saturday, lt: addDays(saturday, 2) };
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  const weekday = Object.entries(weekdays).find(([name]) => text.includes(name));
  if (weekday) {
    const start = nextWeekday(weekday[1], now);
    return { gte: start, lt: addDays(start, 1) };
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    const start = startOfDay(parsed);
    return { gte: start, lt: addDays(start, 1) };
  }

  return { gte: now };
}

function matchesTimeOfDay(date: Date, timeOfDay?: ChatToolArgs["timeOfDay"]) {
  if (!timeOfDay) return true;

  const hour = date.getHours();
  if (timeOfDay === "morning") return hour >= 6 && hour < 12;
  if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
  if (timeOfDay === "evening") return hour >= 17 && hour < 22;
  return hour >= 20 || hour < 2;
}

function movieWhere(args: ChatToolArgs, context?: Record<string, unknown>): Prisma.MovieWhereInput {
  const filters: Prisma.MovieWhereInput[] = [];
  const query = args.query ?? args.movieTitle ?? contextText(context ?? {}, "lastMovieTitle");

  if (args.movieId) filters.push({ id: args.movieId });
  if (args.movieTitle) filters.push({ title: { contains: args.movieTitle, mode: "insensitive" } });
  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { synopsis: { contains: query, mode: "insensitive" } },
        { genre: { contains: query, mode: "insensitive" } },
        { language: { contains: query, mode: "insensitive" } }
      ]
    });
  }
  if (args.genre) filters.push({ genre: { contains: args.genre, mode: "insensitive" } });
  if (args.language) filters.push({ language: { contains: args.language, mode: "insensitive" } });
  if (args.ageRating) filters.push({ rating: { contains: args.ageRating, mode: "insensitive" } });

  return filters.length ? { AND: filters } : {};
}

function showWhere(args: ChatToolArgs, context?: Record<string, unknown>): Prisma.ShowWhereInput {
  const window = dateWindow(args.date);
  const filters: Prisma.ShowWhereInput[] = [{ startsAt: window }];
  const movieFilters = movieWhere(args, context);

  if (args.showId) filters.push({ id: args.showId });
  if (Object.keys(movieFilters).length) filters.push({ movie: movieFilters });
  if (args.city) filters.push({ screen: { theater: { city: { contains: args.city, mode: "insensitive" } } } });
  if (args.theaterChain) filters.push({ screen: { theater: { chain: { contains: args.theaterChain, mode: "insensitive" } } } });
  if (args.theaterName) filters.push({ screen: { theater: { name: { contains: args.theaterName, mode: "insensitive" } } } });
  if (args.screenType) filters.push({ screen: { type: { contains: args.screenType, mode: "insensitive" } } });
  if (args.format) filters.push({ screen: { format: { contains: args.format, mode: "insensitive" } } });

  return { AND: filters };
}

function serializeShow(show: ShowWithDetails) {
  return {
    id: show.id,
    startsAt: show.startsAt.toISOString(),
    basePrice: show.basePrice,
    movie: {
      id: show.movie.id,
      title: show.movie.title,
      genre: show.movie.genre,
      language: show.movie.language,
      rating: show.movie.rating,
      durationMin: show.movie.durationMin
    },
    screen: {
      id: show.screen.id,
      name: show.screen.name,
      type: show.screen.type,
      format: show.screen.format,
      equipment: show.screen.equipment
    },
    theater: {
      id: show.screen.theater.id,
      chain: show.screen.theater.chain,
      name: show.screen.theater.name,
      city: show.screen.theater.city,
      address: show.screen.theater.address
    }
  };
}

function serializeMovie(movie: MovieWithShows) {
  return {
    id: movie.id,
    title: movie.title,
    synopsis: movie.synopsis,
    language: movie.language,
    genre: movie.genre,
    rating: movie.rating,
    durationMin: movie.durationMin,
    releaseDate: movie.releaseDate.toISOString(),
    cast: movie.cast,
    posterUrl: movie.posterUrl,
    trailerUrl: movie.trailerUrl,
    upcomingShows: movie.shows.map((show) => serializeShow({ ...show, movie }))
  };
}

function serializeBooking(booking: BookingWithDetails) {
  return {
    id: booking.id,
    confirmationCode: booking.confirmationCode,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
    createdAt: booking.createdAt.toISOString(),
    show: serializeShow(booking.show),
    seats: booking.seats.map((bookingSeat) => ({
      id: bookingSeat.seat.id,
      row: bookingSeat.seat.row,
      number: bookingSeat.seat.number,
      type: bookingSeat.seat.type,
      price: bookingSeat.price,
      active: bookingSeat.active
    })),
    payments: booking.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      transactionId: payment.transactionId,
      cardLast4: payment.cardLast4,
      failureReason: payment.failureReason
    }))
  };
}

async function resolveMovie(args: ChatToolArgs, context: Record<string, unknown>) {
  const id = args.movieId ?? contextText(context, "lastMovieId");
  if (id) {
    const movie = await prisma.movie.findUnique({
      where: { id },
      include: { shows: { where: { startsAt: { gte: new Date() } }, take: 3, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } }
    });
    if (movie) return movie;
  }

  return prisma.movie.findFirst({
    where: movieWhere(args, context),
    include: { shows: { where: { startsAt: { gte: new Date() } }, take: 3, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
    orderBy: { releaseDate: "desc" }
  });
}

async function resolveShow(args: ChatToolArgs, context: Record<string, unknown>) {
  const id = args.showId ?? contextText(context, "lastShowId");
  if (id) {
    const show = await prisma.show.findUnique({
      where: { id },
      include: { movie: true, screen: { include: { theater: true } } }
    });
    if (show) return show;
  }

  const shows = await prisma.show.findMany({
    where: showWhere(args, context),
    include: { movie: true, screen: { include: { theater: true } } },
    orderBy: { startsAt: "asc" },
    take: 12
  });

  return shows.find((show) => matchesTimeOfDay(show.startsAt, args.timeOfDay)) ?? shows[0] ?? null;
}

async function resolveBooking(args: ChatToolArgs, context: ToolExecutionContext) {
  const bookingId = args.bookingId ?? contextText(context.conversationContext, "lastBookingId");
  if (bookingId) {
    const booking = await prisma.booking.findFirst({
      where: {
        userId: context.userId,
        OR: [{ id: bookingId }, { confirmationCode: bookingId }]
      },
      include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
    });
    if (booking) return booking;
  }

  return prisma.booking.findFirst({
    where: { userId: context.userId },
    orderBy: { createdAt: "desc" },
    include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
  });
}

async function seatAvailability(showId: string, seatType?: string | null) {
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

  const booked = new Set(show.bookingSeats.map((seat) => seat.seatId));
  const held = new Set(show.holds.map((hold) => hold.seatId));
  const typeFilter = seatType?.toLowerCase();
  const seats = show.screen.seats
    .filter((seat) => !typeFilter || seat.type.toLowerCase().includes(typeFilter))
    .map((seat) => ({
      id: seat.id,
      row: seat.row,
      number: seat.number,
      type: seat.type,
      price: show.basePrice + seat.priceModifier,
      status: booked.has(seat.id) ? "booked" : held.has(seat.id) ? "held" : "available"
    }));

  const summary = seats.reduce<Record<string, { available: number; held: number; booked: number }>>((acc, seat) => {
    acc[seat.type] ??= { available: 0, held: 0, booked: 0 };
    acc[seat.type][seat.status as "available" | "held" | "booked"] += 1;
    return acc;
  }, {});

  return {
    show: serializeShow(show),
    summary,
    seats,
    availableSeats: seats.filter((seat) => seat.status === "available")
  };
}

const handlers: Record<ChatToolName, ToolHandler> = {
  async search_movies(args, context) {
    const showsFilter: Prisma.ShowWhereInput = { startsAt: { gte: new Date() } };
    const movies = await prisma.movie.findMany({
      where: {
        ...movieWhere(args, context.conversationContext),
        shows:
          args.city || args.theaterChain || args.theaterName || args.screenType || args.format
            ? {
                some: {
                  ...showsFilter,
                  screen: {
                    ...(args.screenType ? { type: { contains: args.screenType, mode: "insensitive" } } : {}),
                    ...(args.format ? { format: { contains: args.format, mode: "insensitive" } } : {}),
                    theater: {
                      ...(args.city ? { city: { contains: args.city, mode: "insensitive" } } : {}),
                      ...(args.theaterChain ? { chain: { contains: args.theaterChain, mode: "insensitive" } } : {}),
                      ...(args.theaterName ? { name: { contains: args.theaterName, mode: "insensitive" } } : {})
                    }
                  }
                }
              }
            : undefined
      },
      include: { shows: { where: showsFilter, take: 3, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
      orderBy: { releaseDate: "desc" },
      take: 6
    });

    return { status: "ok", movies: movies.map(serializeMovie) };
  },

  async get_movie_details(args, context) {
    const movie = await resolveMovie(args, context.conversationContext);
    return movie ? { status: "ok", movie: serializeMovie(movie) } : { status: "not_found", message: "No matching movie was found." };
  },

  async get_cast_info(args, context) {
    const movie = await resolveMovie(args, context.conversationContext);
    return movie ? { status: "ok", movieId: movie.id, title: movie.title, cast: movie.cast } : { status: "not_found", message: "No matching movie was found." };
  },

  async get_reviews(args, context) {
    const movie = await resolveMovie(args, context.conversationContext);
    if (!movie) return { status: "not_found", message: "No matching movie was found." };

    return {
      status: "ok",
      movieId: movie.id,
      title: movie.title,
      sentiment: "positive",
      summary: `${movie.title} is trending well in this demo catalog. Viewers looking for ${movie.genre} in ${movie.language} are likely to enjoy it.`,
      note: "This assignment database does not include a reviews table, so this is a generated catalog sentiment summary."
    };
  },

  async get_showtimes(args, context) {
    const shows = await prisma.show.findMany({
      where: showWhere(args, context.conversationContext),
      include: { movie: true, screen: { include: { theater: true } } },
      orderBy: { startsAt: "asc" },
      take: 20
    });
    const filtered = shows.filter((show) => matchesTimeOfDay(show.startsAt, args.timeOfDay)).slice(0, 8);
    return { status: "ok", shows: filtered.map(serializeShow) };
  },

  async suggest_similar_movies(args, context) {
    const movie = await resolveMovie(args, context.conversationContext);
    const genre = args.genre ?? movie?.genre;
    const language = args.language ?? movie?.language;
    const movies = await prisma.movie.findMany({
      where: {
        id: movie ? { not: movie.id } : undefined,
        ...(genre ? { genre: { contains: genre, mode: "insensitive" } } : {}),
        ...(language ? { language: { contains: language, mode: "insensitive" } } : {})
      },
      include: { shows: { where: { startsAt: { gte: new Date() } }, take: 2, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
      take: 5
    });
    return { status: "ok", basedOn: movie ? { id: movie.id, title: movie.title } : null, movies: movies.map(serializeMovie) };
  },

  async show_trending() {
    const movies = await prisma.movie.findMany({
      include: {
        shows: { where: { startsAt: { gte: new Date() } }, take: 3, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } },
        _count: { select: { shows: true } }
      },
      orderBy: { shows: { _count: "desc" } },
      take: 6
    });

    return {
      status: "ok",
      movies: movies.map((movie) => ({
        ...serializeMovie(movie),
        popularitySignal: `${movie._count.shows} scheduled show(s)`
      }))
    };
  },

  async show_upcoming(args) {
    const window = dateWindow(args.date);
    const movies = await prisma.movie.findMany({
      where: {
        releaseDate: window,
        ...(args.genre ? { genre: { contains: args.genre, mode: "insensitive" } } : {}),
        ...(args.language ? { language: { contains: args.language, mode: "insensitive" } } : {}),
        ...(args.ageRating ? { rating: { contains: args.ageRating, mode: "insensitive" } } : {})
      },
      include: { shows: { where: { startsAt: { gte: new Date() } }, take: 2, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
      orderBy: { releaseDate: "asc" },
      take: 6
    });
    return { status: "ok", movies: movies.map(serializeMovie) };
  },

  async list_languages() {
    const movies = await prisma.movie.findMany({ select: { language: true }, orderBy: { language: "asc" } });
    return { status: "ok", languages: Array.from(new Set(movies.map((movie) => movie.language))).sort() };
  },

  async list_genres() {
    const movies = await prisma.movie.findMany({ select: { genre: true }, orderBy: { genre: "asc" } });
    return { status: "ok", genres: Array.from(new Set(movies.map((movie) => movie.genre))).sort() };
  },

  async find_theatres(args, context) {
    const shows = await prisma.show.findMany({
      where: showWhere(args, context.conversationContext),
      include: { movie: true, screen: { include: { theater: true } } },
      orderBy: { startsAt: "asc" },
      take: 30
    });

    const theatres = new Map<string, ReturnType<typeof serializeShow>["theater"] & { nextShows: ReturnType<typeof serializeShow>[] }>();
    for (const show of shows.filter((item) => matchesTimeOfDay(item.startsAt, args.timeOfDay))) {
      const serialized = serializeShow(show);
      const existing = theatres.get(serialized.theater.id);
      if (existing) {
        if (existing.nextShows.length < 3) existing.nextShows.push(serialized);
      } else {
        theatres.set(serialized.theater.id, { ...serialized.theater, nextShows: [serialized] });
      }
    }

    return { status: "ok", theatres: Array.from(theatres.values()).slice(0, 8) };
  },

  async get_screen_info(args, context) {
    const show = await resolveShow(args, context.conversationContext);
    if (show) {
      const availability = await seatAvailability(show.id);
      return {
        status: "ok",
        show: availability.show,
        screen: availability.show.screen,
        theater: availability.show.theater,
        seatSummary: availability.summary
      };
    }

    const screens = await prisma.screen.findMany({
      where: {
        ...(args.screenType ? { type: { contains: args.screenType, mode: "insensitive" } } : {}),
        ...(args.format ? { format: { contains: args.format, mode: "insensitive" } } : {}),
        theater: {
          ...(args.city ? { city: { contains: args.city, mode: "insensitive" } } : {}),
          ...(args.theaterChain ? { chain: { contains: args.theaterChain, mode: "insensitive" } } : {}),
          ...(args.theaterName ? { name: { contains: args.theaterName, mode: "insensitive" } } : {})
        }
      },
      include: { theater: true, _count: { select: { seats: true } } },
      take: 8
    });

    return {
      status: "ok",
      screens: screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        format: screen.format,
        equipment: screen.equipment,
        seatCount: screen._count.seats,
        theater: screen.theater
      }))
    };
  },

  async check_seat_availability(args, context) {
    const show = await resolveShow(args, context.conversationContext);
    if (!show) return { status: "needs_input", message: "Ask the user to choose a show before checking seats." };

    const availability = await seatAvailability(show.id, args.seatType);
    return {
      status: "ok",
      show: availability.show,
      summary: availability.summary,
      availableSeats: availability.availableSeats.slice(0, 30),
      heldOrBookedSeats: availability.seats.filter((seat) => seat.status !== "available").slice(0, 30)
    };
  },

  async hold_seats(args, context) {
    const show = await resolveShow(args, context.conversationContext);
    if (!show) return { status: "needs_input", message: "Ask the user to choose a show before holding seats." };

    const requestedCount = args.people ?? 1;
    let seatIds = args.seatIds ?? [];
    if (!seatIds.length) {
      const availability = await seatAvailability(show.id, args.seatType);
      seatIds = availability.availableSeats.slice(0, requestedCount).map((seat) => seat.id);
    }
    if (!seatIds.length) return { status: "not_available", message: "No matching seats are currently available for this show." };

    const result = await createSeatHold({ showId: show.id, seatIds, userId: context.userId });
    return {
      status: "ok",
      show: serializeShow(show),
      expiresAt: result.expiresAt.toISOString(),
      holds: result.holds.map((hold) => ({
        id: hold.id,
        seatId: hold.seatId,
        row: hold.seat.row,
        number: hold.seat.number,
        type: hold.seat.type,
        expiresAt: hold.expiresAt.toISOString()
      }))
    };
  },

  async release_seats(args, context) {
    const holdIds = args.holdIds?.length ? args.holdIds : toStringArray(context.conversationContext.lastHoldIds);
    if (!holdIds.length) return { status: "needs_input", message: "Ask which held seats should be released." };

    const result = await releaseSeatHolds({ holdIds, userId: context.userId });
    return { status: "ok", ...result, holdIds };
  },

  async create_booking(args, context) {
    let showId = args.showId ?? contextText(context.conversationContext, "lastShowId");
    let seatIds = args.seatIds ?? [];
    let holdIds = args.holdIds ?? toStringArray(context.conversationContext.lastHoldIds);

    if ((!seatIds.length || !showId) && holdIds.length) {
      const holds = await prisma.seatHold.findMany({
        where: { id: { in: holdIds }, userId: context.userId, active: true, expiresAt: { gt: new Date() } },
        include: { seat: true },
        orderBy: { createdAt: "asc" }
      });
      seatIds = holds.map((hold) => hold.seatId);
      showId ??= holds[0]?.showId;
      holdIds = holds.map((hold) => hold.id);
    }

    if (!showId || !seatIds.length) return { status: "needs_input", message: "Ask the user to select or hold seats before creating a booking." };

    const booking = await createBooking({ showId, seatIds, holdIds, userId: context.userId });
    const detailed = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
    });
    return detailed ? { status: "ok", booking: serializeBooking(detailed) } : { status: "ok", bookingId: booking.id };
  },

  async check_booking_status(args, context) {
    const booking = await resolveBooking(args, context);
    return booking ? { status: "ok", booking: serializeBooking(booking) } : { status: "not_found", message: "No matching booking was found." };
  },

  async cancel_booking(args, context) {
    const booking = await resolveBooking(args, context);
    if (!booking) return { status: "not_found", message: "No matching booking was found." };
    if (booking.status === BookingStatus.CANCELLED) return { status: "already_cancelled", booking: serializeBooking(booking) };
    if (booking.show.startsAt <= new Date()) return { status: "not_allowed", message: "Past shows cannot be cancelled." };

    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.bookingSeat.updateMany({ where: { bookingId: booking.id }, data: { active: false } });
      await tx.payment.updateMany({ where: { bookingId: booking.id, status: PaymentStatus.SUCCEEDED }, data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() } });
      return tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.REFUNDED },
        include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
      });
    });

    return { status: "ok", booking: serializeBooking(cancelled) };
  },

  async view_booking_history(_args, context) {
    const bookings = await prisma.booking.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
    });
    return { status: "ok", bookings: bookings.map(serializeBooking) };
  },

  async start_payment(args, context) {
    const booking = await resolveBooking(args, context);
    if (!booking) return { status: "needs_input", message: "Ask the user which booking they want to pay for." };
    if (booking.paymentStatus === PaymentStatus.SUCCEEDED) return { status: "already_paid", booking: serializeBooking(booking) };

    return {
      status: "ok",
      booking: serializeBooking(booking),
      testCards: {
        success: "4242424242424242",
        failure: "4000000000000002",
        randomFailure: "4000000000003000"
      }
    };
  },

  async confirm_payment(args, context) {
    const booking = await resolveBooking(args, context);
    if (!booking) return { status: "needs_input", message: "Ask the user which booking they want to pay for." };
    if (!args.cardNumber) return { status: "needs_input", message: "Ask for a test card number before confirming payment." };

    const result = await processPayment({ bookingId: booking.id, userId: context.userId, cardNumber: args.cardNumber });
    const detailed = await prisma.booking.findUnique({
      where: { id: result.booking.id },
      include: { payments: true, seats: { include: { seat: true } }, show: { include: { movie: true, screen: { include: { theater: true } } } } }
    });

    return {
      status: "ok",
      payment: {
        id: result.payment.id,
        status: result.payment.status,
        amount: result.payment.amount,
        transactionId: result.payment.transactionId,
        cardLast4: result.payment.cardLast4
      },
      booking: detailed ? serializeBooking(detailed) : null
    };
  },

  async apply_promo_code(args, context) {
    const code = (args.promoCode ?? "CINE10").toUpperCase();
    const booking = await resolveBooking(args, context);
    const discountPercent = code === "CINE10" ? 10 : 0;
    const discountAmount = booking && discountPercent ? Math.round((booking.totalAmount * discountPercent) / 100) : 0;

    return {
      status: discountPercent ? "ok" : "invalid",
      promoCode: code,
      discountPercent,
      discountAmount,
      payableAmount: booking ? Math.max(booking.totalAmount - discountAmount, 0) : null,
      message: discountPercent ? "CINE10 applies a simulated 10% discount during checkout." : "That promo code is not active in this demo."
    };
  },

  async update_preferences(args) {
    if (!args.preferenceKey || !args.preferenceValue) return { status: "needs_input", message: "Ask what preference should be remembered." };
    return { status: "ok", preference: { key: args.preferenceKey, value: args.preferenceValue } };
  },

  async contact_support(args) {
    const ticketId = `SUP-${Date.now().toString(36).toUpperCase()}`;
    return {
      status: "ok",
      ticketId,
      issue: args.issue ?? args.query ?? "Customer requested help from the chatbot.",
      message: "A simulated support request has been created for the assignment demo."
    };
  },

  async personalized_recommendations(args, context) {
    const genre = args.genre ?? contextText(context.conversationContext, "preferredGenre");
    const language = args.language ?? contextText(context.conversationContext, "preferredLanguage");
    const city = args.city ?? contextText(context.conversationContext, "preferredCity");
    const mood = args.mood ?? args.query ?? "movie night";

    const movies = await prisma.movie.findMany({
      where: {
        ...(genre ? { genre: { contains: genre, mode: "insensitive" } } : {}),
        ...(language ? { language: { contains: language, mode: "insensitive" } } : {}),
        shows: {
          some: {
            startsAt: { gte: new Date() },
            ...(city ? { screen: { theater: { city: { contains: city, mode: "insensitive" } } } } : {})
          }
        }
      },
      include: { shows: { where: { startsAt: { gte: new Date() } }, take: 2, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
      take: 5
    });

    return {
      status: "ok",
      mood,
      recommendations: movies.map((movie) => ({
        movie: serializeMovie(movie),
        reason: `${movie.genre} in ${movie.language} fits ${mood}.`
      }))
    };
  }
};

const CINEBOOK_TOOL_DEFINITIONS: CineBookToolDefinition[] = [
  {
    toolName: "search_movies",
    toolDescription: "Find movies matching filters such as title, genre, language, rating, release date, format, chain, city, or screen type.",
    toolParameters: searchMoviesParameters,
    execute: handlers.search_movies
  },
  {
    toolName: "get_movie_details",
    toolDescription: "Fetch full catalog information for a specific movie when the user asks about synopsis, runtime, rating, release date, language, or trailers.",
    toolParameters: movieLookupParameters,
    execute: handlers.get_movie_details
  },
  {
    toolName: "get_cast_info",
    toolDescription: "Return cast information for a specific movie.",
    toolParameters: movieLookupParameters,
    execute: handlers.get_cast_info
  },
  {
    toolName: "get_reviews",
    toolDescription: "Summarize audience sentiment for a movie. Use this when the user asks about reviews, ratings, or whether a movie is worth watching.",
    toolParameters: movieLookupParameters,
    execute: handlers.get_reviews
  },
  {
    toolName: "get_showtimes",
    toolDescription: "List upcoming shows for a movie, date, time of day, city, theatre chain, screen type, format, or language.",
    toolParameters: showtimesParameters,
    execute: handlers.get_showtimes
  },
  {
    toolName: "suggest_similar_movies",
    toolDescription: "Suggest catalog alternatives similar to a chosen movie or genre.",
    toolParameters: similarMoviesParameters,
    execute: handlers.suggest_similar_movies
  },
  {
    toolName: "show_trending",
    toolDescription: "Show popular movies based on upcoming shows and booking activity.",
    toolParameters: noParameters,
    execute: handlers.show_trending
  },
  {
    toolName: "show_upcoming",
    toolDescription: "Show upcoming releases, optionally filtered by date, genre, language, or age rating.",
    toolParameters: searchMoviesParameters,
    execute: handlers.show_upcoming
  },
  {
    toolName: "list_languages",
    toolDescription: "List the languages currently available in the movie catalog.",
    toolParameters: noParameters,
    execute: handlers.list_languages
  },
  {
    toolName: "list_genres",
    toolDescription: "List the genres currently available in the movie catalog.",
    toolParameters: noParameters,
    execute: handlers.list_genres
  },
  {
    toolName: "find_theatres",
    toolDescription: "Find theatres or theatre chains that match a movie, city, location, or chain request.",
    toolParameters: theatreSearchParameters,
    execute: handlers.find_theatres
  },
  {
    toolName: "get_screen_info",
    toolDescription: "Describe screen type, format, equipment, theatre, and seat layout details.",
    toolParameters: screenInfoParameters,
    execute: handlers.get_screen_info
  },
  {
    toolName: "check_seat_availability",
    toolDescription: "Check available, held, and booked seats for a specific show, optionally filtered by seat type.",
    toolParameters: seatAvailabilityParameters,
    execute: handlers.check_seat_availability
  },
  {
    toolName: "hold_seats",
    toolDescription: "Place a 5-minute hold on selected seats, or pick the best available seats for the requested show, people count, and seat type.",
    toolParameters: holdSeatsParameters,
    execute: handlers.hold_seats
  },
  {
    toolName: "release_seats",
    toolDescription: "Release an active temporary seat hold.",
    toolParameters: releaseSeatsParameters,
    execute: handlers.release_seats
  },
  {
    toolName: "create_booking",
    toolDescription: "Create a pending booking from selected or currently held seats.",
    toolParameters: createBookingParameters,
    execute: handlers.create_booking
  },
  {
    toolName: "check_booking_status",
    toolDescription: "Check confirmation, payment, show, and seat status for a booking.",
    toolParameters: bookingLookupParameters,
    execute: handlers.check_booking_status
  },
  {
    toolName: "cancel_booking",
    toolDescription: "Cancel a user's future booking and refund successful simulated payments.",
    toolParameters: bookingLookupParameters,
    execute: handlers.cancel_booking
  },
  {
    toolName: "view_booking_history",
    toolDescription: "Show the user's recent bookings.",
    toolParameters: noParameters,
    execute: handlers.view_booking_history
  },
  {
    toolName: "start_payment",
    toolDescription: "Begin checkout for a booking and explain supported test cards.",
    toolParameters: bookingLookupParameters,
    execute: handlers.start_payment
  },
  {
    toolName: "confirm_payment",
    toolDescription: "Process a simulated card payment for a booking.",
    toolParameters: confirmPaymentParameters,
    execute: handlers.confirm_payment
  },
  {
    toolName: "apply_promo_code",
    toolDescription: "Apply or validate a promo code such as CINE10 for checkout.",
    toolParameters: promoCodeParameters,
    execute: handlers.apply_promo_code
  },
  {
    toolName: "update_preferences",
    toolDescription: "Remember user preferences such as genre, language, city, time of day, theatre chain, or seat type.",
    toolParameters: preferenceParameters,
    execute: handlers.update_preferences
  },
  {
    toolName: "contact_support",
    toolDescription: "Create a simulated support request for booking, payment, account, or app issues.",
    toolParameters: supportParameters,
    execute: handlers.contact_support
  },
  {
    toolName: "personalized_recommendations",
    toolDescription: "Recommend movies from the live catalog using the user's mood, stated preferences, and conversation context.",
    toolParameters: recommendationParameters,
    execute: handlers.personalized_recommendations
  }
];

function toOpenAIChatTool(tool: CineBookToolDefinition): ChatCompletionTool {
  return zodFunction({
    name: tool.toolName,
    description: `${tool.toolDescription} Use IDs returned by earlier tools whenever available.`,
    parameters: tool.toolParameters
  }) as ChatCompletionTool;
}

export const OPENAI_CHAT_TOOLS: ChatCompletionTool[] = CINEBOOK_TOOL_DEFINITIONS.map(toOpenAIChatTool);

function publicTool(tool: CineBookToolDefinition): PublicChatToolDefinition {
  return {
    toolName: tool.toolName,
    toolDescription: tool.toolDescription,
    toolParameters: (toOpenAIChatTool(tool).function.parameters ?? {}) as Record<string, unknown>
  };
}

export const CINEBOOK_TOOLS: PublicChatToolDefinition[] = CINEBOOK_TOOL_DEFINITIONS.map(publicTool);

function toolDefinition(name: string) {
  return CINEBOOK_TOOL_DEFINITIONS.find((tool) => tool.toolName === name);
}

function publicExecutedTool(tool: ExecutedTool): PublicExecutedChatTool {
  const definition = toolDefinition(tool.name);
  return {
    toolName: tool.name,
    toolDescription: definition?.toolDescription ?? "CineBook assistant tool",
    args: asJson(tool.args),
    result: asJson(tool.result)
  };
}

async function emitMessageDeltas(message: string, options?: ChatOptions) {
  if (!options?.onEvent) return;
  const chunks = message.match(/.{1,42}(?:\s|$)/g) ?? [message];
  for (const chunk of chunks) {
    await options.onEvent({ type: "message_delta", delta: chunk });
  }
}

async function executeToolCall(name: string, rawArguments: string | undefined, context: ToolExecutionContext) {
  const definition = toolDefinition(name);
  if (!definition) {
    return {
      name,
      args: {},
      result: { status: "error", message: `Unknown chatbot tool: ${name}` }
    };
  }

  const startedAt = Date.now();
  let args: ChatToolArgs = {};
  try {
    args = definition.toolParameters.parse(JSON.parse(rawArguments || "{}")) as ChatToolArgs;
    const result = await definition.execute(args, context);
    await logActivity({
      actorId: context.userId,
      action: `chat.tool.${definition.toolName}`,
      entityType: "ChatConversation",
      entityId: context.conversationId,
      durationMs: Date.now() - startedAt,
      metadata: { args: asJson(args), resultStatus: typeof result === "object" && result !== null && "status" in result ? String((result as { status?: unknown }).status) : "ok" }
    });
    return { name: definition.toolName, args, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed";
    await logActivity({
      actorId: context.userId,
      action: `chat.tool.${definition.toolName}`,
      entityType: "ChatConversation",
      entityId: context.conversationId,
      success: false,
      durationMs: Date.now() - startedAt,
      metadata: { args: asJson(args), error: message }
    });
    return { name: definition.toolName, args, result: { status: "error", message } };
  }
}

function systemPrompt(context: Record<string, unknown>) {
  return [
    "You are CineBook's AI movie booking assistant.",
    `Always use OpenAI model ${OPENAI_MODEL}; the application will execute your tool calls.`,
    "Use the provided function tools for facts, IDs, booking operations, payments, preferences, and support. Do not invent movie IDs, show IDs, seat IDs, booking IDs, prices, or payment status.",
    "For complex booking requests, act as the main assistant delegating the operational sequence to a focused booking assistant by chaining tools: search_movies, get_showtimes, check_seat_availability, hold_seats, apply_promo_code, create_booking, start_payment, and confirm_payment when the user provides a card.",
    "Ask for missing required details instead of guessing destructive or payment operations. Holding seats is allowed when the user asked to reserve or book and enough show/seat preference is known.",
    "Use previous tool results and conversation context to pass IDs forward. Keep final replies concise, helpful, and conversational.",
    `Current date/time: ${new Date().toISOString()}.`,
    `Conversation context JSON: ${JSON.stringify(context)}`
  ].join("\n");
}

function conversationContext(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toChatHistory(messages: { sender: "USER" | "ASSISTANT" | "SYSTEM"; content: string }[]): ChatCompletionMessageParam[] {
  return messages
    .filter((message) => message.sender === "USER" || message.sender === "ASSISTANT")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.sender === "USER" ? "user" : "assistant",
      content: message.content
    }));
}

function contextPatch(existing: Record<string, unknown>, message: string, executedTools: ExecutedTool[]) {
  const patch: Record<string, Prisma.InputJsonValue> = {
    ...(asJson(existing) as Prisma.InputJsonObject),
    lastMessage: message,
    lastTools: executedTools.map((tool) => tool.name)
  };

  for (const tool of executedTools) {
    if (tool.args.genre) patch.preferredGenre = tool.args.genre;
    if (tool.args.language) patch.preferredLanguage = tool.args.language;
    if (tool.args.city) patch.preferredCity = tool.args.city;
    if (tool.args.timeOfDay) patch.preferredTimeOfDay = tool.args.timeOfDay;
    if (tool.args.seatType) patch.preferredSeatType = tool.args.seatType;
    if (tool.args.theaterChain) patch.preferredTheaterChain = tool.args.theaterChain;

    if (tool.name === "update_preferences" && tool.args.preferenceKey && tool.args.preferenceValue) {
      patch[`preferred${tool.args.preferenceKey[0]?.toUpperCase() ?? ""}${tool.args.preferenceKey.slice(1)}`] = tool.args.preferenceValue;
    }

    const result = tool.result as Record<string, unknown> | null;
    if (!result || typeof result !== "object") continue;

    const movie = result.movie as Record<string, unknown> | undefined;
    if (movie?.id && typeof movie.id === "string") patch.lastMovieId = movie.id;
    if (movie?.title && typeof movie.title === "string") patch.lastMovieTitle = movie.title;

    const movies = result.movies as Record<string, unknown>[] | undefined;
    if (Array.isArray(movies) && movies[0]?.id && typeof movies[0].id === "string") {
      patch.lastMovieId = movies[0].id;
      if (typeof movies[0].title === "string") patch.lastMovieTitle = movies[0].title;
    }

    const show = result.show as Record<string, unknown> | undefined;
    if (show?.id && typeof show.id === "string") patch.lastShowId = show.id;

    const shows = result.shows as Record<string, unknown>[] | undefined;
    if (Array.isArray(shows) && shows[0]?.id && typeof shows[0].id === "string") patch.lastShowId = shows[0].id;

    const holds = result.holds as Record<string, unknown>[] | undefined;
    if (Array.isArray(holds) && holds.length) patch.lastHoldIds = holds.map((hold) => hold.id).filter((id): id is string => typeof id === "string");

    const booking = result.booking as Record<string, unknown> | undefined;
    if (booking?.id && typeof booking.id === "string") patch.lastBookingId = booking.id;
  }

  return patch;
}

const BOOKING_TOOL_NAMES = new Set<ChatToolName>([
  "find_theatres",
  "get_screen_info",
  "check_seat_availability",
  "hold_seats",
  "release_seats",
  "create_booking",
  "check_booking_status",
  "cancel_booking",
  "view_booking_history",
  "start_payment",
  "confirm_payment",
  "apply_promo_code"
]);

function assistantModeFor(toolNames: ChatToolName[]) {
  const bookingToolCount = toolNames.filter((name) => BOOKING_TOOL_NAMES.has(name)).length;
  return bookingToolCount >= 3 || toolNames.includes("create_booking") || toolNames.includes("hold_seats") ? "booking_assistant" : "main_assistant";
}

async function fallbackChatResponse(conversationId: string, userId: string, message: string, existingContext: Record<string, unknown>, options?: ChatOptions) {
  const movies = await prisma.movie.findMany({
    include: { shows: { where: { startsAt: { gte: new Date() } }, take: 2, orderBy: { startsAt: "asc" }, include: { screen: { include: { theater: true } } } } },
    take: 4
  });
  const response = [
    "OpenAI is not configured yet, so I cannot run the natural-language tool-calling flow.",
    `Add OPENAI_API_KEY and the chatbot will use ${OPENAI_MODEL} for tool selection and replies.`,
    movies.length ? `Current catalog starters: ${movies.map((movie) => movie.title).join(", ")}.` : "No catalog movies are available yet."
  ].join(" ");
  const executedTools: ExecutedTool[] = [{ name: "search_movies", args: { query: message }, result: { status: "fallback", movies: movies.map(serializeMovie) } }];
  const searchMoviesTool = toolDefinition("search_movies");
  const publicTools = executedTools.map(publicExecutedTool);

  if (options?.onEvent && publicTools[0]) {
    await options.onEvent({ type: "tool_start", tool: { toolName: publicTools[0].toolName, toolDescription: publicTools[0].toolDescription, args: publicTools[0].args } });
    await options.onEvent({ type: "tool_result", tool: publicTools[0] });
  }
  await emitMessageDeltas(response, options);

  await prisma.$transaction([
    prisma.chatMessage.create({ data: { conversationId, sender: "USER", content: message, actions: ["search_movies"] } }),
    prisma.chatMessage.create({ data: { conversationId, sender: "ASSISTANT", content: response, actions: { assistantMode: "main_assistant", tools: ["search_movies"], provider: "fallback" } } }),
    prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        context: contextPatch(existingContext, message, executedTools),
        updatedAt: new Date()
      }
    })
  ]);

  return {
    conversationId,
    assistantMode: "main_assistant",
    tools: searchMoviesTool ? [publicTool(searchMoviesTool)] : [],
    toolRuns: publicTools,
    message: response
  };
}

export async function handleChatMessage({ userId, message, conversationId }: ChatInput, options?: ChatOptions) {
  const conversation =
    conversationId
      ? await prisma.chatConversation.findFirst({ where: { id: conversationId, userId }, include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } } })
      : await prisma.chatConversation.create({
          data: { userId, title: message.slice(0, 60) || "Movie assistant" },
          include: { messages: true }
        });

  if (!conversation) throw new Error("Conversation not found");
  await options?.onEvent?.({ type: "conversation", conversationId: conversation.id });

  const existingContext = conversationContext(conversation.context);
  const client = getOpenAIClient();
  if (!client) {
    return fallbackChatResponse(conversation.id, userId, message, existingContext, options);
  }

  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt(existingContext) }, ...toChatHistory(conversation.messages), { role: "user", content: message }];
  const executedTools: ExecutedTool[] = [];
  let finalMessage = "";

  for (let index = 0; index < MAX_TOOL_LOOPS; index += 1) {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: OPENAI_CHAT_TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: false,
      temperature: 0.2
    });

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) break;

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (!toolCalls.length) {
      finalMessage = assistantMessage.content?.trim() || "I can help with that. What would you like to do next?";
      break;
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content ?? null,
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      const definition = toolDefinition(toolCall.function.name);
      let parsedArgs: Prisma.InputJsonValue = {};
      if (definition) {
        try {
          parsedArgs = asJson(definition.toolParameters.parse(JSON.parse(toolCall.function.arguments || "{}")));
        } catch {
          parsedArgs = {};
        }
        await options?.onEvent?.({
          type: "tool_start",
          tool: {
            toolName: definition.toolName,
            toolDescription: definition.toolDescription,
            args: parsedArgs
          }
        });
      }

      const { name, args, result } = await executeToolCall(toolCall.function.name, toolCall.function.arguments, {
        userId,
        conversationId: conversation.id,
        conversationContext: existingContext
      });

      if (toolDefinition(name)) {
        const executedTool = { name: name as ChatToolName, args, result };
        executedTools.push(executedTool);
        await options?.onEvent?.({ type: "tool_result", tool: publicExecutedTool(executedTool) });
      }
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  if (!finalMessage) {
    finalMessage = "I gathered the available booking details, but I need one more message from you to continue cleanly.";
  }

  const toolNames = Array.from(new Set(executedTools.map((tool) => tool.name)));
  const assistantMode = assistantModeFor(toolNames);
  const toolRuns = executedTools.map(publicExecutedTool);
  await options?.onEvent?.({ type: "assistant_mode", assistantMode });
  await emitMessageDeltas(finalMessage, options);

  await prisma.$transaction([
    prisma.chatMessage.create({ data: { conversationId: conversation.id, sender: "USER", content: message, actions: toolNames } }),
    prisma.chatMessage.create({ data: { conversationId: conversation.id, sender: "ASSISTANT", content: finalMessage, actions: { assistantMode, tools: toolNames, model: OPENAI_MODEL } } }),
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        context: contextPatch(existingContext, message, executedTools),
        updatedAt: new Date()
      }
    })
  ]);

  return {
    conversationId: conversation.id,
    assistantMode,
    tools: toolNames
      .map((name) => toolDefinition(name))
      .filter((tool): tool is CineBookToolDefinition => Boolean(tool))
      .map(publicTool),
    toolRuns,
    message: finalMessage
  };
}

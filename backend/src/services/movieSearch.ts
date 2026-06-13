type SearchableTheater = {
  chain?: string | null;
  name?: string | null;
  city?: string | null;
  address?: string | null;
};

type SearchableScreen = {
  name?: string | null;
  type?: string | null;
  format?: string | null;
  equipment?: string[] | null;
  theater?: SearchableTheater | null;
};

type SearchableShow = {
  startsAt?: Date | string | null;
  screen?: SearchableScreen | null;
};

export type SearchableMovie = {
  title: string;
  synopsis?: string | null;
  language?: string | null;
  genre?: string | null;
  rating?: string | null;
  cast?: string[] | null;
  releaseDate?: Date | string | null;
  shows?: SearchableShow[] | null;
};

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim()));
}

function showTimeTokens(value?: Date | string | null) {
  if (!value) return [];
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return [];

  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const twelveHour = hour % 12 || 12;
  const meridiem = hour >= 12 ? "pm" : "am";
  const timeOfDay = hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 22 ? "evening" : "night";

  return [
    IST_DATE_FORMATTER.format(date),
    IST_TIME_FORMATTER.format(date),
    `${twelveHour} ${meridiem}`,
    `${twelveHour}:${minute} ${meridiem}`,
    `${hour.toString().padStart(2, "0")}:${minute}`,
    timeOfDay
  ];
}

function movieFields(movie: SearchableMovie) {
  const cast = movie.cast ?? [];
  const showFields =
    movie.shows?.flatMap((show) => {
      const screen = show.screen;
      const theater = screen?.theater;
      return compact([
        ...showTimeTokens(show.startsAt),
        screen?.name,
        screen?.type,
        screen?.format,
        ...(screen?.equipment ?? []),
        theater?.chain,
        theater?.name,
        theater?.city,
        theater?.address
      ]);
    }) ?? [];

  return {
    title: compact([movie.title]),
    cast,
    details: compact([movie.synopsis, movie.genre, movie.language, movie.rating]),
    release: compact([movie.releaseDate ? IST_DATE_FORMATTER.format(new Date(movie.releaseDate)) : undefined]),
    shows: showFields
  };
}

function fieldScore(query: string, tokens: string[], weight: number) {
  const normalizedValues = tokens.map(normalize).filter(Boolean);
  if (!normalizedValues.length) return 0;

  const joined = normalizedValues.join(" ");
  if (joined === query) return weight + 25;
  if (normalizedValues.some((value) => value === query)) return weight + 20;
  if (normalizedValues.some((value) => value.includes(query))) return weight + 12;

  const queryTokens = query.split(" ").filter(Boolean);
  if (queryTokens.length && queryTokens.every((token) => joined.includes(token))) {
    return weight + queryTokens.length;
  }

  return 0;
}

export function movieSearchScore(movie: SearchableMovie, rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return 1;

  const fields = movieFields(movie);
  return (
    fieldScore(query, fields.title, 100) +
    fieldScore(query, fields.cast, 90) +
    fieldScore(query, fields.details, 45) +
    fieldScore(query, fields.shows, 35) +
    fieldScore(query, fields.release, 20)
  );
}

export function rankSearchableMovies<T extends SearchableMovie>(movies: T[], rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return movies;

  return movies
    .map((movie, index) => ({ movie, index, score: movieSearchScore(movie, query) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.movie);
}

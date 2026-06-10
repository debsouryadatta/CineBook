type RecommendableMovie = {
  id: string;
  title: string;
  genre: string;
};

export type Recommendation = {
  movieId: string;
  title: string;
  reason: string;
};

export function buildFallbackRecommendations(movies: RecommendableMovie[], mood: string): Recommendation[] {
  return movies.slice(0, 3).map((movie) => ({
    movieId: movie.id,
    title: movie.title,
    reason: `${movie.genre} fits "${mood}" and has upcoming shows.`
  }));
}

export function parseOpenAIRecommendations(content: string | null | undefined, movies: RecommendableMovie[], mood: string) {
  if (!content) {
    return { recommendations: buildFallbackRecommendations(movies, mood), provider: "fallback" as const };
  }

  try {
    const parsed = JSON.parse(content) as { recommendations?: unknown };
    if (!Array.isArray(parsed.recommendations)) {
      return { recommendations: buildFallbackRecommendations(movies, mood), provider: "fallback" as const };
    }

    const allowedMovies = new Map(movies.map((movie) => [movie.id, movie]));
    const recommendations = parsed.recommendations
      .map((item): Recommendation | null => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as Record<string, unknown>;
        const movieId = typeof candidate.movieId === "string" ? candidate.movieId : "";
        const movie = allowedMovies.get(movieId);
        if (!movie) return null;

        const reason = typeof candidate.reason === "string" && candidate.reason.trim() ? candidate.reason.trim() : `${movie.genre} fits "${mood}" and has upcoming shows.`;
        return { movieId: movie.id, title: movie.title, reason };
      })
      .filter((item): item is Recommendation => Boolean(item))
      .slice(0, 3);

    if (!recommendations.length) {
      return { recommendations: buildFallbackRecommendations(movies, mood), provider: "fallback" as const };
    }

    return { recommendations, provider: "openai" as const };
  } catch {
    return { recommendations: buildFallbackRecommendations(movies, mood), provider: "fallback" as const };
  }
}

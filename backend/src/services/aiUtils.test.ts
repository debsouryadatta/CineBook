import { describe, expect, it } from "vitest";
import { buildFallbackRecommendations, parseOpenAIRecommendations } from "./aiUtils.js";

const movies = [
  { id: "movie-1", title: "Dune: Part Two", genre: "Sci-Fi" },
  { id: "movie-2", title: "Oppenheimer", genre: "Drama" },
  { id: "movie-3", title: "Spider-Man: Across the Spider-Verse", genre: "Animation" },
  { id: "movie-4", title: "Extra Movie", genre: "Thriller" }
];

describe("aiUtils", () => {
  it("builds deterministic fallback recommendations", () => {
    const recommendations = buildFallbackRecommendations(movies, "expansive");

    expect(recommendations).toHaveLength(3);
    expect(recommendations[0]).toEqual({
      movieId: "movie-1",
      title: "Dune: Part Two",
      reason: 'Sci-Fi fits "expansive" and has upcoming shows.'
    });
  });

  it("parses valid OpenAI recommendations and normalizes titles from known movies", () => {
    const result = parseOpenAIRecommendations(
      JSON.stringify({
        recommendations: [
          { movieId: "movie-2", title: "Wrong title", reason: "Strong drama fit." },
          { movieId: "movie-1", reason: "" }
        ]
      }),
      movies,
      "intense"
    );

    expect(result.provider).toBe("openai");
    expect(result.recommendations).toEqual([
      { movieId: "movie-2", title: "Oppenheimer", reason: "Strong drama fit." },
      { movieId: "movie-1", title: "Dune: Part Two", reason: 'Sci-Fi fits "intense" and has upcoming shows.' }
    ]);
  });

  it("falls back when OpenAI returns malformed JSON", () => {
    const result = parseOpenAIRecommendations("not json", movies, "quiet");

    expect(result.provider).toBe("fallback");
    expect(result.recommendations[0].movieId).toBe("movie-1");
  });

  it("falls back when OpenAI does not return usable catalog movie IDs", () => {
    const result = parseOpenAIRecommendations(JSON.stringify({ recommendations: [{ movieId: "unknown", reason: "Nope" }] }), movies, "bright");

    expect(result.provider).toBe("fallback");
    expect(result.recommendations).toHaveLength(3);
  });
});

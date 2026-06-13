import { describe, expect, it } from "vitest";
import { movieSearchScore, rankSearchableMovies, type SearchableMovie } from "./movieSearch.js";

const movies: SearchableMovie[] = [
  {
    title: "F1: The Movie",
    synopsis: "A veteran driver mentors a rookie at a struggling racing team.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 156,
    cast: ["Brad Pitt", "Damson Idris", "Kerry Condon"],
    releaseDate: new Date("2025-06-27T00:00:00.000Z"),
    shows: [
      {
        startsAt: new Date("2026-06-14T13:30:00.000Z"),
        screen: {
          name: "Screen 1",
          type: "IMAX",
          format: "3D",
          equipment: ["Laser Projection"],
          theater: { chain: "PVR", name: "PVR Phoenix", city: "Mumbai", address: "Lower Parel" }
        }
      }
    ]
  } as SearchableMovie,
  {
    title: "Superman",
    synopsis: "A hero balances alien heritage and human upbringing.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 129,
    cast: ["David Corenswet", "Rachel Brosnahan", "Nicholas Hoult"],
    releaseDate: new Date("2025-07-11T00:00:00.000Z"),
    shows: [
      {
        startsAt: new Date("2026-06-14T05:00:00.000Z"),
        screen: {
          name: "Screen 2",
          type: "Standard",
          format: "2D",
          equipment: [],
          theater: { chain: "INOX", name: "INOX Megaplex", city: "Delhi", address: "Saket" }
        }
      }
    ]
  } as SearchableMovie
];

describe("movieSearch", () => {
  it("matches partial actor and actress names", () => {
    expect(rankSearchableMovies(movies, "Brad")[0]?.title).toBe("F1: The Movie");
    expect(rankSearchableMovies(movies, "Rachel")[0]?.title).toBe("Superman");
  });

  it("matches show time, theatre, screen, and city details", () => {
    expect(rankSearchableMovies(movies, "evening")[0]?.title).toBe("F1: The Movie");
    expect(rankSearchableMovies(movies, "PVR Mumbai IMAX")[0]?.title).toBe("F1: The Movie");
  });

  it("does not treat movie length as searchable text", () => {
    expect(movieSearchScore(movies[0], "156")).toBe(0);
  });
});

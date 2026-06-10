import { ArrowRight, CalendarDays, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { api, type Movie } from "../lib/api";

type Recommendation = {
  movieId: string;
  title: string;
  reason: string;
};

type MovieMeta = {
  cities: string[];
  chains: string[];
  genres: string[];
  languages: string[];
  ratings: string[];
  screenTypes: string[];
  formats: string[];
};

export function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [meta, setMeta] = useState<MovieMeta>({ cities: [], chains: [], genres: [], languages: [], ratings: [], screenTypes: [], formats: [] });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ city: "", chain: "", genre: "", language: "", rating: "", screenType: "", format: "", releaseDate: "" });
  const [mood, setMood] = useState("tense but beautiful");
  const [city, setCity] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationProvider, setRecommendationProvider] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const heroMovie = movies[0];
  const featuredMovies = movies.slice(0, 3);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    api<{ movies: Movie[] }>(`/movies${params.toString() ? `?${params}` : ""}`).then((data) => setMovies(data.movies));
  }, [filters, q]);

  useEffect(() => {
    api<MovieMeta>("/movies/meta/cities").then((data) => setMeta(data));
  }, []);

  const moviesById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);

  async function recommend() {
    setRecommendationLoading(true);
    setRecommendationError("");
    try {
      const data = await api<{ recommendations: Recommendation[]; provider: string }>("/ai/recommend", {
        method: "POST",
        body: JSON.stringify({ mood, ...(city ? { city } : {}) })
      });
      setRecommendations(data.recommendations);
      setRecommendationProvider(data.provider);
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to load recommendations");
    } finally {
      setRecommendationLoading(false);
    }
  }

  return (
    <main>
      <section className="relative min-h-[calc(100svh-64px)] overflow-hidden bg-ink text-white">
        {heroMovie && (
          <img
            src={heroMovie.backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,13,0.96)_0%,rgba(6,8,13,0.80)_42%,rgba(6,8,13,0.12)_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative mx-auto flex min-h-[calc(100svh-64px)] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6"
        >
          <p className="text-sm font-semibold uppercase text-accent">CineBook</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-black tracking-tight sm:text-7xl">Reserve the perfect night at the movies.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/76 sm:text-lg">
            Live showtimes, exact seats, smart recommendations, and a ticket history that stays out of your way.
          </p>
          <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <Input
                placeholder="Search movies, genres, cities"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="h-12 border-white/20 bg-white/92 pl-10 text-black shadow-2xl shadow-black/20"
              />
            </label>
            <Link to={heroMovie ? `/movies/${heroMovie.slug}` : "#"}>
              <Button className="h-12 w-full sm:w-auto">
                View shows
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {!!featuredMovies.length && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-3"
            >
              {featuredMovies.map((movie) => (
                <Link key={movie.id} to={`/movies/${movie.slug}`} className="group rounded-md border border-white/14 bg-white/8 p-3 backdrop-blur transition hover:-translate-y-1 hover:bg-white/12">
                  <p className="text-xs font-semibold uppercase text-white/55">{movie.genre}</p>
                  <p className="mt-1 truncate font-semibold">{movie.title}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white/58">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {movie.durationMin} min
                  </p>
                </Link>
              ))}
            </motion.div>
          )}
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-muted-foreground">Now showing</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Browse live shows</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">Filter by city, format, language, and screen type. Results update as you scan.</p>
        </div>
        <Card className="mt-5 rounded-md shadow-sm">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["genre", "Genre", meta.genres],
            ["chain", "Theatre chain", meta.chains],
            ["screenType", "Screen type", meta.screenTypes],
            ["format", "Format", meta.formats],
            ["language", "Language", meta.languages],
            ["rating", "Age rating", meta.ratings],
            ["city", "Location", meta.cities]
          ].map(([key, label, options]) => {
            const field = key as keyof typeof filters;
            return (
              <div key={key as string} className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{label as string}</Label>
                <Select
                  value={filters[field] || "all"}
                  onValueChange={(value) => setFilters((current) => ({ ...current, [field]: value === "all" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(options as string[]).map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Release after
            <Input
              className="mt-2"
              type="date"
              value={filters.releaseDate}
              onChange={(event) => setFilters((current) => ({ ...current, releaseDate: event.target.value }))}
            />
          </label>
          </CardContent>
        </Card>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {movies.map((movie) => (
            <Link
              key={movie.id}
              to={`/movies/${movie.slug}`}
              className="group block"
            >
              <Card className="h-full overflow-hidden rounded-md shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-foreground/20 group-hover:shadow-xl group-hover:shadow-black/8">
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img src={movie.backdropUrl} alt={movie.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="muted">{movie.genre}</Badge>
                    <span className="text-xs font-semibold text-muted-foreground">{movie.durationMin} min</span>
                  </div>
                  <h3 className="mt-2 text-xl font-black tracking-tight">{movie.title}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{movie.synopsis}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    Select seats <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-background" data-testid="ai-recommendations">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[380px_1fr]">
          <Card className="rounded-md shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase">Match mode</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight">Describe the night. Get the shortlist.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">CineBook reads your mood and filters the live catalog into a few useful picks.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Mood</Label>
                  <Textarea
                    value={mood}
                    onChange={(event) => setMood(event.target.value)}
                    aria-label="Movie mood"
                    className="min-h-24 resize-none bg-background"
                    placeholder="tense but beautiful, funny and light, family-friendly"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {["date night", "edge of seat", "family friendly"].map((item) => (
                    <Button key={item} type="button" variant="secondary" size="sm" onClick={() => setMood(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Select value={city || "all"} onValueChange={(value) => setCity(value === "all" ? "" : value)}>
                      <SelectTrigger aria-label="Recommendation city" className="pl-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cities</SelectItem>
                        {meta.cities.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={recommend} disabled={recommendationLoading || mood.trim().length < 2}>
                    {recommendationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Match
                  </Button>
                </div>
                {recommendationProvider && (
                  <Badge variant="outline">
                    Source: {recommendationProvider === "openai" ? "OpenAI" : "fallback"}
                  </Badge>
                )}
                {recommendationError && <p className="text-sm font-medium text-destructive">{recommendationError}</p>}
              </div>
            </CardContent>
          </Card>
          <div className="grid content-start gap-3 md:grid-cols-3">
            {recommendations.map((item) => {
              const matchedMovie = moviesById.get(item.movieId);
              const content = (
                <>
                  <Badge variant="muted">Recommended</Badge>
                  <h3 className="mt-3 text-lg font-black tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                  {matchedMovie && (
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      View shows <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </>
              );

              return matchedMovie ? (
                <Link
                  key={item.movieId || item.title}
                  to={`/movies/${matchedMovie.slug}`}
                  className="block rounded-md border border-border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg"
                  data-testid={`ai-recommendation-${matchedMovie.slug}`}
                >
                  {content}
                </Link>
              ) : (
                <motion.article key={item.movieId || item.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-md border border-border bg-card p-4 shadow-sm">
                  {content}
                </motion.article>
              );
            })}
            {!recommendations.length && !recommendationLoading && (
              <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground md:col-span-3">
                <div>
                  <Sparkles className="mx-auto h-7 w-7 text-primary" />
                  <p className="mt-3 font-medium text-foreground">Ready when you are.</p>
                  <p className="mt-1">Ask for a mood to see recommendations from currently scheduled shows.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

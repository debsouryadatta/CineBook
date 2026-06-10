import { useEffect, useState } from "react";
import { CalendarClock, CircleDollarSign, Film, Loader2, Plus, Ticket, Users } from "lucide-react";
import { format } from "date-fns";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, type Booking } from "../lib/api";

type Summary = {
  users: number;
  movies: number;
  shows: number;
  bookings: number;
  revenue: number;
};

type MovieForm = {
  title: string;
  slug: string;
  synopsis: string;
  language: string;
  genre: string;
  rating: string;
  durationMin: string;
  posterUrl: string;
  backdropUrl: string;
  cast: string;
  releaseDate: string;
};

type AdminCatalog = {
  movies: Array<{ id: string; title: string; slug: string }>;
  screens: Array<{ id: string; name: string; theater: { id: string; name: string; city: string } }>;
};

type ShowForm = {
  movieId: string;
  screenId: string;
  startsAt: string;
  basePrice: string;
};

const initialMovieForm: MovieForm = {
  title: "",
  slug: "",
  synopsis: "",
  language: "English",
  genre: "",
  rating: "UA 13+",
  durationMin: "120",
  posterUrl: "",
  backdropUrl: "",
  cast: "",
  releaseDate: new Date().toISOString().slice(0, 10)
};

const initialShowForm: ShowForm = {
  movieId: "",
  screenId: "",
  startsAt: "",
  basePrice: "260"
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toLocalDateTimeInputValue(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog>({ movies: [], screens: [] });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [movieForm, setMovieForm] = useState<MovieForm>(initialMovieForm);
  const [showForm, setShowForm] = useState<ShowForm>(initialShowForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaving, setShowSaving] = useState(false);

  useEffect(() => {
    loadSummary();
    loadCatalog();
    loadRecentBookings();
  }, []);

  async function loadSummary() {
    const data = await api<Summary>("/admin/summary");
    setSummary(data);
  }

  async function loadCatalog() {
    const data = await api<AdminCatalog>("/admin/catalog");
    setCatalog(data);
    setShowForm((current) => ({
      ...current,
      movieId: current.movieId || data.movies[0]?.id || "",
      screenId: current.screenId || data.screens[0]?.id || ""
    }));
  }

  async function loadRecentBookings() {
    const data = await api<{ bookings: Booking[] }>("/admin/bookings");
    setRecentBookings(data.bookings);
  }

  function updateField(field: keyof MovieForm, value: string) {
    setMovieForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "title" ? { slug: current.slug ? current.slug : toSlug(value) } : {})
    }));
  }

  function updateShowField(field: keyof ShowForm, value: string) {
    setShowForm((current) => ({ ...current, [field]: value }));
  }

  async function createMovie(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api("/admin/movies", {
        method: "POST",
        body: JSON.stringify({
          title: movieForm.title,
          slug: movieForm.slug,
          synopsis: movieForm.synopsis,
          language: movieForm.language,
          genre: movieForm.genre,
          rating: movieForm.rating,
          durationMin: Number(movieForm.durationMin),
          posterUrl: movieForm.posterUrl,
          backdropUrl: movieForm.backdropUrl,
          cast: movieForm.cast
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
          releaseDate: new Date(`${movieForm.releaseDate}T00:00:00.000Z`).toISOString()
        })
      });
      setMessage(`${movieForm.title} was added to the catalog.`);
      setMovieForm(initialMovieForm);
      await loadSummary();
      await loadCatalog();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create movie");
    } finally {
      setSaving(false);
    }
  }

  async function createShow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSaving(true);
    setMessage("");
    setError("");

    try {
      const startsAt = new Date(showForm.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
        throw new Error("Showtime must be in the future");
      }

      const selectedMovie = catalog.movies.find((movie) => movie.id === showForm.movieId);
      await api("/admin/shows", {
        method: "POST",
        body: JSON.stringify({
          movieId: showForm.movieId,
          screenId: showForm.screenId,
          startsAt: startsAt.toISOString(),
          basePrice: Number(showForm.basePrice)
        })
      });
      setMessage(`${selectedMovie?.title ?? "Movie"} showtime was scheduled.`);
      setShowForm((current) => ({ ...initialShowForm, movieId: current.movieId, screenId: current.screenId }));
      await loadSummary();
      await loadRecentBookings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to schedule show");
    } finally {
      setShowSaving(false);
    }
  }

  const statIcons = [Users, Film, CalendarClock, Ticket, CircleDollarSign];
  const stats = summary
    ? [
        ["Users", summary.users],
        ["Movies", summary.movies],
        ["Shows", summary.shows],
        ["Bookings", summary.bookings],
        ["Revenue", `Rs ${summary.revenue}`]
      ]
    : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Operations summary</h1>
          <p className="mt-2 text-sm text-muted-foreground">Catalog, scheduling, revenue, and recent booking activity.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value], index) => {
          const Icon = statIcons[index];
          return (
          <Card key={label} className="rounded-md shadow-sm">
            <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {(message || error) && (
        <Alert variant={error ? "destructive" : "default"} className="mt-6">
          <AlertDescription>{error || message}</AlertDescription>
        </Alert>
      )}

      <section className="mt-10 grid gap-8 border-t border-border pt-8 lg:grid-cols-[320px_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground">Catalog</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Add a movie</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create movie metadata for upcoming scheduling. Showtimes and seats are managed separately.
          </p>
        </div>

        <Card className="rounded-md shadow-sm">
          <CardContent className="p-5">
        <form onSubmit={createMovie} className="grid gap-4" data-testid="admin-movie-form">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              <Label>Title</Label>
              <Input className="mt-2" value={movieForm.title} onChange={(event) => updateField("title", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Slug</Label>
              <Input className="mt-2" value={movieForm.slug} onChange={(event) => updateField("slug", toSlug(event.target.value))} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Language</Label>
              <Input className="mt-2" value={movieForm.language} onChange={(event) => updateField("language", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Genre</Label>
              <Input className="mt-2" value={movieForm.genre} onChange={(event) => updateField("genre", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Rating</Label>
              <Input className="mt-2" value={movieForm.rating} onChange={(event) => updateField("rating", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Duration</Label>
              <Input className="mt-2" min={1} type="number" value={movieForm.durationMin} onChange={(event) => updateField("durationMin", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Release date</Label>
              <Input className="mt-2" type="date" value={movieForm.releaseDate} onChange={(event) => updateField("releaseDate", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Cast</Label>
              <Input className="mt-2" placeholder="Actor One, Actor Two" value={movieForm.cast} onChange={(event) => updateField("cast", event.target.value)} />
            </label>
          </div>

          <label className="text-sm font-semibold">
            <Label>Synopsis</Label>
            <Textarea
              className="mt-2"
              value={movieForm.synopsis}
              onChange={(event) => updateField("synopsis", event.target.value)}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              <Label>Poster URL</Label>
              <Input className="mt-2" type="url" value={movieForm.posterUrl} onChange={(event) => updateField("posterUrl", event.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              <Label>Backdrop URL</Label>
              <Input className="mt-2" type="url" value={movieForm.backdropUrl} onChange={(event) => updateField("backdropUrl", event.target.value)} required />
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add movie
            </Button>
          </div>
        </form>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-8 border-t border-border pt-8 lg:grid-cols-[320px_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground">Scheduling</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Create a showtime</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Put an existing movie on a screen with a starting price. Seat inventory comes from the selected screen.
          </p>
        </div>

        <Card className="rounded-md shadow-sm">
          <CardContent className="p-5">
        <form onSubmit={createShow} className="grid gap-4" data-testid="admin-show-form">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Movie</Label>
              <Select value={showForm.movieId} onValueChange={(value) => updateShowField("movieId", value)}>
                <SelectTrigger><SelectValue placeholder="Select movie" /></SelectTrigger>
                <SelectContent>
                  {catalog.movies.map((movie) => (
                    <SelectItem key={movie.id} value={movie.id}>{movie.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Screen</Label>
              <Select value={showForm.screenId} onValueChange={(value) => updateShowField("screenId", value)}>
                <SelectTrigger><SelectValue placeholder="Select screen" /></SelectTrigger>
                <SelectContent>
                  {catalog.screens.map((screen) => (
                    <SelectItem key={screen.id} value={screen.id}>
                      {screen.theater.city} - {screen.theater.name} - {screen.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="text-sm font-semibold">
              Starts at
              <Input
                className="mt-2"
                min={toLocalDateTimeInputValue(new Date())}
                type="datetime-local"
                value={showForm.startsAt}
                onChange={(event) => updateShowField("startsAt", event.target.value)}
                required
              />
            </label>

            <label className="text-sm font-semibold">
              Base price
              <Input className="mt-2" min={1} type="number" value={showForm.basePrice} onChange={(event) => updateShowField("basePrice", event.target.value)} required />
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={showSaving || !catalog.movies.length || !catalog.screens.length}>
              {showSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Schedule show
            </Button>
          </div>
        </form>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-muted-foreground">Bookings</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Recent activity</h2>
          </div>
          <p className="text-sm text-muted-foreground">Latest 12 booking records across all users.</p>
        </div>

        <Card className="mt-5 rounded-md shadow-sm" data-testid="admin-recent-bookings">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/60 text-xs uppercase">
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Movie</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Showtime</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-semibold">{booking.confirmationCode}</TableCell>
                  <TableCell>{booking.show.movie.title}</TableCell>
                  <TableCell className="text-muted-foreground">{booking.user?.email ?? "Unknown"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(booking.show.startsAt), "d MMM, h:mm a")}</TableCell>
                  <TableCell>{booking.seats.map((item) => `${item.seat.row}${item.seat.number}`).join(", ")}</TableCell>
                  <TableCell>
                    <Badge variant={booking.status === "CONFIRMED" ? "success" : booking.status === "CANCELLED" ? "danger" : "default"}>{booking.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">Rs {booking.totalAmount}</TableCell>
                </TableRow>
              ))}
              {!recentBookings.length && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-muted-foreground" colSpan={7}>
                    No bookings yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </main>
  );
}

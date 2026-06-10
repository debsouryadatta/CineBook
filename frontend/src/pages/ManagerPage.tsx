import { CalendarPlus, Monitor, Projector, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, type Movie } from "../lib/api";

type ManagedScreen = {
  id: string;
  name: string;
  type: string;
  format: string;
  theater: { name: string; city: string; chain: string };
  shows: Array<{ id: string; startsAt: string; movie: Movie }>;
};

function localFutureValue() {
  const date = new Date(Date.now() + 24 * 60 * 60_000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ManagerPage() {
  const [screens, setScreens] = useState<ManagedScreen[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState({ movieId: "", screenId: "", startsAt: localFutureValue(), basePrice: "260" });
  const [message, setMessage] = useState("");

  async function load() {
    const [screenData, movieData] = await Promise.all([api<{ screens: ManagedScreen[] }>("/manager/screens"), api<{ movies: Movie[] }>("/movies")]);
    setScreens(screenData.screens);
    setMovies(movieData.movies);
    setForm((current) => ({
      ...current,
      screenId: current.screenId || screenData.screens[0]?.id || "",
      movieId: current.movieId || movieData.movies[0]?.id || ""
    }));
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load manager data"));
  }, []);

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const startsAt = new Date(form.startsAt);
      await api("/manager/shows", {
        method: "POST",
        body: JSON.stringify({ movieId: form.movieId, screenId: form.screenId, startsAt: startsAt.toISOString(), basePrice: Number(form.basePrice) })
      });
      setMessage("Show scheduled for assigned screen.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to schedule show");
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[340px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-sm font-semibold uppercase text-muted-foreground">Hall manager</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Assigned screens</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Schedule shows only for screens assigned by an admin.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card className="rounded-md shadow-sm">
            <CardContent className="p-4">
            <Monitor className="h-4 w-4 text-accent" />
            <p className="mt-3 text-2xl font-black">{screens.length}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Screens</p>
            </CardContent>
          </Card>
          <Card className="rounded-md shadow-sm">
            <CardContent className="p-4">
            <Rows3 className="h-4 w-4 text-accent" />
            <p className="mt-3 text-2xl font-black">{screens.reduce((sum, screen) => sum + screen.shows.length, 0)}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
        </div>
      </aside>
      <section className="space-y-8">
        {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
        <Card className="rounded-md shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Schedule show</CardTitle>
          </CardHeader>
          <CardContent>
        <form onSubmit={schedule} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Movie</Label>
              <Select value={form.movieId} onValueChange={(movieId) => setForm({ ...form, movieId })}>
                <SelectTrigger><SelectValue placeholder="Select movie" /></SelectTrigger>
                <SelectContent>
                  {movies.map((movie) => <SelectItem key={movie.id} value={movie.id}>{movie.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Screen</Label>
              <Select value={form.screenId} onValueChange={(screenId) => setForm({ ...form, screenId })}>
                <SelectTrigger><SelectValue placeholder="Select screen" /></SelectTrigger>
                <SelectContent>
                  {screens.map((screen) => <SelectItem key={screen.id} value={screen.id}>{screen.theater.city} - {screen.theater.name} - {screen.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Starts at</Label>
              <Input className="mt-2" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base price</Label>
              <Input className="mt-2" type="number" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit"><CalendarPlus className="h-4 w-4" />Schedule show</Button>
          </div>
        </form>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {screens.map((screen) => (
            <Card key={screen.id} className="rounded-md shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/18">
              <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">{screen.theater.chain}</p>
                  <h2 className="mt-2 text-xl font-black">{screen.theater.name} - {screen.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{screen.theater.city}</p>
                </div>
                <Projector className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">{screen.type}</Badge>
                <Badge variant="outline">{screen.format}</Badge>
                <Badge>{screen.shows.length} upcoming</Badge>
              </div>
              {!!screen.shows.length && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Next movie</p>
                  <p className="mt-1 text-sm font-semibold">{screen.shows[0].movie.title}</p>
                </div>
              )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

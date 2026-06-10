import { format } from "date-fns";
import { CalendarDays, CreditCard, MapPin, Ticket, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";
import { api, type Movie, type Seat, type Show, type User } from "../lib/api";
import { cn } from "../lib/utils";

type MovieWithShows = Movie & {
  shows: Array<{
    id: string;
    startsAt: string;
    basePrice: number;
    screen: { name: string; theater: { name: string; city: string; address: string } };
  }>;
};

export function MoviePage({ user, authLoading }: { user: User | null; authLoading: boolean }) {
  const { slug } = useParams();
  const [movie, setMovie] = useState<MovieWithShows | null>(null);
  const [show, setShow] = useState<Show | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [paymentCard, setPaymentCard] = useState("4242424242424242");
  const [pendingPayment, setPendingPayment] = useState<{ bookingId: string; confirmationCode: string } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const activeShowRequest = useRef(0);
  const initializedSlug = useRef<string | null>(null);
  const checkoutAttempt = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    initializedSlug.current = null;
    api<{ movie: MovieWithShows }>(`/movies/${slug}`).then((data) => {
      if (cancelled) return;
      setMovie(data.movie);
      if (data.movie.shows[0] && initializedSlug.current !== data.movie.slug) {
        initializedSlug.current = data.movie.slug;
        loadShow(data.movie.shows[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function loadShow(id: string) {
    const requestId = activeShowRequest.current + 1;
    activeShowRequest.current = requestId;
    setSelected([]);
    const data = await api<{ show: Show }>(`/shows/${id}`);
    if (activeShowRequest.current !== requestId) return;
    setShow(data.show);
  }

  useEffect(() => {
    if (!show?.id) return;
    const interval = window.setInterval(() => {
      api<{ show: Show }>(`/shows/${show.id}`)
        .then((data) => {
          setShow(data.show);
          setSelected((current) => current.filter((seatId) => data.show.screen.seats.some((seat) => seat.id === seatId && !seat.isReserved)));
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [show?.id]);

  const selectedSeats = useMemo(() => {
    const map = new Map(show?.screen.seats.map((seat) => [seat.id, seat]) ?? []);
    return selected.map((id) => map.get(id)).filter(Boolean) as Seat[];
  }, [selected, show]);

  const total = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of show?.screen.seats ?? []) {
      grouped.set(seat.row, [...(grouped.get(seat.row) ?? []), seat]);
    }
    return Array.from(grouped.entries());
  }, [show]);

  useEffect(() => {
    if (show && searchParams.get("best") === "1") {
      setSelected(show.screen.seats.filter((seat) => !seat.isReserved).slice(0, 2).map((seat) => seat.id));
    }
  }, [show, searchParams]);

  useEffect(() => {
    if (searchParams.get("checkout") === "1" && !user && !authLoading) {
      navigate("/login", { replace: true });
      return;
    }
    if (!show || !user || searchParams.get("checkout") !== "1" || !selected.length) return;
    const attemptKey = `${show.id}:${selected.join(",")}`;
    if (checkoutAttempt.current === attemptKey) return;
    checkoutAttempt.current = attemptKey;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("checkout");
    setSearchParams(nextParams, { replace: true });
    setMessage("");
    api<{ holds: Array<{ id: string }>; expiresAt: string }>("/holds", {
      method: "POST",
      body: JSON.stringify({ showId: show.id, seatIds: selected })
    })
      .then((holdData) =>
        api<{ booking: { id: string; confirmationCode: string } }>("/bookings", {
          method: "POST",
          body: JSON.stringify({ showId: show.id, seatIds: selected, holdIds: holdData.holds.map((hold) => hold.id) })
        })
      )
      .then((data) => {
        setPendingPayment({ bookingId: data.booking.id, confirmationCode: data.booking.confirmationCode });
        setMessage(`Booked ${data.booking.confirmationCode}. Seats were held for checkout; confirmation is processing.`);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Booking failed");
      });
  }, [authLoading, navigate, searchParams, selected, setSearchParams, show, user]);

  function toggleSeat(seatId: string) {
    if (searchParams.has("best")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("best");
      setSearchParams(nextParams, { replace: true });
    }
    setSelected((current) => (current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]));
  }

  function selectBestAvailable() {
    if (!show) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("best", "1");
    nextParams.delete("checkout");
    setSearchParams(nextParams, { replace: true });
  }

  function startCheckout() {
    if (!user) {
      navigate("/login");
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("best");
    nextParams.set("checkout", "1");
    setSearchParams(nextParams, { replace: true });
  }

  async function payForBooking() {
    if (!pendingPayment) return;
    setPaymentLoading(true);
    setMessage("");
    try {
      const data = await api<{ payment: { transactionId: string }; booking: { confirmationCode: string } }>("/payments/process", {
        method: "POST",
        body: JSON.stringify({ bookingId: pendingPayment.bookingId, cardNumber: paymentCard })
      });
      setMessage(`Payment succeeded for ${data.booking.confirmationCode}. Transaction ${data.payment.transactionId}.`);
      setPendingPayment(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  }

  if (!movie) return <main className="mx-auto max-w-7xl px-4 py-10 text-muted-foreground sm:px-6">Loading movie...</main>;

  return (
    <main>
      <section className="relative overflow-hidden bg-ink text-white">
        <img src={movie.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,13,0.96)_0%,rgba(6,8,13,0.78)_52%,rgba(6,8,13,0.22)_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[220px_1fr] lg:py-16">
          <img src={movie.posterUrl} alt={movie.title} className="poster-shadow hidden aspect-[2/3] w-full rounded-md object-cover md:block" />
          <div className="max-w-3xl self-end">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-accent text-accent-foreground">{movie.genre}</Badge>
              <Badge className="border-white/18 bg-white/8 text-white">{movie.rating}</Badge>
              <Badge className="border-white/18 bg-white/8 text-white">{movie.durationMin} min</Badge>
            </div>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-6xl">{movie.title}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-white/76">{movie.synopsis}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-white/72">
              {movie.cast.map((name) => (
                <span key={name} className="rounded-full border border-white/18 bg-white/6 px-3 py-1">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[340px_1fr]">
        <aside>
          <p className="text-sm font-semibold uppercase text-muted-foreground">Showtimes</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Choose a screen</h2>
          <div className="mt-5 space-y-3">
            {movie.shows.map((item) => (
              <button
                key={item.id}
                onClick={() => loadShow(item.id)}
                className={cn(
                  "w-full rounded-md border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20",
                  show?.id === item.id && "border-accent bg-white ring-2 ring-accent/20"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  {format(new Date(item.startsAt), "EEE, d MMM • h:mm a")}
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4" />
                  <span>{item.screen.theater.name}, {item.screen.theater.city}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Seat map</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Select seats</h2>
              <p className="mt-1 text-sm text-muted-foreground">Screen is at the top. Reserved seats are unavailable.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" disabled={!show} onClick={selectBestAvailable}>
                <Wand2 className="h-4 w-4" />
                Best seats
              </Button>
              <Card className="rounded-md shadow-sm">
                <CardContent className="px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Total</span>
                <strong className="ml-2">Rs {total}</strong>
                </CardContent>
              </Card>
              <Button disabled={!selected.length} onClick={startCheckout}>
                <Ticket className="h-4 w-4" />
                Book seats
              </Button>
            </div>
          </div>

          <Card className="mt-6 overflow-hidden rounded-md shadow-sm">
            <CardContent className="p-4">
            <div className="mx-auto max-w-2xl rounded-t-full bg-zinc-950 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Screen
            </div>
            <div className="cinema-rail mt-6 h-px" />
            <ScrollArea className="mt-8 w-full whitespace-nowrap pb-2">
              <div className="space-y-3">
              {rows.map(([row, seats]) => (
                <div key={row} className="flex min-w-[560px] items-center gap-2">
                  <span className="w-6 text-sm font-bold text-muted-foreground">{row}</span>
                  {seats.map((seat) => {
                    const active = selected.includes(seat.id);
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        data-testid={`seat-${seat.row}${seat.number}`}
                        aria-label={`${seat.row}${seat.number}`}
                        aria-pressed={active}
                        disabled={seat.isReserved}
                        onClick={() => toggleSeat(seat.id)}
                        className={cn(
                          "relative grid h-9 w-11 place-items-center rounded-sm border text-xs font-bold transition",
                          seat.isReserved && "cursor-not-allowed border-zinc-200 bg-zinc-200 text-zinc-400",
                          !seat.isReserved && !active && "cursor-pointer border-border bg-background hover:-translate-y-0.5 hover:border-accent",
                          active && "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                        )}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
              ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm border border-border bg-background" />Available</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-accent" />Selected</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-zinc-200" />Reserved</span>
            </div>
            </CardContent>
          </Card>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedSeats.length ? `Selected: ${selectedSeats.map((seat) => `${seat.row}${seat.number}`).join(", ")}` : "No seats selected"}
            </div>
          </div>
          {message && (
            <Alert className="mt-4">
              <AlertDescription>{message} <Link className="underline" to="/bookings">View tickets</Link></AlertDescription>
            </Alert>
          )}
          {pendingPayment && (
            <Card className="mt-4 rounded-md shadow-sm">
              <CardContent className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4 text-accent" /> Simulated payment for {pendingPayment.confirmationCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">Success: 4242424242424242. Failure: 4000000000000002. Random failure: any card ending 3000.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input value={paymentCard} onChange={(event) => setPaymentCard(event.target.value)} aria-label="Test card number" />
                <Button onClick={payForBooking} disabled={paymentLoading}>
                  {paymentLoading ? "Processing..." : "Pay now"}
                </Button>
              </div>
              </CardContent>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}

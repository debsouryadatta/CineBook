import { format } from "date-fns";
import { useEffect, useState } from "react";
import { CalendarClock, CircleDollarSign, Ticket, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent } from "../components/ui/card";
import { api, type Booking } from "../lib/api";

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ bookings: Booking[] }>("/bookings");
    setBookings(data.bookings);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load bookings");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!bookings.some((booking) => booking.status === "PENDING")) return;

    const interval = window.setInterval(() => {
      load().catch((err) => setError(err instanceof Error ? err.message : "Unable to refresh bookings"));
    }, 1500);

    return () => window.clearInterval(interval);
  }, [bookings]);

  async function cancel(id: string) {
    setCancelingId(id);
    setError("");
    try {
      await api(`/bookings/${id}/cancel`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel booking");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
        <p className="text-sm font-semibold uppercase text-muted-foreground">Account</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Your tickets</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pending tickets refresh automatically while confirmation is processing.</p>
        </div>
        <Card className="rounded-md shadow-sm">
          <CardContent className="px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total bookings</span>
          <strong className="ml-2">{bookings.length}</strong>
          </CardContent>
        </Card>
      </div>
      {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="mt-6 space-y-4">
        {bookings.map((booking) => (
          <Card key={booking.id} className="overflow-hidden rounded-md shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row">
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{booking.confirmationCode}</Badge>
                  <Badge variant={booking.status === "CONFIRMED" ? "success" : booking.status === "CANCELLED" ? "danger" : "default"}>{booking.status}</Badge>
                  {booking.status === "PENDING" && <Badge>Processing</Badge>}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight">{booking.show.movie.title}</h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4 text-accent" />
                  {format(new Date(booking.show.startsAt), "EEE, d MMM yyyy • h:mm a")} at {booking.show.screen.theater.name}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  Seats: {booking.seats.map((item) => `${item.seat.row}${item.seat.number}`).join(", ")}
                </p>
              </div>
              <div className="flex items-end justify-between gap-4 border-t border-border bg-muted/35 p-4 md:w-56 md:flex-col md:border-l md:border-t-0">
                <div className="text-right md:text-left">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground md:justify-start">
                    <CircleDollarSign className="h-4 w-4" />
                    Amount
                  </p>
                  <strong className="mt-1 block text-xl">Rs {booking.totalAmount}</strong>
                </div>
                {booking.status !== "CANCELLED" && (
                  <Button variant="danger" onClick={() => cancel(booking.id)} disabled={cancelingId === booking.id}>
                    <XCircle className="h-4 w-4" />
                    {cancelingId === booking.id ? "Cancelling..." : "Cancel"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!loading && !bookings.length && (
          <Card className="rounded-md border-dashed">
            <CardContent className="p-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No bookings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a showtime and your tickets will appear here.</p>
            </CardContent>
          </Card>
        )}
        {loading && <p className="text-muted-foreground">Loading tickets...</p>}
      </div>
    </main>
  );
}

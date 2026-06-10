const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";
const DEMO_EMAIL = process.env.SMOKE_EMAIL ?? "demo@cinebook.local";
const DEMO_PASSWORD = process.env.SMOKE_PASSWORD ?? "Demo@123";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "admin@cinebook.local";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "Admin@123";
const MANAGER_EMAIL = process.env.SMOKE_MANAGER_EMAIL ?? "manager@cinebook.local";
const MANAGER_PASSWORD = process.env.SMOKE_MANAGER_PASSWORD ?? "Manager@123";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload?.message ? payload.message : response.statusText;
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${message}`);
  }

  return payload;
}

async function expectRequestError(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} unexpectedly succeeded`);
  }

  return { status: response.status, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForConfirmedBooking(token, bookingId) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { bookings } = await request("/bookings", { token });
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking?.status === "CONFIRMED") return booking;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Booking ${bookingId} was not confirmed by the worker within 15 seconds`);
}

async function waitForBookingStatus(token, bookingId, status, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { bookings } = await request("/bookings", { token });
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking?.status === status) return booking;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Booking ${bookingId} did not remain ${status} within ${timeoutMs}ms`);
}

async function main() {
  console.log(`Smoke testing ${API_BASE_URL}`);

  const ready = await request("/ready");
  assert(ready?.checks?.database === "ok", "Database readiness check did not pass");
  assert(ready?.checks?.redis === "ok", "Redis readiness check did not pass");
  console.log("[ok] readiness checks passed");

  const smokeAccount = {
    name: "Smoke User",
    email: `smoke-${Date.now()}@cinebook.local`,
    phone: `+9199${String(Date.now()).slice(-8)}`,
    password: "Smoke@123"
  };
  const registered = await request("/auth/register", {
    method: "POST",
    body: smokeAccount
  });
  assert(registered.token, "Registration did not return a token");
  assert(registered.user.email === smokeAccount.email, "Registration returned the wrong user");
  const verification = await request("/auth/phone/request", {
    method: "POST",
    body: { phone: smokeAccount.phone }
  });
  assert(verification.simulatedCode === "123456", "Phone verification did not return the simulated code");
  const verifiedPhone = await request("/auth/phone/verify", {
    method: "POST",
    body: { phone: smokeAccount.phone, code: verification.simulatedCode }
  });
  assert(verifiedPhone.verified === true, "Phone verification did not succeed");
  const profile = await request("/auth/me", { token: registered.token });
  assert(profile.user.email === smokeAccount.email, "Registered user token did not load /auth/me");
  console.log(`[ok] registered, verified phone, and restored ${registered.user.email}`);

  const login = await request("/auth/login", {
    method: "POST",
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD }
  });
  assert(login.token, "Login did not return a token");
  console.log(`[ok] signed in as ${login.user.email}`);
  const customerToken = registered.token;

  const { movies } = await request("/movies");
  assert(Array.isArray(movies) && movies.length > 0, "No movies returned from /movies");
  const meta = await request("/movies/meta/cities");
  assert(meta.genres?.length && meta.chains?.length && meta.screenTypes?.length && meta.formats?.length, "Movie filter metadata is incomplete");
  const filteredMovies = await request(`/movies?genre=${encodeURIComponent(meta.genres[0])}&chain=${encodeURIComponent(meta.chains[0])}`);
  assert(Array.isArray(filteredMovies.movies), "Filtered movies response is invalid");
  console.log("[ok] movie filter metadata and filtered search passed");

  const movie = movies.find((item) => item.shows?.length) ?? movies[0];
  const details = await request(`/movies/${movie.slug}`);
  const showSummary = details.movie.shows?.[0];
  assert(showSummary?.id, `Movie ${movie.title} does not have an upcoming show`);
  console.log(`[ok] loaded movie and show data for ${details.movie.title}`);

  const recommendations = await request("/ai/recommend", {
    method: "POST",
    body: { mood: "thoughtful sci-fi", city: "Bengaluru" }
  });
  assert(Array.isArray(recommendations.recommendations), "AI recommendations response is missing recommendations");
  assert(recommendations.recommendations.length > 0, "AI recommendations response was empty");
  assert(["fallback", "openai"].includes(recommendations.provider), "AI recommendations returned an unknown provider");
  console.log(`[ok] AI recommendations returned via ${recommendations.provider}`);

  const chatTools = await request("/chat/tools", { token: customerToken });
  assert(chatTools.count >= 20, "Chatbot exposes fewer than 20 tools");
  const chat = await request("/chat/messages", {
    method: "POST",
    token: customerToken,
    body: { message: "Book 2 tickets for a sci-fi movie this weekend with recliner seats and offers. I prefer evening shows and want to pay by card." }
  });
  assert(chat.assistantMode === "booking_assistant", "Complex booking was not delegated to the booking assistant");
  assert(chat.tools.length >= 8, "Complex chatbot request did not chain enough tools");
  console.log("[ok] custom chatbot tools and booking delegation passed");

  const showDetails = await request(`/shows/${showSummary.id}`);
  const availableSeats = showDetails.show.screen.seats.filter((seat) => !seat.isReserved).slice(0, 2);
  assert(availableSeats.length > 0, `Show ${showSummary.id} has no available seats`);

  const holdProbeSeat = showDetails.show.screen.seats.find((seat) => !seat.isReserved && !availableSeats.some((item) => item.id === seat.id));
  if (holdProbeSeat) {
    const hold = await request("/holds", {
      method: "POST",
      token: customerToken,
      body: { showId: showSummary.id, seatIds: [holdProbeSeat.id] }
    });
    assert(hold.holds?.length === 1, "Seat hold was not created");
    const heldShow = await request(`/shows/${showSummary.id}`);
    assert(heldShow.show.screen.seats.find((seat) => seat.id === holdProbeSeat.id)?.isReserved === true, "Held seat did not appear unavailable");
    const release = await request("/holds/release", {
      method: "POST",
      token: customerToken,
      body: { holdIds: hold.holds.map((item) => item.id) }
    });
    assert(release.released === 1, "Seat hold was not released");
    console.log("[ok] 5-minute seat hold and release flow passed");
  }

  const bookingResponse = await request("/bookings", {
    method: "POST",
    token: customerToken,
    body: { showId: showSummary.id, seatIds: availableSeats.map((seat) => seat.id) }
  });
  const booking = bookingResponse.booking;
  assert(booking.confirmationCode?.startsWith("CB-"), "Booking did not return a confirmation code");
  console.log(`[ok] created booking ${booking.confirmationCode}`);

  const duplicateBooking = await expectRequestError("/bookings", {
    method: "POST",
    token: customerToken,
    body: { showId: showSummary.id, seatIds: availableSeats.map((seat) => seat.id) }
  });
  assert(duplicateBooking.status === 409, "Duplicate active seat booking did not return 409");
  console.log("[ok] duplicate active seats were rejected");

  const confirmed = await waitForConfirmedBooking(customerToken, booking.id);
  assert(confirmed.seats.length === availableSeats.length, "Confirmed booking seat count did not match request");
  console.log(`[ok] worker confirmed booking ${confirmed.confirmationCode}`);

  const payment = await request("/payments/process", {
    method: "POST",
    token: customerToken,
    body: { bookingId: booking.id, cardNumber: "4242424242424242" }
  });
  assert(payment.payment.transactionId?.startsWith("TXN-"), "Payment did not return a transaction id");
  assert(payment.booking.paymentStatus === "SUCCEEDED", "Booking was not marked paid after payment");
  console.log("[ok] simulated payment succeeded");

  const cancelled = await request(`/bookings/${booking.id}/cancel`, {
    method: "PATCH",
    token: customerToken
  });
  assert(cancelled.booking.status === "CANCELLED", "Cancellation did not mark booking as CANCELLED");
  assert(cancelled.booking.paymentStatus === "REFUNDED", "Paid booking cancellation did not refund payment");
  console.log("[ok] cancellation released the original booking and refunded payment");

  const rebookingResponse = await request("/bookings", {
    method: "POST",
    token: customerToken,
    body: { showId: showSummary.id, seatIds: availableSeats.map((seat) => seat.id) }
  });
  const rebooking = rebookingResponse.booking;
  assert(rebooking.id !== booking.id, "Rebooking reused the original booking id");
  const confirmedRebooking = await waitForConfirmedBooking(customerToken, rebooking.id);
  assert(confirmedRebooking.status === "CONFIRMED", "Rebooking was not confirmed by the worker");

  const cancelledRebooking = await request(`/bookings/${rebooking.id}/cancel`, {
    method: "PATCH",
    token: customerToken
  });
  assert(cancelledRebooking.booking.status === "CANCELLED", "Rebooking cancellation did not mark booking as CANCELLED");
  console.log("[ok] cancelled seats can be rebooked and cancelled again");

  const raceBookingResponse = await request("/bookings", {
    method: "POST",
    token: customerToken,
    body: { showId: showSummary.id, seatIds: availableSeats.map((seat) => seat.id) }
  });
  const raceBooking = raceBookingResponse.booking;
  const cancelledRaceBooking = await request(`/bookings/${raceBooking.id}/cancel`, {
    method: "PATCH",
    token: customerToken
  });
  assert(cancelledRaceBooking.booking.status === "CANCELLED", "Immediate cancellation did not mark booking as CANCELLED");
  const stableCancelledBooking = await waitForBookingStatus(customerToken, raceBooking.id, "CANCELLED");
  assert(stableCancelledBooking.status === "CANCELLED", "Worker changed an immediately cancelled booking");
  console.log("[ok] worker does not confirm immediately cancelled bookings");

  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(adminLogin.user?.role === "ADMIN", "Admin login did not return an admin user");

  const summary = await request("/admin/summary", { token: adminLogin.token });
  assert(Number.isInteger(summary.users) && summary.users >= 2, "Admin summary has an invalid user count");
  assert(Number.isInteger(summary.movies) && summary.movies > 0, "Admin summary has an invalid movie count");
  assert(Number.isInteger(summary.shows) && summary.shows > 0, "Admin summary has an invalid show count");
  assert(Number.isInteger(summary.bookings), "Admin summary has an invalid booking count");

  const adminBookings = await request("/admin/bookings", { token: adminLogin.token });
  assert(Array.isArray(adminBookings.bookings), "Admin bookings response is missing bookings");
  assert(adminBookings.bookings.some((item) => item.id === booking.id), "Admin bookings did not include the smoke booking");

  const catalog = await request("/admin/catalog", { token: adminLogin.token });
  assert(Array.isArray(catalog.movies) && catalog.movies.length > 0, "Admin catalog has no movies");
  assert(Array.isArray(catalog.screens) && catalog.screens.length > 0, "Admin catalog has no screens");

  const overlappingStartsAt = new Date(new Date(showDetails.show.startsAt).getTime() + 30 * 60_000).toISOString();
  const overlappingShow = await expectRequestError("/admin/shows", {
    method: "POST",
    token: adminLogin.token,
    body: {
      movieId: showDetails.show.movie.id,
      screenId: showDetails.show.screen.id,
      startsAt: overlappingStartsAt,
      basePrice: 260
    }
  });
  assert(overlappingShow.status === 409, "Overlapping admin show scheduling did not return 409");
  assert(
    overlappingShow.payload?.message === "A show already overlaps on that screen or cleaning buffer",
    "Overlapping show scheduling returned an unexpected error message"
  );

  const pastShow = await expectRequestError("/admin/shows", {
    method: "POST",
    token: adminLogin.token,
    body: {
      movieId: catalog.movies[0].id,
      screenId: catalog.screens[0].id,
      startsAt: "2020-01-01T00:00:00.000Z",
      basePrice: 260
    }
  });
  assert(pastShow.status === 400, "Past admin show scheduling did not return 400");
  assert(pastShow.payload?.message === "Showtime must be in the future", "Past show scheduling returned an unexpected error message");

  const reports = await request("/admin/reports", { token: adminLogin.token });
  assert(reports.reports?.daily && reports.reports?.weekly && reports.reports?.monthly, "Admin reports are incomplete");
  const activity = await request("/admin/activity", { token: adminLogin.token });
  assert(Array.isArray(activity.logs) && activity.logs.length > 0, "Admin activity log is empty");
  console.log("[ok] admin summary, reports, activity, and scheduling guards passed");

  const managerLogin = await request("/auth/login", {
    method: "POST",
    body: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD }
  });
  assert(managerLogin.user?.role === "HALL_MANAGER", "Manager login did not return a hall manager");
  const managerScreens = await request("/manager/screens", { token: managerLogin.token });
  assert(Array.isArray(managerScreens.screens) && managerScreens.screens.length > 0, "Manager has no assigned screens");
  const forbiddenManagerShow = await expectRequestError("/manager/shows", {
    method: "POST",
    token: managerLogin.token,
    body: {
      movieId: catalog.movies[0].id,
      screenId: catalog.screens.find((screen) => screen.id !== managerScreens.screens[0].id)?.id ?? "missing-screen",
      startsAt: new Date(Date.now() + 29 * 24 * 60 * 60_000).toISOString(),
      basePrice: 260
    }
  });
  assert([400, 403].includes(forbiddenManagerShow.status), "Manager was not blocked from an unassigned screen");
  console.log("[ok] hall manager assigned-screen permissions passed");

  console.log("Smoke test passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

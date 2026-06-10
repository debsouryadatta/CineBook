# CineBook

A full-stack movie ticket booking system built with Node.js, Express, Prisma, PostgreSQL, Redis, BullMQ, React, TypeScript, Tailwind, and shadcn-style components.

## Features

- JWT authentication with registration, login, secure session restore, simulated phone verification, and user/hall-manager/admin roles
- Movie, theater, screen, showtime, and seat browsing with filters for release date, genre, theatre chain, screen type, format, language, age rating, and location
- Redis-cached movie/show listings
- Five-minute Redis/Postgres-backed seat holds, transaction-safe booking, and double-booking protection
- Simulated card payments with success/failure/random-failure cards, transaction IDs, refunds, and a payment circuit breaker
- Booking history, cancellation, refunds, and ticket confirmation codes
- BullMQ worker for asynchronous ticket confirmation processing
- OpenAI-powered recommendations using `gpt-4.1`, with a deterministic fallback
- Custom-built `gpt-4.1` AI chatbot with 25 function tools, tool chaining, conversation context, and booking-assistant delegation
- Hall manager assigned-screen scheduling with overlap, 30-minute cleaning buffer, 30-day horizon, and no-edit/delete rules for shows with bookings
- Admin user, theatre, screen, reports, override scheduling, and activity-log APIs
- Redis-backed abuse limits for chat messages, booking attempts, and phone verification requests
- Dockerized backend, worker, Postgres, and Redis
- React frontend for registration, login, browse filters, seat selection, holds, payment, chatbot, account, manager, and admin flows

## Run

Run project commands from `backend/`. The repository root is intentionally kept to only `backend/` and `frontend/`.

1. Install backend and frontend dependencies:

```bash
cd backend
npm install
npm --prefix ../frontend install
```

2. Copy `backend/.env.example` to `backend/.env` and add `OPENAI_API_KEY` when available. All OpenAI calls use `gpt-4.1` from code.
3. Start backend infrastructure:

```bash
npm run docker:up
```

4. In another terminal from `backend/`, start the frontend:

```bash
npm run dev:frontend
```

Backend: `http://localhost:4000/api`
Frontend: `http://localhost:5174`

Seeded users:

- `admin@cinebook.local` / `Admin@123`
- `manager@cinebook.local` / `Manager@123`
- `demo@cinebook.local` / `Demo@123`

## Verify

```bash
npm run test
npm run build
npm run build:frontend
npm run lint:frontend
npm run smoke
npm audit --omit=dev
docker compose ps
curl http://localhost:4000/api/health
curl http://localhost:4000/api/ready
```

`/api/ready` checks Express, PostgreSQL, and Redis. Docker Compose uses it as the backend healthcheck before starting the worker. The worker container also has its own healthcheck that verifies it can reach PostgreSQL and Redis.

The seed command is idempotent: it ensures demo/admin users exist and creates the sample catalog only when the catalog is empty, so persisted bookings are not wiped on backend restarts.

`npm run smoke` expects the Docker Compose stack to be running. It exercises the real API over HTTP: readiness, user registration, simulated phone verification, token restore, user login, movie filter metadata and filtered search, movie/show lookup, OpenAI recommendation fallback or provider response, custom chatbot tool registry and booking-assistant delegation, seat holds and release, seat booking, duplicate-seat rejection, BullMQ worker confirmation, simulated payment, cancellation refund, rebooking released seats, worker-safe immediate cancellation, admin login, admin summary, admin recent bookings, admin catalog, admin reports, admin activity logs, overlapping show rejection, scheduling validation, and hall-manager assigned-screen enforcement. Override the target with `API_BASE_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_MANAGER_EMAIL`, or `SMOKE_MANAGER_PASSWORD` when needed.

## API Overview

All routes are under `http://localhost:4000/api`.

Public:

- `GET /health` - lightweight API liveness check.
- `GET /ready` - API, PostgreSQL, and Redis readiness check.
- `POST /auth/register` - create a user account.
- `POST /auth/phone/request` - request a simulated phone verification code; the demo code is `123456`.
- `POST /auth/phone/verify` - verify a phone number with the simulated code.
- `POST /auth/login` - sign in and receive a JWT.
- `GET /movies` - list currently showing movies. Supports `q`, `city`, `genre`, `chain`, `screenType`, `format`, `language`, `rating`, and `releaseDate`.
- `GET /movies/:slug` - movie details with upcoming shows.
- `GET /movies/meta/cities` - filter metadata for cities, chains, genres, languages, ratings, screen types, and formats.
- `GET /shows/:id` - show details with seat availability and prices.
- `POST /ai/recommend` - OpenAI-backed movie recommendations, with fallback when no API key is configured.

Authenticated:

- `GET /auth/me` - current user profile.
- `GET /chat/tools` - available custom chatbot tool definitions.
- `POST /chat/messages` - send a natural-language chatbot message and receive tool-chain output.
- `POST /holds` - hold selected seats for five minutes with `{ showId, seatIds }`.
- `POST /holds/release` - release active holds.
- `GET /bookings` - current user's bookings.
- `POST /bookings` - create a booking with `{ showId, seatIds, holdIds? }`.
- `PATCH /bookings/:id/cancel` - cancel an upcoming booking.
- `POST /payments/process` - process a simulated payment. Use `4242424242424242` for success, `4000000000000002` for failure, and cards ending in `3000` for random failure.

Hall Manager:

- `GET /manager/screens` - assigned screens and their upcoming shows.
- `POST /manager/shows` - schedule a show for an assigned screen.
- `PATCH /manager/shows/:id` - edit an unbooked show on an assigned screen.
- `DELETE /manager/shows/:id` - delete an unbooked show on an assigned screen.

Admin:

- `GET /admin/summary` - users, movies, shows, bookings, and revenue totals.
- `GET /admin/catalog` - movies and screens for admin scheduling forms.
- `GET /admin/bookings` - latest bookings across users for admin operations.
- `GET /admin/users` / `PATCH /admin/users/:id` - user management, role assignment, disable accounts, assign manager screens.
- `GET /admin/theaters` / `POST /admin/theaters` - theatre chain and location management.
- `POST /admin/screens` - create screens with generated seating layouts and equipment metadata.
- `GET /admin/reports` - daily, weekly, and monthly booking/revenue reports.
- `GET /admin/activity` - recent admin/customer/chat activity logs.
- `POST /admin/movies` - create a movie.
- `POST /admin/shows` - override schedule a future show on any screen.

Use the JWT as `Authorization: Bearer <token>` for authenticated and admin routes.

AI recommendations use OpenAI `gpt-4.1` when `OPENAI_API_KEY` is configured. If no key is present, or if the OpenAI request fails, the API returns deterministic fallback recommendations from the live catalog so the frontend remains usable. The chatbot also uses `gpt-4.1` with OpenAI function calling: the model selects from the 25 CineBook tools, the backend executes requested tools, appends tool outputs, and repeats until the model returns the final assistant message.

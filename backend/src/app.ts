import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";
import { authRouter } from "./routes/auth.js";
import { moviesRouter } from "./routes/movies.js";
import { showsRouter } from "./routes/shows.js";
import { bookingsRouter } from "./routes/bookings.js";
import { holdsRouter } from "./routes/holds.js";
import { paymentsRouter } from "./routes/payments.js";
import { aiRouter } from "./routes/ai.js";
import { chatRouter } from "./routes/chat.js";
import { managerRouter } from "./routes/manager.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler, notFound } from "./utils/errors.js";

export const app = express();

app.use(helmet());
const allowedOrigins = new Set([
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175"
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || /^https?:\/\/(?:localhost|127\.0\.0\.1):517\d$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cinebook-api" });
});

app.get("/api/ready", async (_req, res) => {
  const checks = {
    api: "ok",
    database: "unknown",
    redis: "unknown"
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    checks.redis = (await redis.ping()) === "PONG" ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const ok = checks.database === "ok" && checks.redis === "ok";
  res.status(ok ? 200 : 503).json({ ok, service: "cinebook-api", checks });
});

app.use("/api/auth", authRouter);
app.use("/api/movies", moviesRouter);
app.use("/api/shows", showsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/holds", holdsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/chat", chatRouter);
app.use("/api/manager", managerRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

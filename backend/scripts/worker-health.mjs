import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  connectTimeout: 3000
});

try {
  await prisma.$queryRaw`SELECT 1`;
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error("Redis ping failed");
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Worker healthcheck failed");
  process.exit(1);
} finally {
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
}

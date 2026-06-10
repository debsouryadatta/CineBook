import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export async function getCached<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setCached(key: string, value: unknown, seconds = 60) {
  await redis.set(key, JSON.stringify(value), "EX", seconds);
}

export async function bustCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(keys);
}

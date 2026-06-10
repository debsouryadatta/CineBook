import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/errors.js";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  key(req: Request): string;
};

export function rateLimit({ keyPrefix, limit, windowSeconds, key }: RateLimitOptions) {
  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const identifier = key(req);
      const redisKey = `rate:${keyPrefix}:${identifier}`;
      const count = await redis.incr(redisKey);

      if (count === 1) await redis.expire(redisKey, windowSeconds);

      const ttl = await redis.ttl(redisKey);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(limit - count, 0)));
      res.setHeader("X-RateLimit-Reset", String(Math.max(ttl, 0)));

      if (count > limit) {
        throw new AppError(429, `Too many attempts. Try again in ${Math.max(ttl, 1)} seconds.`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

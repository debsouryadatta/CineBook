import { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";
import { verifyToken, type JwtUser } from "../utils/tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError(401, "Authentication required");

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) throw new AppError(403, "Admin access required");
  next();
}

export function requireManagerOrAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== Role.HALL_MANAGER && req.user?.role !== Role.ADMIN) {
    throw new AppError(403, "Hall manager access required");
  }
  next();
}

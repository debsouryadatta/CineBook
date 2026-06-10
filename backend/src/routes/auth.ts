import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { logActivity } from "../services/activityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { signToken } from "../utils/tokens.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const verificationRequestSchema = z.object({
  phone: z.string().min(8)
});

const verificationConfirmSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6)
});

const phoneVerificationLimit = rateLimit({
  keyPrefix: "phone-verification",
  limit: 5,
  windowSeconds: 60 * 60,
  key: (req) => String(req.body?.phone ?? req.ip)
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError(409, "Email already registered");
    if (input.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) throw new AppError(409, "Phone already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, phone: input.phone, passwordHash },
      select: { id: true, name: true, email: true, phone: true, phoneVerified: true, role: true }
    });

    await logActivity({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id });
    res.status(201).json({ user, token: signToken(user) });
  })
);

authRouter.post(
  "/phone/request",
  phoneVerificationLimit,
  asyncHandler(async (req, res) => {
    const input = verificationRequestSchema.parse(req.body);
    const code = "123456";
    const verification = await prisma.phoneVerification.create({
      data: {
        phone: input.phone,
        code,
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    });

    await logActivity({
      action: "auth.phone_verification.request",
      entityType: "PhoneVerification",
      entityId: verification.id,
      metadata: { phone: input.phone }
    });

    res.status(201).json({
      verificationId: verification.id,
      phone: input.phone,
      expiresAt: verification.expiresAt,
      simulatedCode: code
    });
  })
);

authRouter.post(
  "/phone/verify",
  asyncHandler(async (req, res) => {
    const input = verificationConfirmSchema.parse(req.body);
    const verification = await prisma.phoneVerification.findFirst({
      where: { phone: input.phone, verified: false },
      orderBy: { createdAt: "desc" }
    });

    if (!verification || verification.expiresAt <= new Date()) throw new AppError(400, "Verification code expired or missing");
    if (verification.code !== input.code) {
      await prisma.phoneVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
      throw new AppError(400, "Invalid verification code");
    }

    await prisma.$transaction([
      prisma.phoneVerification.update({ where: { id: verification.id }, data: { verified: true } }),
      prisma.user.updateMany({ where: { phone: input.phone }, data: { phoneVerified: true } })
    ]);

    await logActivity({
      action: "auth.phone_verification.verify",
      entityType: "PhoneVerification",
      entityId: verification.id,
      metadata: { phone: input.phone }
    });

    res.json({ phone: input.phone, verified: true });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new AppError(401, "Invalid credentials");
    if (user.disabled) throw new AppError(403, "Account is disabled");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new AppError(401, "Invalid credentials");

    const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, phoneVerified: user.phoneVerified, role: user.role };
    await logActivity({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
    res.json({ user: safeUser, token: signToken(safeUser) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, phoneVerified: true, role: true, disabled: true }
    });
    res.json({ user });
  })
);

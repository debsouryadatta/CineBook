import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AppError } from "../utils/errors.js";
import { calculateTotalAmount, toBookingError } from "./bookingUtils.js";

describe("bookingService", () => {
  it("calculates totals from base show price plus seat modifiers", () => {
    const total = calculateTotalAmount(
      { basePrice: 260 },
      [
        { id: "classic-1", priceModifier: 0 },
        { id: "premium-1", priceModifier: 120 },
        { id: "premium-2", priceModifier: 120 }
      ]
    );

    expect(total).toBe(1020);
  });

  it("maps Prisma unique constraint errors to a conflict AppError", () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "test",
      code: "P2002"
    });

    const mapped = toBookingError(prismaError);

    expect(mapped).toBeInstanceOf(AppError);
    expect((mapped as AppError).statusCode).toBe(409);
    expect((mapped as AppError).message).toContain("selected seats");
  });

  it("leaves non-Prisma errors untouched", () => {
    const error = new Error("network failed");
    expect(toBookingError(error)).toBe(error);
  });
});

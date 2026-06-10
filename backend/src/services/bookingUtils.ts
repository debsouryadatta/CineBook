import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";

type SeatLike = {
  id: string;
  priceModifier: number;
};

type ShowLike = {
  basePrice: number;
};

export function calculateTotalAmount(show: ShowLike, seats: SeatLike[]) {
  return seats.reduce((sum, seat) => sum + show.basePrice + seat.priceModifier, 0);
}

export function toBookingError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new AppError(409, "One or more selected seats were just booked");
  }
  return error;
}

import { API_URL } from "./config";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  role: "USER" | "HALL_MANAGER" | "ADMIN";
};

export type Movie = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  language: string;
  genre: string;
  rating: string;
  durationMin: number;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string;
  cast: string[];
  releaseDate: string;
};

export type Show = {
  id: string;
  startsAt: string;
  basePrice: number;
  movie: Movie;
  screen: {
    id: string;
    name: string;
    type?: string;
    format?: string;
    equipment?: string[];
    theater: { id: string; name: string; city: string; address: string; chain?: string };
    seats: Seat[];
  };
};

export type Seat = {
  id: string;
  row: string;
  number: number;
  type: string;
  priceModifier: number;
  price: number;
  isReserved: boolean;
};

export type Booking = {
  id: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  totalAmount: number;
  confirmationCode: string;
  createdAt: string;
  show: Show;
  seats: Array<{ seat: Seat; price: number }>;
};

export async function api<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("cinebook-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? "Request failed");
  }
  return (await response.json()) as T;
}

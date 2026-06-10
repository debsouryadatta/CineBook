import jwt from "jsonwebtoken";
import { Role, type User } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
};

export function signToken(user: Pick<User, "id" | "email" | "role" | "name">) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as JwtUser;
}

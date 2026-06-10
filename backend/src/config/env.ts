import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
function findBackendRoot(startDir: string) {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    if (existsSync(path.join(currentDir, "package.json")) && existsSync(path.join(currentDir, "prisma"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

const backendRoot = findBackendRoot(moduleDir);
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(backendRoot, ".env")
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(12).default("dev-secret-change-me"),
  OPENAI_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().default(4000)
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const missing = parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Missing or invalid environment variables: ${missing}. Create backend/.env from backend/.env.example before starting the backend.`);
}

export const env = parsedEnv.data;
export const OPENAI_MODEL = "gpt-4.1" as const;

import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

type LogActivityInput = {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  durationMs?: number;
  requestId?: string;
  metadata?: Prisma.InputJsonObject;
};

export async function logActivity({
  actorId,
  action,
  entityType,
  entityId,
  success = true,
  durationMs = 0,
  requestId,
  metadata
}: LogActivityInput) {
  await prisma.activityLog.create({
    data: {
      actorId: actorId ?? undefined,
      action,
      entityType,
      entityId,
      success,
      durationMs,
      requestId,
      metadata
    }
  });
}

export async function measureActivity<T>(input: Omit<LogActivityInput, "durationMs" | "success">, work: () => Promise<T>) {
  const startedAt = Date.now();

  try {
    const result = await work();
    await logActivity({ ...input, success: true, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logActivity({
      ...input,
      success: false,
      durationMs: Date.now() - startedAt,
      metadata: { ...(input.metadata ?? {}), error: error instanceof Error ? error.message : "Unknown error" }
    });
    throw error;
  }
}

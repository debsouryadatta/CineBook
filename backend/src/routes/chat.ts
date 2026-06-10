import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { logActivity, measureActivity } from "../services/activityLog.js";
import { CINEBOOK_TOOLS, handleChatMessage } from "../services/chatbot.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const chatRouter = Router();

const messageSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().min(1).max(1200)
});

const chatLimit = rateLimit({
  keyPrefix: "chat-message",
  limit: 30,
  windowSeconds: 60,
  key: (req) => req.user?.id ?? req.ip ?? "anonymous"
});

chatRouter.use(requireAuth);

chatRouter.get("/tools", (_req, res) => {
  res.json({ tools: CINEBOOK_TOOLS, count: CINEBOOK_TOOLS.length });
});

chatRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 30 } }
    });
    res.json({ conversations });
  })
);

chatRouter.post(
  "/messages",
  chatLimit,
  asyncHandler(async (req, res) => {
    const input = messageSchema.parse(req.body);
    const result = await measureActivity(
      {
        actorId: req.user!.id,
        action: "chat.message",
        entityType: "ChatConversation",
        entityId: input.conversationId,
        metadata: { messageLength: input.message.length }
      },
      () => handleChatMessage({ userId: req.user!.id, message: input.message, conversationId: input.conversationId })
    );

    await logActivity({
      actorId: req.user!.id,
      action: "chat.tools",
      entityType: "ChatConversation",
      entityId: result.conversationId,
      metadata: { assistantMode: result.assistantMode, tools: result.tools.map((tool) => tool.toolName) }
    });

    res.status(201).json(result);
  })
);

chatRouter.post("/messages/stream", chatLimit, async (req, res, next) => {
  const sendEvent = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const input = messageSchema.parse(req.body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const result = await measureActivity(
      {
        actorId: req.user!.id,
        action: "chat.message.stream",
        entityType: "ChatConversation",
        entityId: input.conversationId,
        metadata: { messageLength: input.message.length }
      },
      () =>
        handleChatMessage(
          { userId: req.user!.id, message: input.message, conversationId: input.conversationId },
          { onEvent: sendEvent }
        )
    );

    await logActivity({
      actorId: req.user!.id,
      action: "chat.tools",
      entityType: "ChatConversation",
      entityId: result.conversationId,
      metadata: { assistantMode: result.assistantMode, tools: result.tools.map((tool) => tool.toolName), streamed: true }
    });

    sendEvent({
      type: "message_done",
      conversationId: result.conversationId,
      assistantMode: result.assistantMode,
      tools: result.toolRuns,
      message: result.message
    });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
      return;
    }
    sendEvent({ type: "error", message: error instanceof Error ? error.message : "Unable to stream chat response" });
    res.end();
  }
});

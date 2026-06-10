import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildFallbackRecommendations, parseOpenAIRecommendations } from "../services/aiUtils.js";
import { getOpenAIClient, OPENAI_MODEL } from "../services/openai.js";

export const aiRouter = Router();

const recommendSchema = z.object({
  mood: z.string().min(2).max(80),
  city: z.string().optional()
});

aiRouter.post(
  "/recommend",
  asyncHandler(async (req, res) => {
    const input = recommendSchema.parse(req.body);
    const movies = await prisma.movie.findMany({
      where: {
        shows: {
          some: {
            startsAt: { gte: new Date() },
            screen: input.city ? { theater: { city: { equals: input.city, mode: "insensitive" } } } : undefined
          }
        }
      },
      take: 8
    });

    const client = getOpenAIClient();
    if (!client) {
      return res.json({ recommendations: buildFallbackRecommendations(movies, input.mood), provider: "fallback" });
    }

    try {
      const completion = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "Recommend up to three movies from the supplied JSON. Return strict JSON with recommendations: [{movieId,title,reason}]."
          },
          { role: "user", content: JSON.stringify({ mood: input.mood, movies }) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      return res.json(parseOpenAIRecommendations(completion.choices[0]?.message.content, movies, input.mood));
    } catch (error) {
      console.warn("OpenAI recommendations failed; falling back to catalog recommendations", error);
      return res.json({ recommendations: buildFallbackRecommendations(movies, input.mood), provider: "fallback" });
    }
  })
);

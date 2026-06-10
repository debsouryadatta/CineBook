import OpenAI from "openai";
import { env, OPENAI_MODEL } from "../config/env.js";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) return null;

  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export { OPENAI_MODEL };

import { Queue } from "bullmq";
import { env } from "../config/env.js";

export const ticketQueue = new Queue("ticket-confirmations", {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null
  }
});

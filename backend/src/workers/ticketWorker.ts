import { BookingStatus } from "@prisma/client";
import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const worker = new Worker(
  "ticket-confirmations",
  async (job) => {
    const bookingId = job.data.bookingId as string;
    const result = await prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.CONFIRMED }
    });
    return { bookingId, confirmed: result.count === 1 };
  },
  {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    }
  }
);

worker.on("completed", (job) => {
  console.log(`Confirmed booking job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Ticket job ${job?.id} failed`, error);
});

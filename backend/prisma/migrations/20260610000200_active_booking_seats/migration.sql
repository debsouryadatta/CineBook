ALTER TABLE "BookingSeat" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "BookingSeat" AS bs
SET "active" = false
FROM "Booking" AS b
WHERE bs."bookingId" = b."id"
  AND b."status" = 'CANCELLED';

DROP INDEX IF EXISTS "BookingSeat_showId_seatId_key";

CREATE INDEX "BookingSeat_showId_seatId_active_idx" ON "BookingSeat"("showId", "seatId", "active");

CREATE UNIQUE INDEX "BookingSeat_active_show_seat_key"
ON "BookingSeat"("showId", "seatId")
WHERE "active" = true;

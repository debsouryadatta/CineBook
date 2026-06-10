export type ShowtimeWindowInput = {
  startsAt: Date;
  durationMin: number;
  cleaningBufferMin?: number;
};

export function getShowtimeEndAt({ startsAt, durationMin }: ShowtimeWindowInput) {
  return new Date(startsAt.getTime() + durationMin * 60_000);
}

export function showtimesOverlap(left: ShowtimeWindowInput, right: ShowtimeWindowInput) {
  const leftEndsAt = new Date(getShowtimeEndAt(left).getTime() + (left.cleaningBufferMin ?? 0) * 60_000);
  const rightEndsAt = new Date(getShowtimeEndAt(right).getTime() + (right.cleaningBufferMin ?? 0) * 60_000);

  return left.startsAt < rightEndsAt && right.startsAt < leftEndsAt;
}

export function isWithinSchedulingWindow(startsAt: Date, now = new Date(), daysAhead = 30) {
  const latest = new Date(now.getTime() + daysAhead * 24 * 60 * 60_000);
  return startsAt > now && startsAt <= latest;
}

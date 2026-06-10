import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("seed script", () => {
  it("does not include destructive booking cleanup", () => {
    const source = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

    expect(source).not.toContain("bookingSeat.deleteMany");
    expect(source).not.toContain("booking.deleteMany");
    expect(source).toContain("existing catalog preserved");
  });
});

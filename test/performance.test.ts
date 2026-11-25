import { describe, expect, it } from "vitest";
import { parsePrisma, parseSql } from "../src/schema.js";

// Inputs built to make a careless pattern backtrack (CodeQL js/polynomial-redos, 25 Nov 2026). Each must finish well
// inside a second; a quadratic pattern takes minutes here.
const N = 200_000;

describe("performance", () => {
  it("an ALTER TABLE followed by a long run of spaces and no semicolon", () => {
    const started = performance.now();
    parseSql([{ file: "a.sql", source: `alter table " ${" ".repeat(N)}` }]);
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it("a long Prisma field line", () => {
    const started = performance.now();
    parsePrisma(`model User {\n  a a${"aa".repeat(N / 2)}\n}`);
    parsePrisma(`model User {\n  ${"a ".repeat(N / 2)}\n}`);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

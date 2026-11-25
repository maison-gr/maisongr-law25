import { describe, expect, it } from "vitest";
import { parsePrisma, parseSql } from "../src/schema.js";
import { READERS } from "../src/readers/index.js";

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

  // Every reader, and the test of whether a file uses its stack, on the inputs that make patterns and scanners slow:
  // long runs of spaces, of one letter, of unclosed brackets and quotes, deep nesting, and long lines of each.
  const spaces = " ".repeat(N);
  const hostile = [
    spaces, `${spaces}x`, "a".repeat(N), `${"a".repeat(N)}!`, "(".repeat(N), "{".repeat(N), "[".repeat(N), "<".repeat(N),
    '"'.repeat(N), "'".repeat(N), "`".repeat(N), "/*".repeat(N / 2), "#".repeat(N), "\n".repeat(N), `\n${spaces}`.repeat(10),
    `class A${spaces}`, `class A(${spaces}`, `pgTable("t",${spaces}`, `new Schema${spaces}`, `@Entity${spaces}class`, `@Column${spaces}`,
    `type A struct {${spaces}`, `create_table${spaces}`, `$table->${"a".repeat(N)}`, `Schema::create(${spaces}`, `DbSet<${spaces}`,
    `openapi: 3\n${"  ".repeat(N / 4)}a:`, `${"- ".repeat(N / 2)}`, `x: ${"{".repeat(N)}`, `${"a.".repeat(N / 2)}`, `Mapped[${spaces}`,
    `${"a ".repeat(N / 2)}`, `= ${"models.".repeat(N / 8)}`, `@${"a.".repeat(N / 2)}Entity`, `${"t.string ".repeat(N / 10)}`,
    // One opener repeated, never closed: each match must not scan to the end again.
    ...['pgTable("t", {', "new Schema({", '.define("U", {', "U.init({", "@Entity class A {", "@Entity\nclass A(", "type A struct {",
      "Schema::create('t', function ($table) {", "function down() {", "down() {", "class A : B {", "DbSet<A> ", "Table(\"t\", ",
      "AutoMigrate(", "class A(Base):\n", " ".repeat(8) + "class A(models.Model):\n", "create_table :t do |t|\n", "properties:\n  ",
    ].map((opener) => opener.repeat(Math.floor(N / opener.length))),
    Array.from({ length: 2000 }, (_, i) => `${" ".repeat(i)}class A${i}(Base):`).join("\n"),
  ];

  for (const reader of READERS.filter((r) => r.stack !== "sql" && r.stack !== "prisma")) {
    it(`${reader.stack}: every hostile input, read whole`, () => {
      const started = performance.now();
      for (const source of hostile) {
        const file = `db/schema${reader.exts[0]}`;
        reader.uses(source, file);
        reader.parse([{ file, source }]);
      }
      expect(performance.now() - started).toBeLessThan(3000);
    });
  }
});

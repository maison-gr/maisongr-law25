// Finding and reading the config and the schema.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parsePrisma, parseSql, type Field } from "./schema.js";
import type { Assessment } from "./types.js";

export const CONFIG_NAMES = ["law25.config.mjs", "law25.config.js", "law25.config.json"];

export function findConfig(cwd: string, given?: string): string | null {
  if (given) return resolve(cwd, given);
  for (const name of CONFIG_NAMES) if (existsSync(join(cwd, name))) return join(cwd, name);
  return null;
}

export async function loadConfig(path: string): Promise<Assessment> {
  if (extname(path) === ".json") return JSON.parse(readFileSync(path, "utf8")) as Assessment;
  // A query string makes Node read the file again when it changed (watch mode, tests).
  const mod = (await import(`${pathToFileURL(path).href}?t=${statSync(path).mtimeMs}`)) as { default?: Assessment };
  if (!mod.default) throw new Error(`${basename(path)} has no default export: export default defineAssessment({ … })`);
  return mod.default;
}

export interface SchemaSource {
  kind: "prisma" | "sql";
  /** The files read, relative to the project. */
  files: string[];
  fields: Field[];
}

const PRISMA_PLACES = ["prisma/schema.prisma", "schema.prisma", "prisma/schema"];
const SQL_PLACES = ["supabase/migrations", "migrations", "db/migrations", "database/migrations", "sql"];

/** The schema to check against: the paths given, or the usual places of a Prisma schema or SQL migrations. */
export function findSchema(cwd: string, given: { prisma?: string; sql?: string } = {}): SchemaSource | null {
  const prisma = given.prisma ?? (given.sql ? undefined : PRISMA_PLACES.find((p) => existsSync(join(cwd, p))));
  if (prisma) {
    const full = resolve(cwd, prisma);
    const files = statSync(full).isDirectory() ? walk(full, ".prisma") : [full];
    if (!files.length) throw new Error(`no .prisma file in ${prisma}`);
    const fields = files.flatMap((f) => parsePrisma(readFileSync(f, "utf8"), rel(cwd, f)));
    return { kind: "prisma", files: files.map((f) => rel(cwd, f)), fields };
  }
  const sql = given.sql ?? SQL_PLACES.find((p) => existsSync(join(cwd, p)) && walk(join(cwd, p), ".sql").length);
  if (sql) {
    const full = resolve(cwd, sql);
    // Migrations run in file name order (timestamps first), which is the order a column was added, then dropped.
    const files = (statSync(full).isDirectory() ? walk(full, ".sql") : [full]).sort();
    if (!files.length) throw new Error(`no .sql file in ${sql}`);
    const fields = parseSql(files.map((f) => ({ file: rel(cwd, f), source: readFileSync(f, "utf8") })));
    return { kind: "sql", files: files.map((f) => rel(cwd, f)), fields };
  }
  return null;
}

const rel = (cwd: string, f: string) => relative(cwd, f).replace(/\\/g, "/");

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== "node_modules" && !name.startsWith(".")) out.push(...walk(full, ext)); }
    else if (extname(name) === ext) out.push(full);
  }
  return out;
}

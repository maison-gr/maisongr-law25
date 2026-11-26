// Finding and reading the config and the schema.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parsePrisma, parseSql, type Field } from "./schema.js";
import { READERS, read, readerOf, sourceFiles, type Found, type Stack } from "./readers/index.js";
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
  /** The stack read, or "mixed" when the project uses several (Mongoose and TypeORM, say). */
  kind: Stack | "mixed";
  stacks: Stack[];
  /** The files read, relative to the project. */
  files: string[];
  fields: Field[];
}

const PRISMA_PLACES = ["prisma/schema.prisma", "schema.prisma", "prisma/schema"];
const SQL_PLACES = ["supabase/migrations", "migrations", "db/migrations", "database/migrations", "sql"];
/** A whole schema in one file (Supabase's schema.sql, a pg_dump, Rails' structure.sql): read before the migrations, which add to it. */
const SCHEMA_FILES = ["supabase/schema.sql", "db/structure.sql", "db/schema.sql", "database/schema.sql", "sql/schema.sql", "schema.sql"];
/** Stacks whose code describes the data: found anywhere in the project, read together. */
const CODE = READERS.filter((r) => !["prisma", "sql", "openapi"].includes(r.stack));

export interface SchemaGiven {
  prisma?: string;
  sql?: string;
  /** Files or folders to read, whatever the stack (`--schema`). */
  schema?: string[];
  /** The stack they are in, when it can't be told from them (`--stack`). */
  stack?: Stack;
}

/**
 * The schema to check against. Paths given are read as given. Otherwise: a Prisma schema in its usual place; else
 * the models of every ORM the code uses (Drizzle, TypeORM, Django, Rails, Entity Framework, GORM…); else SQL
 * migrations in their usual places; else an OpenAPI or JSON Schema file.
 */
export function findSchema(cwd: string, given: SchemaGiven = {}): SchemaSource | null {
  const prisma = given.prisma ?? (given.sql || given.schema?.length ? undefined : PRISMA_PLACES.find((p) => existsSync(join(cwd, p))));
  if (prisma) {
    const full = resolve(cwd, prisma);
    const files = statSync(full).isDirectory() ? walk(full, ".prisma") : [full];
    if (!files.length) throw new Error(`no .prisma file in ${prisma}`);
    const fields = files.flatMap((f) => parsePrisma(readFileSync(f, "utf8"), rel(cwd, f)));
    return { kind: "prisma", stacks: ["prisma"], files: files.map((f) => rel(cwd, f)), fields };
  }
  if (given.sql) return sqlAt(cwd, given.sql);
  if (given.schema?.length) {
    const exts = new Set((given.stack ? [readerOf(given.stack)] : READERS).flatMap((r) => r.exts));
    const paths = given.schema.flatMap((p) => {
      const full = resolve(cwd, p);
      if (!existsSync(full)) throw new Error(`${p} does not exist`);
      return statSync(full).isDirectory() ? sourceFiles(full, exts) : [full];
    });
    const found = given.stack
      ? read(cwd, paths, [readerOf(given.stack)], true)
      : first(read(cwd, paths, CODE), () => read(cwd, paths, READERS.filter((r) => !CODE.includes(r))));
    if (!found.fields.length) throw new Error(`no ${given.stack ? readerOf(given.stack).label.replace(/^the /, "") : "schema"} found in ${given.schema.join(", ")}${given.stack ? "" : ": pass --stack"}`);
    return source(found);
  }
  const code = read(cwd, sourceFiles(cwd, new Set(CODE.flatMap((r) => r.exts))), CODE);
  if (code.fields.length) return source(code);
  const schemaFile = SCHEMA_FILES.find((p) => existsSync(join(cwd, p)));
  const sql = SQL_PLACES.find((p) => existsSync(join(cwd, p)) && walk(join(cwd, p), ".sql").length);
  if (schemaFile || sql) {
    const first = schemaFile ? [resolve(cwd, schemaFile)] : [];
    const migrations = sql ? walk(resolve(cwd, sql), ".sql").sort().filter((f) => !first.includes(f)) : [];
    return sqlFiles(cwd, [...first, ...migrations]);
  }
  const api = read(cwd, sourceFiles(cwd, new Set([".json", ".yaml", ".yml"])).filter((p) => /(^|[\\/])(openapi|swagger)[^\\/]*\.(json|ya?ml)$|\.schema\.json$/i.test(p)), [readerOf("openapi")]);
  return api.fields.length ? source(api) : null;
}

function sqlAt(cwd: string, sql: string): SchemaSource {
  const full = resolve(cwd, sql);
  // Migrations run in file name order (timestamps first), which is the order a column was added, then dropped.
  const files = (statSync(full).isDirectory() ? walk(full, ".sql") : [full]).sort();
  if (!files.length) throw new Error(`no .sql file in ${sql}`);
  return sqlFiles(cwd, files);
}

/** SQL files read in the order given: a schema first, then the migrations that change it. */
function sqlFiles(cwd: string, files: string[]): SchemaSource {
  const fields = parseSql(files.map((f) => ({ file: rel(cwd, f), source: readFileSync(f, "utf8") })));
  return { kind: "sql", stacks: ["sql"], files: files.map((f) => rel(cwd, f)), fields };
}

const first = (a: Found, b: () => Found) => (a.fields.length ? a : b());
const source = (f: Found): SchemaSource => ({ kind: f.stacks.length === 1 ? f.stacks[0]! : "mixed", stacks: f.stacks, files: f.files, fields: f.fields });

/** "the Django models (3 files)", for messages. */
export function describe(s: SchemaSource): string {
  const what = s.stacks.map((k) => readerOf(k).label);
  const list = what.length > 1 ? `${what.slice(0, -1).join(", ")} and ${what.at(-1)}` : what[0]!;
  return `${list} (${s.files.length === 1 ? s.files[0] : `${s.files.length} files`})`;
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

// Every stack law25 reads, how it recognises one in a project, and the files it reads.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { parsePrisma, parseSql, type Field } from "../schema.js";
import { parseDecorated, parseDrizzle, parseMongoose, parseSequelize } from "./javascript.js";
import { parseLaravel, parseRails } from "./migrations.js";
import { parseOpenApi } from "./openapi.js";
import { parseDjango, parseSqlAlchemy } from "./python.js";
import { parseEntityFramework, parseGorm, parseJpa } from "./typed.js";
import type { SourceFile } from "./scan.js";

export type Stack =
  | "prisma" | "sql" | "drizzle" | "typeorm" | "sequelize" | "mongoose" | "django" | "sqlalchemy" | "rails" | "laravel"
  | "entity-framework" | "jpa" | "gorm" | "openapi";

export interface Reader {
  stack: Stack;
  /** For messages: "checked against the Django models". */
  label: string;
  exts: string[];
  /** Whether a file is one this stack's code is in. */
  uses: (source: string, file: string) => boolean;
  /** Read every file of these extensions once one uses the stack: an entity named in one file is declared in another. */
  all?: boolean;
  parse: (files: SourceFile[]) => Field[];
}

const JS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];

export const READERS: Reader[] = [
  { stack: "prisma", label: "the Prisma schema", exts: [".prisma"], uses: (s) => /^[ \t]*model[ \t]+\w+[ \t]*\{/m.test(s), parse: (files) => files.flatMap((f) => parsePrisma(f.source, f.file)) },
  { stack: "drizzle", label: "the Drizzle tables", exts: JS, uses: (s) => /\b(?:pg|mysql|sqlite|singlestore)Table\s*\(/.test(s), parse: parseDrizzle },
  { stack: "typeorm", label: "the decorated entities (TypeORM, MikroORM, sequelize-typescript, NestJS)", exts: JS, uses: (s) => /@(?:Entity|Table|Schema|Embeddable)\b/.test(s) && /["'](?:typeorm|@mikro-orm\/|sequelize-typescript|@nestjs\/mongoose)/.test(s), parse: parseDecorated },
  { stack: "sequelize", label: "the Sequelize models", exts: JS, uses: (s) => /\b(?:DataTypes|Sequelize)\.\w+/.test(s) && /\.(?:define|init|createTable|addColumn)\s*\(/.test(s), parse: parseSequelize },
  { stack: "mongoose", label: "the Mongoose schemas", exts: JS, uses: (s) => /\bnew\s+(?:mongoose\.)?Schema\b/.test(s), parse: parseMongoose },
  { stack: "django", label: "the Django models", exts: [".py"], uses: (s) => /\bdjango\b/.test(s) && /\bmodels\.Model\b|\w+Field\s*\(/.test(s), parse: parseDjango },
  { stack: "sqlalchemy", label: "the SQLAlchemy models", exts: [".py"], uses: (s) => /\b(?:sqlalchemy|sqlmodel|flask_sqlalchemy|db\.Model)\b/.test(s), parse: parseSqlAlchemy },
  { stack: "rails", label: "the Rails schema", exts: [".rb"], uses: (s, f) => /(^|\/)db\/(schema\.rb|migrate\/)/.test(f) && /\b(?:create_table|add_column)\b/.test(s), parse: parseRails },
  { stack: "laravel", label: "the Laravel migrations", exts: [".php"], uses: (s) => /Schema::(?:create|table)\s*\(/.test(s), parse: parseLaravel },
  { stack: "entity-framework", label: "the Entity Framework entities", exts: [".cs"], uses: (s) => /\b(?:DbSet|IdentityDbContext)\s*</.test(s), all: true, parse: parseEntityFramework },
  { stack: "jpa", label: "the JPA entities", exts: [".java", ".kt"], uses: (s) => /@(?:\w+\.)*(?:Entity|Embeddable|MappedSuperclass)\b/.test(s), parse: parseJpa },
  { stack: "gorm", label: "the GORM models", exts: [".go"], uses: (s) => /\bgorm\b/.test(s), all: true, parse: parseGorm },
  { stack: "sql", label: "the SQL migrations", exts: [".sql"], uses: () => true, parse: parseSql },
  { stack: "openapi", label: "the OpenAPI or JSON Schema", exts: [".json", ".yaml", ".yml"], uses: (s) => /["']?(?:openapi|swagger)["']?:\s*["']?\d/.test(s.slice(0, 5000)) || /"\$schema"\s*:/.test(s.slice(0, 5000)), parse: parseOpenApi },
];

export const STACKS = READERS.map((r) => r.stack);
export const readerOf = (stack: Stack) => READERS.find((r) => r.stack === stack)!;

/** Folders never read: dependencies, builds, caches, and tests (their fixtures are not the project's data). */
const SKIP_DIRS = new Set(["node_modules", "vendor", "dist", "build", "out", "target", "bin", "obj", "coverage", "venv", "env", "__pycache__", "site-packages", "Pods", "test", "tests", "__tests__", "spec", "specs", "fixtures", "__fixtures__", "e2e", "storybook-static", "public", "static", "assets"]);
const TEST_FILE = /\.(test|spec|stories)\.\w+$|_test\.(go|py)$|^test_.*\.py$|Tests?\.(cs|java|kt)$/;
const MAX_FILES = 20_000;
const MAX_SIZE = 1_000_000;

/** The project's source files that could hold a schema, relative and sorted, within limits so a large repository stays quick. */
export function sourceFiles(root: string, exts: Set<string>): string[] {
  const out: string[] = [];
  let seen = 0;
  const walk = (dir: string) => {
    let names: string[];
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const name of names) {
      if (++seen > MAX_FILES) return;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { if (!SKIP_DIRS.has(name) && !name.startsWith(".")) walk(full); }
      else if (exts.has(extname(name).toLowerCase()) && st.size <= MAX_SIZE && !TEST_FILE.test(name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

export interface Found { stacks: Stack[]; files: string[]; fields: Field[] }

/**
 * Reads the files with the readers given, each on the files it recognises. With `only`, that stack reads every file
 * of its extensions, recognised or not.
 */
export function read(cwd: string, paths: string[], readers: Reader[], only = false): Found {
  const cache = new Map<string, string>();
  const text = (f: string) => { let s = cache.get(f); if (s === undefined) { s = readFileSync(f, "utf8"); cache.set(f, s); } return s; };
  const found: Found = { stacks: [], files: [], fields: [] };
  for (const r of readers) {
    const candidates = paths.filter((p) => r.exts.includes(extname(p).toLowerCase()));
    const rel = (p: string) => relative(cwd, p).replace(/\\/g, "/");
    const using = only ? candidates : candidates.filter((p) => r.uses(text(p), rel(p)));
    if (!using.length) continue;
    const files = r.all ? candidates : using;
    const fields = r.parse(files.map((p) => ({ file: rel(p), source: text(p) })));
    if (!fields.length && !only) continue;
    found.stacks.push(r.stack);
    found.files.push(...using.map(rel));
    found.fields.push(...fields);
  }
  return found;
}

export const exists = (p: string) => existsSync(p);

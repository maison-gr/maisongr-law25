// The built CLI as a user runs it, on throwaway projects: init, check and build, with a Prisma schema, with SQL
// migrations, and on the example. Run after `npm run build`. No test framework, so it also runs on the oldest Node.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, validate } from "../dist/index.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
const root = mkdtempSync(join(tmpdir(), "maisongr-law25-smoke-"));

try {
  // A Prisma project: init starts from the schema's personal fields; check and build refuse until the TODOs are written.
  const prisma = join(root, "prisma-app");
  mkdirSync(join(prisma, "prisma"), { recursive: true });
  writeFileSync(join(prisma, "prisma", "schema.prisma"), "model User {\n  id String @id\n  email String\n  name String?\n}\nmodel Post {\n  id String @id\n  title String\n}\n");
  const init = run(prisma, "init");
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /Wrote law25\.config\.mjs, started from the Prisma schema \(prisma\/schema\.prisma\)/);
  const config = readFileSync(join(prisma, "law25.config.mjs"), "utf8");
  assert.match(config, /fields: \["User\.email"\]/);
  assert.match(config, /fields: \["User\.name"\]/);
  assert.doesNotMatch(config, /Post\.title/);
  assert.equal(run(prisma, "init").status, 1, "init never overwrites a config");

  const todo = run(prisma, "check");
  assert.equal(todo.status, 1);
  assert.match(todo.stdout, /✗ organisation\.name: is still to write/);
  assert.match(todo.stdout, /problems in law25\.config\.mjs \(checked against the Prisma schema \(prisma\/schema\.prisma\), 5 fields\)/);
  assert.equal(run(prisma, "build").status, 1, "build refuses an incomplete assessment");
  assert.equal(existsSync(join(prisma, "docs")), false);

  // A Prisma schema split over several files (prisma/schema/*.prisma).
  const split = join(root, "split-app");
  mkdirSync(join(split, "prisma", "schema"), { recursive: true });
  writeFileSync(join(split, "prisma", "schema", "user.prisma"), "model User {\r\n  id String @id\r\n  phone String\r\n}\r\n");
  writeFileSync(join(split, "prisma", "schema", "order.prisma"), "model Order {\n  id String @id\n  shippingAddress String\n}\n");
  assert.equal(run(split, "init").status, 0);
  const splitConfig = readFileSync(join(split, "law25.config.mjs"), "utf8");
  assert.match(splitConfig, /"User\.phone"/);
  assert.match(splitConfig, /"Order\.shippingAddress"/);
  assert.match(run(split, "check").stdout, /checked against the Prisma schema \(2 files\)/);

  // A Supabase-style project: the SQL migrations are found and read in order.
  const sql = join(root, "sql-app");
  mkdirSync(join(sql, "supabase", "migrations"), { recursive: true });
  writeFileSync(join(sql, "supabase", "migrations", "001_init.sql"), "create table public.profiles (id uuid primary key, phone text);\n");
  writeFileSync(join(sql, "supabase", "migrations", "002_email.sql"), "alter table profiles add column email text;\n");
  assert.equal(run(sql, "init").status, 0);
  const sqlConfig = readFileSync(join(sql, "law25.config.mjs"), "utf8");
  assert.match(sqlConfig, /"profiles\.phone"/);
  assert.match(sqlConfig, /"profiles\.email"/);

  // The example: complete, so check passes and build writes both reports.
  const example = join(root, "example");
  cpSync(fileURLToPath(new URL("../example", import.meta.url)), example, { recursive: true, filter: (p) => !p.includes("docs") });
  const ok = run(example, "check", "--json");
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(ok.stdout).ok, true);
  const built = run(example, "build");
  assert.equal(built.status, 0, built.stderr);
  const fr = readFileSync(join(example, "docs", "privacy", "efvp.fr.md"), "utf8");
  assert.match(fr, /^# Évaluation des facteurs relatifs à la vie privée : Commandes en ligne/);
  assert.ok(existsSync(join(example, "docs", "privacy", "pia.en.md")));
  assert.equal(run(example, "build", "--lang", "en", "--out", "out").status, 0);
  assert.deepEqual(existsSync(join(example, "out", "pia.en.md")) && !existsSync(join(example, "out", "efvp.fr.md")), true);

  // The library from dist.
  assert.equal(typeof render, "function");
  assert.equal(typeof validate, "function");

  // A Django project, found by itself; then the same models read through --schema and --stack.
  const django = join(root, "django-app");
  mkdirSync(join(django, "shop"), { recursive: true });
  writeFileSync(join(django, "shop", "models.py"), "from django.db import models\n\nclass Customer(models.Model):\n    email = models.EmailField()\n    total = models.IntegerField()\n");
  const djangoInit = run(django, "init");
  assert.equal(djangoInit.status, 0, djangoInit.stderr);
  assert.match(djangoInit.stdout, /started from the Django models \(shop\/models\.py\)/);
  assert.match(readFileSync(join(django, "law25.config.mjs"), "utf8"), /fields: \["Customer\.email"\]/);
  const given = run(django, "check", "--schema", "shop", "--stack", "django", "--json");
  assert.deepEqual(JSON.parse(given.stdout).schema, ["shop/models.py"]);
  assert.equal(run(django, "check", "--stack", "django").status, 2, "--stack needs --schema");
  assert.equal(run(django, "check", "--schema", "shop", "--stack", "cobol").status, 2);

  assert.equal(run(root, "publish").status, 2);
  assert.equal(run(root, "check").status, 2, "no config: a usage error");
  assert.match(run(root, "--version").stdout, /^\d+\.\d+\.\d+\n$/);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log("smoke: ok");

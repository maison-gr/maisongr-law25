#!/usr/bin/env node
// maisongr-law25 init     a config to start from, with the schema's personal fields
// maisongr-law25 check    the assessment is complete and accounts for every personal field (exit 1 if not; for CI)
// maisongr-law25 build    the report, in French and English, in docs/privacy/
// Exit codes: 0 done, 1 problems found (check) or refused (init over an existing config), 2 a usage error or a bug.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { CONFIG_NAMES, findConfig, findSchema, loadConfig } from "./load.js";
import { starter } from "./init.js";
import { render } from "./render.js";
import { languagesOf, validate } from "./validate.js";
import type { Language } from "./types.js";

const HELP = `maisongr-law25: a Québec Law 25 privacy impact assessment, kept next to the code.

Usage
  maisongr-law25 init                 write law25.config.mjs, started from the schema
  maisongr-law25 check                check the assessment against the schema; exit 1 on a problem
  maisongr-law25 build                write the report (docs/privacy/efvp.fr.md and pia.en.md)

Options
  --config <file>     default: law25.config.mjs, .js or .json in this folder
  --prisma <path>     a schema.prisma file or a folder of them (default: prisma/schema.prisma)
  --sql <path>        a folder of SQL migrations or one file (default: supabase/migrations, migrations…)
  --no-schema         check the assessment alone
  --out <folder>      build: where the report goes (default docs/privacy)
  --lang fr|en        build: one language only
  --json              print the result as JSON
  --version, --help

The report is not legal advice; have it reviewed by a qualified advisor.
`;

class Usage extends Error {}

interface Args { command: "init" | "check" | "build"; config?: string; prisma?: string; sql?: string; noSchema: boolean; out: string; lang?: Language; json: boolean }

function parse(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (command !== "init" && command !== "check" && command !== "build") throw new Usage(command ? `unknown command "${command}"` : "say init, check or build");
  const args: Args = { command, noSchema: false, out: "docs/privacy", json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    const value = () => {
      const v = rest[++i];
      if (v === undefined || v.startsWith("--")) throw new Usage(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--config": args.config = value(); break;
      case "--prisma": args.prisma = value(); break;
      case "--sql": args.sql = value(); break;
      case "--no-schema": args.noSchema = true; break;
      case "--out": args.out = value(); break;
      case "--lang": {
        const v = value();
        if (v !== "fr" && v !== "en") throw new Usage("--lang is fr or en");
        args.lang = v; break;
      }
      case "--json": args.json = true; break;
      default: throw new Usage(`unknown option ${a}`);
    }
  }
  return args;
}

const today = () => new Date().toISOString().slice(0, 10);
const say = (args: Args, text: string) => { if (!args.json) process.stdout.write(`${text}\n`); };
const version = () => (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h") || !argv.length) { process.stdout.write(HELP); return argv.length ? 0 : 2; }
  if (argv.includes("--version")) { process.stdout.write(`${version()}\n`); return 0; }
  const args = parse(argv);
  const cwd = process.cwd();
  const schema = args.noSchema ? null : findSchema(cwd, { prisma: args.prisma, sql: args.sql });
  const schemaNote = schema ? `${schema.kind === "prisma" ? "the Prisma schema" : "the SQL migrations"} (${schema.files.length === 1 ? schema.files[0] : `${schema.files.length} files`})` : null;

  if (args.command === "init") {
    const existing = findConfig(cwd, args.config);
    const target = args.config ? resolve(cwd, args.config) : join(cwd, CONFIG_NAMES[0]!);
    if (existing && existsSync(existing)) {
      process.stderr.write(`maisongr-law25: ${relative(cwd, existing)} already exists; nothing was written.\n`);
      return 1;
    }
    writeFileSync(target, starter(schema?.fields ?? [], today(), schemaNote));
    const count = schema ? schema.fields.length : 0;
    if (args.json) process.stdout.write(`${JSON.stringify({ ok: true, config: relative(cwd, target), schema: schema?.files ?? [], fields: count })}\n`);
    say(args, `Wrote ${relative(cwd, target)}${schemaNote ? `, started from ${schemaNote}` : " (no schema found: pass --prisma or --sql)"}.`);
    say(args, "Replace each TODO, then run: npx maisongr-law25 check");
    return 0;
  }

  const configPath = findConfig(cwd, args.config);
  if (!configPath || !existsSync(configPath)) throw new Usage(`no ${CONFIG_NAMES.join(", ")} here: run "maisongr-law25 init" first, or pass --config`);
  const assessment = await loadConfig(configPath);
  const problems = validate(assessment, schema?.fields ?? null, today());
  const errors = problems.filter((p) => p.level === "error");

  if (args.command === "check") {
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ ok: !errors.length, config: relative(cwd, configPath), schema: schema?.files ?? null, fields: schema?.fields.length ?? null, problems }, null, 2)}\n`);
    } else {
      for (const p of problems) process.stdout.write(`${p.level === "error" ? "✗" : "!"} ${p.where}: ${p.message}\n`);
      const about = schema ? `against ${schemaNote}, ${schema.fields.length} fields` : "without a schema";
      process.stdout.write(errors.length
        ? `${errors.length} problem${errors.length === 1 ? "" : "s"} in ${basename(configPath)} (checked ${about}).\n`
        : `${basename(configPath)} is complete (checked ${about}).\n`);
    }
    return errors.length ? 1 : 0;
  }

  // build
  if (errors.length) {
    process.stderr.write(`maisongr-law25: the assessment has ${errors.length} problem${errors.length === 1 ? "" : "s"}; run "maisongr-law25 check" and fix ${errors.length === 1 ? "it" : "them"} first.\n`);
    return 1;
  }
  const langs = args.lang ? [args.lang] : languagesOf(assessment);
  const outDir = resolve(cwd, args.out);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const lang of langs) {
    const file = join(outDir, lang === "fr" ? "efvp.fr.md" : "pia.en.md");
    writeFileSync(file, render(assessment, lang, relative(cwd, configPath).replace(/\\/g, "/")));
    written.push(relative(cwd, file).replace(/\\/g, "/"));
  }
  if (args.json) process.stdout.write(`${JSON.stringify({ ok: true, written, warnings: problems })}\n`);
  for (const p of problems) say(args, `! ${p.where}: ${p.message}`);
  say(args, `Wrote ${written.join(" and ")}.`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(e instanceof Usage ? `maisongr-law25: ${e.message}\nRun maisongr-law25 --help.\n` : `maisongr-law25: ${(e as Error).stack ?? e}\n`);
    process.exitCode = 2;
  },
);

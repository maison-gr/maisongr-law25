// Rails (db/schema.rb, or db/migrate/*.rb) and Laravel (database/migrations/*.php): tables and columns as the
// migrations build them, in file order; what a later migration drops or renames is followed. A migration's `down`
// undoes its `up`, so it is left out.

import { marker, type Field } from "../schema.js";
import { Lines, PHP, closing, quotedAt, spaces, type SourceFile } from "./scan.js";
import { blank } from "./javascript.js";

/** Rails column methods that add no column of their own, or a relation. */
const RAILS_SKIP = new Set(["index", "timestamps", "references", "belongs_to", "check_constraint", "foreign_key", "remove", "remove_references", "remove_timestamps", "remove_index", "rename", "change", "change_default", "change_null", "rename_index"]);

export function parseRails(files: SourceFile[]): Field[] {
  const byRef = new Map<string, Field>();
  const drop = (table: string) => { for (const ref of [...byRef.keys()]) if (ref.startsWith(`${table}.`)) byRef.delete(ref); };
  const rename = (table: string, from: string, to: string) => renameIn(byRef, table, from, to);
  for (const { file, source } of [...files].sort((a, b) => a.file.localeCompare(b.file))) {
    const lines = source.split(/\r?\n/);
    let table: string | null = null;
    let downIndent = -1;
    lines.forEach((l, i) => {
      const t = l.trim();
      const indent = l.length - l.trimStart().length;
      // def down … end, at the same indent.
      if (downIndent !== -1) { if (indent === downIndent && /^end\b/.test(t)) downIndent = -1; return; }
      if (/^def\s+down\b/.test(t)) { downIndent = indent; return; }
      if (!t || t.startsWith("#")) return;
      const call = t.match(/^(\w+)[\s(]*/);
      if (!call) return;
      const method = call[1]!;
      const args = names(t.slice(call[0].length));
      if (method === "create_table" || method === "change_table") { table = args[0] ?? null; if (method === "create_table" && table) drop(table); return; }
      if (method === "end") { table = null; return; }
      if (method === "drop_table" && args[0]) { drop(args[0]); return; }
      if (method === "add_column" && args[0] && args[1]) { set(args[0], args[1], args[2] ?? "unknown", l, i); return; }
      if (method === "remove_column" && args[0] && args[1]) { byRef.delete(`${args[0]}.${args[1]}`); return; }
      if (method === "rename_column" && args[0] && args[1] && args[2]) { rename(args[0], args[1], args[2]); return; }
      if (method === "rename_table" && args[0] && args[1]) {
        for (const f of [...byRef.values()].filter((x) => x.model === args[0])) { byRef.delete(f.ref); byRef.set(`${args[1]}.${f.name}`, { ...f, ref: `${args[1]}.${f.name}`, model: args[1]! }); }
        return;
      }
      // t.string "email", null: false
      const column = t.match(/^\w+\.(\w+)[\s(]*/);
      if (!table || !column) return;
      const kind = column[1]!;
      const cols = names(t.slice(column[0].length));
      if (kind === "remove") { for (const c of cols) byRef.delete(`${table}.${c}`); return; }
      if (kind === "rename" && cols[0] && cols[1]) { rename(table, cols[0], cols[1]); return; }
      if (RAILS_SKIP.has(kind)) return;
      // t.string :first_name, :last_name declares both.
      for (const c of cols) set(table, c, kind, l, i);
    });
    function set(model: string, name: string, type: string, line: string, i: number) {
      const comment = lines[i - 1]?.trim().startsWith("#") ? lines[i - 1]! : "";
      byRef.set(`${model}.${name}`, { ref: `${model}.${name}`, model, name, type, marked: marker(`${comment} ${line}`), file, line: i + 1 });
    }
  }
  return [...byRef.values()];
}

/** The leading names of a Ruby call's arguments: "users", :users, then stops at the first option (null: false). */
function names(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const q = quotedAt(s, i);
    if (!q) break;
    const after = spaces(s, q.end);
    // :null => false is an option, not a name.
    if (s.startsWith("=>", after)) break;
    out.push(q.value);
    if (s[after] !== ",") break;
    i = after + 1;
  }
  return out;
}

/** Laravel Blueprint methods with no column of their own. */
const LARAVEL_SKIP = new Set(["index", "unique", "primary", "foreign", "fullText", "spatialIndex", "rawIndex", "dropIndex", "dropUnique", "dropPrimary", "dropForeign", "dropFullText", "dropSpatialIndex", "dropConstrainedForeignId", "dropForeignIdFor", "dropTimestamps", "dropTimestampsTz", "dropSoftDeletes", "dropSoftDeletesTz", "dropRememberToken", "dropMorphs", "timestamps", "timestampsTz", "nullableTimestamps", "morphs", "nullableMorphs", "uuidMorphs", "nullableUuidMorphs", "ulidMorphs", "nullableUlidMorphs", "foreignIdFor", "engine", "charset", "collation", "temporary", "comment", "after", "renameIndex", "dropColumn", "renameColumn", "dropIfExists"]);
/** Methods that name their column themselves when given none. */
const LARAVEL_DEFAULT: Record<string, string> = { id: "id", softDeletes: "deleted_at", softDeletesTz: "deleted_at", rememberToken: "remember_token", ipAddress: "ip_address", macAddress: "mac_address", uuid: "uuid", ulid: "ulid" };

export function parseLaravel(files: SourceFile[]): Field[] {
  const byRef = new Map<string, Field>();
  for (const { file, source: raw } of [...files].sort((a, b) => a.file.localeCompare(b.file))) {
    const source = blankFunction(raw, "down");
    const lines = new Lines(source);
    let after = 0;
    for (const m of source.matchAll(/Schema::(create|table|drop|dropIfExists|rename)\s*\(/g)) {
      if ((m.index ?? 0) < after) continue;
      const open = (m.index ?? 0) + m[0].length;
      const table = quotedAt(source, open);
      if (!table) continue;
      if (m[1] === "drop" || m[1] === "dropIfExists") { for (const ref of [...byRef.keys()]) if (ref.startsWith(`${table.value}.`)) byRef.delete(ref); continue; }
      if (m[1] === "rename") {
        const comma = spaces(source, table.end);
        const to = source[comma] === "," ? quotedAt(source, comma + 1) : null;
        if (to) for (const f of [...byRef.values()].filter((x) => x.model === table.value)) { byRef.delete(f.ref); byRef.set(`${to.value}.${f.name}`, { ...f, ref: `${to.value}.${f.name}`, model: to.value }); }
        continue;
      }
      const end = closing(source, open, PHP);
      after = end;
      // $table->string('email')->unique(); one statement each, its comment on the same line.
      for (const c of source.slice(open, end).matchAll(/\$\w+->(\w+)\s*\(/g)) {
        const at = open + (c.index ?? 0);
        const method = c[1]!;
        const argAt = at + c[0].length;
        const eol = source.indexOf("\n", at);
        const text = source.slice(at, eol === -1 ? end : Math.min(eol, end));
        const first = quotedAt(source, argAt);
        if (method === "dropColumn") {
          for (const n of first ? [first.value] : [...source.slice(argAt, source.indexOf(")", argAt)).matchAll(/["'](\w+)["']/g)].map((x) => x[1]!)) byRef.delete(`${table.value}.${n}`);
          continue;
        }
        if (method === "renameColumn" && first) {
          const comma = spaces(source, first.end);
          const to = source[comma] === "," ? quotedAt(source, comma + 1) : null;
          if (to) renameIn(byRef, table.value, first.value, to.value);
          continue;
        }
        if (LARAVEL_SKIP.has(method)) continue;
        const name = first?.value ?? LARAVEL_DEFAULT[method];
        if (!name) continue;
        byRef.set(`${table.value}.${name}`, { ref: `${table.value}.${name}`, model: table.value, name, type: method, marked: marker(text), file, line: lines.at(at) });
      }
    }
  }
  return [...byRef.values()];
}

/** A renamed column keeps its place in the list (and its line and markers: where it was declared). */
function renameIn(byRef: Map<string, Field>, table: string, from: string, to: string): void {
  if (!byRef.has(`${table}.${from}`)) return;
  const entries = [...byRef.entries()];
  byRef.clear();
  for (const [ref, f] of entries) {
    if (ref === `${table}.${from}`) byRef.set(`${table}.${to}`, { ...f, ref: `${table}.${to}`, name: to });
    else byRef.set(ref, f);
  }
}

/** The body of `function name(…) { … }` blanked out (offsets kept). */
function blankFunction(source: string, name: string): string {
  const ranges: [number, number][] = [];
  let after = 0;
  for (const m of source.matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, "g"))) {
    if ((m.index ?? 0) < after) continue;
    const params = closing(source, (m.index ?? 0) + m[0].length, PHP);
    const brace = source.indexOf("{", params);
    if (brace === -1) continue;
    after = closing(source, brace + 1, PHP);
    ranges.push([brace + 1, after]);
  }
  return blank(source, ranges);
}

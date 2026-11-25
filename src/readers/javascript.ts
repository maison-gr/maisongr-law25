// JavaScript and TypeScript ORMs: Drizzle tables, Mongoose schemas, Sequelize models and migrations, and the
// decorated classes of TypeORM, MikroORM, sequelize-typescript and NestJS Mongoose. Fields are named as the code
// names them: the table's variable and the column's key (Drizzle), the model (Mongoose, Sequelize), the class.

import { marker, type Field } from "../schema.js";
import { C_LIKE, Lines, closing, code, quotedAt, spaces, splitTopLevel, wordAt, type SourceFile } from "./scan.js";

interface Entry { key: string; value: string; text: string; start: number }

/** The `key: value` entries of an object literal's body (keys plain or quoted; spreads and methods left out). */
function entries(body: string): Entry[] {
  const out: Entry[] = [];
  for (const part of splitTopLevel(body, C_LIKE)) {
    const clean = code(part.text, C_LIKE).trim();
    const quoted = quotedAt(clean, 0);
    const key = quoted && !clean.startsWith(":") ? { word: quoted.value, end: quoted.end } : wordAt(clean, 0);
    const colon = spaces(clean, key.end);
    if (!key.word || clean[colon] !== ":") continue;
    out.push({ key: key.word, value: clean.slice(colon + 1).trim(), text: part.text, start: part.start });
  }
  return out;
}

/** The variable a value is assigned to on its line: "export const users = pgTable(…)" → users. */
function assignedTo(source: string, index: number): string | null {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const before = source.slice(lineStart, index);
  const m = before.match(/(?:const|let|var)\s+(\w+)\s*(?::[^=]*)?=\s*(?:\w+\.)?$/);
  return m ? m[1]! : null;
}

/** From the "(" of a call: the "{" its object argument opens, after `name,` and an optional `(t) =>` callback. */
function objectAfterName(source: string, paren: number): { name: string; brace: number } | null {
  const name = quotedAt(source, paren + 1);
  if (!name) return null;
  let i = spaces(source, name.end);
  if (source[i] !== ",") return null;
  i = spaces(source, i + 1);
  if (source[i] !== "{") {
    // Drizzle's callback form: pgTable("users", (t) => ({ … })).
    const arrow = source.indexOf("=>", i);
    if (arrow === -1 || arrow - i > 40) return null;
    i = spaces(source, arrow + 2);
    if (source[i] === "(") i = spaces(source, i + 1);
    if (source[i] !== "{") return null;
  }
  return { name: name.value, brace: i };
}

export function parseDrizzle(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    const lines = new Lines(source);
    // A table read, the next starts after it: a table's own body is never read again as the start of another.
    let after = 0;
    for (const m of source.matchAll(/\b(?:pgTable|mysqlTable|sqliteTable|singlestoreTable|\.table)\s*\(/g)) {
      if ((m.index ?? 0) < after) continue;
      const paren = (m.index ?? 0) + m[0].length - 1;
      const found = objectAfterName(source, paren);
      if (!found) continue;
      const model = assignedTo(source, m.index ?? 0) ?? found.name;
      const end = closing(source, found.brace + 1, C_LIKE);
      after = end;
      const body = source.slice(found.brace + 1, end);
      for (const e of entries(body)) {
        const builder = e.value.match(/^(?:\w+\.)?(\w+)\s*\(/);
        if (!builder) continue;
        fields.push({ ref: `${model}.${e.key}`, model, name: e.key, type: builder[1]!, marked: marker(e.text), file, line: lines.at(found.brace + 1 + e.start + e.text.length - e.text.trimStart().length) });
      }
    }
  }
  return fields;
}

/** Mongoose: new Schema({ … }), the model named by mongoose.model("User", userSchema), nested paths as "address.city". */
export function parseMongoose(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  const names = new Map<string, string>();
  for (const { source } of files) {
    for (const m of source.matchAll(/\bmodel(?:<[^>\n]*>)?\(\s*["'`](\w+)["'`]\s*,\s*(\w+)/g)) names.set(m[2]!, m[1]!);
  }
  for (const { file, source } of files) {
    const lines = new Lines(source);
    let after = 0;
    for (const m of source.matchAll(/\bnew\s+(?:mongoose\.)?Schema\b/g)) {
      if ((m.index ?? 0) < after) continue;
      let i = spaces(source, (m.index ?? 0) + m[0].length);
      // new Schema<IUser>({ … }): the type argument, to its ">".
      if (source[i] === "<") { const gt = source.indexOf(">", i); if (gt === -1) continue; i = spaces(source, gt + 1); }
      if (source[i] !== "(") continue;
      i = spaces(source, i + 1);
      if (source[i] !== "{") continue;
      const variable = assignedTo(source, m.index ?? 0);
      const inline = source.slice(source.lastIndexOf("\n", m.index ?? 0) + 1, m.index).match(/model(?:<[^>\n]*>)?\(\s*["'`](\w+)["'`]\s*,\s*$/);
      const model = inline?.[1] ?? (variable ? names.get(variable) ?? capital(variable.replace(/Schema$/i, "")) : "Schema");
      const read = (brace: number, prefix: string) => {
        const end = closing(source, brace + 1, C_LIKE);
        for (const e of entries(source.slice(brace + 1, end))) {
          const at = brace + 1 + e.start;
          const value = e.value;
          const name = `${prefix}${e.key}`;
          const push = (type: string) => fields.push({ ref: `${model}.${name}`, model, name, type, marked: marker(e.text), file, line: lines.at(at + e.text.length - e.text.trimStart().length) });
          const objectAt = (offset: number) => source.indexOf("{", at + e.text.indexOf(value) + offset);
          if (value.startsWith("{")) {
            const inner = entries(value.slice(1, closing(value, 1, C_LIKE)));
            const type = inner.find((x) => x.key === "type");
            if (type) { if (!inner.some((x) => x.key === "ref")) push(lastWord(type.value)); }
            else read(objectAt(0), `${name}.`);
          } else if (value.startsWith("[")) {
            const inside = value.slice(1).trim();
            if (inside.startsWith("{") && !entries(inside.slice(1, closing(inside, 1, C_LIKE))).some((x) => x.key === "type")) read(objectAt(value.indexOf("{")), `${name}.`);
            else if (!/\bref\s*:/.test(inside)) push(`[${lastWord(inside.replace(/^\{/, "")) || "Mixed"}]`);
          } else push(lastWord(value));
        }
      };
      after = closing(source, i + 1, C_LIKE);
      read(i, "");
    }
  }
  return fields;
}

/** Sequelize: sequelize.define("User", { … }), User.init({ … }), and migrations' createTable, addColumn, removeColumn, dropTable (in up, not down). */
export function parseSequelize(files: SourceFile[]): Field[] {
  const byRef = new Map<string, Field>();
  const ordered = [...files].sort((a, b) => a.file.localeCompare(b.file));
  for (const { file, source: raw } of ordered) {
    const source = withoutDown(raw);
    const lines = new Lines(source);
    let after = 0;
    const columns = (model: string, brace: number) => {
      const end = closing(source, brace + 1, C_LIKE);
      after = end;
      for (const e of entries(source.slice(brace + 1, end))) {
        const type = e.value.match(/\b(?:DataTypes|Sequelize|DataType|Types)\.(\w+)/)?.[1];
        if (!type || type === "VIRTUAL") continue;
        byRef.set(`${model}.${e.key}`, { ref: `${model}.${e.key}`, model, name: e.key, type, marked: marker(e.text), file, line: lines.at(brace + 1 + e.start + e.text.length - e.text.trimStart().length) });
      }
    };
    for (const m of source.matchAll(/\.(define|createTable)\s*\(/g)) {
      if ((m.index ?? 0) < after) continue;
      const found = objectAfterName(source, (m.index ?? 0) + m[0].length - 1);
      if (found) columns(found.name, found.brace);
    }
    after = 0;
    for (const m of source.matchAll(/\b(\w+)\.init\s*\(/g)) {
      if ((m.index ?? 0) < after) continue;
      const brace = spaces(source, (m.index ?? 0) + m[0].length);
      if (source[brace] === "{") columns(m[1]!, brace);
    }
    for (const m of source.matchAll(/\.(addColumn|removeColumn|dropTable)\s*\(/g)) {
      const table = quotedAt(source, (m.index ?? 0) + m[0].length);
      if (!table) continue;
      if (m[1] === "dropTable") { for (const ref of [...byRef.keys()]) if (ref.startsWith(`${table.value}.`)) byRef.delete(ref); continue; }
      const comma = spaces(source, table.end);
      const column = source[comma] === "," ? quotedAt(source, comma + 1) : null;
      if (!column) continue;
      const ref = `${table.value}.${column.value}`;
      if (m[1] === "removeColumn") { byRef.delete(ref); continue; }
      const end = source.indexOf(";", column.end);
      const text = source.slice(m.index ?? 0, end === -1 ? source.length : end);
      const type = text.match(/\b(?:DataTypes|Sequelize|Types)\.(\w+)/)?.[1] ?? "unknown";
      byRef.set(ref, { ref, model: table.value, name: column.value, type, marked: marker(text), file, line: lines.at(m.index ?? 0) });
    }
  }
  return [...byRef.values()];
}

/** A migration's down() undoes up(): its dropTable and removeColumn must not count. Blanked, so offsets stay. */
function withoutDown(source: string): string {
  const ranges: [number, number][] = [];
  let after = 0;
  for (const m of source.matchAll(/\bdown\s*(?::\s*(?:async\s*)?(?:function\s*)?)?\(/g)) {
    if ((m.index ?? 0) < after) continue;
    const params = closing(source, (m.index ?? 0) + m[0].length, C_LIKE);
    const brace = source.indexOf("{", params);
    if (brace === -1 || brace - params > 20) continue;
    after = closing(source, brace + 1, C_LIKE);
    ranges.push([brace + 1, after]);
  }
  return blank(source, ranges);
}

/** The text with each range's characters turned to spaces, its line breaks kept, so offsets and lines stay. Built once. */
export function blank(source: string, ranges: [number, number][]): string {
  if (!ranges.length) return source;
  let out = "";
  let last = 0;
  for (const [from, to] of ranges) {
    out += source.slice(last, from) + source.slice(from, to).replace(/[^\n]/g, " ");
    last = to;
  }
  return out + source.slice(last);
}

const COLUMN = new Set([
  // TypeORM
  "Column", "PrimaryColumn", "PrimaryGeneratedColumn", "CreateDateColumn", "UpdateDateColumn", "DeleteDateColumn", "VersionColumn", "ObjectIdColumn", "ViewColumn",
  // MikroORM
  "Property", "PrimaryKey", "SerializedPrimaryKey", "Enum",
  // sequelize-typescript
  "CreatedAt", "UpdatedAt", "DeletedAt",
  // NestJS Mongoose
  "Prop",
]);
const RELATION = new Set(["ManyToOne", "OneToMany", "OneToOne", "ManyToMany", "RelationId", "JoinColumn", "JoinTable", "BelongsTo", "HasMany", "HasOne", "BelongsToMany", "Embedded"]);
const MODIFIERS = new Set(["public", "private", "protected", "readonly", "declare", "static", "abstract", "override", "accessor", "get", "set", "async"]);

/** TypeORM, MikroORM, sequelize-typescript and NestJS Mongoose: a class decorated @Entity, @Table or @Schema, and its decorated properties. */
export function parseDecorated(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    const lines = new Lines(source);
    let after = 0;
    for (const m of source.matchAll(/@(?:Entity|Table|Schema|ViewEntity|ChildEntity|Embeddable)\b/g)) {
      if ((m.index ?? 0) < after) continue;
      let i = (m.index ?? 0) + m[0].length;
      if (source[spaces(source, i)] === "(") i = closing(source, spaces(source, i) + 1, C_LIKE) + 1;
      const head = source.slice(i, i + 400).match(/^[\s\S]*?\bclass\s+(\w+)/);
      if (!head || /[{;]/.test(head[0].slice(0, head[0].lastIndexOf("class")).replace(/@\w+\([^)]*\)/g, ""))) continue;
      const brace = source.indexOf("{", i + head[0].length);
      if (brace === -1) continue;
      const end = closing(source, brace + 1, C_LIKE);
      after = end;
      for (const p of members(source.slice(brace + 1, end))) {
        if (p.static || !p.decorators.some((d) => COLUMN.has(d.name)) || p.decorators.some((d) => RELATION.has(d.name) || /\bref\s*:/.test(d.args))) continue;
        fields.push({ ref: `${head[1]}.${p.name}`, model: head[1]!, name: p.name, type: p.type, marked: marker(p.text), file, line: lines.at(brace + 1 + p.at) });
      }
    }
  }
  return fields;
}

interface Member { name: string; type: string; decorators: { name: string; args: string }[]; static: boolean; text: string; at: number }

/** A class body's properties, with their decorators; methods and their bodies skipped. */
function members(body: string): Member[] {
  const out: Member[] = [];
  let decorators: Member["decorators"] = [];
  let isStatic = false;
  let segment = 0;
  let i = 0;
  const reset = (to: number) => { decorators = []; isStatic = false; segment = to; };
  while (i < body.length) {
    const j = skip(body, i);
    if (j !== i) { i = j; continue; }
    const c = body[i]!;
    if (/\s|;/.test(c)) { i++; if (c === ";") reset(i); continue; }
    if (c === "@") {
      const w = wordAt(body, i + 1);
      let end = w.end;
      let args = "";
      const k = spaces(body, end);
      if (body[k] === "(") { end = closing(body, k + 1, C_LIKE) + 1; args = body.slice(k, end); }
      decorators.push({ name: w.word, args });
      i = Math.max(end, i + 1);
      continue;
    }
    if (/[\w$#]/.test(c)) {
      const w = wordAt(body, c === "#" ? i + 1 : i);
      if (MODIFIERS.has(w.word) && /^\s+[\w$#[]/.test(body.slice(w.end, w.end + 2))) { if (w.word === "static") isStatic = true; i = w.end; continue; }
      let k = spaces(body, w.end);
      if (body[k] === "?" || body[k] === "!") k = spaces(body, k + 1);
      const at = i;
      if (body[k] === "(" || body[k] === "<") {
        // A method: its parameters, return type, then its body.
        const brace = body.indexOf("{", k);
        const semi = body.indexOf(";", k);
        i = brace === -1 || (semi !== -1 && semi < brace && !body.slice(k, semi).includes("(")) ? (semi === -1 ? body.length : semi + 1) : closing(body, brace + 1, C_LIKE) + 1;
        reset(i);
        continue;
      }
      // A property: its type runs to "=", ";" or the line's end, outside brackets.
      let end = k;
      let depth = 0;
      for (; end < body.length; end++) {
        const s = skip(body, end);
        if (s !== end) { end = s - 1; continue; }
        const ch = body[end]!;
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        else if (depth <= 0 && (ch === ";" || ch === "\n" || ch === "=")) break;
      }
      const type = body[k] === ":" ? body.slice(k + 1, end).trim() : "";
      let stop = end;
      if (body[end] === "=") {
        // Its initializer, to the statement's end.
        for (depth = 0; stop < body.length; stop++) {
          const s = skip(body, stop);
          if (s !== stop) { stop = s - 1; continue; }
          const ch = body[stop]!;
          if ("([{".includes(ch)) depth++;
          else if (")]}".includes(ch)) depth--;
          else if (depth <= 0 && (ch === ";" || ch === "\n")) break;
        }
      }
      // A comment after the property, on its line, is part of it.
      const eol = body.indexOf("\n", stop);
      const lineEnd = eol === -1 ? body.length : eol;
      out.push({ name: w.word, type: type || "unknown", decorators, static: isStatic, text: body.slice(segment, lineEnd), at });
      i = lineEnd;
      reset(i);
      continue;
    }
    i++;
  }
  return out;
}

const skip = (s: string, i: number) => {
  const c = s[i];
  if (c === "/" && (s[i + 1] === "/" || s[i + 1] === "*")) {
    const j = s[i + 1] === "/" ? s.indexOf("\n", i) : s.indexOf("*/", i + 2);
    return j === -1 ? s.length : s[i + 1] === "/" ? j : j + 2;
  }
  if (c === '"' || c === "'" || c === "`") {
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === "\\") j++;
      else if (s[j] === c) return j + 1;
    }
    return s.length;
  }
  return i;
};

const lastWord = (s: string) => s.match(/\w+/g)?.at(-1) ?? "unknown";
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

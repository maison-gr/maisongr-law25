// Statically typed ORMs: Entity Framework (C#), JPA and Hibernate (Java, Kotlin), GORM (Go). A field is a property
// or member the ORM maps to a column; navigation properties and relations are left out, as in Prisma.

import { marker, type Field } from "../schema.js";
import { JAVA, Lines, annotations, closing, code, spaces, splitTopLevel, statements, type SourceFile, type Syntax } from "./scan.js";

const GO: Syntax = { line: ["//"], block: true, quotes: "\"'`" };
const KOTLIN: Syntax = { line: ["//"], block: true, quotes: "\"'" };

interface Declared { name: string; bases: string; body: string; bodyAt: number; file: string; source: string; lines: Lines; before: string }

/** Every `class Name … { … }` of the files, with what it extends. */
function declared(files: SourceFile[], syntax: Syntax): Declared[] {
  const out: Declared[] = [];
  for (const { file, source } of files) {
    const lines = new Lines(source);
    for (const m of source.matchAll(/\b(?:class|record)\s+(\w+)/g)) {
      const end = (m.index ?? 0) + m[0].length;
      const brace = source.indexOf("{", end);
      const semi = source.indexOf(";", end);
      if (brace === -1 || (semi !== -1 && semi < brace)) continue;
      const header = source.slice(end, brace);
      const colon = header.indexOf(":");
      const bases = colon === -1 ? "" : header.slice(colon + 1).split(/\bwhere\b/)[0]!;
      const close = closing(source, brace + 1, syntax);
      out.push({ name: m[1]!, bases, body: source.slice(brace + 1, close), bodyAt: brace + 1, file, source, lines, before: source.slice(Math.max(0, (m.index ?? 0) - 300), m.index) });
    }
  }
  return out;
}

const COLLECTION = /^(?:I?Collection|I?List|IEnumerable|HashSet|ISet|IReadOnlyCollection|IReadOnlyList|ICollection)\s*</;
const IDENTITY_USER = ["UserName", "NormalizedUserName", "Email", "NormalizedEmail", "PhoneNumber", "PasswordHash"];
const CS_MODIFIERS = new Set(["public", "protected", "internal", "private", "virtual", "override", "required", "new", "static", "abstract", "sealed", "readonly", "partial"]);

/** Entity Framework: the classes of the context's DbSet<…> (or marked [Table]) and their base classes; public properties with a getter. */
export function parseEntityFramework(files: SourceFile[]): Field[] {
  const entities = new Set<string>();
  for (const { source } of files) {
    for (const m of source.matchAll(/\b(?:DbSet|IdentityDbContext)\s*<\s*(\w+)/g)) entities.add(m[1]!);
  }
  const classes = declared(files, JAVA);
  if (!entities.size) for (const c of classes) if (/\[\s*Table\s*\(/.test(c.before.slice(c.before.lastIndexOf("}") + 1))) entities.add(c.name);
  // A base class's columns are the entity's too (an "Entity" base with Id and CreatedAt).
  const byName = new Map(classes.map((c) => [c.name, c]));
  for (const name of [...entities]) {
    for (let c = byName.get(name), guard = 0; c && guard < 10; guard++) {
      const base = c.bases.split(",")[0]?.trim().replace(/<.*$/, "");
      if (!base || !byName.has(base) || entities.has(base)) break;
      entities.add(base);
      c = byName.get(base);
    }
  }
  const fields: Field[] = [];
  for (const c of classes) {
    if (!entities.has(c.name)) continue;
    for (const st of statements(c.body, JAVA)) {
      if (st.block === undefined || !/\b(get|set|init)\b/.test(code(st.block, JAVA))) continue;
      const a = annotations(code(st.head, JAVA));
      if (a.names.includes("NotMapped")) continue;
      const tokens = a.rest.trim().split(/\s+/);
      const modifiers = tokens.filter((t) => CS_MODIFIERS.has(t));
      if (!modifiers.includes("public") || modifiers.includes("static")) continue;
      const rest = tokens.filter((t) => !CS_MODIFIERS.has(t));
      const name = rest.pop();
      const type = rest.join(" ");
      if (!name || !/^\w+$/.test(name) || !type) continue;
      const bare = type.replace(/\?$/, "");
      if (COLLECTION.test(bare) || entities.has(bare)) continue;
      fields.push({ ref: `${c.name}.${name}`, model: c.name, name, type, marked: marker(st.head), file: c.file, line: c.lines.at(c.bodyAt + st.start + leading(st.head)) });
    }
    if (/\bIdentityUser\b/.test(c.bases)) {
      for (const name of IDENTITY_USER) if (!fields.some((f) => f.ref === `${c.name}.${name}`)) fields.push({ ref: `${c.name}.${name}`, model: c.name, name, type: "IdentityUser property", file: c.file, line: c.lines.at(c.bodyAt) });
    }
  }
  return fields;
}

const JPA_RELATIONS = new Set(["OneToMany", "ManyToOne", "OneToOne", "ManyToMany", "Transient", "Formula"]);
const JAVA_MODIFIERS = new Set(["private", "protected", "public", "final", "volatile"]);

/** JPA and Hibernate: classes marked @Entity, @Embeddable or @MappedSuperclass; Java fields, Kotlin constructor and body properties. */
export function parseJpa(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    const kotlin = file.endsWith(".kt");
    const syntax = kotlin ? KOTLIN : JAVA;
    const lines = new Lines(source);
    let after = 0;
    for (const m of source.matchAll(/@(?:\w+\.)*(?:Entity|Embeddable|MappedSuperclass)\b(?!\.)/g)) {
      if ((m.index ?? 0) < after) continue;
      const from = (m.index ?? 0) + m[0].length;
      const head = source.slice(from, from + 400).match(/^[\s\S]*?\bclass\s+(\w+)/);
      if (!head || code(head[0], syntax).includes("{")) continue;
      const model = head[1]!;
      let i = from + head[0].length;
      const push = (name: string, type: string, text: string, at: number) => fields.push({ ref: `${model}.${name}`, model, name, type: type.trim(), marked: marker(text), file, line: lines.at(at) });
      const kotlinProperty = (text: string, at: number) => {
        const a = annotations(code(text, syntax));
        if (a.names.some((n) => JPA_RELATIONS.has(n))) return;
        const p = a.rest.trim().match(/^(?:(?:private|protected|internal|public|override|open|lateinit)\s+)*(?:val|var)\s+(\w+)\s*:([^=]+)/);
        if (p) push(p[1]!, p[2]!, text, at);
      };
      if (kotlin) {
        // The primary constructor: class User(@Id val id: Long, val email: String)
        let k = spaces(source, i);
        if (source[k] === "(") {
          const close = closing(source, k + 1, syntax);
          for (const part of splitTopLevel(source.slice(k + 1, close), syntax)) kotlinProperty(part.text, k + 1 + part.start + leading(part.text));
          k = spaces(source, close + 1);
        }
        const next = source.slice(k, k + 300).search(/[{@]|\bclass\b|\bfun\b/);
        if (next === -1 || source[k + next] !== "{") continue;
        i = k + next;
      } else {
        i = source.indexOf("{", i);
        if (i === -1) continue;
      }
      after = closing(source, i + 1, syntax);
      const body = source.slice(i + 1, after);
      for (const st of statements(body, syntax, kotlin)) {
        if (st.block !== undefined) continue;
        const at = i + 1 + st.start + leading(st.head);
        if (kotlin) { kotlinProperty(st.head, at); continue; }
        const a = annotations(code(st.head, syntax));
        if (a.names.some((n) => JPA_RELATIONS.has(n))) continue;
        const declaration = a.rest.split("=")[0]!.trim();
        const tokens = declaration.split(/\s+/);
        if (tokens.includes("static") || tokens.includes("transient") || tokens.some((t) => t === "class" || t === "enum" || t === "interface" || t === "record")) continue;
        const rest = tokens.filter((t) => !JAVA_MODIFIERS.has(t));
        const name = rest.pop();
        if (!name || !/^\w+$/.test(name) || !rest.length) continue;
        push(name, rest.join(" "), st.head, at);
      }
    }
  }
  return fields;
}

/** GORM: structs that embed gorm.Model, carry gorm:"…" tags or are passed to AutoMigrate; their exported fields. */
export function parseGorm(files: SourceFile[]): Field[] {
  const migrated = new Set<string>();
  for (const { source } of files) {
    let after = 0;
    for (const m of source.matchAll(/AutoMigrate\s*\(/g)) {
      if ((m.index ?? 0) < after) continue;
      const end = closing(source, (m.index ?? 0) + m[0].length, GO);
      after = end;
      for (const t of source.slice((m.index ?? 0) + m[0].length, end).matchAll(/&(?:\w+\.)?(\w+)\s*\{/g)) migrated.add(t[1]!);
    }
  }
  const structs: { name: string; body: string; at: number; file: string; lines: Lines }[] = [];
  for (const { file, source } of files) {
    const lines = new Lines(source);
    let after = 0;
    for (const m of source.matchAll(/\btype\s+(\w+)\s+struct\s*\{/g)) {
      if ((m.index ?? 0) < after) continue;
      const at = (m.index ?? 0) + m[0].length;
      after = closing(source, at, GO);
      structs.push({ name: m[1]!, body: source.slice(at, after), at, file, lines });
    }
  }
  const names = new Set(structs.map((s) => s.name));
  const fields: Field[] = [];
  for (const s of structs) {
    const rows = s.body.split("\n");
    const isModel = migrated.has(s.name) || rows.some((r) => /^\s*gorm\.Model\b/.test(r) || r.includes('gorm:"'));
    if (!isModel) continue;
    let offset = 0;
    let docs = "";
    for (const row of rows) {
      const at = s.at + offset;
      offset += row.length + 1;
      const t = row.trim();
      if (t.startsWith("//")) { docs += ` ${t}`; continue; }
      const tick = t.indexOf("`");
      const tag = tick === -1 ? "" : t.slice(tick);
      const decl = code(tick === -1 ? t : t.slice(0, tick), GO).trim();
      const text = `${docs} ${t}`;
      docs = "";
      if (!decl) continue;
      const tokens = decl.split(/\s+/);
      // An embedded struct (gorm.Model, a base) has no name of its own.
      if (tokens.length < 2) continue;
      if (/gorm:"-/.test(tag) || /gorm:"[^"]*\b(foreignKey|many2many|references|polymorphic)\b/i.test(tag)) continue;
      const type = tokens.at(-1)!;
      const bare = type.replace(/^[*[\]]+/, "");
      if (names.has(bare)) continue;
      for (const name of tokens.slice(0, -1).join(" ").split(",").map((n) => n.trim())) {
        if (!/^[A-Z]\w*$/.test(name)) continue;
        fields.push({ ref: `${s.name}.${name}`, model: s.name, name, type, marked: marker(text), file: s.file, line: s.lines.at(at) });
      }
    }
  }
  return fields;
}

/** How many characters of whitespace and comments come before the code of a part, so its line is the code's. */
function leading(text: string): number {
  const clean = code(text, JAVA);
  const first = clean.search(/\S/);
  if (first === -1) return 0;
  // Comments were replaced by one space each, so find the same code in the original.
  const word = clean.slice(first, first + 12);
  const at = text.indexOf(word);
  return at === -1 ? 0 : at;
}

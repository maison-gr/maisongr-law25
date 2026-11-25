// Python ORMs: Django models, and SQLAlchemy (declarative classes, 2.0 Mapped annotations, Flask-SQLAlchemy's db.Model,
// SQLModel, and Table() objects). Line-based on indentation: a class's fields are the lines at its first indent.

import { marker, type Field } from "../schema.js";
import { Lines, PYTHON, closing, code, quotedAt, splitTopLevel, type SourceFile } from "./scan.js";

/** "Mapped[Optional[str]]" → str. */
const mapped = (annotation: string) => annotation.match(/^Mapped\[\s*(?:Optional\[\s*)?([\w.]+)/)?.[1];

interface Member { text: string; line: number; raw: string }
interface PyClass { name: string; bases: string; line: number; members: Member[] }

const indentOf = (l: string) => l.length - l.trimStart().length;

/** Each class with the statements at its body's own indent: a statement's continuation lines and the comments just above it go with it. */
function classes(source: string): PyClass[] {
  const out: PyClass[] = [];
  // The classes open at this line, innermost last: one pass over the lines, however deep classes nest.
  const open: { cls: PyClass; own: number; body: number; docs: string; current: Member | null }[] = [];
  source.split(/\r?\n/).forEach((l, i) => {
    const t = l.trim();
    if (!t) return;
    const indent = indentOf(l);
    while (open.length && indent <= open.at(-1)!.own) open.pop();
    const top = open.at(-1);
    if (top) {
      if (top.body === -1) top.body = indent;
      if (indent > top.body) { if (top.current) top.current.raw += `\n${l}`; }
      else if (indent === top.body) {
        if (t.startsWith("#")) { top.docs += `\n${t}`; top.current = null; }
        else { top.current = { text: t, line: i + 1, raw: `${top.docs}\n${t}` }; top.cls.members.push(top.current); top.docs = ""; }
      }
    }
    const m = l.match(/^(\s*)class\s+(\w+)/);
    if (!m) return;
    // "class User(Base):", read by hand: no pattern with two optional runs of spaces.
    let rest = l.slice(m[0].length).trimStart();
    let bases = "";
    if (rest.startsWith("(")) {
      const close = rest.indexOf(")");
      if (close === -1) return;
      bases = rest.slice(1, close);
      rest = rest.slice(close + 1).trimStart();
    }
    if (!rest.startsWith(":")) return;
    const cls: PyClass = { name: m[2]!, bases, line: i + 1, members: [] };
    out.push(cls);
    open.push({ cls, own: m[1]!.length, body: -1, docs: "", current: null });
  });
  return out;
}

const RELATIONS = new Set(["ForeignKey", "OneToOneField", "ManyToManyField", "GenericForeignKey", "GenericRelation", "ParentalKey", "ParentalManyToManyField", "TreeForeignKey"]);
/** Fields a Django base class brings: its own columns, written in no file of the project. */
const INHERITED: Record<string, string[]> = {
  AbstractUser: ["username", "first_name", "last_name", "email", "password", "last_login", "date_joined"],
  AbstractBaseUser: ["password", "last_login"],
};

/** Django: classes whose statements are `name = models.SomethingField(…)`; relations (ForeignKey, ManyToMany) left out. */
export function parseDjango(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    for (const cls of classes(source)) {
      if (cls.name === "Meta") continue;
      const own: Field[] = [];
      for (const m of cls.members) {
        const f = m.text.match(/^(\w+)\s*=\s*(?:models\.|\w+\.)?(\w+)\s*\(/);
        if (!f || f[1]!.startsWith("_")) continue;
        const type = f[2]!;
        if (!type.endsWith("Field") || RELATIONS.has(type)) continue;
        own.push({ ref: `${cls.name}.${f[1]}`, model: cls.name, name: f[1]!, type, marked: marker(m.raw), file, line: m.line });
      }
      for (const [base, names] of Object.entries(INHERITED)) {
        if (!new RegExp(`\\b${base}\\b`).test(cls.bases)) continue;
        for (const name of names) {
          if (!own.some((f) => f.name === name)) own.push({ ref: `${cls.name}.${name}`, model: cls.name, name, type: `${base} field`, file, line: cls.line });
        }
      }
      fields.push(...own);
    }
  }
  return fields;
}

/** SQLAlchemy and SQLModel: Column(…), mapped_column(…), bare Mapped[…] annotations, SQLModel fields; relationship() left out. */
export function parseSqlAlchemy(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    for (const cls of classes(source)) {
      const sqlModel = /\bSQLModel\b/.test(cls.bases) && /\btable\s*=\s*True\b/.test(cls.bases);
      for (const m of cls.members) {
        const name = m.text.match(/^\w+/)?.[0];
        if (!name || name.startsWith("__")) continue;
        let rest = m.text.slice(name.length).trimStart();
        let annotation = "";
        if (rest.startsWith(":")) {
          const eq = rest.indexOf("=");
          annotation = (eq === -1 ? rest.slice(1) : rest.slice(1, eq)).trim();
          rest = eq === -1 ? "" : rest.slice(eq);
        }
        const value = rest.startsWith("=") ? rest.slice(1).trim() : "";
        const call = value.match(/^(?:\w+\.)*(\w+)\s*\(/)?.[1];
        if (call && /^(relationship|Relationship|relation|association_proxy|column_property|synonym|hybrid_property)$/.test(call)) continue;
        let type: string | undefined;
        if (call === "Column" || call === "mapped_column") {
          const args = value.slice(value.indexOf("(") + 1);
          const first = splitTopLevel(args.slice(0, closing(args, 0, PYTHON)), PYTHON).map((p) => code(p.text, PYTHON).trim()).find((a) => /^(?:\w+\.)*[A-Z]\w*/.test(a));
          type = first?.match(/^(?:\w+\.)*(\w+)/)?.[1] ?? mapped(annotation) ?? "unknown";
        } else if (annotation.startsWith("Mapped[") && !value) {
          type = mapped(annotation) ?? "unknown";
        } else if (sqlModel && annotation && (!call || call === "Field") && !/^(List|list)\[/.test(annotation)) {
          type = annotation.replace(/\|\s*None$/, "").trim().replace(/^Optional\[(.*)\]$/, "$1");
        }
        if (!type) continue;
        fields.push({ ref: `${cls.name}.${name}`, model: cls.name, name, type, marked: marker(m.raw), file, line: m.line });
      }
    }
    // users = Table("users", metadata, Column("email", String), …)
    const lines = new Lines(source);
    let after = 0;
    for (const t of source.matchAll(/\bTable\s*\(/g)) {
      if ((t.index ?? 0) < after) continue;
      const open = (t.index ?? 0) + t[0].length;
      const name = quotedAt(source, open);
      if (!name) continue;
      const end = closing(source, open, PYTHON);
      after = end;
      for (const part of splitTopLevel(source.slice(open, end), PYTHON)) {
        const c = code(part.text, PYTHON).trim();
        if (!/^(?:\w+\.)?Column\s*\(/.test(c)) continue;
        const column = quotedAt(c, c.indexOf("(") + 1);
        if (!column) continue;
        const type = c.slice(column.end).match(/^\s*,\s*(?:\w+\.)*(\w+)/)?.[1] ?? "unknown";
        const line = lines.at(open + part.start + part.text.length - part.text.trimStart().length);
        fields.push({ ref: `${name.value}.${column.value}`, model: name.value, name: column.value, type, marked: marker(part.text), file, line });
      }
    }
  }
  return fields;
}

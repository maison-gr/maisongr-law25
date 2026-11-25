// The fields a project stores, read from its Prisma schema or its SQL migrations, so `check` can tell which personal
// fields the assessment doesn't account for. Line-based on purpose: it needs names, types and comments, not a full
// grammar. A `/// @personal` (Prisma) or `-- @personal` (SQL) comment marks a field personal whatever its name, and
// `@not-personal` marks it not personal.

export interface Field {
  /** "Model.field" (Prisma) or "table.column" (SQL; the "public." schema is left out). */
  ref: string;
  model: string;
  name: string;
  type: string;
  /** From a comment: true for @personal, false for @not-personal. */
  marked?: boolean;
  /** Where it is declared, for messages. */
  file: string;
  line: number;
}

const marker = (text: string): boolean | undefined =>
  /@not-personal\b/.test(text) ? false : /@personal\b/.test(text) ? true : undefined;

export function parsePrisma(source: string, file = "schema.prisma"): Field[] {
  const lines = source.split(/\r?\n/);
  const models = new Set<string>();
  for (const l of lines) {
    const m = l.match(/^\s*(model|view)\s+(\w+)\s*\{/);
    if (m) models.add(m[2]!);
  }
  const fields: Field[] = [];
  let model: string | null = null;
  let docs = "";
  lines.forEach((l, i) => {
    const open = l.match(/^\s*(model|view)\s+(\w+)\s*\{/);
    if (open) { model = open[2]!; docs = ""; return; }
    if (/^\s*(enum|type)\s+\w+\s*\{/.test(l)) { model = null; return; }
    if (/^\s*\}/.test(l)) { model = null; return; }
    if (!model) return;
    const doc = l.match(/^\s*\/\/\/(.*)$/);
    if (doc) { docs += ` ${doc[1]}`; return; }
    const f = l.match(/^\s*(\w+)\s+(\w+)(\[\])?\??(.*)$/);
    if (!f || l.trim().startsWith("@@") || l.trim().startsWith("//")) { docs = ""; return; }
    const [, name, type, , rest] = f;
    // A field whose type is another model is a relation, not stored data. Enums stay: a Gender enum is personal.
    if (models.has(type!)) { docs = ""; return; }
    fields.push({ ref: `${model}.${name}`, model, name: name!, type: type!, marked: marker(`${docs} ${rest ?? ""}`), file, line: i + 1 });
    docs = "";
  });
  return fields;
}

/** CREATE TABLE and ALTER TABLE … ADD COLUMN, in migration order; DROP TABLE and DROP COLUMN take fields away again. */
export function parseSql(files: { file: string; source: string }[]): Field[] {
  const byRef = new Map<string, Field>();
  // Identifiers quoted the PostgreSQL ("x"), MySQL (`x`) or SQL Server ([x]) way; the default schema left out.
  const name = (raw: string) => unquote(raw).replace(/^(public|dbo)\./i, "");
  for (const { file, source } of files) {
    const lineAt = (index: number) => source.slice(0, index).split("\n").length;
    const create = /create\s+(?:(?:global\s+|local\s+)?(?:temporary|temp|unlogged)\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."`\[\]]+)\s*\(/gi;
    for (let m = create.exec(source); m; m = create.exec(source)) {
      const table = name(m[1]!);
      const start = m.index + m[0].length;
      const end = closingParen(source, start);
      let cursor = start;
      for (const part of splitTopLevel(source.slice(start, end))) {
        const clean = part.replace(/--[^\n]*/g, "").trim();
        const col = clean.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+(\w+)/);
        if (col && !/^(constraint|primary|foreign|unique|check|exclude|like|key|index|fulltext|spatial|period)\b/i.test(clean)) {
          const column = unquote(col[1]!);
          const offset = source.indexOf(col[1]!, cursor);
          cursor = offset === -1 ? cursor : offset + col[1]!.length;
          byRef.set(`${table}.${column}`, { ref: `${table}.${column}`, model: table, name: column, type: col[2]!.toLowerCase(), marked: marker(part), file, line: lineAt(offset === -1 ? start : offset) });
        }
      }
      create.lastIndex = end;
    }
    const alter = /alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([\w."`\[\]]+)\s+([^;]*);/gi;
    for (const m of source.matchAll(alter)) {
      const table = name(m[1]!);
      for (const action of splitTopLevel(m[2]!)) {
        const add = action.match(/^\s*add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+(\w+)/i);
        if (add && !/^\s*add\s+(constraint|primary|foreign|unique|check)\b/i.test(action)) {
          const column = unquote(add[1]!);
          byRef.set(`${table}.${column}`, { ref: `${table}.${column}`, model: table, name: column, type: add[2]!.toLowerCase(), marked: marker(action), file, line: lineAt(m.index ?? 0) });
        }
        const drop = action.match(/^\s*drop\s+(?:column\s+)?(?:if\s+exists\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)/i);
        if (drop && !/^\s*drop\s+(constraint|default|not)\b/i.test(action)) byRef.delete(`${table}.${unquote(drop[1]!)}`);
      }
    }
    for (const m of source.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w."`\[\]]+)/gi)) {
      const table = name(m[1]!);
      for (const ref of [...byRef.keys()]) if (ref.startsWith(`${table}.`)) byRef.delete(ref);
    }
  }
  return [...byRef.values()];
}

/** "x", `x` or [x] → x (each part of schema.table). */
function unquote(s: string): string {
  return s.replace(/["`[\]]/g, "");
}

function closingParen(s: string, from: number): number {
  let depth = 1;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === "'") { const j = s.indexOf("'", i + 1); i = j === -1 ? s.length : j; continue; }
    if (c === "-" && s[i + 1] === "-") { const j = s.indexOf("\n", i); i = j === -1 ? s.length : j; continue; }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return s.length;
}

/** Splits on commas outside parentheses and quotes. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") { const j = s.indexOf("'", i + 1); i = j === -1 ? s.length : j; continue; }
    if (c === "-" && s[i + 1] === "-") { const j = s.indexOf("\n", i); i = j === -1 ? s.length : j; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      // "email text, -- @personal": a comment after the comma, on the same line, belongs to the column before it.
      const eol = s.indexOf("\n", i);
      const tail = s.slice(i + 1, eol === -1 ? s.length : eol);
      const end = /^\s*--/.test(tail) ? (eol === -1 ? s.length : eol) : i;
      parts.push(s.slice(last, i) + s.slice(i + 1, end));
      last = end + (end === i ? 1 : 0);
      i = Math.max(i, end - 1);
    }
  }
  parts.push(s.slice(last));
  return parts.filter((p) => p.trim());
}

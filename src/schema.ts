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

export const marker = (text: string): boolean | undefined =>
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
    // "email String? @unique // note": the first two words are the name and the type (with [] or ?), the rest is
    // attributes and comments. Split, not matched, so no pattern can backtrack on a long line.
    const trimmed = l.trim();
    if (trimmed.startsWith("@@") || trimmed.startsWith("//")) { docs = ""; return; }
    const [name, rawType, ...restParts] = trimmed.split(/\s+/);
    const type = rawType?.replace(/(\[\])?\??$/, "");
    if (!name || !type || !/^\w+$/.test(name) || !/^\w+$/.test(type)) { docs = ""; return; }
    const rest = restParts.join(" ");
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
    // Statements are found in the text with its comments blanked, so "-- Rollback: DROP TABLE notes;" drops nothing;
    // offsets are the same in both, and @personal markers are still read from the source itself.
    const code = withoutComments(source);
    const lines = lineStarts(source);
    const lineAt = (index: number) => lineOf(lines, index);
    const create = /create\s+(?:(?:global\s+|local\s+)?(?:temporary|temp|unlogged)\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."`\[\]]+)\s*\(/gi;
    for (let m = create.exec(code); m; m = create.exec(code)) {
      const table = name(m[1]!);
      const start = m.index + m[0].length;
      const end = closingParen(source, start);
      let cursor = start;
      for (const part of splitTopLevel(source.slice(start, end))) {
        const clean = withoutComments(part).trim();
        const col = clean.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+(\w+)/);
        if (col && !isIndexOrConstraint(clean)) {
          const column = unquote(col[1]!);
          const offset = source.indexOf(col[1]!, cursor);
          cursor = offset === -1 ? cursor : offset + col[1]!.length;
          byRef.set(`${table}.${column}`, { ref: `${table}.${column}`, model: table, name: column, type: col[2]!.toLowerCase(), marked: marker(part), file, line: lineAt(offset === -1 ? start : offset) });
        }
      }
      create.lastIndex = end;
    }
    // The pattern finds "ALTER TABLE name" only; its actions run to the next ";", found with indexOf. No pattern spans
    // the actions, so a long run of spaces with no ";" can't make one backtrack (CodeQL js/polynomial-redos).
    const alter = /alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([\w."`\[\]]+)/gi;
    for (const m of code.matchAll(alter)) {
      const from = (m.index ?? 0) + m[0].length;
      const end = code.indexOf(";", from);
      if (end === -1) break;
      const table = name(m[1]!);
      for (const action of splitTopLevel(source.slice(from, end))) {
        const clean = withoutComments(action).trim();
        const add = clean.match(/^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+(\w+)/i);
        const column = clean.replace(/^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?/i, "");
        // "ADD COLUMN key text" is a column; "ADD KEY idx (id)" and "ADD CONSTRAINT …" are not.
        if (add && (/^add\s+column\b/i.test(clean) || !isIndexOrConstraint(column))) {
          const col = unquote(add[1]!);
          byRef.set(`${table}.${col}`, { ref: `${table}.${col}`, model: table, name: col, type: add[2]!.toLowerCase(), marked: marker(action), file, line: lineAt(m.index ?? 0) });
        }
        const drop = clean.match(/^drop\s+(?:column\s+)?(?:if\s+exists\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)/i);
        if (drop && !/^drop\s+(constraint|default|not|index|key|primary|foreign)\b/i.test(clean)) byRef.delete(`${table}.${unquote(drop[1]!)}`);
      }
    }
    for (const m of code.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w."`\[\]]+)/gi)) {
      const table = name(m[1]!);
      for (const ref of [...byRef.keys()]) if (ref.startsWith(`${table}.`)) byRef.delete(ref);
    }
  }
  return [...byRef.values()];
}

/**
 * Whether a line of a table body (or what follows ADD) is an index or a constraint rather than a column. A keyword
 * opens one only in its own shape: "PRIMARY KEY (id)", "KEY idx (email)", "UNIQUE (email)", "CHECK (x > 0)",
 * "INDEX ix USING BTREE (id)". "key text primary key" is a column called key.
 */
function isIndexOrConstraint(clean: string): boolean {
  const words = clean.match(/^(\w+)\s*(.*)$/s);
  if (!words) return false;
  const first = words[1]!.toLowerCase();
  const rest = words[2]!;
  if (["constraint", "foreign", "exclude", "period", "like"].includes(first)) return true;
  if (!["primary", "unique", "check", "key", "index", "fulltext", "spatial"].includes(first)) return false;
  // What comes next: "(" (UNIQUE (email)), a second keyword (PRIMARY KEY, UNIQUE KEY, FULLTEXT INDEX), or a name
  // followed by "(" or USING (KEY idx_email (email)).
  if (!rest || rest.startsWith("(")) return true;
  const next = rest.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s*(.*)$/s);
  if (!next) return true;
  if (/^(key|index)$/i.test(next[1]!)) return true;
  const after = next[2]!;
  return after.startsWith("(") || /^using\b/i.test(after);
}

/** The text with its comments (-- to the line's end, /* … *\/) turned to spaces, line breaks kept: offsets don't move. */
function withoutComments(s: string): string {
  let out = "";
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') { const j = s.indexOf(c, i + 1); i = j === -1 ? s.length : j; continue; }
    let end = -1;
    if (c === "-" && s[i + 1] === "-") { const j = s.indexOf("\n", i); end = j === -1 ? s.length : j; }
    else if (c === "/" && s[i + 1] === "*") { const j = s.indexOf("*/", i + 2); end = j === -1 ? s.length : j + 2; }
    if (end === -1) continue;
    out += s.slice(last, i) + s.slice(i, end).replace(/[^\n]/g, " ");
    last = end;
    i = end - 1;
  }
  return out + s.slice(last);
}

function lineStarts(s: string): number[] {
  const starts = [0];
  for (let i = s.indexOf("\n"); i !== -1; i = s.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}

function lineOf(starts: number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
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
    if (c === "/" && s[i + 1] === "*") { const j = s.indexOf("*/", i + 2); i = j === -1 ? s.length : j + 1; continue; }
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
    if (c === "/" && s[i + 1] === "*") { const j = s.indexOf("*/", i + 2); i = j === -1 ? s.length : j + 1; continue; }
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

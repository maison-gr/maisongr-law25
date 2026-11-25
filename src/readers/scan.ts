// What every reader needs from source code without a parser: the bracket that closes another, the parts of a list,
// the text without its comments, a line number. Each walks the text once, skipping strings and comments, so no input
// can make it slow (no pattern here can backtrack).

export interface SourceFile {
  /** Relative to the project, for messages. */
  file: string;
  source: string;
}

/** How a language writes comments and strings. */
export interface Syntax {
  /** Line comments: "//", "#", "--". */
  line: string[];
  /** Block comments: /* … *\/. */
  block: boolean;
  /** String delimiters. Python's triple quotes are handled when `triple` is set. */
  quotes: string;
  triple?: boolean;
}

export const C_LIKE: Syntax = { line: ["//"], block: true, quotes: "\"'`" };
export const PYTHON: Syntax = { line: ["#"], block: false, quotes: "\"'", triple: true };
export const RUBY: Syntax = { line: ["#"], block: false, quotes: "\"'" };
export const PHP: Syntax = { line: ["//", "#"], block: true, quotes: "\"'" };
export const JAVA: Syntax = { line: ["//"], block: true, quotes: "\"'" };

/** Where the string or comment starting at i ends (the index after it), or i when none starts there. */
export function skip(s: string, i: number, syntax: Syntax): number {
  const c = s[i]!;
  if (syntax.quotes.includes(c)) {
    if (syntax.triple && s.startsWith(c.repeat(3), i)) {
      const j = s.indexOf(c.repeat(3), i + 3);
      return j === -1 ? s.length : j + 3;
    }
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === "\\") j++;
      else if (s[j] === c) return j + 1;
      // An unclosed quote on a line (an apostrophe in a Ruby or Python comment we didn't see) stops at the line's end.
      else if (s[j] === "\n" && c !== "`") return j;
    }
    return s.length;
  }
  for (const t of syntax.line) {
    if (s.startsWith(t, i)) {
      const j = s.indexOf("\n", i);
      return j === -1 ? s.length : j;
    }
  }
  if (syntax.block && c === "/" && s[i + 1] === "*") {
    const j = s.indexOf("*/", i + 2);
    return j === -1 ? s.length : j + 2;
  }
  return i;
}

const OPEN = "([{";
const CLOSE = ")]}";

/**
 * Where each bracket of a text closes, found in one pass with a stack: a file with ten thousand unclosed "{" is
 * still read once, not once per bracket. Kept for the last few texts, since readers ask about the same one often.
 */
const tables: { s: string; syntax: Syntax; match: Int32Array }[] = [];
function table(s: string, syntax: Syntax): Int32Array {
  // The same text object is passed again and again: compared by length first, so a miss costs nothing.
  const hit = tables.find((t) => t.syntax === syntax && t.s.length === s.length && t.s === s);
  if (hit) return hit.match;
  const match = new Int32Array(s.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const j = skip(s, i, syntax);
    if (j !== i) { i = j - 1; continue; }
    const c = s[i]!;
    if (OPEN.includes(c)) stack.push(i);
    else if (CLOSE.includes(c) && stack.length) match[stack.pop()!] = i;
  }
  for (const open of stack) match[open] = s.length;
  if (tables.length >= 8) tables.shift();
  tables.push({ s, syntax, match });
  return match;
}

/** The index of the bracket closing the one just before `from`, or the text's end. */
export function closing(s: string, from: number, syntax: Syntax): number {
  const opener = from - 1;
  if (opener >= 0 && OPEN.includes(s[opener]!)) {
    const m = table(s, syntax)[opener]!;
    // -1: that bracket is inside a string or a comment; scan from it as asked.
    if (m !== -1) return m;
  }
  let depth = 1;
  for (let i = from; i < s.length; i++) {
    const j = skip(s, i, syntax);
    if (j !== i) { i = j - 1; continue; }
    const c = s[i]!;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && --depth === 0) return i;
  }
  return s.length;
}

export interface Part {
  /** The part as written, comments included (they carry @personal). */
  text: string;
  /** Its offset in the text split. */
  start: number;
}

/**
 * Splits on the commas outside brackets, strings and comments. A comment after a comma, on the same line, belongs to
 * the part before it ("email: text(), // @personal").
 */
export function splitTopLevel(s: string, syntax: Syntax, separator = ","): Part[] {
  const parts: Part[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const j = skip(s, i, syntax);
    if (j !== i) { i = j - 1; continue; }
    const c = s[i]!;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (c === separator && depth === 0) {
      const eol = s.indexOf("\n", i);
      const lineEnd = eol === -1 ? s.length : eol;
      let k = i + 1;
      while (k < lineEnd && (s[k] === " " || s[k] === "\t")) k++;
      const comment = k < lineEnd && skip(s, k, syntax) !== k && !syntax.quotes.includes(s[k]!);
      parts.push({ text: s.slice(last, i) + (comment ? s.slice(k, lineEnd) : ""), start: last });
      last = comment ? lineEnd : i + 1;
      i = last - 1;
    }
  }
  parts.push({ text: s.slice(last), start: last });
  return parts.filter((p) => code(p.text, syntax).trim());
}

/** The text without its comments; strings kept. */
export function code(s: string, syntax: Syntax): string {
  let out = "";
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const j = skip(s, i, syntax);
    if (j === i) continue;
    if (!syntax.quotes.includes(s[i]!)) { out += `${s.slice(last, i)} `; last = j; }
    i = j - 1;
  }
  return out + s.slice(last);
}

/** Line numbers by offset, found by binary search: one pass over the text, however many fields it has. */
export class Lines {
  private starts: number[] = [0];
  constructor(source: string) {
    for (let i = source.indexOf("\n"); i !== -1; i = source.indexOf("\n", i + 1)) this.starts.push(i + 1);
  }
  /** The 1-based line of an offset. */
  at(index: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }
}

export interface Statement {
  /** The text before the terminator or block, comments included. */
  head: string;
  /** The inside of the block that ended it ({ get; set; }, a method's body), if one did. */
  block?: string;
  /** Offset of the head in the body. */
  start: number;
}

/**
 * A class body's statements at its own depth: each ends at ";" or with a block. With `newline` (Kotlin), a line ends
 * one too, unless it holds only annotations, which then go with the next line.
 */
export function statements(body: string, syntax: Syntax, newline = false): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const j = skip(body, i, syntax);
    if (j !== i) { i = j - 1; continue; }
    const c = body[i]!;
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && c === "{") {
      const end = closing(body, i + 1, syntax);
      out.push({ head: body.slice(start, i), block: body.slice(i + 1, end), start });
      i = end;
      start = end + 1;
    } else if (depth === 0 && (c === ";" || (newline && c === "\n"))) {
      const head = body.slice(start, i);
      if (c === "\n" && (!code(head, syntax).trim() || !annotations(code(head, syntax)).rest.trim())) continue;
      out.push({ head, start });
      start = i + 1;
    }
  }
  if (code(body.slice(start), syntax).trim()) out.push({ head: body.slice(start), start });
  return out;
}

/** Leading annotations (@Column(…), @field:Column, Java's and Kotlin's) or attributes ([Required, MaxLength(50)], C#'s): their names, and the rest. */
export function annotations(s: string): { names: string[]; args: string; rest: string } {
  const names: string[] = [];
  let args = "";
  let i = spaces(s, 0);
  for (;;) {
    if (s[i] === "@") {
      let end = i + 1;
      while (end < s.length && /[\w.:]/.test(s[end]!)) end++;
      const name = s.slice(i + 1, end).split(/[.:]/).at(-1)!;
      names.push(name);
      const k = spaces(s, end);
      if (s[k] === "(") { const close = closing(s, k + 1, JAVA); args += s.slice(k, close + 1); i = spaces(s, close + 1); }
      else i = k;
      continue;
    }
    if (s[i] === "[") {
      const close = closing(s, i + 1, JAVA);
      const inside = s.slice(i + 1, close);
      for (const part of splitTopLevel(inside, JAVA)) { const w = part.text.trim().match(/^[\w.]+/)?.[0]; if (w) names.push(w.split(".").at(-1)!.replace(/Attribute$/, "")); }
      args += inside;
      i = spaces(s, close + 1);
      continue;
    }
    break;
  }
  return { names, args, rest: s.slice(i) };
}

/** The first identifier at i, after spaces; "" when there is none. */
export function wordAt(s: string, i: number): { word: string; end: number } {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  let end = i;
  while (end < s.length && /[\w$]/.test(s[end]!)) end++;
  return { word: s.slice(i, end), end };
}

/** The index of the first character after spaces at i. */
export function spaces(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
}

/** A quoted name at i ("users", 'users', `users`, :users), or null. */
export function quotedAt(s: string, i: number): { value: string; end: number } | null {
  i = spaces(s, i);
  const q = s[i];
  if (q === ":") {
    const w = wordAt(s, i + 1);
    return w.word ? { value: w.word, end: w.end } : null;
  }
  if (q !== '"' && q !== "'" && q !== "`") return null;
  const end = s.indexOf(q, i + 1);
  if (end === -1 || s.slice(i + 1, end).includes("\n")) return null;
  return { value: s.slice(i + 1, end), end: end + 1 };
}

// OpenAPI (components.schemas, or Swagger 2's definitions) and JSON Schema (the root, $defs, definitions), in JSON or
// YAML: each schema's properties, nested objects as "address.city". `x-personal: true` or `false` on a property marks
// it, as a @personal comment does in code. YAML is read in its usual block style, without a dependency.

import type { Field } from "../schema.js";
import type { SourceFile } from "./scan.js";

type Node = { [key: string]: unknown };
/** The line each mapping key was read from, by object. */
type LinesOf = WeakMap<object, Map<string, number>>;

export function parseOpenApi(files: SourceFile[]): Field[] {
  const fields: Field[] = [];
  for (const { file, source } of files) {
    const lines: LinesOf = new WeakMap();
    let doc: unknown;
    try { doc = /\.json$/i.test(file) ? jsonWithLines(source, lines) : yaml(source, lines); } catch { continue; }
    if (!isObject(doc)) continue;
    const schemas: [string, unknown][] = [];
    if ("openapi" in doc || "swagger" in doc) {
      const components = isObject(doc.components) ? doc.components.schemas : undefined;
      for (const group of [components, doc.definitions]) if (isObject(group)) schemas.push(...Object.entries(group));
    } else {
      const stem = file.split("/").pop()!.replace(/(\.schema)?\.(json|ya?ml)$/i, "");
      if (isObject(doc.properties)) schemas.push([typeof doc.title === "string" ? doc.title.replace(/\W+/g, "") || stem : stem, doc]);
      for (const group of [doc.$defs, doc.definitions]) if (isObject(group)) schemas.push(...Object.entries(group));
    }
    for (const [model, schema] of schemas) {
      const read = (s: unknown, prefix: string, depth: number) => {
        if (!isObject(s) || depth > 8) return;
        for (const part of [s, ...["allOf", "oneOf", "anyOf"].flatMap((k) => (Array.isArray(s[k]) ? (s[k] as unknown[]) : []))]) {
          if (!isObject(part) || !isObject(part.properties)) continue;
          const props = part.properties;
          for (const [name, p] of Object.entries(props)) {
            const path = `${prefix}${name}`;
            const prop = isObject(p) ? p : {};
            const items = isObject(prop.items) ? prop.items : null;
            const nested = isObject(prop.properties) ? prop : items && isObject(items.properties) ? items : null;
            const marked = prop["x-personal"] === true ? true : prop["x-personal"] === false ? false : undefined;
            if (nested && marked === undefined) { read(nested, `${path}.`, depth + 1); continue; }
            const ref = typeof prop.$ref === "string" ? prop.$ref.split("/").pop()! : null;
            const type = typeof prop.type === "string" ? (prop.type === "array" && items ? `${typeof items.type === "string" ? items.type : "object"}[]` : prop.type) : ref ?? "object";
            fields.push({ ref: `${model}.${path}`, model, name: path, type, marked, file, line: lines.get(props)?.get(name) ?? 1 });
          }
        }
      };
      read(schema, "", 0);
    }
  }
  return fields;
}

const isObject = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON.parse, then the line of each key, found by walking the text once in the same order. */
function jsonWithLines(source: string, lines: LinesOf): unknown {
  const doc = JSON.parse(source) as unknown;
  let i = 0;
  let line = 1;
  const advance = (to: number) => { for (; i < to; i++) if (source[i] === "\n") line++; };
  const skipString = () => {
    // At a quote: to the character after the closing one.
    let j = i + 1;
    while (j < source.length && source[j] !== '"') j += source[j] === "\\" ? 2 : 1;
    advance(j + 1);
  };
  const walk = (v: unknown) => {
    while (i < source.length && /\s/.test(source[i]!)) advance(i + 1);
    if (Array.isArray(v)) {
      advance(source.indexOf("[", i) + 1);
      for (const x of v) { walk(x); while (i < source.length && /[\s,]/.test(source[i]!)) advance(i + 1); }
      advance(source.indexOf("]", i) + 1);
    } else if (isObject(v)) {
      advance(source.indexOf("{", i) + 1);
      const map = new Map<string, number>();
      lines.set(v, map);
      // Keys come in source order; JSON.parse keeps the last of a repeated key.
      for (;;) {
        while (i < source.length && /[\s,]/.test(source[i]!)) advance(i + 1);
        if (source[i] !== '"') break;
        const keyStart = i;
        skipString();
        const key = JSON.parse(source.slice(keyStart, i)) as string;
        map.set(key, line);
        advance(source.indexOf(":", i) + 1);
        walk(v[key]);
      }
      advance(source.indexOf("}", i) + 1);
    } else if (typeof v === "string") {
      skipString();
    } else {
      while (i < source.length && !/[\s,\]}]/.test(source[i]!)) advance(i + 1);
    }
  };
  walk(doc);
  return doc;
}

/**
 * The block style of YAML that OpenAPI files are written in: mappings, "- " sequences, plain and quoted scalars, and
 * one-line flow collections ({ type: string }, [a, b]). Block scalars (| and >) are skipped. Anchors are dropped.
 */
function yaml(source: string, lines: LinesOf): unknown {
  const rows: { indent: number; text: string; line: number }[] = [];
  source.split(/\r?\n/).forEach((raw, n) => {
    const text = stripComment(raw);
    if (!text.trim() || text.trim() === "---" || text.trim() === "...") return;
    rows.push({ indent: text.length - text.trimStart().length, text: text.trim(), line: n + 1 });
  });
  let r = 0;
  const block = (indent: number): unknown => {
    const first = rows[r];
    if (!first || first.indent < indent) return null;
    if (first.text.startsWith("- ") || first.text === "-") {
      const list: unknown[] = [];
      const own = first.indent;
      while (rows[r] && rows[r]!.indent === own && (rows[r]!.text.startsWith("- ") || rows[r]!.text === "-")) {
        const row = rows[r]!;
        const rest = row.text.slice(1).trimStart();
        if (!rest) { r++; list.push(block(own + 1)); continue; }
        // "- key: value" starts a mapping whose other keys are indented to the key.
        const keyIndent = own + (row.text.length - rest.length);
        if (keyOf(rest)) { rows[r] = { indent: keyIndent, text: rest, line: row.line }; list.push(block(keyIndent)); }
        else { r++; list.push(scalar(rest)); }
      }
      return list;
    }
    const map: Node = {};
    const keys = new Map<string, number>();
    lines.set(map, keys);
    const own = first.indent;
    while (rows[r] && rows[r]!.indent === own && !rows[r]!.text.startsWith("- ")) {
      const row = rows[r]!;
      const kv = keyOf(row.text);
      r++;
      if (!kv) continue;
      keys.set(kv.key, row.line);
      const value = kv.value.replace(/^&\S+\s*/, "");
      if (value === "|" || value === ">" || /^[|>][+-]?\d*$/.test(value)) {
        while (rows[r] && rows[r]!.indent > own) r++;
        map[kv.key] = "";
      } else if (value) map[kv.key] = scalar(value);
      else map[kv.key] = rows[r] && (rows[r]!.indent > own || (rows[r]!.indent === own && rows[r]!.text.startsWith("- "))) ? block(rows[r]!.indent) : null;
    }
    // Deeper rows nobody claimed (bad indentation) are skipped, so the walk always moves on.
    while (rows[r] && rows[r]!.indent > own && r < rows.length) r++;
    return map;
  };
  return block(0);
}

/** "key: value" (key plain or quoted), or null. */
function keyOf(text: string): { key: string; value: string } | null {
  let key: string;
  let rest: string;
  if (text[0] === '"' || text[0] === "'") {
    const end = text.indexOf(text[0], 1);
    if (end === -1) return null;
    key = text.slice(1, end);
    rest = text.slice(end + 1);
    if (!rest.startsWith(":")) return null;
    rest = rest.slice(1);
  } else {
    const colon = text.search(/:(\s|$)/);
    if (colon <= 0) return null;
    key = text.slice(0, colon);
    rest = text.slice(colon + 1);
  }
  return { key: key.trim(), value: rest.trim() };
}

function scalar(v: string): unknown {
  if (v.startsWith("{") && v.endsWith("}")) {
    const out: Node = {};
    for (const part of v.slice(1, -1).split(",")) { const kv = keyOf(part.trim()); if (kv) out[kv.key] = scalar(kv.value); }
    return out;
  }
  if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map((x) => scalar(x.trim())).filter((x) => x !== "");
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  return v;
}

/** The line without its # comment (a # inside quotes, or with no space before it, is text). */
function stripComment(raw: string): string {
  let quote = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { if (i === 0 || /[\s:[{,-]/.test(raw[i - 1]!)) quote = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(raw[i - 1]!))) return raw.slice(0, i);
  }
  return raw;
}

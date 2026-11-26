// What `check` verifies: the assessment is complete (every required text written, in every language), consistent
// (references point at things that exist), and accounts for every personal field the schema stores.

import { personalFields } from "./personal.js";
import type { Field } from "./schema.js";
import type { Assessment, Language, Text } from "./types.js";

export interface Problem {
  level: "error" | "warning";
  /** Where: "data[2].retention", "providers[0].transfer", or a schema field "User.email (prisma/schema.prisma:14)". */
  where: string;
  message: string;
}

const SOURCES = ["person", "third-party", "generated", "public"];
const STAGES = ["collection", "use", "communication", "retention", "other"];
const STATUSES = ["done", "planned", "to-confirm"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const languagesOf = (a: Assessment): Language[] => (a.languages?.length ? a.languages : ["fr", "en"]);

/** A Text's value in one language: the plain string, or its { fr, en } entry. */
export function textIn(t: Text | undefined, lang: Language): string {
  if (t === undefined) return "";
  return typeof t === "string" ? t : (t[lang] ?? "");
}

/** Every value a Text can take (a data item is referred to by its name in any language). */
export const allValues = (t: Text): string[] => (typeof t === "string" ? [t] : Object.values(t));

export function validate(a: Assessment, fields: Field[] | null, today: string): Problem[] {
  const out: Problem[] = [];
  const langs = languagesOf(a);
  const error = (where: string, message: string) => out.push({ level: "error", where, message });
  const warn = (where: string, message: string) => out.push({ level: "warning", where, message });

  /** A required text: present in every language, and not a placeholder. */
  const text = (where: string, t: unknown, required = true) => {
    if (t === undefined || t === null || t === "") {
      if (required) error(where, "is missing");
      return;
    }
    if (typeof t !== "string" && (typeof t !== "object" || Array.isArray(t))) return error(where, "must be text, or { fr, en }");
    // A plain string is the same text in every language: checked once.
    for (const lang of typeof t === "string" ? [langs[0]!] : langs) {
      const v = textIn(t as Text, lang).trim();
      if (!v) error(where, typeof t === "string" ? "is empty" : `has no ${lang} text`);
      else if (/\bTODO\b/.test(v)) error(where, `is still to write${typeof t === "string" ? "" : ` (${lang})`}`);
    }
  };
  const date = (where: string, v: unknown) => {
    if (typeof v !== "string" || !ISO.test(v) || Number.isNaN(Date.parse(v))) error(where, "must be a date written 2026-11-25");
  };

  text("organisation.name", a.organisation?.name);
  text("organisation.privacyOfficer.title", a.organisation?.privacyOfficer?.title);
  text("organisation.privacyOfficer.contact", a.organisation?.privacyOfficer?.contact);
  text("project.name", a.project?.name);
  text("project.description", a.project?.description);
  if (!a.project?.objectives?.length) error("project.objectives", "lists no objective");
  a.project?.objectives?.forEach((o, i) => text(`project.objectives[${i}]`, o));
  text("project.proportionality", a.project?.proportionality);
  date("assessed", a.assessed);
  date("nextReview", a.nextReview);
  if (typeof a.nextReview === "string" && a.nextReview < today) error("nextReview", `was due on ${a.nextReview}: review the assessment, then set the next date`);
  if (typeof a.assessed === "string" && a.assessed > today) warn("assessed", "is in the future");
  if (a.officerConsulted !== undefined) date("officerConsulted", a.officerConsulted);
  text("portability", a.portability, false);
  a.roles?.forEach((r, i) => { text(`roles[${i}].who`, r.who); text(`roles[${i}].role`, r.role); });
  a.consultations?.forEach((c, i) => text(`consultations[${i}]`, c));

  // The information.
  if (!Array.isArray(a.data) || !a.data.length) error("data", "lists no personal information");
  const names = new Map<string, number>();
  (a.data ?? []).forEach((d, i) => {
    const at = `data[${i}]`;
    text(`${at}.name`, d.name);
    for (const n of d.name ? allValues(d.name) : []) {
      if (names.has(n) && names.get(n) !== i) error(`${at}.name`, `"${n}" is also the name of data[${names.get(n)}]`);
      names.set(n, i);
    }
    text(`${at}.whose`, d.whose);
    if (!SOURCES.includes(d.source)) error(`${at}.source`, `must be one of ${SOURCES.join(", ")}`);
    text(`${at}.purpose`, d.purpose);
    text(`${at}.retention`, d.retention);
    text(`${at}.storedIn`, d.storedIn);
    text(`${at}.access`, d.access, false);
    text(`${at}.sensitive`, d.sensitive, false);
  });

  // The providers.
  (a.providers ?? []).forEach((p, i) => {
    const at = `providers[${i}]`;
    text(`${at}.name`, p.name);
    text(`${at}.service`, p.service);
    text(`${at}.location`, p.location);
    text(`${at}.safeguards`, p.safeguards);
    if (!p.data?.length) error(`${at}.data`, "names no information");
    for (const n of p.data ?? []) if (!names.has(n)) error(`${at}.data`, `"${n}" is not the name of an item in data`);
    if (typeof p.outsideQuebec !== "boolean") error(`${at}.outsideQuebec`, "must be true or false");
    if (p.outsideQuebec) {
      if (!p.transfer) error(`${at}.transfer`, "is missing: information that leaves Québec needs the s. 17 assessment (sensitivity, purposes, protection, legal framework, conclusion)");
      else for (const k of ["sensitivity", "purposes", "protection", "legalFramework", "conclusion"] as const) text(`${at}.transfer.${k}`, p.transfer[k]);
    }
  });

  // The risks.
  if (!Array.isArray(a.risks) || !a.risks.length) error("risks", "lists no risk");
  (a.risks ?? []).forEach((r, i) => {
    const at = `risks[${i}]`;
    if (!STAGES.includes(r.stage)) error(`${at}.stage`, `must be one of ${STAGES.join(", ")}`);
    if (!STATUSES.includes(r.status)) error(`${at}.status`, `must be one of ${STATUSES.join(", ")}`);
    text(`${at}.risk`, r.risk);
    text(`${at}.measure`, r.measure);
    text(`${at}.owner`, r.owner, false);
    if (r.due !== undefined) date(`${at}.due`, r.due);
    if (r.status === "planned" && !r.due) warn(`${at}.due`, "a planned measure has no date");
    if (r.status !== "done" && typeof r.due === "string" && r.due < today) warn(`${at}.due`, `was due on ${r.due}`);
  });
  a.approvals?.forEach((x, i) => { text(`approvals[${i}].by`, x.by); text(`approvals[${i}].title`, x.title); date(`approvals[${i}].date`, x.date); });
  a.updates?.forEach((x, i) => { date(`updates[${i}].date`, x.date); text(`updates[${i}].summary`, x.summary); });

  // The schema: every personal field accounted for, every reference real.
  if (fields) {
    const known = new Map(fields.map((f) => [f.ref, f]));
    const listed = new Set<string>();
    (a.data ?? []).forEach((d, i) => d.fields?.forEach((ref) => {
      listed.add(ref);
      if (!known.has(ref)) error(`data[${i}].fields`, `"${ref}" is not in the schema (renamed or removed?)`);
    }));
    for (const ref of Object.keys(a.notPersonal ?? {})) {
      if (!known.has(ref)) warn(`notPersonal`, `"${ref}" is not in the schema`);
      else text(`notPersonal["${ref}"]`, a.notPersonal![ref]);
    }
    for (const { field: f, why } of personalFields(fields)) {
      if (listed.has(f.ref) || (a.notPersonal && f.ref in a.notPersonal)) continue;
      error(`${f.ref} (${f.file}:${f.line})`, `looks like ${why === "marked @personal" ? "personal information (marked @personal)" : why}: add it to an item's fields in data, or explain in notPersonal why it isn't personal`);
    }
  }
  return out;
}

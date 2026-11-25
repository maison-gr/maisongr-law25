// `init`: a config to start from, with one item per field of the schema that looks personal and a placeholder (TODO)
// everywhere the project has to answer. `check` fails until every TODO is written.

import { looksPersonal } from "./personal.js";
import type { Field } from "./schema.js";

const q = (s: string) => JSON.stringify(s);

/** "dateOfBirth" → "Date of birth". */
function label(name: string): string {
  const s = name.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function starter(fields: Field[], today: string, schemaNote: string | null): string {
  const personal = fields.filter((f) => looksPersonal(f));
  const seen = new Map<string, number>();
  const items = personal.map((f) => {
    let name = `${label(f.name)} (${f.model})`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) name += ` ${n + 1}`;
    return `    {
      name: ${q(name)},
      fields: [${q(f.ref)}],
      whose: "TODO: whose information it is",
      source: "person", // person, third-party, generated or public
      purpose: "TODO: why it is collected and what it is used for",
      retention: "TODO: how long it is kept, and how it is destroyed or anonymised",
      storedIn: "TODO: where it is stored (service and region)",
      access: "TODO: who can see it",
      // sensitive: "Health information: …", // only when it is sensitive (s. 12)
    },`;
  });
  const next = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  return `// The privacy impact assessment (Law 25) of this project. \`npx maisongr-law25 check\` verifies it against the
// schema; \`npx maisongr-law25 build\` writes the report. Every text is one string for every language, or
// { fr: "…", en: "…" }. Replace each TODO.
${schemaNote ? `// Started from ${schemaNote}.\n` : ""}
/** @type {import("maisongr-law25").Assessment} */
export default {
  languages: ["fr", "en"],
  organisation: {
    name: "TODO: the organisation's legal name",
    // The person in charge of the protection of personal information (s. 3.1): by default the highest authority.
    privacyOfficer: { title: "TODO: their title", contact: "TODO: how to reach them (privacy@…)" },
  },
  project: {
    name: "TODO: the system's name",
    description: "TODO: what the system does, in a paragraph",
    objectives: ["TODO: why the project needs personal information"],
    proportionality: "TODO: why what is collected is no more than the objectives need",
  },
  assessed: ${q(today)},
  nextReview: ${q(next)},
  // officerConsulted: "2026-01-15", // when the person in charge was consulted, from the project's outset (s. 3.3)
  // portability: "How a person gets their information back in a structured, commonly used format",
  roles: [],
  data: [
${items.length ? items.join("\n") : `    {
      name: "TODO: a kind of personal information",
      whose: "TODO",
      source: "person",
      purpose: "TODO",
      retention: "TODO",
      storedIn: "TODO",
    },`}
  ],
  providers: [
    // {
    //   name: "Hosting provider", service: "Database hosting", data: ["Email (User)"],
    //   location: "United States", outsideQuebec: true, safeguards: "Data processing agreement; encryption at rest",
    //   transfer: { sensitivity: "…", purposes: "…", protection: "…", legalFramework: "…", conclusion: "…" },
    // },
  ],
  risks: [
    { stage: "collection", risk: "More information is collected than the objectives need", measure: "TODO", status: "to-confirm" },
    { stage: "use", risk: "People see information they don't need for their work", measure: "TODO", status: "to-confirm" },
    { stage: "communication", risk: "A provider uses the information for its own purposes", measure: "TODO", status: "to-confirm" },
    { stage: "retention", risk: "Information is kept after it is no longer needed", measure: "TODO", status: "to-confirm" },
  ],
  approvals: [],
  updates: [],
  // Fields that look personal but aren't, each with the reason:
  notPersonal: {},
};
`;
}

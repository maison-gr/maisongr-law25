import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePrisma } from "../src/schema.js";
import { validate } from "../src/validate.js";
import { render } from "../src/render.js";
import type { Assessment } from "../src/types.js";

// The example is a plain .mjs config, as a project writes it.
const example = ((await import("../example/law25.config.mjs" as string)) as { default: Assessment }).default;

const fields = parsePrisma(readFileSync(new URL("../example/prisma/schema.prisma", import.meta.url), "utf8"), "prisma/schema.prisma");
const TODAY = "2026-11-25";
const copy = (): Assessment => structuredClone(example as Assessment);
const errors = (a: Assessment, f = fields) => validate(a, f, TODAY).filter((p) => p.level === "error").map((p) => `${p.where}: ${p.message}`);

describe("validate", () => {
  it("passes the complete example", () => {
    expect(errors(copy())).toEqual([]);
  });

  it("fails on a personal field the assessment doesn't account for, naming where it is declared", () => {
    const a = copy();
    a.data = a.data.filter((d) => !d.fields?.includes("Customer.phone"));
    a.providers = a.providers!.map((p) => ({ ...p, data: p.data.filter((n) => n !== "Téléphone") }));
    expect(errors(a)).toEqual([
      "Customer.phone (prisma/schema.prisma:21): looks like a phone number: add it to an item's fields in data, or explain in notPersonal why it isn't personal",
    ]);
  });

  it("accepts a field explained in notPersonal, and asks for the reason", () => {
    const a = copy();
    a.data = a.data.filter((d) => !d.fields?.includes("Customer.phone"));
    a.providers = a.providers!.map((p) => ({ ...p, data: p.data.filter((n) => n !== "Téléphone") }));
    a.notPersonal = { "Customer.phone": "" };
    expect(errors(a)).toEqual(['notPersonal["Customer.phone"]: is missing']);
    a.notPersonal = { "Customer.phone": "The shop's own phone, not the customer's" };
    expect(errors(a)).toEqual([]);
  });

  it("fails on a field the schema no longer has", () => {
    const a = copy();
    a.data[0]!.fields = ["Customer.emailAddress"];
    expect(errors(a)).toContain('data[0].fields: "Customer.emailAddress" is not in the schema (renamed or removed?)');
  });

  it("fails on a TODO, and on a text missing in one language", () => {
    const a = copy();
    a.data[1]!.purpose = "TODO: why";
    a.data[2]!.retention = { fr: "Comme le courriel.", en: "" };
    expect(errors(a)).toEqual(["data[1].purpose: is still to write", "data[2].retention: has no en text"]);
  });

  it("accepts one language when the assessment has only that one", () => {
    const a = copy();
    a.languages = ["fr"];
    a.data[2]!.retention = { fr: "Comme le courriel.", en: "" };
    expect(errors(a)).toEqual([]);
  });

  it("requires the s. 17 assessment for information that leaves Québec", () => {
    const a = copy();
    delete a.providers![1]!.transfer;
    expect(errors(a)).toEqual([expect.stringMatching(/^providers\[1\]\.transfer: is missing: information that leaves Québec needs the s\. 17 assessment/)]);
    a.providers![1]!.transfer = { sensitivity: "Low", purposes: "Send", protection: "", legalFramework: "US law", conclusion: "Adequate" };
    expect(errors(a)).toEqual(["providers[1].transfer.protection: is missing"]);
  });

  it("fails on a provider naming information the assessment doesn't list", () => {
    const a = copy();
    a.providers![0]!.data.push("Adresse");
    expect(errors(a)).toEqual(['providers[0].data: "Adresse" is not the name of an item in data']);
  });

  it("fails when the review is overdue, and warns about a planned measure without a date", () => {
    const a = copy();
    a.nextReview = "2026-01-01";
    a.risks[1]!.due = undefined;
    const problems = validate(a, fields, TODAY);
    expect(problems.filter((p) => p.level === "error").map((p) => p.where)).toEqual(["nextReview"]);
    expect(problems.filter((p) => p.level === "warning").map((p) => p.where)).toEqual(["risks[1].due"]);
  });

  it("rejects values outside the lists", () => {
    const a = copy() as unknown as { data: { source: string }[]; risks: { stage: string; status: string }[] };
    a.data[0]!.source = "website";
    a.risks[0]!.stage = "storage";
    a.risks[0]!.status = "ok";
    expect(errors(a as unknown as Assessment)).toEqual([
      "data[0].source: must be one of person, third-party, generated, public",
      "risks[0].stage: must be one of collection, use, communication, retention, other",
      "risks[0].status: must be one of done, planned, to-confirm",
    ]);
  });
});

describe("render", () => {
  it("writes the same report twice: it can be committed and diffed", () => {
    expect(render(copy(), "fr")).toBe(render(copy(), "fr"));
  });

  it("writes French with a no-break space before the colon, and names each provider's data in the report's language", () => {
    const fr = render(copy(), "fr");
    expect(fr).toContain("# Évaluation des facteurs relatifs à la vie privée : Commandes en ligne");
    expect(fr).toContain("- **Allergies** : Renseignement de santé.");
    const en = render(copy(), "en");
    expect(en).toContain("| Courriels Transactionnels | Order confirmation emails | Email, First name | United States | Yes |");
  });

  it("has every section, numbered, in each language", () => {
    for (const [lang, heads] of [
      ["en", ["Summary", "1. The project", "2. Roles and consultations", "3. Personal information", "4. Sensitive information (s. 12)", "5. Providers and communication outside Québec (s. 17)", "6. Risks and measures", "7. Action plan", "8. Approval and history"]],
      ["fr", ["Résumé", "1. Le projet", "2. Rôles et consultations", "3. Renseignements personnels", "4. Renseignements sensibles (art. 12)", "5. Fournisseurs et communication à l’extérieur du Québec (art. 17)", "6. Risques et mesures", "7. Plan d’action", "8. Approbation et historique"]],
    ] as const) {
      const found = render(copy(), lang).split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
      expect(found).toEqual(heads);
    }
  });

  it("escapes table cells and lists the open measures by due date", () => {
    const a = copy();
    a.data[0]!.purpose = "Confirm | sign in\nand recover";
    const en = render(a, "en");
    expect(en).toContain("Confirm \\| sign in<br>and recover");
    // CodeQL js/incomplete-sanitization: a backslash is escaped too, so "\|" in the text can't unescape the pipe.
    a.data[0]!.purpose = "C:\\data\\| end";
    expect(render(a, "en")).toContain("C:\\\\data\\\\\\| end");
    expect(en.split("## 7. Action plan")[1]!.split("## 8.")[0]).toMatch(/Allergies appear only[^\n]*15 January 2027[^\n]*Planned[\s\S]*Automatic deletion[^\n]*—[^\n]*To confirm/);
  });
});

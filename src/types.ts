// The assessment, as a project describes it in law25.config.mjs (or .json). Every field is plain text the report
// prints as written, in the language of the config. Dates are ISO (2026-11-25).

/** Where the information comes from. */
export type Source = "person" | "third-party" | "generated" | "public";
/** The stage of the information's life a risk belongs to. */
export type Stage = "collection" | "use" | "communication" | "retention" | "other";
export type Status = "done" | "planned" | "to-confirm";
export type Language = "fr" | "en";
/** Text the report prints: one string for every language (a name, a product), or one per language. */
export type Text = string | { fr: string; en: string };

export interface DataItem {
  /** What it is, in a few words: "Email address", "Journal entries". */
  name: Text;
  /** Where it lives in the code: "User.email" (Prisma model.field) or "profiles.email" (SQL table.column). */
  fields?: string[];
  /** Whose information it is: "Account holders", "Visitors who accept analytics". */
  whose: Text;
  source: Source;
  /** Why it is collected, and what it is used for. Required. */
  purpose: Text;
  /** How long it is kept, and how it is destroyed or anonymised. Required. */
  retention: Text;
  /** Where it is stored: "PostgreSQL (Neon, us-east-2)". */
  storedIn: Text;
  /** Who can see it: "The account holder; support staff on request". */
  access?: Text;
  /** Sensitive in the sense of s. 12 (by nature, e.g. medical, biometric or otherwise intimate, or by context; financial information often is): say why. */
  sensitive?: Text;
}

/**
 * The factors s. 17 names (at least these four) for communicating personal information outside Québec, or entrusting
 * someone outside Québec with collecting, using, communicating or keeping it.
 */
export interface TransferAssessment {
  /** The sensitivity of the information. */
  sensitivity: Text;
  /** The purposes for which it will be used. */
  purposes: Text;
  /** The protection measures, contractual ones included, that will apply to it. */
  protection: Text;
  /** The legal framework of the place it goes, including its personal information protection principles. */
  legalFramework: Text;
  /**
   * Whether the information would receive adequate protection, in light of generally recognized principles of personal
   * information protection; and the terms of the written agreement, including those agreed on to mitigate the risks.
   */
  conclusion: Text;
}

export interface Provider {
  name: Text;
  /** What it does for the project: "Database hosting", "Email delivery". */
  service: Text;
  /** The names of the DataItems it receives. */
  data: string[];
  /** Where it processes the information: "United States (Ohio)". */
  location: Text;
  /**
   * True when the information is processed or reached outside Québec, which requires `transfer`. Outside Québec includes
   * the rest of Canada; count where subcontractors process it and where it is accessed from, not only the head office.
   */
  outsideQuebec: boolean;
  /** The contract and controls that bind it: "DPA signed; encryption at rest". */
  safeguards: Text;
  transfer?: TransferAssessment;
}

export interface Risk {
  stage: Stage;
  risk: Text;
  measure: Text;
  status: Status;
  owner?: Text;
  /** ISO date for a planned measure. */
  due?: string;
}

export interface Assessment {
  /** The languages of the report, and of every { fr, en } text. Default both. */
  languages?: Language[];
  organisation: {
    name: Text;
    /** The person in charge of the protection of personal information (s. 3.1): a title, and how to reach them. */
    privacyOfficer: { title: Text; contact: Text };
  };
  project: {
    name: Text;
    /** What the system does, in a paragraph. */
    description: Text;
    /** Why the project needs personal information at all. */
    objectives: Text[];
    /** Why what is collected is no more than the objectives need. */
    proportionality: Text;
  };
  /** ISO date of this assessment, and of the next review. */
  assessed: string;
  nextReview: string;
  /** ISO date the person in charge of the protection of personal information was consulted, from the project's outset (s. 3.3). */
  officerConsulted?: string;
  /** How computerized information collected from a person can be given back to them in a structured, commonly used technological format. */
  portability?: Text;
  /** Who took part, and in what role. */
  roles?: { who: Text; role: Text }[];
  /** Who was consulted, and what came of it. */
  consultations?: Text[];
  data: DataItem[];
  providers?: Provider[];
  risks: Risk[];
  approvals?: { by: Text; title: Text; date: string }[];
  updates?: { date: string; summary: Text }[];
  /** Schema fields that look personal but aren't, each with the reason: { "Post.authorName": "a pen name the user chooses to publish" }. */
  notPersonal?: Record<string, Text>;
}

/** For law25.config.mjs: `export default defineAssessment({ … })` gives autocompletion and type checks in an editor. */
export function defineAssessment(a: Assessment): Assessment {
  return a;
}

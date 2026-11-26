import { describe, expect, it } from "vitest";
import { parsePrisma, parseSql } from "../src/schema.js";
import { looksPersonal, words } from "../src/personal.js";

describe("parsePrisma", () => {
  const schema = `
enum Gender { F M X }
model User {
  id        String  @id
  email     String  @unique // reached by email
  /// What the person writes about themself.
  /// @personal
  bio       String?
  gender    Gender?
  /// @not-personal: a pen name chosen to publish
  firstName String?
  posts     Post[]
  @@index([email])
}
model Post {
  id     String @id
  author User   @relation(fields: [authorId], references: [id])
  authorId String
  title  String
}`;
  const fields = parsePrisma(schema, "schema.prisma");

  it("reads each model's fields, with their line, and leaves relations out", () => {
    expect(fields.map((f) => f.ref)).toEqual(["User.id", "User.email", "User.bio", "User.gender", "User.firstName", "Post.id", "Post.authorId", "Post.title"]);
    expect(fields.find((f) => f.ref === "User.email")).toMatchObject({ type: "String", file: "schema.prisma", line: 5 });
  });

  it("reads @personal and @not-personal from the field's doc comments", () => {
    expect(fields.find((f) => f.ref === "User.bio")?.marked).toBe(true);
    expect(fields.find((f) => f.ref === "User.firstName")?.marked).toBe(false);
    expect(fields.find((f) => f.ref === "User.email")?.marked).toBeUndefined();
  });
});

describe("parseSql", () => {
  it("reads CREATE TABLE and ADD COLUMN in migration order, and forgets dropped columns and tables", () => {
    const fields = parseSql([
      { file: "001.sql", source: `create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null, -- @personal (a comment after the comma belongs to the column before it)
  "displayName" text,
  notes text, -- @not-personal
  score numeric(5, 2) default 0,
  constraint email_unique unique (email)
);
create table audit (id bigint, ip inet);` },
      { file: "002.sql", source: `alter table profiles add column if not exists phone text, add column birth_date date;
alter table profiles drop column score;
drop table if exists audit;` },
    ]);
    expect(fields.map((f) => f.ref)).toEqual(["profiles.id", "profiles.email", "profiles.displayName", "profiles.notes", "profiles.phone", "profiles.birth_date"]);
    expect(fields.find((f) => f.ref === "profiles.email")).toMatchObject({ marked: true, file: "001.sql", line: 3 });
    expect(fields.find((f) => f.ref === "profiles.notes")?.marked).toBe(false);
    expect(fields.find((f) => f.ref === "profiles.phone")).toMatchObject({ file: "002.sql", type: "text" });
  });
});

describe("other databases and line endings", () => {
  it("reads MySQL (backticks, KEY lines) and SQL Server ([brackets], dbo) migrations", () => {
    const mysql = parseSql([{ file: "m.sql", source: "CREATE TABLE `users` (\n  `id` INT NOT NULL AUTO_INCREMENT,\n  `email` VARCHAR(255) NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_email` (`email`),\n  UNIQUE KEY `u` (`email`)\n) ENGINE=InnoDB;\nALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20);" }]);
    expect(mysql.map((f) => f.ref)).toEqual(["users.id", "users.email", "users.phone"]);
    const mssql = parseSql([{ file: "s.sql", source: "CREATE TABLE [dbo].[Customers] (\n  [Id] INT PRIMARY KEY,\n  [LastName] NVARCHAR(100)\n);" }]);
    expect(mssql.map((f) => f.ref)).toEqual(["Customers.Id", "Customers.LastName"]);
    const sqlite = parseSql([{ file: "l.sql", source: 'CREATE TEMP TABLE "visits" (ip TEXT, at INTEGER);' }]);
    expect(sqlite.map((f) => f.ref)).toEqual(["visits.ip", "visits.at"]);
  });

  it("reads a pg_dump --schema-only dump", () => {
    const dump = `--
-- PostgreSQL database dump
--
SET statement_timeout = 0;
CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    encrypted_password character varying DEFAULT ''::character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);
CREATE SEQUENCE public.users_id_seq START WITH 1;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email);
`;
    const fields = parseSql([{ file: "structure.sql", source: dump }]);
    expect(fields.map((f) => [f.ref, f.type])).toEqual([["users.id", "bigint"], ["users.email", "character"], ["users.encrypted_password", "character"], ["users.created_at", "timestamp"]]);
  });

  // Found in Resistaa's migrations (25 Nov 2026): a rollback note in a comment dropped the table it describes.
  it("never acts on SQL written in a comment", () => {
    const fields = parseSql([
      { file: "001.sql", source: `-- Rollback: DROP TABLE public.notes;
create table public.notes (id int, body text);
/* Rollback:
   alter table public.notes drop column body;
   drop table public.notes; */
-- alter table notes add column fake text;
create table t2 (email text); /* drop table t2; */
alter table t2
  -- a note: drop column email
  add column phone text, -- @personal
  /* add column ignored text, */ add column city text;` },
    ]);
    expect(fields.map((f) => f.ref)).toEqual(["notes.id", "notes.body", "t2.email", "t2.phone", "t2.city"]);
    expect(fields.find((f) => f.ref === "t2.phone")?.marked).toBe(true);
  });

  // Found in Rehearse's and Resistaa's rate_limits (key text primary key): a column named like a keyword.
  it("reads columns named key, index, unique or check, and still skips the index and constraint lines", () => {
    const fields = parseSql([
      { file: "a.sql", source: `create table rate_limits (
  key text primary key,
  index integer not null,
  unique boolean,
  check text,
  primary key (key),
  unique (index),
  check (index > 0),
  constraint c unique (key)
);
CREATE TABLE \`m\` (
  \`id\` INT,
  KEY \`idx_id\` (\`id\`),
  UNIQUE KEY \`u\` (\`id\`),
  INDEX ix USING BTREE (\`id\`),
  FULLTEXT KEY ft (\`id\`)
);
ALTER TABLE m ADD KEY idx2 (id), ADD INDEX (id), ADD COLUMN key varchar(10);` },
    ]);
    expect(fields.map((f) => f.ref)).toEqual(["rate_limits.key", "rate_limits.index", "rate_limits.unique", "rate_limits.check", "m.id", "m.key"]);
  });

  it("reads files written with Windows line endings the same way", () => {
    const lf = "model User {\n  id String @id\n  /// @personal\n  bio String?\n  email String\n}\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(parsePrisma(crlf)).toEqual(parsePrisma(lf));
    const sql = "create table t (\n  id int,\n  bio text, -- @personal\n  email text\n);\n";
    expect(parseSql([{ file: "a.sql", source: sql.replace(/\n/g, "\r\n") }])).toEqual(parseSql([{ file: "a.sql", source: sql }]));
  });
});

describe("looksPersonal", () => {
  const f = (model: string, name: string, marked?: boolean) => looksPersonal({ model, name, marked });

  it("splits names into words", () => {
    expect(words("dateOfBirth")).toEqual(["date", "of", "birth"]);
    expect(words("IPAddress")).toEqual(["ip", "address"]);
    expect(words("last_name")).toEqual(["last", "name"]);
  });

  it("flags names that hold personal information, on any table", () => {
    expect(f("Order", "customerEmail")).toBe("an email address");
    expect(f("Event", "dateOfBirth")).toBe("a date of birth");
    expect(f("Log", "ipAddress")).toBe("an IP address");
    expect(f("Log", "userAgent")).toBe("a device's user agent");
    expect(f("Payment", "cardNumber")).toBe("a payment card");
    expect(f("Visit", "lastName")).toBe("a name");
  });

  it("flags name, city or location only on a table about people", () => {
    expect(f("User", "name")).toBe("a name");
    expect(f("customers", "city")).toBe("a place of residence");
    expect(f("Product", "name")).toBeNull();
    expect(f("Event", "location")).toBeNull();
  });

  it("leaves ordinary names alone", () => {
    for (const name of ["title", "price", "cardTitle", "createdAt", "orientation", "cellIndex", "bankHoliday", "dateOfOrder", "mailbox"]) {
      expect(f("Thing", name), name).toBeNull();
    }
  });

  // The cases below come from running law25 on Resistaa and Signum (25 Nov 2026).
  it("flags a role's name: author_name, reviewer_name", () => {
    expect(f("blog_comments", "author_name")).toBe("a name");
    expect(f("editorial_reviews", "reviewerName")).toBe("a name");
    expect(f("products", "brand_name")).toBeNull();
  });

  it("flags free text on rows that belong to a person, and only there", () => {
    const g = (model: string, name: string, siblings: string[] = []) => looksPersonal({ model, name }, siblings);
    const FREE = "free text about or by a person";
    expect(g("journal_entries", "content", ["id", "user_id", "content", "mood"])).toBe(FREE);
    expect(g("support_tickets", "message", ["id", "userId", "message"])).toBe(FREE);
    expect(g("blog_comments", "body", ["post_slug", "author_id", "body"])).toBe(FREE);
    expect(g("research_studies", "summary", ["id", "title", "summary"])).toBeNull();
    expect(g("articles", "content")).toBeNull();
    expect(g("journal_entries", "content")).toBe(FREE);
    // A person's own table, and tables that are messages, notes or reviews, need no link (Mongoose references aren't fields).
    expect(g("Profile", "bio")).toBe(FREE);
    expect(g("Application", "coverLetter")).toBe(FREE);
    expect(g("Application", "employerNotes")).toBe(FREE);
    expect(g("Message", "body")).toBe(FREE);
    expect(g("InterviewScorecard", "notes")).toBe(FREE);
    expect(g("Issue", "internalNotes", ["reporterId"])).toBe(FREE);
    expect(g("Job", "description")).toBeNull();
    // Rehearse's sessions: the conversation itself, and what is written about it.
    for (const name of ["messages", "transcript", "conversation", "debrief", "chat_messages"]) expect(g("sessions", name, ["user_id"]), name).toBe(FREE);
    // A compound name is free text only when its last word always is: "licensing body" is an organisation,
    // "acquisition content" a campaign parameter, "company description" not about the person.
    for (const [model, name] of [["partner_applications", "licensing_body"], ["profiles", "acquisition_content"], ["Profile", "companyDescription"], ["Application", "jobSnapshot.description"]]) {
      expect(g(model!, name!, ["user_id"]), name).toBeNull();
    }
    expect(g("partner_applications", "admin_note", ["user_id"])).toBe(FREE);
    expect(f("Profile", "resumeSize")).toBeNull();
  });

  it("flags what a person's profile and account hold", () => {
    expect(f("Profile", "resumeUrl")).toBe("a résumé");
    expect(f("Profile", "linkedin")).toBe("a social or professional profile");
    expect(f("Profile", "workAuthorizationStatus")).toBe("immigration status (sensitive)");
    expect(f("Profile", "nationality")).toBe("nationality");
    expect(f("User", "password")).toBe("a password or its hash");
    expect(f("JobVersion", "changedByName")).toBe("a name");
  });

  it("calls a device or identity fingerprint that, not biometric information", () => {
    expect(f("trial_grants", "identity_fingerprint")).toBe("a device or identity fingerprint");
    expect(f("Device", "browserFingerprint")).toBe("a device or identity fingerprint");
    expect(f("enrolments", "fingerprint")).toBe("biometric information");
  });

  it("doesn't call a notification preference an email address", () => {
    for (const name of ["notifPrefs.emailJobMatches", "email_opt_out", "blog_email_opt_out", "emailNotifications", "email_unsubscribed"]) {
      expect(f("Profile", name), name).toBeNull();
    }
  });

  it("flags a mood, which can be health information", () => {
    expect(f("daily_checkins", "mood")).toBe("a mood or emotional state (possibly health information)");
  });

  it("flags place fields on an application or registration, like on a table about people", () => {
    expect(f("partner_applications", "city")).toBe("a place of residence");
    expect(f("event_registrations", "country")).toBe("a country of residence");
  });

  it("doesn't flag a field that only names a kind, an id or a date about the information", () => {
    for (const [model, name] of [["email_log", "email_type"], ["email_log", "scheduled_email_id"], ["Company", "emailDomain"], ["User", "emailVerificationTokenExpiresAt"], ["User", "isEmailVerified"], ["Address", "address_id"], ["Profile", "phoneCount"]]) {
      expect(f(model!, name!), name).toBeNull();
    }
    // What stays: the information itself, and what is derived from it.
    expect(f("Referral", "refereeEmailHash")).toBe("an email address");
    expect(f("profiles", "canonical_email")).toBe("an email address");
    expect(f("Visit", "ipAddress")).toBe("an IP address");
  });

  it("follows the schema's own markers first", () => {
    expect(f("Thing", "title", true)).toBe("marked @personal");
    expect(f("User", "email", false)).toBeNull();
  });
});

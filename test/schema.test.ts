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

  it("follows the schema's own markers first", () => {
    expect(f("Thing", "title", true)).toBe("marked @personal");
    expect(f("User", "email", false)).toBeNull();
  });
});

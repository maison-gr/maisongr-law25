# maisongr-law25

[Français](README.md) · **English**

**Your Law 25 privacy impact assessment, next to your code.** Describe the personal information your app handles in one file; `check` fails CI when the schema stores a field that looks personal and that the assessment doesn't account for, and `build` writes the assessment in French and English.

[![npm version](https://img.shields.io/npm/v/maisongr-law25?color=1b1a17)](https://www.npmjs.com/package/maisongr-law25)
[![CI](https://github.com/maison-gr/maisongr-law25/actions/workflows/ci.yml/badge.svg)](https://github.com/maison-gr/maisongr-law25/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1b1a17)](LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-1b1a17)
![Node 20.9+](https://img.shields.io/badge/node-%E2%89%A520.9-1b1a17)

![On a navy ledger: on the left, CI refusing a new Customer.phone field with no stated purpose or retention; on the right, the assessment filed in French, stamped approved.](.github/assets/hero.png)

```sh
npx maisongr-law25 init     # law25.config.mjs, started from your schema (Prisma, Drizzle, Django, Rails, Entity Framework, JPA, GORM, SQL…)
npx maisongr-law25 check    # every required entry written, every field that looks personal accounted for? exit 1 if not
npx maisongr-law25 build    # docs/privacy/efvp.fr.md and docs/privacy/pia.en.md
```

```text
✗ Customer.phone (prisma/schema.prisma:21): looks like a phone number: add it to an item's fields in data, or explain in notPersonal why it isn't personal
1 problem in law25.config.mjs (checked against the Prisma schema (prisma/schema.prisma), 16 fields).
```

> This package helps you write and maintain an assessment. It is not legal advice, and it does not determine whether an assessment is required or sufficient: have it reviewed by a qualified advisor. Provided as is, without warranty (see [LICENSE](LICENSE)). The legislation prevails.

## Why

Québec's *Act respecting the protection of personal information in the private sector* (CQLR c. P-39.1), as amended by Law 25, requires a privacy impact assessment for any project to acquire, develop or overhaul an information system or electronic service delivery system involving the collection, use, communication, keeping or destruction of personal information (s. 3.3), and before personal information is communicated outside Québec, or someone outside Québec is entrusted with it (s. 17). Most apps do both: a database, an email provider, a hosting region. Outside Québec includes the rest of Canada.

The assessment is usually a document written once. Then the code moves on: a new column, a new provider, a field nobody remembers adding. This package keeps the assessment in the repository, beside the schema it describes, and makes CI say when they drift apart.

## How `check` works

1. It reads your schema where your stack describes it (see [Stacks it reads](#stacks-it-reads)): Prisma, the ORMs of JavaScript, Python, Ruby, PHP, C#, Java, Kotlin and Go, SQL migrations, or an OpenAPI or JSON Schema file.
2. It flags every field that looks like personal information: by name (`email`, `phone`, `dateOfBirth`, `ipAddress`, `lastName`, `gender`…, and `name`, `city` or `location` on a table about people), or because a comment marks it `@personal`.
3. Each flagged field must be listed in an item's `fields`, or explained in `notPersonal`. A field in the assessment that the schema no longer has is an error too.
4. The assessment must be complete: every purpose and retention period written (in each language), no `TODO` left, a s. 17 assessment for every provider outside Québec, the next review date not past.

Mark what the names don't tell:

```prisma
model Customer {
  /// Allergies the customer chooses to tell us.
  /// @personal
  allergies String?
  /// @not-personal
  shopNote  String?
}
```

```sql
create table profiles (
  id uuid primary key,
  bio text, -- @personal
  theme text -- @not-personal
);
```

The marker goes in a comment, in the language's own syntax (`// @personal`, `# @personal`, `/** @personal */`), on the field's line or just above it. In OpenAPI and JSON Schema, it is the property `x-personal: true` (or `false`).

### Stacks it reads

With no option, `check` looks first for a Prisma schema, then for the models of every ORM the code uses (read together when a project has several), then for SQL migrations, then for an OpenAPI or JSON Schema file. Dependency, build and test folders are never read: a test's data is not the project's.

| Stack | What is read | A field's name |
| --- | --- | --- |
| Prisma | `prisma/schema.prisma`, or a folder of `.prisma` files | `User.email` |
| Drizzle | `pgTable`, `mysqlTable`, `sqliteTable` | `users.email` (the variable and the key) |
| TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose) | `@Entity`, `@Table` and `@Schema` classes, and their `@Column`, `@Property` and `@Prop` properties | `Customer.email` |
| Sequelize | `sequelize.define`, `Model.init`, and migrations (`createTable`, `addColumn`, `removeColumn`) | `User.email` |
| Mongoose | `new Schema({ … })`, named by `mongoose.model("User", …)` | `User.address.city` |
| Django | the models' `models.…Field` fields, and those `AbstractUser` brings | `Customer.email` |
| SQLAlchemy, Flask-SQLAlchemy, SQLModel | `Column`, `mapped_column`, `Mapped[…]`, `Table("…")` | `User.email` |
| Rails | `db/schema.rb`, or the migrations in `db/migrate` | `users.email` |
| Laravel | the migrations in `database/migrations` (`Schema::create`, `Schema::table`) | `users.email` |
| Entity Framework | the classes of the context's `DbSet<…>`, their base classes, and what `IdentityUser` brings | `Customer.Email` |
| JPA, Hibernate (Java, Kotlin) | `@Entity`, `@Embeddable` and `@MappedSuperclass` classes | `Customer.email` |
| GORM | structs that embed `gorm.Model`, carry `gorm:"…"` tags or are passed to `AutoMigrate` | `User.Email` |
| SQL | migrations in order (`supabase/migrations`, `migrations`, `db/migrations`…): `CREATE TABLE`, `ADD COLUMN`, `DROP COLUMN`, `DROP TABLE`, in PostgreSQL, MySQL, SQLite and SQL Server | `profiles.email` |
| OpenAPI, JSON Schema | `components.schemas` (or `definitions`), the root and `$defs`, in JSON or YAML | `Customer.address.city` |

Relations (foreign keys to another model, collections, navigation properties) are not fields: they are left out, as in Prisma. Migrations are read in file order, and their `down` part is ignored.

To read somewhere else, name it: `--schema backend/src/main/java` (the option repeats). When the stack can't be told from the files, say it: `--schema contracts/signup.json --stack openapi`. Any stack also works through SQL: point `--sql` at a schema dump (`pg_dump --schema-only`, `mysqldump --no-data`) or at migrations written in SQL (Flyway, dbmate, golang-migrate, Supabase).

## The assessment

`law25.config.mjs` (or `.js`, or `.json`). Every text is one string for every language, or `{ fr: "…", en: "…" }`; `check` makes sure each language is written. The [example](example/law25.config.mjs) is a complete one, for a fictional bakery's ordering app, and its reports are [in French](example/docs/privacy/efvp.fr.md) and [in English](example/docs/privacy/pia.en.md).

```js
/** @type {import("maisongr-law25").Assessment} */
export default {
  languages: ["fr", "en"],
  organisation: {
    name: "Boulangerie Exemple inc.",
    privacyOfficer: { title: { fr: "Propriétaire", en: "Owner" }, contact: "vieprivee@boulangerie-exemple.ca" },
  },
  project: { name: "…", description: "…", objectives: ["…"], proportionality: "…" },
  assessed: "2026-11-25",
  nextReview: "2027-11-25",
  data: [
    {
      name: { fr: "Courriel", en: "Email" },
      fields: ["Customer.email"],
      whose: { fr: "Clients", en: "Customers" },
      source: "person",
      purpose: { fr: "Confirmer la commande et se connecter.", en: "Confirm the order and sign in." },
      retention: { fr: "Tant que le compte existe, puis 30 jours.", en: "While the account exists, then 30 days." },
      storedIn: "PostgreSQL (Canada, Montréal)",
      access: { fr: "Le client; l’équipe", en: "The customer; the team" },
    },
  ],
  providers: [
    {
      name: "Email provider", service: "Order emails", data: ["Email"],
      location: "United States", outsideQuebec: true, safeguards: "Processing agreement",
      transfer: { sensitivity: "…", purposes: "…", protection: "…", legalFramework: "…", conclusion: "…" },
    },
  ],
  risks: [
    { stage: "retention", risk: "Inactive accounts stay forever", measure: "Deleted after three years", status: "planned", owner: "Dev", due: "2027-01-15" },
  ],
};
```

| Field | What it holds |
|---|---|
| `languages` | `["fr", "en"]` (default), `["fr"]` or `["en"]` |
| `organisation` | `name`, and `privacyOfficer` (`title`, `contact`): the person in charge of the protection of personal information (s. 3.1) |
| `project` | `name`, `description`, `objectives` (why personal information is needed), `proportionality` (why it's no more than needed) |
| `assessed`, `nextReview` | ISO dates; `check` fails once `nextReview` has passed |
| `officerConsulted`, `portability` | When the person in charge was consulted, from the project's outset, and how a person gets their computerized information back in a structured, commonly used format (s. 3.3; optional) |
| `roles`, `consultations` | Who took part, and who was consulted (optional) |
| `data[]` | `name`, `fields` (`Model.field` or `table.column`), `whose`, `source` (`person`, `third-party`, `generated`, `public`), `purpose`, `retention`, `storedIn`, `access`, `sensitive` (why, when s. 12 applies) |
| `providers[]` | `name`, `service`, `data` (item names), `location`, `outsideQuebec` (the rest of Canada counts, and so do subcontractors and where the data is reached from), `safeguards`, and `transfer` (the factors s. 17 names: `sensitivity`, `purposes`, `protection`, `legalFramework`, and a `conclusion` on adequate protection and the written agreement) |
| `risks[]` | `stage` (`collection`, `use`, `communication`, `retention`, `other`), `risk`, `measure`, `status` (`done`, `planned`, `to-confirm`), `owner`, `due` |
| `approvals[]`, `updates[]` | Who approved it and when; what changed and when |
| `notPersonal` | `{ "Post.authorName": "a pen name the user chooses to publish" }` |

With the package installed (`npm install --save-dev maisongr-law25`), the `@type` comment gives autocompletion and type checks in your editor; `npx` needs nothing installed.

## The report

`build` writes one Markdown file per language, the same every time for the same config, so it can be committed and reviewed as a diff:

1. The project: description, objectives, proportionality
2. Roles and consultations
3. Personal information: whose, where from, why, how long, where, who sees it, and the fields in the code
4. Sensitive information (s. 12)
5. Providers and communication outside Québec (s. 17), with the factors s. 17 names for each provider outside Québec
6. Risks and measures, by stage: collection, use, communication, retention and destruction
7. Action plan: the open measures, by due date
8. Approval and history

The sections cover the points ss. 3.3, 12 and 17 name, and the topics the [Commission d'accès à l'information's guide](https://www.cai.gouv.qc.ca/commission-acces-information/guide-fiches-information) walks through. The wording is this package's own: it doesn't reproduce the Commission's template. The French is written for Québec, with its typography.

## In CI

```yaml
- run: npx maisongr-law25 check
```

A pull request that adds `users.phone` without saying why it's collected and how long it's kept fails, with the file and line of the new field.

Or, with no script to write:

**GitHub Action.** Each problem shows up in the pull request: a field left out on its line in the schema, the rest on the config.

```yaml
- uses: actions/checkout@v5
- uses: maison-gr/maisongr-law25@v1.0.3
  # with: { working-directory: apps/api, schema: db/schema.ts, stack: drizzle, command: build }
```

The action runs the npm version it was tagged with (`version` to choose another) and needs Node.js 20.9+ on the runner, which GitHub's runners have. Elsewhere, `npx maisongr-law25 check --github` prints the same annotations.

**pre-commit.** In `.pre-commit-config.yaml`; the hook reads the whole project, so it runs on every commit:

```yaml
repos:
  - repo: https://github.com/maison-gr/maisongr-law25
    rev: v1.0.3
    hooks:
      - id: maisongr-law25
```

**Docker,** for any CI or a machine without Node.js (linux/amd64 and linux/arm64):

```sh
docker run --rm -v "$PWD:/work" ghcr.io/maison-gr/maisongr-law25 check
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ghcr.io/maison-gr/maisongr-law25 build
```

Options: `--config <file>`, `--schema <path>` (repeatable) and `--stack <name>`, `--prisma <path>`, `--sql <path>`, `--no-schema` (check the assessment alone), `--out <folder>` and `--lang fr|en` for `build`, `--json` for a machine-readable result, `--github` for GitHub Actions annotations. Exit codes: 0 done, 1 problems found, 2 a usage error.

## In code

```js
import { findSchema, validate, render, parseDjango, looksPersonal } from "maisongr-law25";

// The schema found as the CLI finds it, or read by one reader (parsePrisma, parseDrizzle, parseJpa…).
const schema = findSchema(process.cwd());
const fields = parseDjango([{ file: "shop/models.py", source: modelsText }]);
const problems = validate(assessment, schema?.fields ?? fields, "2026-11-25");
const markdown = render(assessment, "fr");
```

## For AI agents

The package ships an [Agent Skill](skills/maisongr-law25/SKILL.md) and an [`llms.txt`](llms.txt). An agent that adds a column holding personal information can run `check`, then add the item, with its purpose and retention, for a person to confirm.

## Limits

- Personal fields are found by name and by marker. A free-text field (`notes`, `message`) can hold personal information under any name: mark it `@personal`.
- It reads schemas without running them, line by line, with no dependency: a model built at run time (columns added in a loop, a function returning a columns object, a mixin from another package) isn't seen. Point `--sql` at a schema dump then, or list `fields` by hand.
- It checks that the assessment is complete and matches the schema, not that what it says is true or sufficient. That is the assessment's job, and the advisor's.
- It doesn't decide whether an assessment is required, or whether it is enough.
- It covers the privacy impact assessment of the private sector Act. Public bodies fall under a different Act (CQLR c. A-2.1), and other assessments (such as for communication for research purposes) aren't covered.
- Law 25's other duties (the published policy, consent, the confidentiality incident register, the person in charge's contact on your site) are yours to meet.
- Section numbers refer to CQLR c. P-39.1 as in force on the release date; check the current text on [LégisQuébec](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1).

## Requirements

Node.js 20.9 or later, on Linux, macOS and Windows. No runtime dependencies. An ES module: from CommonJS, `require("maisongr-law25")` works on Node 22.12 and later; on Node 20, use `await import("maisongr-law25")`. The CLI works the same everywhere, in any project: it needs nothing installed beside it, whatever the project's language.

## More from Maison GR

Open source from [Maison GR](https://www.maisongr.com), a software studio in Québec City:

- [maisongr-sitemap](https://github.com/maison-gr/maisongr-sitemap): one sitemap, two readers. The XML search engines need, and a page in your site's own design for people.
- [Maison GR Sitemap for WordPress](https://github.com/maison-gr/maisongr-sitemap-wordpress): the same sitemap for WordPress, in your theme's colours and type.
- [maisongr-skills](https://github.com/maison-gr/maisongr-skills): one engineering standard for every AI coding agent: Claude Code, Codex, Cursor, Copilot, Gemini CLI.
- [maisongr-typo](https://github.com/maison-gr/maisongr-typo): French typography, the Québec way, with a CI check.

## License

MIT, © Maison GR Inc. Not affiliated with or endorsed by the Commission d'accès à l'information.

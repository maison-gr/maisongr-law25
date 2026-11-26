---
name: maisongr-law25
description: Keep a Québec Law 25 privacy impact assessment (EFVP / PIA) in step with the code using the maisongr-law25 CLI. Use when a project serves people in Québec and adds or changes a database field, table or migration that holds personal information, adds a provider or service that receives personal information (hosting, email, analytics, AI), when the user mentions Law 25, Loi 25, EFVP, ÉFVP, privacy impact assessment or the Commission d'accès à l'information, or when `maisongr-law25 check` fails in CI.
license: MIT
---

# maisongr-law25

The project describes its personal information in `law25.config.mjs`. `check` compares it with the project's schema, found by itself: Prisma, the models of the ORMs it uses (Drizzle, TypeORM, Sequelize, Mongoose, Django, SQLAlchemy, Rails, Laravel, Entity Framework, JPA, GORM), SQL migrations, or OpenAPI (`--schema <path> --stack <name>` reads given paths); `build` writes the report in French and English.

## When the schema changed

```sh
npx maisongr-law25 check --json
```

In a GitHub workflow: `uses: maison-gr/maisongr-law25@v1.0.3` (problems show on the pull request); pre-commit: hook `maisongr-law25`; without Node.js: `docker run --rm -v "$PWD:/work" ghcr.io/maison-gr/maisongr-law25 check`.

It prints `{ ok, config, schema, fields, problems: [{ level, where, message }] }` and exits 1 when an error is left.

For each `looks like …` error on a field:

1. If the field holds personal information, add its `Model.field` (or `table.column`) to the `fields` of the matching item in `data`, or add an item with `name`, `whose`, `source`, `purpose`, `retention`, `storedIn` and `access`.
2. If it doesn't, add it to `notPersonal` with the reason.
3. **Don't invent the purpose, the retention period or the reason.** They are the organisation's decisions: write what the code shows (what the field is used for, when it is deleted) and ask the user to confirm, or write `TODO` so `check` keeps failing until a person answers.

For a new provider that receives personal information, add it to `providers`; if it processes or reaches the information outside Québec (the rest of Canada counts, and so do its subcontractors), `outsideQuebec: true` and a `transfer` with the factors s. 17 names (`sensitivity`, `purposes`, `protection`, `legalFramework`, and a `conclusion` on adequate protection and the written agreement), confirmed with the user.

Then `npx maisongr-law25 check` again, and `npx maisongr-law25 build` to update `docs/privacy/`.

## Starting

`npx maisongr-law25 init` writes the config from the schema, with `TODO` where the project must answer. It never overwrites an existing config.

## Every text

A string (the same in every language), or `{ fr: "…", en: "…" }` when the report has both. Write the French for Québec.

The report is not legal advice; say so when you hand it over, and suggest a review by a qualified advisor.

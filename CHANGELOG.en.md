# Changelog

[Français](CHANGELOG.md) · **English**

All notable changes to `maisongr-law25`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and each release adds 0.0.1 to the version (1.0.1, 1.0.2, 1.0.3), whatever it contains.

## [Unreleased]

## [1.0.2] - 2026-11-26

### Fixed

- A whole schema in one file (`supabase/schema.sql`, `db/structure.sql`, `db/schema.sql`) is read, before the migrations that change it. In Rehearse, the `profiles` and `sessions` tables went unseen.
- A conversation is free text: `messages`, `transcript`, `conversation`, `debrief`.

## [1.0.1] - 2026-11-25

### Fixed

- SQL migrations: a statement written in a comment (`-- Rollback: DROP TABLE notes;`, `/* … */`) is no longer run. In Resistaa's migrations it made four tables vanish, `email_log` among them.
- A column named like a keyword (`key text primary key`, `index`, `unique`, `check`) is read; a MySQL index added with `ALTER TABLE … ADD KEY idx (id)` no longer becomes a column.

### Changed

- Personal fields are found better, from three real projects: free text on a person's rows (a journal, a message, a cover letter, notes), a role's name (`author_name`, `changedByName`), mood, password, résumé, LinkedIn and GitHub profiles, nationality and immigration status. Less noise: a type, an id, a date or a preference about the information (`email_type`, `scheduled_email_id`, `isEmailVerified`, `email_opt_out`) is no longer flagged, and a device fingerprint is no longer called biometric.
- `init` asks why sensitive information is sensitive (s. 12): `check` waits for the answer.
- `init` prints the whole path of a config written outside the project.
## [1.0.0] - 2026-11-25

### Added

- `law25.config.mjs` (or `.js`, `.json`): the assessment, with every text in one language or `{ fr, en }`.
- `check`: the assessment is complete in each language, its references are real, every provider outside Québec has its s. 17 factors, the next review isn't past, and every field of the schema that looks personal (by name, or marked `@personal`) is accounted for.
- `build`: the report in French and English, deterministic, in `docs/privacy/`.
- Schemas read, found by themselves: Prisma; Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize, Mongoose, Django, SQLAlchemy (with Flask-SQLAlchemy and SQLModel), Rails, Laravel, Entity Framework, JPA and Hibernate (Java, Kotlin), GORM, read together when a project uses several; SQL migrations or dumps for PostgreSQL, MySQL, SQLite and SQL Server; OpenAPI or JSON Schema (JSON or YAML). `--schema <path>` and `--stack <name>` read given paths. The `@personal` marker goes in a comment in each language, `x-personal` in OpenAPI.
- Two optional fields from s. 3.3: `officerConsulted` (the person in charge consulted from the project's outset) and `portability` (giving information back in a structured format).
- `init`: a config started from the schema's personal fields.
- An example (a fictional bakery's ordering app), an Agent Skill and `llms.txt`.

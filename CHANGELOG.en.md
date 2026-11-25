# Changelog

[Français](CHANGELOG.md) · **English**

All notable changes to `maisongr-law25`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and each release adds 0.0.1 to the version (1.0.1, 1.0.2, 1.0.3), whatever it contains.

## [Unreleased]

### Added

- `check` now reads the schema of every common stack, not only Prisma and SQL: Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize (models and migrations), Mongoose, Django, SQLAlchemy (with Flask-SQLAlchemy and SQLModel), Rails (`db/schema.rb` or `db/migrate`), Laravel, Entity Framework, JPA and Hibernate (Java, Kotlin), GORM, and OpenAPI or JSON Schema (JSON or YAML). With no option it finds the models of every ORM in the project and reads them together; dependency, build and test folders are left out.
- `--schema <path>` (repeatable) reads the files or folder named, and `--stack <name>` says the stack when it can't be told from them.
- The `@personal` (or `@not-personal`) marker goes in a comment in each language, and `x-personal` in OpenAPI and JSON Schema.
- The readers are exported (`parseDrizzle`, `parseDjango`, `parseJpa`…), with `findSchema`.

## [1.0.0] - 2026-11-25

### Added

- `law25.config.mjs` (or `.js`, `.json`): the assessment, with every text in one language or `{ fr, en }`.
- `check`: the assessment is complete in each language, its references are real, every provider outside Québec has its s. 17 factors, the next review isn't past, and every field of the Prisma schema or SQL migrations that looks personal (by name, or marked `@personal`) is accounted for.
- `build`: the report in French and English, deterministic, in `docs/privacy/`.
- Schemas read: Prisma (one file or a folder), and SQL migrations or dumps for PostgreSQL, MySQL, SQLite and SQL Server.
- Two optional fields from s. 3.3: `officerConsulted` (the person in charge consulted from the project's outset) and `portability` (giving information back in a structured format).
- `init`: a config started from the schema's personal fields.
- An example (a fictional bakery's ordering app), an Agent Skill and `llms.txt`.

# Changelog

[Français](CHANGELOG.md) · **English**

All notable changes to `maisongr-law25`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and each release adds 0.0.1 to the version (1.0.1, 1.0.2, 1.0.3), whatever it contains.

## [Unreleased]

## [1.0.0] - 2026-11-25

### Added

- `law25.config.mjs` (or `.js`, `.json`): the assessment, with every text in one language or `{ fr, en }`.
- `check`: the assessment is complete in each language, its references are real, every provider outside Québec has its s. 17 factors, the next review isn't past, and every field of the schema that looks personal (by name, or marked `@personal`) is accounted for.
- `build`: the report in French and English, deterministic, in `docs/privacy/`.
- Schemas read, found by themselves: Prisma; Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize, Mongoose, Django, SQLAlchemy (with Flask-SQLAlchemy and SQLModel), Rails, Laravel, Entity Framework, JPA and Hibernate (Java, Kotlin), GORM, read together when a project uses several; SQL migrations or dumps for PostgreSQL, MySQL, SQLite and SQL Server; OpenAPI or JSON Schema (JSON or YAML). `--schema <path>` and `--stack <name>` read given paths. The `@personal` marker goes in a comment in each language, `x-personal` in OpenAPI.
- Two optional fields from s. 3.3: `officerConsulted` (the person in charge consulted from the project's outset) and `portability` (giving information back in a structured format).
- `init`: a config started from the schema's personal fields.
- An example (a fictional bakery's ordering app), an Agent Skill and `llms.txt`.

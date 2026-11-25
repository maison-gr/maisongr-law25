# Journal des modifications

**Français** · [English](CHANGELOG.en.md)

Toutes les modifications notables de `maisongr-law25`. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et chaque version ajoute 0.0.1 au numéro (1.0.1, 1.0.2, 1.0.3), quel que soit son contenu.

## [Non publié]

## [1.0.0] - 2026-11-25

### Ajouté

- `law25.config.mjs` (ou `.js`, `.json`) : l’évaluation, chaque texte dans une langue ou en `{ fr, en }`.
- `check` : l’évaluation est complète dans chaque langue, ses références existent, chaque fournisseur à l’extérieur du Québec a les facteurs de l’article 17, la prochaine révision n’est pas dépassée, et chaque champ du schéma qui semble personnel (par son nom, ou marqué `@personal`) est déclaré.
- `build` : le rapport en français et en anglais, déterministe, dans `docs/privacy/`.
- Les schémas lus, trouvés d’eux-mêmes : Prisma; Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize, Mongoose, Django, SQLAlchemy (et Flask-SQLAlchemy, SQLModel), Rails, Laravel, Entity Framework, JPA et Hibernate (Java, Kotlin), GORM, lus ensemble quand un projet en utilise plusieurs; les migrations ou vidages SQL de PostgreSQL, MySQL, SQLite et SQL Server; OpenAPI ou JSON Schema (JSON ou YAML). `--schema <chemin>` et `--stack <pile>` lisent les chemins donnés. Le marqueur `@personal` s’écrit dans un commentaire de chaque langage, `x-personal` dans OpenAPI.
- Deux champs facultatifs de l’article 3.3 : `officerConsulted` (la consultation de la personne responsable dès le début du projet) et `portability` (la communication des renseignements à la personne dans un format structuré).
- `init` : une configuration amorcée à partir des champs personnels du schéma.
- Un exemple (l’application de commandes d’une boulangerie fictive), une Agent Skill et un `llms.txt`.

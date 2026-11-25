# Journal des modifications

**Français** · [English](CHANGELOG.en.md)

Toutes les modifications notables de `maisongr-law25`. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et chaque version ajoute 0.0.1 au numéro (1.0.1, 1.0.2, 1.0.3), quel que soit son contenu.

## [Non publié]

### Ajouté

- `check` lit maintenant le schéma de toutes les piles courantes, pas seulement Prisma et SQL : Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize (modèles et migrations), Mongoose, Django, SQLAlchemy (et Flask-SQLAlchemy, SQLModel), Rails (`db/schema.rb` ou `db/migrate`), Laravel, Entity Framework, JPA et Hibernate (Java, Kotlin), GORM, et OpenAPI ou JSON Schema (JSON ou YAML). Sans option, il trouve les modèles de chaque ORM du projet et les lit ensemble; les dossiers de dépendances, de compilation et de tests sont laissés de côté.
- `--schema <chemin>` (répétable) lit les fichiers ou le dossier nommés, et `--stack <pile>` précise la pile quand elle ne se reconnaît pas d’elle-même.
- Le marqueur `@personal` (ou `@not-personal`) s’écrit dans un commentaire de chaque langage, et `x-personal` dans OpenAPI et JSON Schema.
- Les lecteurs sont exportés (`parseDrizzle`, `parseDjango`, `parseJpa`…), avec `findSchema`.
## [1.0.0] - 2026-11-25

### Ajouté

- `law25.config.mjs` (ou `.js`, `.json`) : l’évaluation, chaque texte dans une langue ou en `{ fr, en }`.
- `check` : l’évaluation est complète dans chaque langue, ses références existent, chaque fournisseur à l’extérieur du Québec a les facteurs de l’article 17, la prochaine révision n’est pas dépassée, et chaque champ du schéma Prisma ou des migrations SQL qui semble personnel (par son nom, ou marqué `@personal`) est déclaré.
- `build` : le rapport en français et en anglais, déterministe, dans `docs/privacy/`.
- Les schémas lus : Prisma (un fichier ou un dossier), et les migrations ou vidages SQL de PostgreSQL, MySQL, SQLite et SQL Server.
- Deux champs facultatifs de l’article 3.3 : `officerConsulted` (la consultation de la personne responsable dès le début du projet) et `portability` (la communication des renseignements à la personne dans un format structuré).
- `init` : une configuration amorcée à partir des champs personnels du schéma.
- Un exemple (l’application de commandes d’une boulangerie fictive), une Agent Skill et un `llms.txt`.

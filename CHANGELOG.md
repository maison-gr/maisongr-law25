# Journal des modifications

**Français** · [English](CHANGELOG.en.md)

Toutes les modifications notables de `maisongr-law25`. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et chaque version ajoute 0.0.1 au numéro (1.0.1, 1.0.2, 1.0.3), quel que soit son contenu.

## [Non publié]

### Corrigé

- Les migrations SQL : une instruction écrite dans un commentaire (`-- Rollback: DROP TABLE notes;`, `/* … */`) n’est plus exécutée. Dans les migrations de Resistaa, elle faisait disparaître quatre tables, dont `email_log`.
- Une colonne nommée comme un mot-clé (`key text primary key`, `index`, `unique`, `check`) est lue; un index MySQL ajouté par `ALTER TABLE … ADD KEY idx (id)` ne devient plus une colonne.

### Modifié

- Les champs personnels sont mieux repérés, d’après trois vrais projets : le texte libre sur les lignes d’une personne (un journal, un message, une lettre de présentation, des notes), le nom d’un rôle (`author_name`, `changedByName`), l’humeur, le mot de passe, le CV, les profils LinkedIn et GitHub, la nationalité et le statut d’immigration. Moins de bruit : un type, un identifiant, une date ou une préférence à propos d’un renseignement (`email_type`, `scheduled_email_id`, `isEmailVerified`, `email_opt_out`) n’est plus signalé, et une empreinte d’appareil n’est plus appelée biométrique.
- `init` demande pourquoi un renseignement sensible l’est (art. 12) : `check` attend la réponse.
- `init` affiche le chemin complet d’une configuration écrite hors du projet.
## [1.0.0] - 2026-11-25

### Ajouté

- `law25.config.mjs` (ou `.js`, `.json`) : l’évaluation, chaque texte dans une langue ou en `{ fr, en }`.
- `check` : l’évaluation est complète dans chaque langue, ses références existent, chaque fournisseur à l’extérieur du Québec a les facteurs de l’article 17, la prochaine révision n’est pas dépassée, et chaque champ du schéma qui semble personnel (par son nom, ou marqué `@personal`) est déclaré.
- `build` : le rapport en français et en anglais, déterministe, dans `docs/privacy/`.
- Les schémas lus, trouvés d’eux-mêmes : Prisma; Drizzle, TypeORM, MikroORM, sequelize-typescript, NestJS (Mongoose), Sequelize, Mongoose, Django, SQLAlchemy (et Flask-SQLAlchemy, SQLModel), Rails, Laravel, Entity Framework, JPA et Hibernate (Java, Kotlin), GORM, lus ensemble quand un projet en utilise plusieurs; les migrations ou vidages SQL de PostgreSQL, MySQL, SQLite et SQL Server; OpenAPI ou JSON Schema (JSON ou YAML). `--schema <chemin>` et `--stack <pile>` lisent les chemins donnés. Le marqueur `@personal` s’écrit dans un commentaire de chaque langage, `x-personal` dans OpenAPI.
- Deux champs facultatifs de l’article 3.3 : `officerConsulted` (la consultation de la personne responsable dès le début du projet) et `portability` (la communication des renseignements à la personne dans un format structuré).
- `init` : une configuration amorcée à partir des champs personnels du schéma.
- Un exemple (l’application de commandes d’une boulangerie fictive), une Agent Skill et un `llms.txt`.

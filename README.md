# maisongr-law25

**Français** · [English](README.en.md)

**Votre évaluation des facteurs relatifs à la vie privée (EFVP), à côté de votre code.** Décrivez dans un seul fichier les renseignements personnels que votre application traite. `check` fait échouer la CI quand le schéma stocke un champ qui semble personnel et dont l’évaluation ne rend pas compte, et `build` rédige l’évaluation en français et en anglais.

[![npm version](https://img.shields.io/npm/v/maisongr-law25?color=0b1b33)](https://www.npmjs.com/package/maisongr-law25)
[![CI](https://github.com/maison-gr/maisongr-law25/actions/workflows/ci.yml/badge.svg)](https://github.com/maison-gr/maisongr-law25/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/licence-MIT-0b1b33)](LICENSE)
![Dépendances à l’exécution : 0](https://img.shields.io/badge/d%C3%A9pendances-0-0b1b33)
![Node 20.9+](https://img.shields.io/badge/node-%E2%89%A520.9-0b1b33)

![Sur un registre bleu marine : à gauche, la CI qui refuse un nouveau champ Customer.phone sans finalité ni durée de conservation; à droite, l’évaluation classée en français, estampillée « approuvée ».](.github/assets/hero.png)

```sh
npx maisongr-law25 init     # law25.config.mjs, amorcé à partir de votre schéma Prisma ou de vos migrations SQL
npx maisongr-law25 check    # tout est rempli, chaque champ qui semble personnel est déclaré? Sinon, code de sortie 1
npx maisongr-law25 build    # docs/privacy/efvp.fr.md et docs/privacy/pia.en.md
```

```text
✗ Customer.phone (prisma/schema.prisma:21): looks like a phone number: add it to an item's fields in data, or explain in notPersonal why it isn't personal
1 problem in law25.config.mjs (checked against the Prisma schema (prisma/schema.prisma), 16 fields).
```

Les commandes et leurs messages sont en anglais, comme la plupart des outils de développement; les rapports, eux, sont en français et en anglais.

> Ce paquet aide à rédiger et à tenir à jour une évaluation. Ce n’est pas un avis juridique, et il ne détermine pas si une évaluation est requise ni si elle est suffisante : faites-la valider par une personne qualifiée. Fourni tel quel, sans garantie (voir la [LICENCE](LICENSE)). La loi prévaut.

## Pourquoi

La *Loi sur la protection des renseignements personnels dans le secteur privé* (RLRQ, c. P-39.1), telle que modifiée par la Loi 25, exige une évaluation des facteurs relatifs à la vie privée pour tout projet d’acquisition, de développement ou de refonte d’un système d’information ou de prestation électronique de services qui implique la collecte, l’utilisation, la communication, la conservation ou la destruction de renseignements personnels (art. 3.3), et avant de communiquer des renseignements personnels à l’extérieur du Québec ou d’en confier la charge à quelqu’un à l’extérieur du Québec (art. 17). La plupart des applications font les deux : une base de données, un fournisseur de courriels, une région d’hébergement. L’extérieur du Québec comprend le reste du Canada.

L’évaluation est souvent un document rédigé une fois. Puis le code évolue : une nouvelle colonne, un nouveau fournisseur, un champ que personne ne se rappelle avoir ajouté. Ce paquet garde l’évaluation dans le dépôt, à côté du schéma qu’elle décrit, et la CI signale l’écart dès qu’ils divergent.

## Ce que vérifie `check`

1. Il lit votre schéma : un schéma Prisma (`prisma/schema.prisma`, ou un dossier de fichiers `.prisma`), ou vos migrations SQL dans l’ordre (`supabase/migrations`, `migrations`, `db/migrations`…), en suivant `CREATE TABLE`, `ADD COLUMN`, `DROP COLUMN` et `DROP TABLE` en syntaxe PostgreSQL, MySQL, SQLite et SQL Server. Toute pile technologique passe par le SQL : pointez `--sql` vers un vidage du schéma (`pg_dump --schema-only`, `mysqldump --no-data`, `rails db:schema:dump` avec `structure.sql`) ou vers des migrations écrites en SQL (Flyway, dbmate, golang-migrate, Supabase).
2. Il relève chaque champ qui semble contenir un renseignement personnel : par son nom (`email`, `phone`, `dateOfBirth`, `ipAddress`, `lastName`, `gender`…, et `name`, `city` ou `location` dans une table qui décrit des personnes), ou parce qu’un commentaire le marque `@personal`.
3. Chaque champ relevé doit figurer dans les `fields` d’un renseignement, ou être expliqué dans `notPersonal`. Un champ de l’évaluation que le schéma n’a plus est aussi une erreur.
4. L’évaluation doit être complète : chaque finalité et chaque durée de conservation écrites (dans chaque langue), aucun `TODO`, une évaluation selon l’article 17 pour chaque fournisseur à l’extérieur du Québec, une date de révision qui n’est pas dépassée.

Marquez ce que les noms ne disent pas :

```prisma
model Customer {
  /// Les allergies que le client choisit de nous signaler.
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

## L’évaluation

`law25.config.mjs` (ou `.js`, ou `.json`). Chaque texte est une seule chaîne pour toutes les langues, ou `{ fr: "…", en: "…" }`; `check` s’assure que chaque langue est écrite. L’[exemple](example/law25.config.mjs) est complet, pour l’application de commandes d’une boulangerie fictive, et ses rapports sont [en français](example/docs/privacy/efvp.fr.md) et [en anglais](example/docs/privacy/pia.en.md).

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
      name: "Fournisseur de courriels", service: { fr: "Courriels de commande", en: "Order emails" }, data: ["Courriel"],
      location: { fr: "États-Unis", en: "United States" }, outsideQuebec: true, safeguards: { fr: "Entente de traitement", en: "Processing agreement" },
      transfer: { sensitivity: "…", purposes: "…", protection: "…", legalFramework: "…", conclusion: "…" },
    },
  ],
  risks: [
    { stage: "retention", risk: { fr: "Les comptes inactifs restent indéfiniment", en: "Inactive accounts stay forever" }, measure: { fr: "Suppression après trois ans", en: "Deleted after three years" }, status: "planned", owner: "Dev", due: "2027-01-15" },
  ],
};
```

| Champ | Ce qu’il contient |
|---|---|
| `languages` | `["fr", "en"]` (par défaut), `["fr"]` ou `["en"]` |
| `organisation` | `name`, et `privacyOfficer` (`title`, `contact`) : la personne responsable de la protection des renseignements personnels (art. 3.1) |
| `project` | `name`, `description`, `objectives` (pourquoi des renseignements personnels sont nécessaires), `proportionality` (pourquoi on n’en recueille pas plus que nécessaire) |
| `assessed`, `nextReview` | Dates ISO; `check` échoue une fois `nextReview` dépassée |
| `officerConsulted`, `portability` | La date à laquelle la personne responsable a été consultée, dès le début du projet, et la façon dont une personne récupère ses renseignements informatisés dans un format technologique structuré et couramment utilisé (art. 3.3; facultatifs) |
| `roles`, `consultations` | Qui a participé, et qui a été consulté (facultatifs) |
| `data[]` | `name`, `fields` (`Model.field` ou `table.column`), `whose`, `source` (`person`, `third-party`, `generated`, `public`), `purpose`, `retention`, `storedIn`, `access`, `sensitive` (pourquoi, quand l’article 12 s’applique) |
| `providers[]` | `name`, `service`, `data` (noms des renseignements), `location`, `outsideQuebec` (le reste du Canada compte, tout comme les sous-traitants et l’endroit d’où l’on accède aux données), `safeguards`, et `transfer` (les facteurs que nomme l’article 17 : `sensitivity`, `purposes`, `protection`, `legalFramework`, et une `conclusion` sur la protection adéquate et l’entente écrite) |
| `risks[]` | `stage` (`collection`, `use`, `communication`, `retention`, `other`), `risk`, `measure`, `status` (`done`, `planned`, `to-confirm`), `owner`, `due` |
| `approvals[]`, `updates[]` | Qui l’a approuvée et quand; ce qui a changé et quand |
| `notPersonal` | `{ "Post.authorName": "un pseudonyme que l’utilisateur choisit de publier" }` |

Avec le paquet installé (`npm install --save-dev maisongr-law25`), le commentaire `@type` donne l’autocomplétion et la vérification des types dans votre éditeur; `npx` n’exige rien d’installé.

## Le rapport

`build` écrit un fichier Markdown par langue, identique d’une fois à l’autre pour la même configuration, pour qu’on puisse le versionner et le relire comme un diff :

1. Le projet : description, objectifs, proportionnalité
2. Rôles et consultations
3. Renseignements personnels : de qui, d’où, pourquoi, combien de temps, où, qui y a accès, et les champs dans le code
4. Renseignements sensibles (art. 12)
5. Fournisseurs et communication à l’extérieur du Québec (art. 17), avec les facteurs que nomme l’article 17 pour chaque fournisseur à l’extérieur du Québec
6. Risques et mesures, par étape : collecte, utilisation, communication, conservation et destruction
7. Plan d’action : les mesures encore ouvertes, par échéance
8. Approbation et historique

Les sections couvrent les points que nomment les articles 3.3, 12 et 17, et les sujets que parcourt le [guide de la Commission d’accès à l’information](https://www.cai.gouv.qc.ca/commission-acces-information/guide-fiches-information). Le libellé est propre à ce paquet : il ne reproduit pas le modèle de la Commission. Le français est rédigé pour le Québec, avec sa typographie.

## Dans la CI

```yaml
- run: npx maisongr-law25 check
```

Une demande de fusion qui ajoute `users.phone` sans dire pourquoi on le recueille ni combien de temps on le garde échoue, avec le fichier et la ligne du nouveau champ.

Options : `--config <fichier>`, `--prisma <chemin>`, `--sql <chemin>`, `--no-schema` (vérifier l’évaluation seule), `--out <dossier>` et `--lang fr|en` pour `build`, `--json` pour un résultat lisible par une machine. Codes de sortie : 0 terminé, 1 problèmes trouvés, 2 erreur d’utilisation.

## Dans le code

```js
import { validate, render, parsePrisma, parseSql, looksPersonal } from "maisongr-law25";

const problems = validate(assessment, parsePrisma(schemaText), "2026-11-25");
const markdown = render(assessment, "fr");
```

## Pour les agents d’IA

Le paquet fournit une [Agent Skill](skills/maisongr-law25/SKILL.md) et un [`llms.txt`](llms.txt). Un agent qui ajoute une colonne contenant un renseignement personnel peut lancer `check`, puis ajouter le renseignement, avec sa finalité et sa durée de conservation, pour qu’une personne les confirme.

## Limites

- Les champs personnels sont repérés par leur nom et par un marqueur. Un champ de texte libre (`notes`, `message`) peut contenir des renseignements personnels sous n’importe quel nom : marquez-le `@personal`.
- Il lit Prisma et les migrations SQL. Drizzle, TypeORM, Mongoose et les autres ne sont pas encore lus : utilisez `--no-schema`, et listez les `fields` à la main.
- Il vérifie que l’évaluation est complète et conforme au schéma, pas que ce qu’elle affirme est exact ou suffisant. C’est le rôle de l’évaluation elle-même, et de la personne qui la valide.
- Il ne décide pas si une évaluation est requise, ni si elle suffit.
- Il couvre l’évaluation de la loi sur le secteur privé. Les organismes publics relèvent d’une autre loi (RLRQ, c. A-2.1), et les autres évaluations (par exemple pour une communication à des fins de recherche) ne sont pas couvertes.
- Les autres obligations de la Loi 25 (la politique publiée, le consentement, le registre des incidents de confidentialité, les coordonnées de la personne responsable sur votre site) restent à remplir de votre côté.
- Les numéros d’articles renvoient à la RLRQ, c. P-39.1 en vigueur à la date de publication; vérifiez le texte actuel sur [LégisQuébec](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1).

## Prérequis

Node.js 20.9 ou plus récent, sur Linux, macOS et Windows. Aucune dépendance à l’exécution. Un module ES : depuis CommonJS, `require("maisongr-law25")` fonctionne à partir de Node 22.12; sur Node 20, utilisez `await import("maisongr-law25")`. L’outil en ligne de commande fonctionne partout de la même façon, dans tout projet : il n’exige rien d’installé à côté, quel que soit le langage du projet.

## Aussi chez Maison GR

Du logiciel libre de [Maison GR](https://www.maisongr.com), un studio de logiciels de Québec :

- [maisongr-sitemap](https://github.com/maison-gr/maisongr-sitemap) : un plan de site, deux lecteurs. Le XML dont les moteurs de recherche ont besoin, et une page aux couleurs de votre site pour les gens.
- [Maison GR Sitemap pour WordPress](https://github.com/maison-gr/maisongr-sitemap-wordpress) : le même plan de site pour WordPress, aux couleurs et aux polices de votre thème.
- [maisongr-skills](https://github.com/maison-gr/maisongr-skills) : une même norme d’ingénierie pour tous les agents de programmation par IA : Claude Code, Codex, Cursor, Copilot, Gemini CLI.
- [maisongr-typo](https://github.com/maison-gr/maisongr-typo) : la typographie française à la québécoise, avec une vérification pour la CI.

## Licence

MIT, © Maison GR Inc. Ni affilié à la Commission d’accès à l’information ni approuvé par elle.

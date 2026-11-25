# Contribuer

**Français** · [English](CONTRIBUTING.en.md)

Merci de votre aide. Un schéma que le paquet lit mal, ou un champ personnel qu’il rate (ou qu’il relève à tort), avec le schéma qui le montre, est ce qu’on peut nous envoyer de plus utile. Les demandes de fusion sont aussi les bienvenues.

## Mise en place

Le développement demande Node 22.12 ou plus récent (le paquet lui-même fonctionne à partir de Node 20.9).

```sh
npm ci
npm run typecheck
npm test
npm run build && node test/smoke.mjs
```

## Ce qu’une modification demande

- **Un test qui échoue sans elle.** La lecture des schémas se teste sur de petits schémas écrits dans le test (`test/schema.test.ts`); ajoutez celui qui a révélé le problème.
- **Une source pour tout ce qui touche la loi.** Un énoncé sur la Loi 25 cite l’article dont il vient, et reste un résumé dans les mots propres au paquet. Ne copiez pas le guide ni le modèle de la Commission d’accès à l’information : leurs textes ne sont pas sous licence libre.
- **Les deux langues.** Chaque mot du rapport existe en français (québécois, avec sa typographie) et en anglais, et change dans les deux à la fois.
- **Un rapport déterministe.** La même configuration donne le même fichier : pas d’horodatage, pas d’ordre qui dépende de la machine.
- **Aucune nouvelle dépendance à l’exécution.**

## Ajouter une source de schéma

1. `src/schema.ts` : un analyseur qui renvoie des `Field` (`ref`, `model`, `name`, `type`, `marked`, `file`, `line`), qui lit `@personal` et `@not-personal` dans les commentaires.
2. `src/load.ts` : où le trouver, et une option de la ligne de commande.
3. Des tests pour les deux, et la section « Ce que vérifie `check` » du README.

## Commits et demandes de fusion

De petits commits, chacun faisant une seule chose, avec un message [conventionnel](https://www.conventionalcommits.org/fr/) : `feat: read Drizzle schemas`, `fix: keep a comment after the comma with its column`. Une demande de fusion porte sur un seul changement, et dit ce que vous avez vérifié. Les messages de commit et le code restent en anglais; les échanges peuvent se faire en français ou en anglais.

## Sécurité

N’ouvrez pas d’issue publique pour un problème de sécurité. Voir [SECURITY.md](SECURITY.md).

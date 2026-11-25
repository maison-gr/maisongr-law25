# Sécurité

**Français** · [English](SECURITY.en.md)

## Signaler un problème

Signalez les problèmes de sécurité en privé, par GitHub : **Security → Report a vulnerability** sur ce dépôt. N’ouvrez pas d’issue publique.

Dites ce que vous avez trouvé, comment le reproduire, et ce que cela permet de faire. Vous aurez une réponse dans la semaine, et un correctif ou un plan une fois le problème confirmé. Les signalements sont mentionnés dans les notes de version, sauf si vous préférez ne pas être nommé.

## Versions prises en charge

Les correctifs de sécurité vont dans la dernière version.

## Ce que fait le paquet, et qui compte ici

- **Il exécute votre configuration.** `law25.config.mjs` et `.js` sont des modules JavaScript, importés comme n’importe quel fichier de configuration (celui d’ESLint, de Vite) : ne lancez l’outil que sur un projet de confiance. Une configuration `.json` est lue comme des données.
- **Il lit** la configuration, le schéma Prisma et les migrations SQL qu’il trouve ou qu’on lui donne. Il ne lit aucune base de données et aucun renseignement personnel : seulement des noms, des types et des commentaires.
- **Il écrit** `law25.config.mjs` (`init`, jamais par-dessus un fichier existant) et les fichiers du rapport (`build`, dans `docs/privacy/` ou `--out`). Rien d’autre.
- **Il n’envoie rien nulle part.** Aucune requête réseau, aucune télémétrie.

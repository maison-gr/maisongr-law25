# Évaluation des facteurs relatifs à la vie privée : Commandes en ligne

| | |
|---|---|
| Organisation | Boulangerie Exemple inc. |
| Responsable de la protection des renseignements personnels | Propriétaire et responsable de la protection des renseignements personnels, vieprivee@boulangerie-exemple.ca |
| Système évalué | Commandes en ligne |
| Évaluation faite le | 25 novembre 2026 |
| Prochaine révision | 25 novembre 2027 |
| Responsable consulté le | 1 octobre 2026 |
| Dispositions visées | Loi sur la protection des renseignements personnels dans le secteur privé (RLRQ, c. P-39.1), art. 3.3, 12 et 17 |

*Préparée par l’organisation à partir de sa propre description du système, avec un outil libre qui vérifie que l’évaluation est complète et cohérente avec le code, et non qu’elle est exacte ou suffisante au regard de la loi. Une validation par une personne qualifiée est recommandée.*

## Résumé

- 5 types de renseignements personnels, dont 1 sensible.
- 2 fournisseurs, dont 1 traite des renseignements à l’extérieur du Québec.
- 4 risques relevés : 2 traités, 2 encore ouverts.

## 1. Le projet

Les clients commandent du pain et des pâtisseries en ligne, choisissent une heure de cueillette et paient en boutique. L’équipe voit les commandes du jour pour les préparer.

### Objectifs

- Préparer chaque commande pour l’heure choisie et la remettre à la bonne personne.
- Joindre le client si la commande ne peut pas être prête.
- Éviter de servir un produit qui contient un allergène que le client nous a signalé.

### Proportionnalité

Le prénom et le courriel suffisent pour remettre et confirmer une commande. Le téléphone et les allergies sont facultatifs et servent seulement à la commande. Aucun paiement en ligne, donc aucune donnée de carte.

### Communication des renseignements à la personne

Le client télécharge ses renseignements et ses commandes en un fichier JSON depuis son compte.

## 2. Rôles et consultations

| Qui | Rôle |
|---|---|
| La propriétaire | Responsable de l’évaluation |
| Le développeur | Inventaire des données et mesures techniques |

## 3. Renseignements personnels

| Renseignement | Personnes concernées | Provenance | Finalité | Conservation | Lieu de conservation | Accès | Dans le code |
|---|---|---|---|---|---|---|---|
| Courriel | Clients | La personne | Confirmer la commande et se connecter. | Tant que le compte existe, puis supprimé dans les 30 jours suivant la fermeture. | PostgreSQL (Canada, Montréal) | Le client; l’équipe pour les commandes du jour | `Customer.email` |
| Prénom | Clients | La personne | Remettre la commande à la bonne personne. | Comme le courriel. | PostgreSQL (Canada, Montréal) | L’équipe en boutique | `Customer.firstName` |
| Téléphone | Clients qui le donnent | La personne | Joindre le client si la commande ne peut pas être prête. | Comme le courriel; effacé quand le client le retire. | PostgreSQL (Canada, Montréal) | La propriétaire | `Customer.phone` |
| Allergies | Clients qui les signalent | La personne | Éviter de servir un allergène signalé. | Comme le courriel; effacées quand le client les retire. | PostgreSQL (Canada, Montréal) | L’équipe qui prépare la commande | `Customer.allergies` |
| Commandes | Clients | La personne | Préparer et remettre la commande. | Deux ans pour la comptabilité, puis supprimées. | PostgreSQL (Canada, Montréal) | L’équipe en boutique | `Order.pickupAt`, `Order.note` |

## 4. Renseignements sensibles (art. 12)

Un renseignement personnel est sensible lorsque, de par sa nature notamment médicale, biométrique ou autrement intime, ou en raison du contexte de son utilisation ou de sa communication, il suscite un haut degré d’attente raisonnable en matière de vie privée.

- **Allergies** : Renseignement de santé.

## 5. Fournisseurs et communication à l’extérieur du Québec (art. 17)

| Fournisseur | Service | Renseignements | Lieu | Hors Québec | Mesures de protection |
|---|---|---|---|---|---|
| Hébergeur Canada | Hébergement de la base de données | Courriel, Prénom, Téléphone, Allergies, Commandes | Canada (Montréal) | Non | Entente de traitement; chiffrement au repos |
| Courriels Transactionnels | Envoi des confirmations de commande | Courriel, Prénom | États-Unis | Oui | Entente de traitement; données utilisées seulement pour l’envoi |

Avant de communiquer des renseignements personnels à l’extérieur du Québec, ou de confier à une personne ou à un organisme à l’extérieur du Québec la tâche de les recueillir, de les utiliser, de les communiquer ou de les conserver pour son compte, l’article 17 exige une évaluation qui tient compte notamment des facteurs ci-dessous. La communication peut s’effectuer si l’évaluation établit que les renseignements bénéficieraient d’une protection adéquate, notamment au regard des principes de protection des renseignements personnels généralement reconnus. Elle doit faire l’objet d’une entente écrite qui tient compte notamment des résultats de l’évaluation et, le cas échéant, des modalités convenues pour atténuer les risques relevés. L’extérieur du Québec comprend le reste du Canada.

### Courriels Transactionnels

- **Sensibilité des renseignements** : Faible, un courriel et un prénom.
- **Finalités de leur utilisation** : Envoyer la confirmation de commande, rien d’autre.
- **Mesures de protection, y compris contractuelles** : Entente écrite qui interdit tout autre usage; journaux effacés après 30 jours.
- **Régime juridique applicable dans l’État de destination, y compris ses principes de protection des renseignements personnels** : Lois américaines sur la vie privée, moins protectrices que la loi québécoise. Le fournisseur s’engage par contrat à un niveau équivalent, mais l’entente ne peut écarter l’accès des autorités américaines prévu par leurs lois.
- **Conclusion** : Protection adéquate compte tenu de la faible sensibilité des renseignements et de l’entente écrite, qui reprend les mesures ci-dessus.

## 6. Risques et mesures

### À la collecte

| Risque | Mesure | État |
|---|---|---|
| Demander plus que nécessaire | Téléphone et allergies facultatifs; aucune date de naissance ni adresse | Fait |

### À l’utilisation

| Risque | Mesure | État |
|---|---|---|
| Toute l’équipe voit les allergies de tous les clients | Les allergies n’apparaissent que sur la fiche de la commande à préparer | Prévu |

### À la communication

| Risque | Mesure | État |
|---|---|---|
| Le fournisseur de courriels réutilise les adresses | Entente écrite qui interdit tout autre usage | Fait |

### À la conservation et à la destruction

| Risque | Mesure | État |
|---|---|---|
| Les comptes inactifs restent indéfiniment | Suppression automatique après trois ans sans commande | À confirmer |

## 7. Plan d’action

| Mesure | Responsable | Échéance | État |
|---|---|---|---|
| Les allergies n’apparaissent que sur la fiche de la commande à préparer | Le développeur | 15 janvier 2027 | Prévu |
| Suppression automatique après trois ans sans commande | La propriétaire | — | À confirmer |

## 8. Approbation et historique

| Approuvée par | Titre | Date |
|---|---|---|
| Marie Exemple | Propriétaire | 25 novembre 2026 |

### Historique

- 25 novembre 2026 : Première évaluation.

---

Rédigée à partir de `law25.config.mjs` avec [maisongr-law25](https://github.com/maison-gr/maisongr-law25).

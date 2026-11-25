// The privacy impact assessment of a fictional bakery's ordering app (example/prisma/schema.prisma).
// Run from this folder: npx maisongr-law25 check, then npx maisongr-law25 build.

/** @type {import("maisongr-law25").Assessment} */
export default {
  languages: ["fr", "en"],
  organisation: {
    name: "Boulangerie Exemple inc.",
    privacyOfficer: {
      title: { fr: "Propriétaire et responsable de la protection des renseignements personnels", en: "Owner, in charge of the protection of personal information" },
      contact: "vieprivee@boulangerie-exemple.ca",
    },
  },
  project: {
    name: { fr: "Commandes en ligne", en: "Online ordering" },
    description: {
      fr: "Les clients commandent du pain et des pâtisseries en ligne, choisissent une heure de cueillette et paient en boutique. L’équipe voit les commandes du jour pour les préparer.",
      en: "Customers order bread and pastries online, choose a pickup time and pay in the shop. The team sees the day’s orders to prepare them.",
    },
    objectives: [
      { fr: "Préparer chaque commande pour l’heure choisie et la remettre à la bonne personne.", en: "Prepare each order for the chosen time and hand it to the right person." },
      { fr: "Joindre le client si la commande ne peut pas être prête.", en: "Reach the customer when an order can’t be ready." },
      { fr: "Éviter de servir un produit qui contient un allergène que le client nous a signalé.", en: "Avoid serving a product with an allergen the customer told us about." },
    ],
    proportionality: {
      fr: "Le prénom et le courriel suffisent pour remettre et confirmer une commande. Le téléphone et les allergies sont facultatifs et servent seulement à la commande. Aucun paiement en ligne, donc aucune donnée de carte.",
      en: "A first name and an email are enough to hand over and confirm an order. The phone number and allergies are optional and used only for the order. No online payment, so no card data.",
    },
  },
  assessed: "2026-11-25",
  nextReview: "2027-11-25",
  officerConsulted: "2026-10-01",
  portability: {
    fr: "Le client télécharge ses renseignements et ses commandes en un fichier JSON depuis son compte.",
    en: "Customers download their information and orders as one JSON file from their account.",
  },
  roles: [
    { who: { fr: "La propriétaire", en: "The owner" }, role: { fr: "Responsable de l’évaluation", en: "Responsible for the assessment" } },
    { who: { fr: "Le développeur", en: "The developer" }, role: { fr: "Inventaire des données et mesures techniques", en: "Data inventory and technical measures" } },
  ],
  data: [
    {
      name: { fr: "Courriel", en: "Email" },
      fields: ["Customer.email"],
      whose: { fr: "Clients", en: "Customers" },
      source: "person",
      purpose: { fr: "Confirmer la commande et se connecter.", en: "Confirm the order and sign in." },
      retention: { fr: "Tant que le compte existe, puis supprimé dans les 30 jours suivant la fermeture.", en: "While the account exists, then deleted within 30 days of closing it." },
      storedIn: { fr: "PostgreSQL (Canada, Montréal)", en: "PostgreSQL (Canada, Montréal)" },
      access: { fr: "Le client; l’équipe pour les commandes du jour", en: "The customer; the team for the day’s orders" },
    },
    {
      name: { fr: "Prénom", en: "First name" },
      fields: ["Customer.firstName"],
      whose: { fr: "Clients", en: "Customers" },
      source: "person",
      purpose: { fr: "Remettre la commande à la bonne personne.", en: "Hand the order to the right person." },
      retention: { fr: "Comme le courriel.", en: "As the email." },
      storedIn: "PostgreSQL (Canada, Montréal)",
      access: { fr: "L’équipe en boutique", en: "The shop team" },
    },
    {
      name: { fr: "Téléphone", en: "Phone" },
      fields: ["Customer.phone"],
      whose: { fr: "Clients qui le donnent", en: "Customers who give it" },
      source: "person",
      purpose: { fr: "Joindre le client si la commande ne peut pas être prête.", en: "Reach the customer when an order can’t be ready." },
      retention: { fr: "Comme le courriel; effacé quand le client le retire.", en: "As the email; erased when the customer removes it." },
      storedIn: "PostgreSQL (Canada, Montréal)",
      access: { fr: "La propriétaire", en: "The owner" },
    },
    {
      name: { fr: "Allergies", en: "Allergies" },
      fields: ["Customer.allergies"],
      whose: { fr: "Clients qui les signalent", en: "Customers who report them" },
      source: "person",
      purpose: { fr: "Éviter de servir un allergène signalé.", en: "Avoid serving a reported allergen." },
      retention: { fr: "Comme le courriel; effacées quand le client les retire.", en: "As the email; erased when the customer removes them." },
      storedIn: "PostgreSQL (Canada, Montréal)",
      access: { fr: "L’équipe qui prépare la commande", en: "The team preparing the order" },
      sensitive: { fr: "Renseignement de santé.", en: "Health information." },
    },
    {
      name: { fr: "Commandes", en: "Orders" },
      fields: ["Order.pickupAt", "Order.note"],
      whose: { fr: "Clients", en: "Customers" },
      source: "person",
      purpose: { fr: "Préparer et remettre la commande.", en: "Prepare and hand over the order." },
      retention: { fr: "Deux ans pour la comptabilité, puis supprimées.", en: "Two years for the accounts, then deleted." },
      storedIn: "PostgreSQL (Canada, Montréal)",
      access: { fr: "L’équipe en boutique", en: "The shop team" },
    },
  ],
  providers: [
    {
      name: "Hébergeur Canada",
      service: { fr: "Hébergement de la base de données", en: "Database hosting" },
      data: ["Courriel", "Prénom", "Téléphone", "Allergies", "Commandes"],
      location: { fr: "Canada (Montréal)", en: "Canada (Montréal)" },
      outsideQuebec: false,
      safeguards: { fr: "Entente de traitement; chiffrement au repos", en: "Processing agreement; encryption at rest" },
    },
    {
      name: "Courriels Transactionnels",
      service: { fr: "Envoi des confirmations de commande", en: "Order confirmation emails" },
      data: ["Courriel", "Prénom"],
      location: { fr: "États-Unis", en: "United States" },
      outsideQuebec: true,
      safeguards: { fr: "Entente de traitement; données utilisées seulement pour l’envoi", en: "Processing agreement; data used only to send" },
      transfer: {
        sensitivity: { fr: "Faible, un courriel et un prénom.", en: "Low, an email and a first name." },
        purposes: { fr: "Envoyer la confirmation de commande, rien d’autre.", en: "Send the order confirmation, nothing else." },
        protection: { fr: "Entente écrite qui interdit tout autre usage; journaux effacés après 30 jours.", en: "Written agreement forbidding any other use; logs erased after 30 days." },
        legalFramework: { fr: "Lois américaines sur la vie privée, moins protectrices que la loi québécoise. Le fournisseur s’engage par contrat à un niveau équivalent, mais l’entente ne peut écarter l’accès des autorités américaines prévu par leurs lois.", en: "US privacy laws, less protective than Québec’s. The provider commits by contract to an equivalent level, but the agreement can’t set aside access by US authorities under their laws." },
        conclusion: { fr: "Protection adéquate compte tenu de la faible sensibilité des renseignements et de l’entente écrite, qui reprend les mesures ci-dessus.", en: "Adequate protection given the low sensitivity of the information and the written agreement, which includes the measures above." },
      },
    },
  ],
  risks: [
    { stage: "collection", risk: { fr: "Demander plus que nécessaire", en: "Asking for more than needed" }, measure: { fr: "Téléphone et allergies facultatifs; aucune date de naissance ni adresse", en: "Phone and allergies optional; no date of birth or address" }, status: "done" },
    { stage: "use", risk: { fr: "Toute l’équipe voit les allergies de tous les clients", en: "The whole team sees every customer’s allergies" }, measure: { fr: "Les allergies n’apparaissent que sur la fiche de la commande à préparer", en: "Allergies appear only on the ticket of the order being prepared" }, status: "planned", owner: { fr: "Le développeur", en: "The developer" }, due: "2027-01-15" },
    { stage: "communication", risk: { fr: "Le fournisseur de courriels réutilise les adresses", en: "The email provider reuses the addresses" }, measure: { fr: "Entente écrite qui interdit tout autre usage", en: "Written agreement forbidding any other use" }, status: "done" },
    { stage: "retention", risk: { fr: "Les comptes inactifs restent indéfiniment", en: "Inactive accounts stay forever" }, measure: { fr: "Suppression automatique après trois ans sans commande", en: "Automatic deletion after three years without an order" }, status: "to-confirm", owner: { fr: "La propriétaire", en: "The owner" } },
  ],
  approvals: [{ by: "Marie Exemple", title: { fr: "Propriétaire", en: "Owner" }, date: "2026-11-25" }],
  updates: [{ date: "2026-11-25", summary: { fr: "Première évaluation.", en: "First assessment." } }],
  notPersonal: {},
};

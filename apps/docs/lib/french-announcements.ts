import type { AdapterAnnouncementCopy, AnnouncementCatalog } from "@generative-a11y/core";

// Illustrative host-owned copy, not a supported translation pack. Have a fluent
// speaker review production wording. A host may call its existing i18n system
// in any formatter instead of maintaining these example strings.
const plural = new Intl.PluralRules("fr");
const number = new Intl.NumberFormat("fr");
const steps = (count: number) => plural.select(count) === "one" ? "étape" : "étapes";
const outcomes = { approved: "approuvée", rejected: "refusée", submitted: "envoyée", cancelled: "annulée" };

export const frenchCatalog = {
  id: "example-fr-v1", locale: "fr",
  messages: {
    "response.started": "L’assistant prépare une réponse.",
    "response.completed": "Réponse terminée.",
    "response.interrupted": "Réponse arrêtée.",
    "response.failed": "La réponse a échoué.",
    "response.retrying": ({ attempt }) => attempt === undefined ? "Nouvelle tentative de réponse." : `Nouvelle tentative de réponse. Tentative ${number.format(attempt)}.`,
    "tool.started": ({ label }) => `${label} démarre.`,
    "tool.progress": ({ label, percent }) => percent === undefined ? `${label} est en cours.` : `${label} : ${number.format(percent)} pour cent.`,
    "tool.completed": ({ label }) => `${label} : terminé.`,
    "tool.failed": ({ label }) => `${label} : échec.`,
    "run.started": ({ label }) => label ? `${label} démarre.` : "Le traitement démarre.",
    "run.completed": ({ completedSteps, failedSteps }) => `Traitement terminé. ${number.format(completedSteps)} ${steps(completedSteps)} avec succès. ${number.format(failedSteps)} ${steps(failedSteps)} en échec.`,
    "run.interrupted": "Traitement arrêté.",
    "run.failed": "Le traitement a échoué.",
    "run.retrying": ({ attempt }) => attempt === undefined ? "Nouvelle tentative de traitement." : `Nouvelle tentative de traitement. Tentative ${number.format(attempt)}.`,
    "step.started": ({ label }) => `${label} démarre.`,
    "step.progress": ({ label, percent }) => percent === undefined ? `${label} est en cours.` : `${label} : ${number.format(percent)} pour cent.`,
    "step.completed": ({ label }) => `${label} : terminé.`,
    "step.interrupted": ({ label }) => `${label} : arrêté.`,
    "step.failed": ({ label }) => `${label} : échec.`,
    "step.retrying": ({ label, attempt }) => attempt === undefined ? `Nouvelle tentative : ${label}.` : `Nouvelle tentative : ${label}. Tentative ${number.format(attempt)}.`,
    "interaction.resolved": ({ outcome }) => `Demande ${outcomes[outcome]}.`,
    "approval.resolved": ({ outcome }) => `Autorisation ${outcomes[outcome]}.`,
    "connection.lost": "Connexion perdue. Reconnexion en cours.",
    "connection.restored": "Connexion rétablie.",
    "citation.available": ({ count }) => plural.select(count) === "one" ? `${number.format(count)} source disponible.` : `${number.format(count)} sources disponibles.`,
  },
} satisfies AnnouncementCatalog;

export const frenchAdapterCopy = {
  locale: "fr", toolLabel: "Un outil", approvalRequested: "Autorisation requise.",
  approvalResolved: { approved: "Autorisation accordée.", rejected: "Autorisation refusée.", cancelled: "Autorisation annulée." },
  inputRequested: "Saisie requise.", inputResolved: { submitted: "Saisie reçue.", cancelled: "Saisie annulée." },
} satisfies AdapterAnnouncementCopy;

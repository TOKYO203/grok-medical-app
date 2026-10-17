/**
 * Source unique des prix Optimus — Mission International, Session 1 (A01).
 *
 * Les montants de référence restent en Ariary (MGA) : c'est la devise de
 * paiement Mobile Money et celle des montants officiels des commandes
 * (`orderAmount` dans src/content/purchase-order.ts). Les affichages en
 * USD et EUR sont des équivalents indicatifs pensés pour les visiteurs
 * internationaux — aucune requête réseau, aucun service de taux tiers.
 */

export const CURRENCIES = ["MGA", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Prix de référence, alignés sur `orderAmount` de src/content/purchase-order.ts. */
export const PRICES_MGA = {
  deck: 3_000,
  specialty: 27_000,
} as const;

/**
 * Abonnements Premium (A04) : mensuel 30 jours, trimestriel 90 jours.
 * Montants alignés sur `SUBSCRIPTION_OFFERS` (src/content/purchase-order.ts,
 * source canonique via `orderAmount`) — l'achat à vie n'est plus proposé :
 * PRICES_MGA ne sert plus qu'aux commandes historiques deck/specialty.
 */
export const SUBSCRIPTIONS_MGA = {
  monthly: 5_000,
  quarterly: 12_000,
} as const;

/**
 * Taux indicatifs : 1 unité de devise = X Ariary.
 * Volontairement constants et documentés : l'application doit rester
 * utilisable hors ligne et ne dépendre d'aucune API externe.
 * À réviser à chaque recalibrage tarifaire.
 */
export const INDICATIVE_RATES: Record<Exclude<Currency, "MGA">, number> = {
  USD: 4_600,
  EUR: 5_000,
};

export function convertFromMga(amountMga: number, currency: Currency): number {
  if (currency === "MGA") return amountMga;
  return amountMga / INDICATIVE_RATES[currency];
}

export function formatPrice(amountMga: number, currency: Currency): string {
  if (currency === "MGA") {
    return amountMga.toLocaleString("fr-FR") + " Ar";
  }
  const converted = convertFromMga(amountMga, currency);
  const formatted = converted.toLocaleString("fr-FR", {
    minimumFractionDigits: converted < 10 ? 1 : 0,
    maximumFractionDigits: converted < 10 ? 1 : 0,
  });
  return currency === "USD" ? "≈ $" + formatted : "≈ " + formatted + " €";
}

/**
 * Fuseaux horaires principaux de la zone euro (liste indicative, non
 * exhaustive) utilisés pour présuger la devise du visiteur.
 */
const EURO_TIME_ZONES = new Set([
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Luxembourg",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Vienna",
  "Europe/Malta",
  "Indian/Reunion",
]);

/**
 * Devise présomptive du visiteur : Madagascar → MGA, zone euro → EUR,
 * sinon USD. Détection purement locale (fuseau horaire + langue), sans
 * géolocalisation ni réseau.
 */
export function detectPreferredCurrency(): Currency {
  if (typeof navigator === "undefined") return "MGA";
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (timeZone === "Africa/Antananarivo" || /(^|-)mg$/i.test(navigator.language)) {
      return "MGA";
    }
    if (EURO_TIME_ZONES.has(timeZone)) return "EUR";
  } catch {
    // Environnement sans Intl complet : on reste sur la devise locale.
    return "MGA";
  }
  return "USD";
}

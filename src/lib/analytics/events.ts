/**
 * Mesure produit — module PUR, partagé par le client et le serveur.
 *
 * Aucune dépendance, aucun accès à `window` : tout est injectable, donc testable
 * sous `node --test` et utilisable côté serveur pour valider ce que le client
 * envoie. C'est le point unique de vérité sur « quel événement est autorisé et
 * avec quelles propriétés ».
 *
 * POURQUOI UNE LISTE BLANCHE : un système de mesure est une porte d'entrée
 * ouverte sur la base. Si le client choisit librement le nom et le contenu, une
 * version modifiée de l'app peut y écrire n'importe quoi (et y faire entrer des
 * données personnelles, y compris par accident en envoyant un message d'erreur).
 * On n'accepte donc que des noms connus, avec des propriétés de type scalaire,
 * bornées, et sur une liste fermée de clés.
 */

/** Les 7 événements qui suffisent à piloter le lancement. */
export const PRODUCT_EVENTS = [
  "signup", //            compte créé
  "onboarding_done", //   parcours d'inscription terminé
  "first_content_viewed", // première fiche/démo lue (activation J0)
  "session_completed", // une session de révision/QCM terminée
  "day_streak", //        série quotidienne atteinte
  "paywall_viewed", //    mur Premium rencontré
  "purchase", //          paiement abouti
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

const EVENT_SET = new Set<string>(PRODUCT_EVENTS);

/**
 * Propriétés autorisées — noms fermés, pour deux raisons : éviter le texte libre
 * (qui laisse fuiter un e-mail, un nom de fichier, un message d'erreur) et
 * garder des agrégations stables dans le temps.
 */
export const ALLOWED_PROP_KEYS = [
  "offer", //      deck | specialty | subscription
  "specialty", //  cardiologie | nephro | …
  "surface", //    fiche | cas | qcm | signes | ecg | auscultation | demarche
  "item", //       identifiant d'item du programme (slug)
  "count", //      nombre d'éléments (questions répondues…)
  "minutes", //    durée d'une session, arrondie
  "step", //       étape d'onboarding
  "reason", //     motif technique court (rate_limited, offline…)
  "plan", //       premium | free
  "days", //       ancienneté / série
  "source", //     origine d'un clic (nav, home, deep_link…)
] as const;

const PROP_SET = new Set<string>(ALLOWED_PROP_KEYS);

/** Bornes : un événement pèse quelques octets, jamais quelques kilooctets. */
export const MAX_PROPS = 6;
export const MAX_BATCH = 25;
export const MAX_VALUE_LENGTH = 48;

export type EventProps = Record<string, string | number | boolean>;

export type ProductEventInput = {
  name: string;
  anonId?: string | null;
  props?: Record<string, unknown>;
};

export type ProductEvent = {
  name: ProductEventName;
  anonId: string | null;
  props: EventProps;
};

/**
 * Nettoie une propriété : valeurs scalaires uniquement, tronquées. Un objet, un
 * tableau, `null` ou une valeur trop longue sont rejetés (on ne « devine » pas,
 * on jette) : c'est ce qui empêche un message d'erreur complet d'entrer en base.
 */
function sanitizeValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) return undefined;
    return trimmed;
  }
  return undefined;
}

const ANON_PATTERN = /^[A-Za-z0-9_-]{16,40}$/;
/**
 * Forme canonique d'un UUID (8-4-4-4-12). Volontairement REJETÉE : sans cela,
 * une version modifiée du client pourrait envoyer l'identifiant utilisateur
 * comme `anon_id` et rendre la mesure nominative. Un identifiant anonyme est un
 * jeton opaque généré localement, jamais un identifiant de compte.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant anonyme est opaque : ni e-mail, ni UUID d'utilisateur. */
export function isAnonId(value: unknown): value is string {
  return typeof value === "string" && ANON_PATTERN.test(value) && !UUID_SHAPE.test(value);
}

export type ValidationResult =
  | { ok: true; event: ProductEvent }
  | { ok: false; reason: "unknown_event" | "bad_anon_id" | "bad_props" };

/**
 * Valide et normalise UN événement. Utilisé côté serveur : ne jamais faire
 * confiance au corps de la requête, même s'il vient de « notre » client.
 */
export function normalizeEvent(input: ProductEventInput): ValidationResult {
  if (!EVENT_SET.has(input.name)) return { ok: false, reason: "unknown_event" };

  let anonId: string | null = null;
  if (input.anonId !== undefined && input.anonId !== null) {
    if (!isAnonId(input.anonId)) return { ok: false, reason: "bad_anon_id" };
    anonId = input.anonId;
  }

  const raw = input.props ?? {};
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "bad_props" };
  const keys = Object.keys(raw);
  if (keys.length > MAX_PROPS) return { ok: false, reason: "bad_props" };
  if (keys.some((key) => !PROP_SET.has(key))) return { ok: false, reason: "bad_props" };

  const props: EventProps = {};
  for (const key of keys) {
    const value = sanitizeValue(raw[key]);
    if (value === undefined) return { ok: false, reason: "bad_props" };
    props[key] = value;
  }

  return { ok: true, event: { name: input.name as ProductEventName, anonId, props } };
}

export type BatchResult =
  | { ok: true; events: ProductEvent[]; rejected: number }
  | { ok: false; reason: "empty" | "too_many" | "not_array" };

/**
 * Valide un lot. On CONSERVE les événements valides d'un lot partiellement
 * invalide (un client ancien ne doit pas faire perdre les autres mesures) mais
 * on compte les rejets, qui sont remontés pour alerter sur une dérive.
 */
export function normalizeBatch(input: unknown): BatchResult {
  if (!Array.isArray(input)) return { ok: false, reason: "not_array" };
  if (input.length === 0) return { ok: false, reason: "empty" };
  if (input.length > MAX_BATCH) return { ok: false, reason: "too_many" };

  const events: ProductEvent[] = [];
  let rejected = 0;
  for (const item of input) {
    if (!item || typeof item !== "object") {
      rejected += 1;
      continue;
    }
    const result = normalizeEvent(item as ProductEventInput);
    if (result.ok) events.push(result.event);
    else rejected += 1;
  }
  return { ok: true, events, rejected };
}

/* ─────────────────────────────────────────────────────────────────────────
   Rétention : agrégation côté lecture.
   Fonction pure, donc testable sans base — et utilisée par le tableau de bord.
   ───────────────────────────────────────────────────────────────────────── */

export type RawEvent = { name: string; anonId: string | null; day: string };

/**
 * Rétention par cohorte de jour d'inscription.
 * `retention[n]` = part des inscrits du jour ayant eu une action (session ou
 * contenu) exactement n jours après. J0/J7/J30 sont les chiffres de la roadmap.
 */
export function computeRetention(events: readonly RawEvent[], days = 30): {
  cohorts: { day: string; size: number; retention: Record<number, number> }[];
} {
  const signups = new Map<string, string>(); // anonId → jour d'inscription
  for (const e of events) {
    if (e.name === "signup" && e.anonId && !signups.has(e.anonId)) signups.set(e.anonId, e.day);
  }

  // anonId → ensemble de jours actifs
  const activeDays = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.anonId || (e.name !== "session_completed" && e.name !== "first_content_viewed")) continue;
    if (!activeDays.has(e.anonId)) activeDays.set(e.anonId, new Set());
    activeDays.get(e.anonId)!.add(e.day);
  }

  const byCohort = new Map<string, string[]>();
  for (const [anonId, day] of signups) {
    if (!byCohort.has(day)) byCohort.set(day, []);
    byCohort.get(day)!.push(anonId);
  }

  const cohorts = [...byCohort.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, members]) => {
      const retention: Record<number, number> = {};
      const base = Date.parse(`${day}T00:00:00Z`);
      for (let offset = 0; offset <= days; offset += 1) {
        const target = new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
        const active = members.filter((id) => activeDays.get(id)?.has(target)).length;
        retention[offset] = members.length ? Math.round((1000 * active) / members.length) / 10 : 0;
      }
      return { day, size: members.length, retention };
    });

  return { cohorts };
}

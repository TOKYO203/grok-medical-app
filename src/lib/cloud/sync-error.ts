/**
 * Diagnostic des erreurs Supabase/PostgREST — module PUR (testable sous Node).
 *
 * Pourquoi ce module existe : `supabase-js` renvoie les erreurs Postgres sous
 * forme d'objet (`code`, `message`, `hint`), et un code comme `42501` signifie
 * « droits manquants » — un problème de CONFIGURATION du projet, que rien dans
 * l'interface ne distingue d'une simple panne réseau. Sans ce diagnostic, la
 * synchronisation échouait en silence et l'utilisateur ne pouvait pas savoir que
 * sa progression n'était pas enregistrée.
 */

export type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

export type SyncErrorKind =
  | "offline"
  | "permissions"
  | "missing-table"
  | "conflict"
  | "auth"
  | "unknown";

export type SyncErrorDiagnosis = {
  kind: SyncErrorKind;
  /** Message court, destiné à l'interface (jamais un dump technique). */
  message: string;
  /** Vrai quand seule une action côté projet Supabase peut débloquer la situation. */
  configuration: boolean;
};

/** Codes PostgREST/PostgreSQL qui signalent un problème de configuration. */
const PERMISSION_CODES = new Set(["42501", "42P01", "PGRST205", "PGRST301", "PGRST302"]);

export function diagnoseSyncError(error: SupabaseErrorLike, target = "les données"): SyncErrorDiagnosis {
  const code = (error?.code ?? "").toUpperCase();
  const message = (error?.message ?? "").toLowerCase();

  if (code === "42501" || /permission denied/.test(message)) {
    return {
      kind: "permissions",
      // Volontairement sans jargon SQL : l'utilisateur doit comprendre que rien
      // n'est perdu. Le code Postgres et le remède restent dans `console.warn`
      // et dans `docs/supabase/002-grants.sql`.
      message:
        `Supabase n'autorise pas encore l'enregistrement de ${target} pour ce compte : ` +
        "un réglage du projet est manquant. Rien n'est perdu, tout reste sur cet appareil.",
      configuration: true,
    };
  }

  if (PERMISSION_CODES.has(code) || /does not exist|not found/.test(message)) {
    return {
      kind: "missing-table",
      message:
        `La table Supabase de ${target} est introuvable ou non exposée à l'API. ` +
        "La progression reste sur cet appareil.",
      configuration: true,
    };
  }

  if (code === "23505" || /duplicate key|conflict/.test(message)) {
    return {
      kind: "conflict",
      message: `Conflit d'écriture sur ${target} ; la synchronisation sera retentée.`,
      configuration: false,
    };
  }

  if (code === "PGRST116" || /jwt|token|unauthorized|invalid claim/.test(message)) {
    return {
      kind: "auth",
      message: `La session cloud a expiré : reconnectez-vous pour reprendre la synchronisation de ${target}.`,
      configuration: false,
    };
  }

  if (/failed to fetch|network|offline|timeout/.test(message)) {
    return {
      kind: "offline",
      message: `Réseau indisponible : ${target} seront synchronisées au retour de la connexion.`,
      configuration: false,
    };
  }

  return {
    kind: "unknown",
    message: `La synchronisation de ${target} a échoué ; elle sera retentée automatiquement.`,
    configuration: false,
  };
}

/** Table lisible par un humain (utilisée dans les messages ci-dessus). */
export function syncTargetLabel(table: "progressions" | "profiles"): string {
  return table === "progressions" ? "la progression" : "le profil";
}

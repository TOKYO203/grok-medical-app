/**
 * Sujets — le pont entre un item officiel et tout ce qui le traite.
 *
 * Problème résolu : le dépôt contient 46 decks, 1 démarche enrichie, 5 cas,
 * 23 ECG, 10 sons et 78 scores. Ces contenus vivent dans des routes séparées ;
 * l'étudiant qui veut « travailler le SCA » ne sait pas qu'il existe aussi un
 * cas clinique, deux ECG et trois scores de risque sur le même sujet.
 * Un *sujet* relie ces morceaux : c'est la page `/sujet/<slug>`.
 *
 * ## Ce fichier est écrit à la main, volontairement
 *
 * Aucune déduction dynamique, aucun parsing d'identifiants : les tables
 * ci-dessous sont la **décision éditoriale**. Si un deck est renommé ou
 * supprimé, ce fichier devient faux — c'est justement pour ça qu'il est
 * versionné et relu, et qu'un garde-fou (`scripts/sujet-page.test.mjs`)
 * vérifie que chaque identifiant référencé existe réellement.
 *
 * ## `itemsOfficiels` : numérotation GLOBALE 1 → 240
 *
 * Le référentiel `src/content/data/programmes/madagascar-2025.json` numérote
 * ses items **par section** (`n` repart à 1 dans chacune) ; `/programme`
 * affiche ce `n` local. Ici, pour rester dans un espace de nombres unique et
 * vérifiable (« plage 1-240 »), on utilise l'ordinal **global** du fichier :
 *
 *   sémiologie  1 →  41   (41 items)
 *   médecine   42 → 175   (134 items)  → global = 41 + n
 *   chirurgie 176 → 240   ( 65 items)  → global = 175 + n
 *
 * Exemple : « Infarctus du myocarde » est `n = 20` de la section médecine →
 * ordinal global `61`. Un item peut appartenir à plusieurs sujets (la dyspnée
 * sert à l'insuffisance cardiaque comme à l'OAP) : ce n'est pas un doublon,
 * c'est un carrefour.
 *
 * ## Périmètre de cette première version
 *
 * Les 7 séries de l'escalier de cardiologie (branches du curriculum portant
 * ≥ 2 decks) + l'AVC, seul sujet hors cardiologie qui réunit déjà un deck, un
 * cas, un ECG et trois scores. Les 10 decks isolés (anatomie, physio, semio,
 * pharmaco, cardio, neuro, infectio, tropical, dermato, urgences) restent
 * accessibles par `/parcours` et `/bibliotheque` ; ils rejoindront des sujets
 * quand le découpage sera validé.
 *
 * Module **pur** : aucun import, aucune dépendance à `window`, donc lisible
 * au build, au SSR et sous `node --experimental-strip-types`.
 */

/**
 * Score rattaché au sujet.
 *
 * Le libellé est écrit **ici** (et non importé du registre des calculateurs) :
 * la page sujet n'a besoin que d'un identifiant et d'un nom, alors que le
 * registre embarque les 78 scores *avec leurs fonctions de calcul* (~130 Kio).
 * `sujets.test.ts` vérifie que ce libellé est exactement celui du registre —
 * la donnée reste donc alignée sans être chargée.
 */
export type SujetCalcul = { id: string; label: string };

export type Sujet = {
  slug: string;
  label: string;
  specialty: string;
  /** Ordinals globaux 1 → 240 du référentiel national (cf. en-tête). */
  itemsOfficiels: number[];
  /** Ids de decks (`src/content/data/decks.json`). */
  decks: string[];
  /** Ids de démarches (`DX-…`, manifeste `demarches/_index.json`). */
  demarches: string[];
  /** Ids de cas cliniques (`src/content/data/cases.json`). */
  cases: string[];
  /** Ids d'ECG (`src/content/data/ecg/_index.json`). */
  ecg: string[];
  /** Ids de sons (`src/content/data/auscultation/_index.json`). */
  auscultation: string[];
  /** Scores (`src/content/calculators/scores/*.ts`) : identifiant + libellé du registre. */
  calculateurs: SujetCalcul[];
};

export const SUJETS: Record<string, Sujet> = {
  sca: {
    slug: "sca",
    label: "Syndrome coronarien aigu",
    specialty: "Cardiologie",
    itemsOfficiels: [10, 61, 97],
    decks: ["cardio-sca-l2", "cardio-sca-l3", "cardio-sca-l4", "cardio-sca-l5", "cardio-sca-int"],
    demarches: ["DX-THORAX-001"],
    cases: ["CARDIO-SCA-001"],
    ecg: ["ecg-1-2-idm-etalonnage", "ecg-4-6-pacemaker-idm"],
    auscultation: [],
    calculateurs: [
      { id: "grace", label: "GRACE — SCA" },
      { id: "timi-ua-nstemi", label: "TIMI — UA/NSTEMI" },
      { id: "killip", label: "Killip — IDM" },
    ],
  },

  ic: {
    slug: "ic",
    label: "Insuffisance cardiaque",
    specialty: "Cardiologie",
    itemsOfficiels: [11, 15, 62],
    decks: ["cardio-ic-l2", "cardio-ic-l3", "cardio-ic-l4", "cardio-ic-l5", "cardio-ic-int"],
    demarches: [],
    cases: ["CARDIO-IC-001"],
    ecg: [],
    auscultation: ["b3-galop", "b4-galop"],
    calculateurs: [{ id: "nyha", label: "NYHA — Dyspnée fonctionnelle" }],
  },

  hta: {
    slug: "hta",
    label: "Hypertension artérielle",
    specialty: "Cardiologie",
    itemsOfficiels: [66, 73, 86, 99],
    decks: ["cardio-hta-l2", "cardio-hta-l3", "cardio-hta-l4", "cardio-hta-l5", "cardio-hta-int"],
    demarches: [],
    cases: [],
    ecg: [],
    auscultation: [],
    calculateurs: [],
  },

  fa: {
    slug: "fa",
    label: "Fibrillation atriale",
    specialty: "Cardiologie",
    // Aucun item du référentiel 2025 ne nomme la FA : en inventer un serait
    // pire que de laisser la liste vide. Le sujet vit par ses decks, son ECG
    // et ses deux scores.
    itemsOfficiels: [],
    decks: ["cardio-fa-l2", "cardio-fa-l3", "cardio-fa-l4", "cardio-fa-l5", "cardio-fa-int"],
    demarches: [],
    cases: [],
    ecg: ["ecg-3-3-fa-oap"],
    auscultation: ["fa-rythme-irregulier"],
    calculateurs: [
      { id: "cha2ds2-vasc", label: "CHA₂DS₂-VASc" },
      { id: "has-bled", label: "HAS-BLED" },
    ],
  },

  valvulopathies: {
    slug: "valvulopathies",
    label: "Valvulopathies",
    specialty: "Cardiologie",
    itemsOfficiels: [93, 94, 95, 98, 173],
    decks: ["cardio-valv-l2", "cardio-valv-l3", "cardio-valv-l4", "cardio-valv-l5", "cardio-valv-int"],
    demarches: [],
    cases: [],
    ecg: [],
    auscultation: [
      "souffle-ejection-aortique",
      "insuffisance-mitrale",
      "insuffisance-aortique",
      "retrecissement-mitral",
    ],
    calculateurs: [],
  },

  arret: {
    slug: "arret",
    label: "Arrêt cardiaque",
    specialty: "Cardiologie",
    itemsOfficiels: [13],
    decks: [
      "cardio-arret-l2",
      "cardio-arret-l3",
      "cardio-arret-l4",
      "cardio-arret-l5",
      "cardio-arret-int",
    ],
    demarches: [],
    cases: [],
    // La TV et les torsades sont les rythmes de l'algorithme ACLS : ils
    // s'entraînent ici, pas dans un sujet « troubles du rythme » inexistant.
    ecg: ["ecg-3-7-tv", "ecg-3-8-torsades"],
    auscultation: [],
    calculateurs: [{ id: "glasgow", label: "Glasgow (GCS)" }],
  },

  oap: {
    slug: "oap",
    label: "Œdème aigu du poumon",
    specialty: "Cardiologie",
    itemsOfficiels: [64],
    decks: ["cardio-oap-l2", "cardio-oap-l3", "cardio-oap-l4", "cardio-oap-l5", "cardio-oap-int"],
    demarches: [],
    cases: [],
    ecg: ["ecg-3-3-fa-oap"],
    auscultation: ["b3-galop"],
    calculateurs: [],
  },

  avc: {
    slug: "avc",
    label: "Accident vasculaire cérébral",
    specialty: "Neurologie",
    itemsOfficiels: [153, 154],
    decks: ["neuro-avc-l2"],
    demarches: [],
    cases: ["NEURO-AVC-001"],
    ecg: ["ecg-5-8-hemorragie-cerebrale"],
    auscultation: [],
    calculateurs: [
      { id: "glasgow", label: "Glasgow (GCS)" },
      { id: "nihss", label: "NIHSS — AVC" },
      { id: "rankin-modifiee", label: "Rankin modifiée (mRS)" },
    ],
  },
};

/** Ordre d'affichage des sujets dans le hub `/sujet`. */
const SLUG_ORDER = Object.keys(SUJETS);

/** Tous les sujets, dans l'ordre de déclaration du fichier. */
export function listSujets(): Sujet[] {
  return SLUG_ORDER.map((slug) => SUJETS[slug]);
}

/** Résolution par slug — `undefined` si le sujet n'existe pas (page « introuvable »). */
export function getSujet(slug: string): Sujet | undefined {
  return SUJETS[slug];
}

/** Index inverse `deckId → sujet`, dérivé des tables ci-dessus (aucune donnée en double). */
const SUJET_BY_DECK: Map<string, Sujet> = (() => {
  const map = new Map<string, Sujet>();
  for (const sujet of listSujets()) {
    for (const deckId of sujet.decks) map.set(deckId, sujet);
  }
  return map;
})();

/** Sujet qui traite ce deck (un deck n'appartient qu'à un sujet). */
export function sujetForDeck(deckId: string): Sujet | undefined {
  return SUJET_BY_DECK.get(deckId);
}

/** Slug du sujet traitant ce deck — sert aux liens « Voir le sujet » des cartes. */
export function sujetSlugForDeck(deckId: string): string | undefined {
  return SUJET_BY_DECK.get(deckId)?.slug;
}

/** Sujet partageant la même spécialité (découverte latérale), hors sujet courant. */
export function siblingSujets(sujet: Sujet): Sujet[] {
  return listSujets().filter(
    (candidate) => candidate.slug !== sujet.slug && candidate.specialty === sujet.specialty,
  );
}

/** Nombre total de contenus rattachés (toutes natures confondues). */
export function sujetContentCount(sujet: Sujet): number {
  return (
    sujet.itemsOfficiels.length +
    sujet.decks.length +
    sujet.demarches.length +
    sujet.cases.length +
    sujet.ecg.length +
    sujet.auscultation.length +
    sujet.calculateurs.length
  );
}

/** Sujets groupés par spécialité, dans l'ordre de déclaration. */
export function sujetsBySpecialty(): { specialty: string; sujets: Sujet[] }[] {
  const groups: { specialty: string; sujets: Sujet[] }[] = [];
  for (const sujet of listSujets()) {
    const group = groups.find((candidate) => candidate.specialty === sujet.specialty);
    if (group) group.sujets.push(sujet);
    else groups.push({ specialty: sujet.specialty, sujets: [sujet] });
  }
  return groups;
}

/**
 * Statistiques du hub `/sujet`, comptées sur la seule donnée éditoriale :
 * le hub s'affiche donc sans charger un catalogue ni le store.
 */
export function sujetHubStats() {
  const sujets = listSujets();
  return {
    sujets: sujets.length,
    decks: sujets.reduce((sum, sujet) => sum + sujet.decks.length, 0),
    linked: sujets.reduce(
      (sum, sujet) =>
        sum +
        sujet.cases.length +
        sujet.demarches.length +
        sujet.ecg.length +
        sujet.auscultation.length +
        sujet.calculateurs.length,
      0,
    ),
    items: sujets.reduce((sum, sujet) => sum + sujet.itemsOfficiels.length, 0),
  };
}

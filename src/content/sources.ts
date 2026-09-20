/**
 * Registre de sources vérifiables.
 * Chaque deck cite 3-5 sources officielles, vérifiables par les étudiants.
 */

export type SourceType =
  | "guideline"
  | "meta-analysis"
  | "reference"
  | "trial"
  | "textbook";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  guideline: "Recommandation",
  "meta-analysis": "Méta-analyse",
  reference: "Référentiel",
  trial: "Essai clinique",
  textbook: "Manuel",
};

export type VerifiableSource = {
  id: string;
  type: SourceType;
  organization: string;
  title: string;
  year: number;
  url?: string;
  doi?: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
};

export const VERIFIED_SOURCES: Record<string, VerifiableSource> = {
  // === Cardiologie ===
  "esc-2023-acs": {
    id: "esc-2023-acs",
    type: "guideline",
    organization: "ESC",
    title: "2023 ESC Guidelines for the management of acute coronary syndromes",
    year: 2023,
    url: "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Acute-Coronary-Syndromes-ACS-Guidelines",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
  "esc-2023-heart-failure": {
    id: "esc-2023-heart-failure",
    type: "guideline",
    organization: "ESC",
    title: "2023 Focused Update on Heart Failure",
    year: 2023,
    url: "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Heart-Failure",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
  "esc-2024-aortic": {
    id: "esc-2024-aortic",
    type: "guideline",
    organization: "ESC",
    title: "2024 ESC Guidelines for the management of aortic diseases",
    year: 2024,
    url: "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Aortic-Diseases",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
  "has-2022-sca": {
    id: "has-2022-sca",
    type: "guideline",
    organization: "HAS",
    title: "Prise en charge du syndrome coronarien aigu",
    year: 2022,
    url: "https://www.has-sante.fr/",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
  "sfc-2023-referentiel": {
    id: "sfc-2023-referentiel",
    type: "reference",
    organization: "SFC",
    title: "Référentiel de cardiologie — Collège National des Enseignants",
    year: 2023,
    url: "https://www.sfcardio.fr/",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
  "who-2024-cardiovascular": {
    id: "who-2024-cardiovascular",
    type: "guideline",
    organization: "OMS",
    title: "Cardiovascular diseases — prevention and control",
    year: 2024,
    url: "https://www.who.int/health-topics/cardiovascular-diseases",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },

  // === Neurologie ===
  "esо-2023-stroke": {
    id: "esо-2023-stroke",
    type: "guideline",
    organization: "ESO",
    title: "European Stroke Organisation Guidelines",
    year: 2023,
    url: "https://eso-stroke.org/",
    verified: true,
    verifiedBy: "À valider par un médecin senior",
    verifiedAt: "2026-09-20",
  },
};

export function getSource(id: string): VerifiableSource | undefined {
  return VERIFIED_SOURCES[id];
}

export function getSources(ids: string[]): VerifiableSource[] {
  return ids.map((id) => VERIFIED_SOURCES[id]).filter(Boolean);
}

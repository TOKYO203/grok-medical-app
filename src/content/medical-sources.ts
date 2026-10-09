export type SourceCategory =
  | "guideline" | "terminology" | "rare-disease" | "drug"
  | "reference-book" | "imagery" | "meta-portal";

export type MedicalSource = {
  id: string;
  label: string;
  short: string;
  url: string;
  category: SourceCategory;
  authority: "international" | "france" | "reference";
  citationFormat: string;
  lang: "fr" | "en";
};

export const MEDICAL_SOURCES: Record<string, MedicalSource> = {
  HAS:       { id: "HAS",       label: "Haute Autorité de Santé",                   short: "HAS",         url: "https://www.has-sante.fr",               category: "guideline",     authority: "france",        citationFormat: "HAS, [titre], [année]",                        lang: "fr" },
  ANSM:      { id: "ANSM",      label: "ANSM — Thésaurus médicaments",              short: "ANSM",        url: "https://ansm.sante.fr",                  category: "drug",          authority: "france",        citationFormat: "ANSM, [titre], [année]",                       lang: "fr" },
  OMS:       { id: "OMS",       label: "Organisation Mondiale de la Santé",         short: "OMS",         url: "https://www.who.int/fr",                 category: "guideline",     authority: "international", citationFormat: "OMS, [titre], [année]",                        lang: "fr" },
  ESC:       { id: "ESC",       label: "European Society of Cardiology",            short: "ESC",         url: "https://www.escardio.org",               category: "guideline",     authority: "international", citationFormat: "ESC Guidelines, [titre], [année]",              lang: "en" },
  ORPHANET:  { id: "ORPHANET",  label: "Orphanet — Maladies rares",                 short: "Orphanet",    url: "https://www.orpha.net",                  category: "rare-disease",  authority: "france",        citationFormat: "Orphanet, [maladie], ORPHA:[numéro]",          lang: "fr" },
  OMIM:      { id: "OMIM",      label: "Online Mendelian Inheritance in Man",       short: "OMIM",        url: "https://www.omim.org",                   category: "rare-disease",  authority: "international", citationFormat: "OMIM, [numéro], [année]",                      lang: "en" },
  SNOMED:    { id: "SNOMED",    label: "SNOMED CT",                                 short: "SNOMED",      url: "https://browser.ihtsdotools.org",        category: "terminology",   authority: "international", citationFormat: "SNOMED CT, concept [ID]",                      lang: "en" },
  CIM10:     { id: "CIM10",     label: "CIM-10 (OMS)",                              short: "CIM-10",      url: "https://icd.who.int/browse10",           category: "terminology",   authority: "international", citationFormat: "CIM-10, code [XXX]",                           lang: "fr" },
  CIM11:     { id: "CIM11",     label: "CIM-11 (OMS)",                              short: "CIM-11",      url: "https://icd.who.int/browse11",           category: "terminology",   authority: "international", citationFormat: "CIM-11, code [XXX]",                           lang: "fr" },
  MESH:      { id: "MESH",      label: "Medical Subject Headings",                  short: "MeSH",        url: "https://meshb.nlm.nih.gov",              category: "terminology",   authority: "international", citationFormat: "MeSH, [terme]",                                lang: "en" },
  HETOP:     { id: "HETOP",     label: "HeTOP — Terminologies de santé",            short: "HeTOP",       url: "https://www.hetop.eu",                   category: "meta-portal",   authority: "france",        citationFormat: "HeTOP, [concept]",                             lang: "fr" },
  ACADEMIE:  { id: "ACADEMIE",  label: "Dictionnaire Académie Nationale de Médecine", short: "Acad. Méd.", url: "https://dictionnaire.academie-medecine.fr", category: "reference-book", authority: "france",    citationFormat: "Acad. Nat. Méd., [terme]",                     lang: "fr" },
  RADIOPAEDIA: { id: "RADIOPAEDIA", label: "Radiopaedia — Imagerie",                short: "Radiopaedia", url: "https://radiopaedia.org",                category: "imagery",       authority: "reference",     citationFormat: "Radiopaedia, [case], [URL]",                   lang: "en" },
};

export const SOURCE_CATEGORY_LABEL: Record<SourceCategory, string> = {
  guideline: "Recommandation",
  terminology: "Terminologie",
  "rare-disease": "Maladie rare",
  drug: "Médicament",
  "reference-book": "Ouvrage de référence",
  imagery: "Imagerie",
  "meta-portal": "Portail",
};

export type SourceId = keyof typeof MEDICAL_SOURCES;

export function getSource(id: string): MedicalSource | undefined {
  return MEDICAL_SOURCES[id];
}

export function listSources(): MedicalSource[] {
  return Object.values(MEDICAL_SOURCES);
}

export type QuestionCitation = {
  sourceId: SourceId | string;
  title: string;
  year?: number;
  url?: string;
  page?: string;
};

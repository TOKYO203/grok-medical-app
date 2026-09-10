import type { Source } from "@/core/types";

const REVIEW_DATE = "2026-09-09";
const NEURO_REVIEW_DATE = "2026-09-10";

type SourceRule = {
  matches: (source: Source) => boolean;
  metadata: Partial<Source>;
};

const SOURCE_RULES: SourceRule[] = [
  {
    matches: (source) =>
      source.title === "ESC" && source.citation.includes("acute coronary syndromes"),
    metadata: {
      organization: "European Society of Cardiology",
      year: 2023,
      version: "2023",
      url: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/acute-coronary-syndromes/",
      doi: "10.1093/eurheartj/ehad191",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) => source.title === "ESC" && source.citation.includes("atrial fibrillation"),
    metadata: {
      organization: "European Society of Cardiology",
      year: 2024,
      version: "2024",
      url: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/atrial-fibrillation/",
      doi: "10.1093/eurheartj/ehae176",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "ESC" && source.citation.includes("management of heart failure"),
    metadata: {
      organization: "European Society of Cardiology",
      year: 2026,
      version: "2026",
      url: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/heart-failure/",
      doi: "10.1093/eurheartj/ehag100",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "ESC" && source.citation.includes("valvular heart disease"),
    metadata: {
      organization: "European Society of Cardiology",
      year: 2025,
      version: "2025",
      url: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/valvular-heart-disease/",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "OMS" && source.citation.includes("WHO guidelines for malaria"),
    metadata: {
      organization: "Organisation mondiale de la Santé",
      year: 2025,
      version: "13 août 2025",
      url: "https://www.who.int/publications-detail-redirect/guidelines-for-malaria",
      doi: "10.2471/B09514",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "AHA / ASA" &&
      source.citation.includes("2026 Guideline for the Early Management"),
    metadata: {
      organization: "American Heart Association / American Stroke Association",
      year: 2026,
      version: "2026",
      url: "https://professional.heart.org/en/science-news/2026-guideline-for-the-early-management-of-patients-with-acute-ischemic-stroke",
      doi: "10.1161/STR.0000000000000513",
      verifiedAt: REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "ILAE" && source.citation.includes("definition and classification"),
    metadata: {
      organization: "International League Against Epilepsy",
      year: 2015,
      version: "ILAE 2015",
      url: "https://pubmed.ncbi.nlm.nih.gov/26336950/",
      doi: "10.1111/epi.13121",
      verifiedAt: NEURO_REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "American Epilepsy Society" &&
      source.citation.includes("Treatment of Convulsive Status Epilepticus"),
    metadata: {
      organization: "American Epilepsy Society",
      year: 2016,
      version: "AES 2016",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4749120/",
      doi: "10.5698/1535-7597-16.1.48",
      verifiedAt: NEURO_REVIEW_DATE,
    },
  },
  {
    matches: (source) =>
      source.title === "MGFA" && source.citation.includes("International Consensus Guidance"),
    metadata: {
      organization: "Myasthenia Gravis Foundation of America",
      year: 2016,
      version: "Consensus international 2016",
      url: "https://myasthenia.org/myasthenia-gravis-treatments/",
      doi: "10.1212/WNL.0000000000002790",
      verifiedAt: NEURO_REVIEW_DATE,
    },
  },
];

export function enrichSource(source: Source): Source {
  const rule = SOURCE_RULES.find((candidate) => candidate.matches(source));
  return rule ? { ...source, ...rule.metadata } : source;
}

export function enrichSources(sources: Source[]): Source[] {
  return sources.map(enrichSource);
}

export function sourceHref(source: Source): string | null {
  if (source.url?.startsWith("https://")) return source.url;
  if (source.doi) return `https://doi.org/${source.doi}`;
  return null;
}

export function latestSourceReview(sources: Source[]): string | null {
  const dates = sources
    .map((source) => source.verifiedAt)
    .filter((date): date is string => typeof date === "string")
    .filter((date) => !Number.isNaN(Date.parse(date)))
    .sort();
  return dates.at(-1) ?? null;
}

export function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

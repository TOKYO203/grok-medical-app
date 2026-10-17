// Phase 4 — UX « navigation classée » : configuration unique de la navigation.
// Le shell desktop, le tiroir mobile et la palette de commandes consomment tous
// cette même taxonomie : chaque surface de l'app y est rangée dans un groupe
// avec sa clé i18n — une seule source, systématique et cohérente.
import {
  Activity,
  AudioWaveform,
  Brain,
  BadgePercent,
  BookMarked,
  BookOpen,
  Calculator,
  ClipboardCheck,
  Compass,
  HeartPulse,
  Home,
  Layers3,
  Library,
  RotateCcw,
  Stethoscope,
  Trophy,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavEntry = {
  /** Cible de la route (déclarée sous src/routes/). */
  to: string;
  /** Clé i18n du libellé complet. */
  labelKey: string;
  /** Clé i18n du libellé court (barre mobile). */
  shortKey?: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** Clé i18n du titre du groupe (kicker de section). */
  labelKey: string;
  items: readonly NavEntry[];
};

/** Onglets principaux : barre mobile en bas + premier bloc de la sidebar. */
export const NAV = [
  { to: "/", labelKey: "nav.home", shortKey: "nav.homeShort", icon: Home },
  { to: "/demarche", labelKey: "nav.orientation", shortKey: "nav.orientationShort", icon: Compass },
  { to: "/cas", labelKey: "nav.cases", shortKey: "nav.casesShort", icon: Stethoscope },
  { to: "/programme", labelKey: "nav.nosography", shortKey: "nav.nosographyShort", icon: BookMarked },
  { to: "/profil", labelKey: "nav.profile", shortKey: "nav.profileShort", icon: UserRound },
] as const satisfies readonly NavEntry[];

/*
 * Surfaces secondaires, classées en groupes (Phase 4 : « tout est rangé »).
 * Chaque entrée expose une page réelle : plus aucun recoin de l'app n'est
 * accessible uniquement par un lien au fil d'une page ou par la palette.
 */
export const EXPLORE_GROUPS = [
  {
    labelKey: "nav.group.learn",
    items: [
      { to: "/bibliotheque", labelKey: "nav.library", icon: Library },
      { to: "/sujet", labelKey: "nav.sujets", icon: BookOpen },
      { to: "/parcours", labelKey: "nav.parcours", icon: Layers3 },
      { to: "/revue", labelKey: "nav.review", icon: RotateCcw },
    ],
  },
  {
    labelKey: "nav.group.train",
    items: [
      { to: "/ecg", labelKey: "nav.ecgCases", icon: Activity },
      { to: "/demo-ecg", labelKey: "nav.animatedEcg", icon: HeartPulse },
      { to: "/auscultation", labelKey: "nav.auscultation", icon: AudioWaveform },
      { to: "/signes", labelKey: "nav.signes", icon: Brain },
      { to: "/examen", labelKey: "nav.mockExam", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.group.tools",
    items: [
      { to: "/calculateurs", labelKey: "nav.calculators", icon: Calculator },
      { to: "/import", labelKey: "nav.importDeck", icon: Upload },
    ],
  },
  {
    labelKey: "nav.group.community",
    items: [
      { to: "/classement", labelKey: "nav.leaderboard", icon: Trophy },
      { to: "/tarifs", labelKey: "nav.pricing", icon: BadgePercent },
    ],
  },
] as const satisfies readonly NavGroup[];

/** État actif partagé : exact pour la racine, préfixé pour les pages enfants. */
export function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { CLINICAL_CASES, DIAGNOSTIC_CASES, BUILTIN_DECKS } from "@/content/catalog";
import { BADGE_CATALOG } from "@/content/badges";
import { EXPLORE_GROUPS, NAV } from "@/lib/navigation";
import { useI18n } from "@/i18n";

/*
 * Palette de commandes (Phase 4 — UX « navigation classée ») :
 *  - les pages viennent de la configuration centrale src/lib/navigation.ts ;
 *  - les résultats sont groupés par type dans un ordre de sections fixe ;
 *  - requête vide = plan du site classé (pages uniquement).
 */
type ItemKind = "case" | "diagnostic" | "deck" | "badge" | "page";

type PaletteItem = {
  id: string;
  kind: ItemKind;
  title: string;
  /** Clé i18n du libellé (pages de navigation) — prioritaire sur `title`. */
  labelKey?: string;
  subtitle?: string;
  keywords?: string;
  to: string;
};

/** Mots-clés de recherche (fr + en) pour chaque page de la navigation. */
const PAGE_KEYWORDS: Record<string, string> = {
  "/": "home accueil dashboard tableau de bord",
  "/demarche": "orientation démarches diagnostiques diagnostic guide",
  "/cas": "cas cliniques cases",
 "/programme": "nosographie programme national référentiel items concours internat",
  "/profil": "profil compte badges stats",
  "/bibliotheque": "bibliothèque library catalogue content decks cas",
  "/parcours": "parcours decks cartes pathways spécialités",
  "/revue": "réviser review répétition espacée session",
 "/ecg": "ecg électrocardiogramme interprétation cas",
 "/demo-ecg": "ecg animé moniteur simulateur",
 "/auscultation": "auscultation murmures cardio pulmo",
  "/examen": "examen blanc mock exam",
  "/calculateurs": "calculateurs scores cliniques",
 "/import": "importer deck import",
 "/classement": "classement leaderboard ligue",
 "/donnees": "mes données export rgpd privacy",
  "/a-propos": "à propos about outil éducatif",
  "/contact": "contact aide support",
  "/soutenir": "soutenir contribuer don support",
  "/pro": "premium offres decks",
};

/** Pages hors navigation principale ou secondaire, toujours recherchables. */
const EXTRA_PAGES: PaletteItem[] = [
  { id: "page-donnees", kind: "page", labelKey: "nav.data", title: "", to: "/donnees", keywords: "export rgpd privacy data" },
  { id: "page-a-propos", kind: "page", labelKey: "nav.about", title: "", to: "/a-propos", keywords: "about tool" },
  { id: "page-contact", kind: "page", labelKey: "nav.contact", title: "", to: "/contact", keywords: "help support" },
  { id: "page-soutenir", kind: "page", labelKey: "nav.support", title: "", to: "/soutenir", keywords: "don contribute" },
  { id: "page-pro", kind: "page", labelKey: "nav.pro", title: "", to: "/pro", keywords: "premium offers unlock" },
];

/** Pages issues de la taxonomie centrale, dédupliquées par route. */
const NAV_PAGES: PaletteItem[] = [...NAV, ...EXPLORE_GROUPS.flatMap((group) => [...group.items])]
  .filter((item, index, all) => all.findIndex((other) => other.to === item.to) === index)
  .map((item) => ({
    id: "page-" + item.to,
    kind: "page",
    title: "",
    labelKey: item.labelKey,
    to: item.to,
    keywords: PAGE_KEYWORDS[item.to] ?? "",
  }));

function buildIndex(): PaletteItem[] {
  const cases: PaletteItem[] = CLINICAL_CASES.map((c) => ({
    id: "case-" + c.id,
    kind: "case",
    title: c.title,
    subtitle: c.specialty,
    keywords: c.specialty + " " + (c.difficulty ?? "") + " " + (c.summary ?? ""),
    to: "/cas/" + c.id,
  }));

  const diagnostics: PaletteItem[] = DIAGNOSTIC_CASES.map((d) => ({
    id: "dx-" + d.id,
    kind: "diagnostic",
    title: (d as { title?: string }).title ?? d.id,
    subtitle: (d as { specialty?: string }).specialty,
    keywords: ((d as { specialty?: string }).specialty ?? "") + " démarche diagnostic",
    to: "/demarche/" + d.id,
  }));

  const decks: PaletteItem[] = BUILTIN_DECKS.map((d) => ({
    id: "deck-" + d.id,
    kind: "deck",
    title: d.title ?? d.id,
    subtitle: (d as { description?: string }).description,
    keywords: d.id + " deck cartes",
    to: "/parcours/" + d.id,
  }));

  const badges: PaletteItem[] = BADGE_CATALOG.map((b) => ({
    id: "badge-" + b.id,
    kind: "badge",
    title: b.title,
    subtitle: b.detail,
    keywords: "badge achievement " + b.detail,
    to: "/profil",
  }));

  return [...NAV_PAGES, ...EXTRA_PAGES, ...cases, ...diagnostics, ...decks, ...badges];
}

function score(item: PaletteItem, q: string): number {
  if (!q) return 1;
  const haystack = (item.title + " " + (item.subtitle ?? "") + " " + (item.keywords ?? "")).toLowerCase();
  const needle = q.toLowerCase();
  if (!haystack.includes(needle)) return 0;
  let s = 1;
  if (item.title.toLowerCase().startsWith(needle)) s += 10;
  if (item.title.toLowerCase().includes(needle)) s += 5;
  if (item.kind === "page") s += 2;
  return s;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}

const KIND_EMOJI: Record<ItemKind, string> = {
  page: "🧭",
  case: "🩺",
  diagnostic: "📋",
  deck: "📚",
  badge: "🏆",
};

/** Ordre des sections : fixe et lisible, même entre deux recherches. */
const SECTION_ORDER: ItemKind[] = ["page", "case", "diagnostic", "deck", "badge"];

const SECTION_LABEL_KEY: Record<ItemKind, string> = {
  page: "palette.section.pages",
  case: "palette.section.cases",
  diagnostic: "palette.section.diagnostics",
  deck: "palette.section.decks",
  badge: "palette.section.badges",
};

const KIND_LABEL_KEY: Record<ItemKind, string> = {
  page: "palette.kind.page",
  case: "palette.kind.case",
  diagnostic: "palette.kind.diagnostic",
  deck: "palette.kind.deck",
  badge: "palette.kind.badge",
};

export function CommandPalette({ open: openProp, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const open = openProp;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(buildIndex, []);

  // Les pages portent une clé i18n : leur titre est résolu dans la langue active.
  const localized = useMemo(
    () => index.map((item) => (item.labelKey ? { ...item, title: t(item.labelKey) } : item)),
    [index, t],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      // Requête vide : la palette devient un plan du site classé.
      return localized.filter((item) => item.kind === "page");
    }
    return localized
      .map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.item);
  }, [localized, query]);

  // Résultats groupés par type, ordre de sections fixe, index global conservé
  // pour la navigation clavier.
  const sections = useMemo(() => {
    const byKind = new Map<ItemKind, PaletteItem[]>();
    for (const item of results) {
      const list = byKind.get(item.kind);
      if (list) list.push(item);
      else byKind.set(item.kind, [item]);
    }
    let start = 0;
    return SECTION_ORDER.filter((kind) => byKind.has(kind)).map((kind) => {
      const items = byKind.get(kind) as PaletteItem[];
      const section = { kind, items, start };
      start += items.length;
      return section;
    });
  }, [results]);

  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const pick = (item: PaletteItem) => {
    onClose();
    void navigate({ to: item.to });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      pick(flat[active]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("palette.placeholder")}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        {results.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("palette.empty")}</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            {sections.map((section) => (
              <section key={section.kind} aria-label={t(SECTION_LABEL_KEY[section.kind])}>
                <p className="sticky top-0 z-[1] border-b border-border/60 bg-card/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted backdrop-blur-sm">
                  {t(SECTION_LABEL_KEY[section.kind])}
                </p>
                <ul className="p-2">
                  {section.items.map((item, i) => {
                    const globalIndex = section.start + i;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => pick(item)}
                          onMouseEnter={() => setActive(globalIndex)}
                          className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left ${
                            globalIndex === active ? "bg-primary-soft" : "hover:bg-secondary"
                          }`}
                        >
                          <span className="text-lg" aria-hidden>{KIND_EMOJI[item.kind]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
                            {t(KIND_LABEL_KEY[item.kind])}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
          {t("palette.hint")}
        </div>
      </div>
    </div>
  );
}

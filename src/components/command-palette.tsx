import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { CLINICAL_CASES, DIAGNOSTIC_CASES, BUILTIN_DECKS } from "@/content/catalog";
import { BADGE_CATALOG } from "@/content/badges";

type ItemKind = "case" | "diagnostic" | "deck" | "badge" | "page";

type PaletteItem = {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle?: string;
  keywords?: string;
  to: string;
};

const PAGES: PaletteItem[] = [
  { id: "p-home", kind: "page", title: "Accueil", to: "/", keywords: "home dashboard" },
  { id: "p-cas", kind: "page", title: "Cas cliniques", to: "/cas", keywords: "cases cliniques" },
  { id: "p-parcours", kind: "page", title: "Parcours", to: "/parcours", keywords: "decks cartes" },
  { id: "p-revue", kind: "page", title: "Réviser", to: "/revue", keywords: "review spaced repetition" },
  { id: "p-profil", kind: "page", title: "Profil", to: "/profil", keywords: "compte badges stats" },
  { id: "p-calculateurs", kind: "page", title: "Calculateurs", to: "/calculateurs", keywords: "score calcul" },
  { id: "p-donnees", kind: "page", title: "Mes données", to: "/donnees", keywords: "export rgpd privacy" },
];

function buildIndex(): PaletteItem[] {
  const cases: PaletteItem[] = CLINICAL_CASES.map((c) => ({
    id: `case-${c.id}`,
    kind: "case",
    title: c.title,
    subtitle: c.specialty,
    keywords: `${c.specialty} ${c.difficulty ?? ""} ${c.summary ?? ""}`,
    to: `/cas/${c.id}`,
  }));

  const diagnostics: PaletteItem[] = DIAGNOSTIC_CASES.map((d) => ({
    id: `dx-${d.id}`,
    kind: "diagnostic",
    title: (d as { title?: string }).title ?? d.id,
    subtitle: (d as { specialty?: string }).specialty,
    keywords: `${(d as { specialty?: string }).specialty ?? ""} démarche diagnostic`,
    to: `/demarche/${d.id}`,
  }));

  const decks: PaletteItem[] = BUILTIN_DECKS.map((d) => ({
    id: `deck-${d.id}`,
    kind: "deck",
    title: d.title ?? d.id,
    subtitle: (d as { description?: string }).description,
    keywords: `${d.id} deck cartes`,
    to: `/parcours/${d.id}`,
  }));

  const badges: PaletteItem[] = BADGE_CATALOG.map((b) => ({
    id: `badge-${b.id}`,
    kind: "badge",
    title: b.title,
    subtitle: b.detail,
    keywords: `badge achievement ${b.detail}`,
    to: "/profil",
  }));

  return [...PAGES, ...cases, ...diagnostics, ...decks, ...badges];
}

function score(item: PaletteItem, q: string): number {
  if (!q) return 1;
  const haystack = `${item.title} ${item.subtitle ?? ""} ${item.keywords ?? ""}`.toLowerCase();
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

const KIND_LABEL: Record<ItemKind, string> = {
  page: "Page",
  case: "Cas",
  diagnostic: "Démarche",
  deck: "Deck",
  badge: "Badge",
};

const KIND_EMOJI: Record<ItemKind, string> = {
  page: "🧭",
  case: "🩺",
  diagnostic: "📋",
  deck: "📚",
  badge: "🏆",
};

export function CommandPalette({ open: openProp, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const open = openProp;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(buildIndex, []);

  const results = useMemo(() => {
    const q = query.trim();
    return index
      .map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.item);
  }, [index, query]);

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
      setActive((a) => Math.min(a + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      pick(results[active]);
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
            placeholder="Rechercher cas, démarches, badges…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">Aucun résultat</p>
          ) : (
            <ul className="p-2">
              {results.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left ${
                      i === active ? "bg-primary-soft" : "hover:bg-secondary"
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
                      {KIND_LABEL[item.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
          ↑↓ naviguer · Entrée ouvrir · Échap fermer · ⌘K rouvrir
        </div>
      </div>
    </div>
  );
}

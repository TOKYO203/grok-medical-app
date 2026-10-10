import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, HeartPulse, Lock, Square, Volume2, Wind } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  foyerById,
  getFiche,
  listFoyers,
  listSounds,
  type AuscultationFiche,
  type AuscultationFoyer,
  type AuscultationSoundEntry,
} from "@/lib/auscultation/catalog";
import { isSupported, playSound, stop } from "@/lib/auscultation/engine";

export const Route = createFileRoute("/auscultation")({ component: AuscultationPage });

const CATEGORIE_LABEL: Record<string, string> = {
  normal: "Normal",
  valvulopathie: "Valvulopathie",
  pericarde: "Péricarde",
  "trouble-rythme": "Trouble du rythme",
};

function AuscultationPage() {
  const [tab, setTab] = useState<"cardiaque" | "pulmonaire">("cardiaque");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Coupe tout son en cours au démontage de la page (navigation).
  useEffect(() => () => stop(), []);

  function selectSound(id: string) {
    stop();
    setPlaying(false);
    setSelectedId(id);
  }

  function changeTab(next: "cardiaque" | "pulmonaire") {
    stop();
    setPlaying(false);
    setTab(next);
  }

  function toggleListen(fiche: AuscultationFiche) {
    if (playing) {
      stop();
      setPlaying(false);
      return;
    }
    playSound(fiche.audio.preset, fiche.audio.params);
    setPlaying(true);
  }

  const fiche = selectedId ? getFiche(selectedId) : undefined;
  const sounds = listSounds();
  const foyers = listFoyers();

  return (
    <Shell title="Auscultation">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Sémiologie"
            title="Auscultation"
            description="Bruits du cœur synthétisés en temps réel : foyer, timing, timbre, manœuvres et pièges. Étape 1/3 — fiche pilote B1-B2."
          />
        }
      >
        {/* Onglets Cardiaque / Pulmonaire */}
        <div
          role="tablist"
          aria-label="Type d'auscultation"
          className="mb-5 inline-flex rounded-full bg-secondary p-1 shadow-[var(--shadow-border)]"
        >
          {(
            [
              ["cardiaque", "Cardiaque", HeartPulse],
              ["pulmonaire", "Pulmonaire", Wind],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => changeTab(value)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                tab === value
                  ? "bg-card text-fg shadow-[var(--shadow-soft)]"
                  : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {tab === "pulmonaire" ? (
          <EmptyPanel />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {/* Liste des fiches */}
            <div className={cn("space-y-2", selectedId && "hidden md:block")}>
              {sounds.map((entry) => (
                <SoundRow
                  key={entry.id}
                  entry={entry}
                  foyers={foyers}
                  selected={entry.id === selectedId}
                  onSelect={selectSound}
                />
              ))}
            </div>

            {/* Panneau détail */}
            <div className={cn(!selectedId && "hidden md:block")}>
              {fiche ? (
                <FicheDetail
                  fiche={fiche}
                  playing={playing}
                  canPlay={isSupported()}
                  onToggle={() => toggleListen(fiche)}
                  onBack={() => {
                    stop();
                    setPlaying(false);
                    setSelectedId(null);
                  }}
                />
              ) : (
                <div className="hidden h-full min-h-64 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center md:flex">
                  <div className="max-w-xs">
                    <p className="font-display text-lg font-medium">Choisissez une fiche</p>
                    <p className="mt-1 text-sm text-muted">
                      Sélectionnez un son dans la liste pour afficher son schéma de timing, son
                      timbre et ses pièges.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Page>
    </Shell>
  );
}

function SoundRow({
  entry,
  foyers,
  selected,
  onSelect,
}: {
  entry: AuscultationSoundEntry;
  foyers: AuscultationFoyer[];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const available = entry.status === "available";
  const foyerLabels = entry.foyers.map((id) => foyers.find((f) => f.id === id)?.short ?? id);

  const inner = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          available ? "bg-primary-soft text-primary" : "bg-secondary text-muted",
        )}
      >
        {available ? <HeartPulse className="size-5" /> : <Lock className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{entry.label}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="optimus-type-badge bg-secondary text-muted">
            {CATEGORIE_LABEL[entry.categorie] ?? entry.categorie}
          </span>
          {foyerLabels.slice(0, 3).map((label) => (
            <span key={label} className="optimus-type-badge bg-[#A67C1E]/15 text-accent">
              {label}
            </span>
          ))}
        </div>
      </div>
      {available ? (
        <ChevronRight className="mt-1 size-4 shrink-0 text-subtle" aria-hidden />
      ) : (
        <span className="mt-1 shrink-0 text-[10px] uppercase tracking-wider text-subtle">
          Bientôt
        </span>
      )}
    </div>
  );

  if (!available) {
    return (
      <div className="optimus-card p-4 opacity-70" aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "optimus-card optimus-interactive-card block w-full p-4 text-left active:scale-[0.99]",
        selected && "ring-1 ring-primary",
      )}
    >
      {inner}
    </button>
  );
}

function FicheDetail({
  fiche,
  playing,
  canPlay,
  onToggle,
  onBack,
}: {
  fiche: AuscultationFiche;
  playing: boolean;
  canPlay: boolean;
  onToggle: () => void;
  onBack: () => void;
}) {
  const params = fiche.audio.params as { systoleMs?: number; diastoleMs?: number };

  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg md:hidden"
      >
        <ChevronLeft className="size-3.5" aria-hidden /> Toutes les fiches
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="optimus-type-badge bg-secondary text-muted">
            {CATEGORIE_LABEL[fiche.categorie] ?? fiche.categorie}
          </span>
          <h2 className="mt-2 font-display text-xl font-medium tracking-tight">{fiche.label}</h2>
          <p className="mt-1 font-mono text-xs text-subtle">{fiche.timing.schema}</p>
        </div>
        <Button
          onClick={onToggle}
          disabled={!canPlay}
          aria-pressed={playing}
          className="shrink-0"
          data-auscultation-listen={playing ? "playing" : "idle"}
        >
          {playing ? (
            <>
              <Square className="size-4" aria-hidden /> Arrêter
            </>
          ) : (
            <>
              <Volume2 className="size-4" aria-hidden /> Écouter
            </>
          )}
        </Button>
      </div>

      <div className="mt-5">
        <SectionLabel>Schéma du timing</SectionLabel>
        <TimingStrip systoleMs={params.systoleMs} diastoleMs={params.diastoleMs} />
        <p className="mt-3 text-sm leading-relaxed text-fg">{fiche.timing.description}</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Foyers">
          <Chips items={fiche.foyer.map((id) => foyerById(id)?.label ?? id)} />
        </Field>
        <Field label="Phase">{fiche.timing.phase}</Field>
        <Field label="Timbre">{fiche.timbre}</Field>
        <Field label="Irradiation">{fiche.irradiation}</Field>
        <Field label="Palpation">{fiche.palpation}</Field>
        <Field label="Symptômes">
          <Chips items={fiche.symptomes} />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Manœuvres">
          <Bullets items={fiche.manoeuvres} />
        </Field>
        <Field label="Diagnostics associés">
          <Chips items={fiche.diagnostics_associes} />
        </Field>
        <Field label="Items du programme">
          <Chips items={fiche.items_programme} />
        </Field>
        <Field label="Pièges">
          <Bullets items={fiche.pieges} tone="warn" />
        </Field>
      </div>

      <p className="mt-5 border-t border-border pt-3 text-[11px] leading-relaxed text-subtle">
        Source : {fiche.source.reference} — {fiche.source.license}
      </p>
    </div>
  );
}

/** Frise B1 — systole — B2 — diastole, proportions issues des params audio. */
function TimingStrip({
  systoleMs = 340,
  diastoleMs = 480,
}: {
  systoleMs?: number;
  diastoleMs?: number;
}) {
  const total = Math.max(1, systoleMs + diastoleMs);
  const systolePct = (systoleMs / total) * 100;

  return (
    <div>
      <div className="flex items-stretch gap-1.5 rounded-[var(--radius-md)] bg-secondary p-2.5">
        <ClickMark label="B1" tone="primary" />
        <div className="flex min-w-0 flex-col justify-center" style={{ width: `${systolePct}%` }}>
          <div className="h-1 rounded-full bg-primary/50" />
          <span className="mt-1 truncate text-[9px] uppercase tracking-wider text-muted">
            systole
          </span>
        </div>
        <ClickMark label="B2" tone="accent" />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="h-1 rounded-full bg-[#A67C1E]/50" />
          <span className="mt-1 truncate text-[9px] uppercase tracking-wider text-muted">
            diastole
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-subtle">
        <span>Systole {systoleMs} ms</span>
        <span>Diastole {diastoleMs} ms</span>
      </div>
    </div>
  );
}

function ClickMark({ label, tone }: { label: string; tone: "primary" | "accent" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center rounded-full px-2 py-1 font-mono text-[10px] font-semibold shadow-[var(--shadow-border)]",
        tone === "primary" ? "bg-primary-soft text-primary" : "bg-[#A67C1E]/20 text-accent",
      )}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{children}</p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1 text-sm leading-relaxed text-fg">{children}</div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="optimus-type-badge bg-secondary text-muted">
          {item}
        </span>
      ))}
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: "warn" }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted">—</span>;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span
            aria-hidden
            className={cn(
              "mt-1.5 size-1.5 shrink-0 rounded-full",
              tone === "warn" ? "bg-accent" : "bg-primary",
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyPanel() {
  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-10 text-center shadow-[var(--shadow-border)]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted">
        <Wind className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-display text-lg font-medium">Auscultation pulmonaire</p>
      <p className="mt-1 text-sm text-muted">Module en préparation (étape 3/3).</p>
    </div>
  );
}

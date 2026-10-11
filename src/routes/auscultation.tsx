import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Lock,
  Square,
  Volume2,
  Wind,
} from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  foyerById,
  getFiche,
  getPulmonaireFiche,
  listFoyers,
  listPulmonaireSounds,
  listPulmonaireZones,
  listSounds,
  pulmonaireZoneById,
  type AuscultationFiche,
  type AuscultationFoyer,
  type AuscultationSoundEntry,
  type PulmonaireFiche,
  type PulmonaireSoundEntry,
  type PulmonaireZone,
} from "@/lib/auscultation/catalog";
import { isSupported, playLungSound, playSound, stop } from "@/lib/auscultation/engine";
import { buildCycle } from "@/lib/auscultation/phonocardiogram";
import { useMonitorPlayhead } from "@/lib/auscultation/useMonitorPlayhead";
import { MonitorControls } from "@/components/auscultation/MonitorControls";
import { ParamPanel } from "@/components/auscultation/ParamPanel";
import { PhonoSVG } from "@/components/auscultation/PhonoSVG";
import { TorsoView, type FoyerId } from "@/components/auscultation/TorsoView";

export const Route = createFileRoute("/auscultation")({ component: AuscultationPage });

const CATEGORIE_LABEL: Record<string, string> = {
  normal: "Normal",
  valvulopathie: "Valvulopathie",
  pericarde: "Péricarde",
  "trouble-rythme": "Trouble du rythme",
  craquement: "Craquement",
  continu: "Bruit continu",
  souffle: "Souffle",
};

function AuscultationPage() {
  const [tab, setTab] = useState<"cardiaque" | "pulmonaire">("cardiaque");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeFoyer, setActiveFoyer] = useState<FoyerId | null>(null);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);

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
    setSelectedId(null);
    setTab(next);
  }

  function toggleListen(preset: string, params: Record<string, number>, lung: boolean) {
    if (playing) {
      stop();
      setPlaying(false);
      return;
    }
    if (lung) playLungSound(preset, params);
    else playSound(preset, params);
    setPlaying(true);
  }

  const fiche = tab === "cardiaque" && selectedId ? getFiche(selectedId) : undefined;
  const pFiche = tab === "pulmonaire" && selectedId ? getPulmonaireFiche(selectedId) : undefined;

  const sounds = listSounds();
  const foyers = listFoyers();
  const pSounds = listPulmonaireSounds();
  const zones = listPulmonaireZones();

  // Son sélectionné (cardio ou pulmo) — pour le moniteur en haut de page
  // ⚠ listSounds() / listPulmonaireSounds() ne retournent QUE les
  // métadonnées d'index (id, label, foyer, zones) — SANS le champ `audio`.
  // Il faut donc charger la fiche complète via getFiche()/getPulmonaireFiche()
  // pour obtenir audio.preset. Sans ça, monitorPreset tombait toujours sur
  // "normal_s1s2" et le tracé n'affichait que B1/B2.
  const selectedEntryId =
    selectedId
    ?? (tab === "pulmonaire" ? pSounds[0]?.id : sounds[0]?.id)
    ?? null;
  const selectedEntry = selectedEntryId
    ? (tab === "pulmonaire"
        ? getPulmonaireFiche(selectedEntryId)
        : getFiche(selectedEntryId))
    : undefined;

  // Fallback : si aucune fiche sélectionnée, on prend le premier son de
  // l'onglet courant → le moniteur ne disparaît jamais au switch.
  const fallbackEntry = tab === "pulmonaire" ? pSounds[0] : sounds[0];
  const monitorEntry = selectedEntry ?? fallbackEntry;

  const monitorPreset =
    (monitorEntry as { audio?: { preset?: string } } | undefined)?.audio?.preset
    ?? (tab === "pulmonaire" ? "normal_vesicular" : "normal_s1s2");
  const monitorParams =
    (monitorEntry as { audio?: { params?: Record<string, number> } } | undefined)?.audio?.params
    ?? {};
  const monitorFoyer = (() => {
    if (activeFoyer) return activeFoyer;
    const f = (selectedEntry as { foyer?: string[]; zones?: string[] } | undefined);
    const first = (f?.foyer ?? f?.zones ?? [])[0];
    return (first as FoyerId | undefined) ?? null;
  })();
  const monitorCycle = buildCycle(monitorPreset);
  const playheadSec = useMonitorPlayhead(monitorCycle.durationSec, playing, rate);

  // Boucle audio : si loop est actif, on relance playSound à chaque fin de cycle.
  useEffect(() => {
    if (!playing || !loop || !monitorEntry) return;
    const periodMs = (monitorCycle.durationSec / rate) * 1000;
    const id = setInterval(() => {
      const e = monitorEntry as { audio?: { preset?: string; params?: Record<string, number> } };
      const preset = e.audio?.preset ?? monitorPreset;
      const params = e.audio?.params ?? {};
      if (tab === "pulmonaire") playLungSound(preset, params);
      else playSound(preset, params);
    }, periodMs);
    return () => clearInterval(id);
  }, [playing, loop, rate, monitorPreset, monitorEntry, monitorCycle.durationSec, tab]);


  const canPlay = isSupported();

  return (
    <Shell title="Auscultation">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Sémiologie"
            title="Auscultation"
            description="Bruits du cœur et du poumon synthétisés en temps réel : topographie, timing, timbre, variations et pièges. Étape 3/3 — 20 fiches (10 cardiaques + 10 pulmonaires)."
          />
        }
      >
        {/* Moniteur auscultation — visible en permanence */}
        <div className="sticky top-0 z-30 -mx-5 mb-5 border-y border-border bg-card px-5 py-3 shadow-[var(--shadow-border)] md:mx-0 md:rounded-[var(--radius-lg)] md:border md:px-4 md:py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-5">
            <div>
              <TorsoView
                mode={tab}
                activeFoyer={monitorFoyer ?? undefined}
                onFoyerClick={(id) => setActiveFoyer(id)}
                height={220}
              />
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div className="rounded-[var(--radius-md)] bg-black p-2">
                <PhonoSVG cycle={monitorCycle} playheadSec={playing ? playheadSec : undefined} height={180} />
              </div>
              <div className="flex items-center justify-between gap-3">
                
                
              </div>
            </div>
          </div>
        </div>

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

        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Liste des fiches */}
          <div className={cn("space-y-2", selectedId && "hidden md:block")}>
            {tab === "pulmonaire"
              ? pSounds.map((entry) => (
                  <PulmonaireSoundRow
                    key={entry.id}
                    entry={entry}
                    zones={zones}
                    selected={entry.id === selectedId}
                    onSelect={selectSound}
                  />
                ))
              : sounds.map((entry) => (
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
            {pFiche ? (
              <PulmonaireDetail
                fiche={pFiche}
                playing={playing}
                canPlay={canPlay}
                onToggle={() =>
                  toggleListen(pFiche.audio.preset, pFiche.audio.params, true)
                }
                onBack={() => {
                  stop();
                  setPlaying(false);
                  setSelectedId(null);
                }}
              />
            ) : fiche ? (
              <FicheDetail
                fiche={fiche}
                playing={playing}
                canPlay={canPlay}
                onToggle={() => toggleListen(fiche.audio.preset, fiche.audio.params, false)}
                onBack={() => {
                  stop();
                  setPlaying(false);
                  setSelectedId(null);
                }}
              />
            ) : (
              <EmptyDetail tab={tab} />
            )}
          </div>
        </div>
      </Page>
    </Shell>
  );
}

function EmptyDetail({ tab }: { tab: "cardiaque" | "pulmonaire" }) {
  return (
    <div className="hidden h-full min-h-64 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center md:flex">
      <div className="max-w-xs">
        <p className="font-display text-lg font-medium">Choisissez une fiche</p>
        <p className="mt-1 text-sm text-muted">
          {tab === "pulmonaire"
            ? "Sélectionnez un son respiratoire dans la liste pour afficher son schéma de cycle, son timbre, ses variations et ses pièges."
            : "Sélectionnez un son dans la liste pour afficher son schéma de timing, son timbre et ses pièges."}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Module cardiaque
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   Module pulmonaire
   ═══════════════════════════════════════════════════════════════════ */

function PulmonaireSoundRow({
  entry,
  zones,
  selected,
  onSelect,
}: {
  entry: PulmonaireSoundEntry;
  zones: PulmonaireZone[];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const available = entry.status === "available";
  const zoneLabels = entry.zones.map((id) => zones.find((z) => z.id === id)?.short ?? id);

  const inner = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          available ? "bg-primary-soft text-primary" : "bg-secondary text-muted",
        )}
      >
        {available ? <Wind className="size-5" /> : <Lock className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{entry.label}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="optimus-type-badge bg-secondary text-muted">
            {CATEGORIE_LABEL[entry.categorie] ?? entry.categorie}
          </span>
          {zoneLabels.slice(0, 3).map((label) => (
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

function PulmonaireDetail({
  fiche,
  playing,
  canPlay,
  onToggle,
  onBack,
}: {
  fiche: PulmonaireFiche;
  playing: boolean;
  canPlay: boolean;
  onToggle: () => void;
  onBack: () => void;
}) {
  const params = fiche.audio.params as { inspirationMs?: number; expirationMs?: number };

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
        <SectionLabel>Schéma du cycle respiratoire</SectionLabel>
        <RespiratoryStrip
          inspirationMs={params.inspirationMs}
          expirationMs={params.expirationMs}
          phase={fiche.timing.phase}
        />
        <p className="mt-3 text-sm leading-relaxed text-fg">
          <span className="font-medium">Moment : </span>
          {fiche.timing.moment}
          {" — "}
          <span className="font-medium">Caractère : </span>
          {fiche.timing.caractere}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Zones d'auscultation">
          <Chips items={fiche.zone.map((id) => pulmonaireZoneById(id)?.label ?? id)} />
        </Field>
        <Field label="Phase">{fiche.timing.phase}</Field>
        <Field label="Timbre">{fiche.timbre}</Field>
        <Field label="Fréquence">{fiche.frequence}</Field>
        <Field label="Localisation">{fiche.localisation}</Field>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Variations (manœuvres)">
          <VariationList items={fiche.variations} />
        </Field>
        <Field label="Pathologies associées">
          <Chips items={fiche.pathologies_associees} />
        </Field>
        <Field label="Diagnostics différentiels">
          <Chips items={fiche.diagnostics_differentiels} />
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

/** Frise Inspiration — Expiration d'après les durées du preset audio. */
function RespiratoryStrip({
  inspirationMs = 1400,
  expirationMs = 2200,
  phase,
}: {
  inspirationMs?: number;
  expirationMs?: number;
  phase?: string;
}) {
  const total = Math.max(1, inspirationMs + expirationMs);
  const inspPct = (inspirationMs / total) * 100;
  const expiFocused = !!phase && phase.startsWith("expiratoire");
  const inspiFocused = !!phase && phase.startsWith("inspiratoire");

  return (
    <div>
      <div className="flex items-stretch gap-1.5 rounded-[var(--radius-md)] bg-secondary p-2.5">
        <div
          className={cn(
            "flex min-w-0 flex-col justify-center",
            inspiFocused && "rounded-[var(--radius-sm)] ring-1 ring-primary/60",
          )}
          style={{ width: `${inspPct}%` }}
        >
          <div className={cn("h-1 rounded-full", inspiFocused ? "bg-primary" : "bg-primary/50")} />
          <span className="mt-1 truncate text-[9px] uppercase tracking-wider text-muted">
            inspiration
          </span>
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col justify-center",
            expiFocused && "rounded-[var(--radius-sm)] ring-1 ring-[#A67C1E]/60",
          )}
        >
          <div
            className={cn(
              "h-1 rounded-full",
              expiFocused ? "bg-[#A67C1E]" : "bg-[#A67C1E]/50",
            )}
          />
          <span className="mt-1 truncate text-[9px] uppercase tracking-wider text-muted">
            expiration
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-subtle">
        <span>Inspiration {inspirationMs} ms</span>
        <span>Expiration {expirationMs} ms</span>
      </div>
    </div>
  );
}

function VariationList({ items }: { items: PulmonaireFiche["variations"] }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted">—</span>;
  return (
    <ul className="space-y-2">
      {items.map((v) => (
        <li key={v.manoeuvre} className="flex flex-col gap-0.5">
          <span className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="font-medium">{v.manoeuvre}</span>
          </span>
          <span className="pl-[14px] text-sm text-muted">{v.effet}</span>
        </li>
      ))}
    </ul>
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

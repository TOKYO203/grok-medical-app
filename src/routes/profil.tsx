import { createFileRoute, Link } from "@tanstack/react-router";
import { MadagascarMark } from "@/components/brand/marks";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BADGE_CATALOG } from "@/content/badges";
import { YEARS } from "@/content/catalog";
import { levelInfo } from "@/core/scoring";
import { currentLeague, useOptimus } from "@/state/store";
import type { CoverId, StudyLevel } from "@/core/types";
import { STUDY_LEVEL_LABEL } from "@/core/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/profil")({ component: ProfilPage });

const COVERS: { id: CoverId; label: string; className: string }[] = [
  { id: "hautes-terres", label: "Hautes Terres", className: "cover-hautes-terres" },
  { id: "baobab", label: "Baobab", className: "cover-baobab" },
  { id: "canal", label: "Canal", className: "cover-canal" },
  { id: "clinique", label: "Clinique", className: "cover-clinique" },
];

function ProfilPage() {
  const profile = useOptimus((s) => s.profile);
  const update = useOptimus((s) => s.updateProfile);
  const createFree = useOptimus((s) => s.createFreeAccount);
  const xp = useOptimus((s) => s.xp);
  const streak = useOptimus((s) => s.streak);
  const weeklyXp = useOptimus((s) => s.weeklyXp);
  const badges = useOptimus((s) => s.badges);
  const queue = useOptimus((s) => s.syncQueue);
  const markSynced = useOptimus((s) => s.markQueueSynced);
  const lvl = levelInfo(xp);
  const league = currentLeague(weeklyXp);
  const pending = queue.filter((e) => !e.synced).length;
  const [localName, setLocalName] = useState(profile.displayName);
  const [localStudyYear, setLocalStudyYear] = useState<number | undefined>(profile.studyYear ?? undefined);
  const [localStudyLevel, setLocalStudyLevel] = useState<string | number | undefined>(
    profile.studyLevel ?? undefined,
  );
  const [localFaculty, setLocalFaculty] = useState(profile.faculty ?? "");
  const [showSaved, setShowSaved] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // keep local state in sync if profile updates from elsewhere
  useEffect(() => {
    setLocalName(profile.displayName);
    setLocalStudyYear(profile.studyYear ?? undefined);
    setLocalStudyLevel(profile.studyLevel ?? undefined);
    setLocalFaculty(profile.faculty ?? "");
  }, [profile.displayName, profile.studyYear, profile.studyLevel, profile.faculty]);

  function scheduleAutoSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    // schedule save in 10s
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    saveTimerRef.current = window.setTimeout(() => {
      void saveIfDirty();
    }, 10000);
  }

  async function saveIfDirty() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const payload: any = {};
    if ((localName || "").trim() !== (profile.displayName || "")) payload.displayName = (localName || "").trim();
    // studyYear stored as number
    if ((localStudyYear ?? null) !== (profile.studyYear ?? null)) payload.studyYear = localStudyYear ?? null;
    // studyLevel can be number or string
    if ((localStudyLevel ?? null) !== (profile.studyLevel ?? null)) payload.studyLevel = localStudyLevel ?? null;
    if ((localFaculty || "") !== (profile.faculty || "")) payload.faculty = localFaculty || null;

    if (Object.keys(payload).length === 0) return false;

    try {
      await update(payload);
      setShowSaved(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setShowSaved(false), 2200);
      return true;
    } catch (e) {
      // errors handled in store, but show a visual indicator in case
      // eslint-disable-next-line no-console
      console.error("Auto-save failed", e);
      return false;
    }
  }

  function onStudyLevelChange(raw: string) {
    // raw may be numeric string or key
    const v = /^\d+$/.test(raw) ? Number(raw) : raw;
    setLocalStudyLevel(v as any);

    const isRole = !/^\d+$/.test(String(raw));
    if (isRole) {
      // when selecting a role, clear year locally and persist
      setLocalStudyYear(undefined);
    }

    scheduleAutoSave();
  }

  function onStudyYearChange(val: string) {
    const n = Number(val);
    if (Number.isNaN(n)) {
      setLocalStudyYear(undefined);
    } else {
      setLocalStudyYear(n);
    }
    scheduleAutoSave();
  }

  function onNameBlur() {
    void saveIfDirty();
  }

  function onFacultyChange(val: string) {
    setLocalFaculty(val);
    scheduleAutoSave();
  }

  const isRoleSelected = typeof localStudyLevel === "string" && localStudyLevel !== "";

  return (
    <Shell title="Profil">
      <div
        className={cn("relative h-36 overflow-hidden md:h-44", profile.cover !== "custom" && (COVERS.find((c) => c.id === profile.cover)?.className ?? ""))}
        style={
          profile.cover === "custom" && profile.coverDataUrl
            ? { backgroundImage: `url(${profile.coverDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
        <MadagascarMark className="absolute right-4 top-4 h-14 w-9 text-fg/20" />
      </div>
      <Page className="-mt-10">
        <div className="flex items-end gap-3">
          <div className="flex size-16 items-center justify-center rounded-[var(--radius-lg)] bg-primary-soft font-display text-2xl text-primary shadow-[var(--shadow-border)]">
            {(profile.displayName[0] ?? "O").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate font-display text-2xl font-medium tracking-tight">{profile.displayName}</h1>
            <p className="font-mono text-xs text-muted">{profile.optimusId}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {lvl.title} · niv. {lvl.level} · ligue {league.label} · série {streak}
        </p>
        <Progress className="mt-2" value={lvl.progress} />

        <div className="mt-8 space-y-3">
          <label className="block text-xs font-medium text-muted" htmlFor="display-name">
            Nom
          </label>
          <Input
            id="display-name"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              scheduleAutoSave();
            }}
            onBlur={onNameBlur}
          />

          {/* Year - hidden when a professional role is selected */}
          {!isRoleSelected ? (
            <>
              <label className="block text-xs font-medium text-muted" htmlFor="year">
                Année
              </label>
              <select
                id="year"
                className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
                value={localStudyYear ?? ""}
                onChange={(e) => onStudyYearChange(e.target.value)}
              >
                <option value="">-- Choisir une année --</option>
                {YEARS.map((y) => (
                  <option key={y.year} value={String(y.year)}>
                    {y.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label className="block text-xs font-medium text-muted" htmlFor="studyLevel">
            Niveau / Statut professionnel (optionnel)
          </label>
          <select
            id="studyLevel"
            className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
            value={String(localStudyLevel ?? "")}
            onChange={(e) => onStudyLevelChange(e.target.value)}
          >
            <option value="">-- Choisir un niveau --</option>
            <optgroup label="Années">
              {YEARS.map((y) => (
                <option key={`y-${y.year}`} value={String(y.year)}>
                  {y.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Autre">
              {Object.entries(STUDY_LEVEL_LABEL)
                .filter(([key]) => !/^\d+$/.test(key))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </optgroup>
          </select>

          <label className="block text-xs font-medium text-muted" htmlFor="faculty">
            Faculté (optionnel)
          </label>
          <Input
            id="faculty"
            value={localFaculty}
            placeholder="Ex. Antananarivo"
            onChange={(e) => {
              onFacultyChange(e.target.value);
            }}
            onBlur={() => void saveIfDirty()}
          />
        </div>

        <h2 className="mt-8 font-display text-lg font-medium">Couverture</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {COVERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => update({ cover: c.id, coverDataUrl: null })}
              className={cn(
                "h-16 rounded-[var(--radius-md)] text-left text-xs text-fg",
                c.className,
                profile.cover === c.id && "ring-2 ring-primary",
              )}
            >
              <span className="m-2 inline-block rounded bg-bg/50 px-2 py-0.5">{c.label}</span>
            </button>
          ))}
        </div>
        <label className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm shadow-[var(--shadow-border)]">
          Photo personnelle
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const reader = new FileReader();
                reader.onload = () => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const w = 1200;
                    const h = 400;
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const scale = Math.max(w / img.width, h / img.height);
                    const sw = img.width * scale;
                    const sh = img.height * scale;
                    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
                    update({ cover: "custom", coverDataUrl: canvas.toDataURL("image/jpeg", 0.72) });
                  };
                  img.src = String(reader.result);
                };
                reader.readAsDataURL(f);
              }
            }}
          />
        </label>

        <h2 className="mt-8 font-display text-lg font-medium">Badges</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BADGE_CATALOG.map((b) => {
            const on = badges.includes(b.id);
            return (
              <div
                key={b.id}
                className={cn(
                  "rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-border)]",
                  on ? "bg-card" : "bg-secondary opacity-50",
                )}
              >
                <p className="text-sm font-medium">{b.title}</p>
                <p className="mt-1 text-xs text-muted">{b.detail}</p>
              </div>
            );
          })}
        </div>

        <h2 className="mt-8 font-display text-lg font-medium">Compte</h2>
        <p className="mt-1 text-sm text-muted">
          {profile.tier === "guest"
            ? "Invité — progression locale. Un compte Free crée un Optimus ID durable."
            : profile.tier === "free"
            ? "Compte Free — sync et classement prêts, serveur à brancher."
            : "Optimus Pro actif sur cet appareil."}
        </p>
        {profile.tier === "guest" ? (
          <Button className="mt-3" onClick={() => createFree(localName || "Étudiant")}>
            Créer un compte Free
          </Button>
        ) : null}

        <h2 className="mt-8 font-display text-lg font-medium">Synchronisation</h2>
        <p className="mt-1 text-sm text-muted">
          File locale : {pending} événement{pending > 1 ? "s" : ""} en attente. Hors-ligne d’abord — pas de connexion
          quotidienne exigée.
        </p>
        <div className="flex gap-2 items-center">
          <Button className="mt-3" variant="secondary" size="sm" onClick={markSynced} disabled={pending === 0}>
            Marquer comme synchronisé (démo)
          </Button>
          <span className="ml-3 text-xs text-muted">{pending} en file</span>
        </div>

        <nav className="mt-8 grid gap-1 text-sm">
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/publications">
            Publications
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/surveys">
            Sondages
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/pro">
            Optimus Pro
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/soutenir">
            Soutenir le développeur
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/contact">
            Contact
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/import">
            Importer un deck
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/a-propos">
            À propos
          </Link>
        </nav>

        {/* simple toast */}
        {showSaved ? (
          <div className="fixed right-4 bottom-6 rounded bg-card px-4 py-2 shadow-[var(--shadow-border)]">
            <p className="text-sm">Enregistré</p>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}

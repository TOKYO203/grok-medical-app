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
import { useState } from "react";

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
  const [name, setName] = useState(profile.displayName);
  const coverClass = COVERS.find((c) => c.id === profile.cover)?.className ?? "cover-hautes-terres";

  function onCoverFile(file: File) {
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
    reader.readAsDataURL(file);
  }

  return (
    <Shell title="Profil">
      <div
        className={cn("relative h-36 overflow-hidden md:h-44", profile.cover !== "custom" && coverClass)}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => update({ displayName: name.trim() || profile.displayName })}
          />
          <label className="block text-xs font-medium text-muted" htmlFor="year">
            Année
          </label>
          <select
            id="year"
            className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
            value={profile.studyYear}
            onChange={(e) => update({ studyYear: Number(e.target.value) })}
          >
            {YEARS.map((y) => (
              <option key={y.year} value={y.year}>
                {y.label}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-muted" htmlFor="studyLevel">
            Niveau / Statut professionnel (optionnel)
          </label>
          <select
            id="studyLevel"
            className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
            value={String(profile.studyLevel ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              const v = /^\d+$/.test(raw) ? Number(raw) : (raw as StudyLevel);
              update({ studyLevel: (raw === "" ? undefined : (v as any)) });
            }}
          >
            <option value="">-- Choisir un niveau --</option>
            {Object.entries(STUDY_LEVEL_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-muted" htmlFor="faculty">
            Faculté (optionnel)
          </label>
          <Input
            id="faculty"
            value={profile.faculty}
            placeholder="Ex. Antananarivo"
            onChange={(e) => update({ faculty: e.target.value })}
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
              if (f) onCoverFile(f);
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
          <Button className="mt-3" onClick={() => createFree(name || "Étudiant")}>
            Créer un compte Free
          </Button>
        ) : null}

        <h2 className="mt-8 font-display text-lg font-medium">Synchronisation</h2>
        <p className="mt-1 text-sm text-muted">
          File locale : {pending} événement{pending > 1 ? "s" : ""} en attente. Hors-ligne d’abord — pas de connexion
          quotidienne exigée.
        </p>
        <Button className="mt-3" variant="secondary" size="sm" onClick={markSynced} disabled={pending === 0}>
          Marquer comme synchronisé (démo)
        </Button>

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
      </Page>
    </Shell>
  );
}

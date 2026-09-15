import { useEffect, useState, type CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  Brain,
  BriefcaseMedical,
  Camera,
  ChevronRight,
  ClipboardList,
  Download,
  Flame,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Info,
  Landmark,
  MapPin,
  Medal,
  Pencil,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ExperienceControls } from "@/components/experience-controls";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BADGE_CATALOG } from "@/content/badges";
import { PROFESSIONAL_LEVELS, YEARS } from "@/content/catalog";
import { levelInfo } from "@/core/scoring";
import { STUDY_LEVEL_LABEL, type CoverId, type StudyLevel } from "@/core/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  dataUrlToImageBlob,
  deleteProfileCover,
  loadProfileCover,
  saveProfileCover,
} from "@/lib/profile-cover-storage";
import { cn } from "@/lib/utils";
import { currentLeague, useOptimus } from "@/state/store";

export const Route = createFileRoute("/profil")({ component: ProfilPage });

const COVERS: {
  id: CoverId;
  label: string;
  image?: string;
  className?: string;
}[] = [
  {
    id: "hautes-terres",
    label: "Hautes Terres",
    image: "/profile-covers/hautes-terres.webp",
  },
  {
    id: "baobab",
    label: "Allée des Baobabs",
    image: "/profile-covers/baobabs.webp",
  },
  { id: "canal", label: "Canal des Pangalanes", className: "cover-canal" },
  { id: "clinique", label: "Clinique", className: "cover-clinique" },
];

const AVATARS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: "stethoscope", icon: Stethoscope, label: "Clinique" },
  { id: "doctor", icon: BriefcaseMedical, label: "Médecin" },
  { id: "brain", icon: Brain, label: "Neurologie" },
  { id: "heart", icon: HeartPulse, label: "Cardiologie" },
  { id: "books", icon: BookOpen, label: "Études médicales" },
  { id: "madagascar", icon: Landmark, label: "Madagascar" },
];

const BADGE_ICONS: Record<string, LucideIcon> = {
  streak7: Flame,
  q100: Award,
  firstCase: Stethoscope,
  cardio90: HeartPulse,
  modules5: GraduationCap,
  firstImport: Download,
  diagnostic: Search,
  reviewer: Brain,
  tropical: Medal,
  exam: Trophy,
};

function ProfilPage() {
  const profile = useOptimus((state) => state.profile);
  const update = useOptimus((state) => state.updateProfile);
  const xp = useOptimus((state) => state.xp);
  const streak = useOptimus((state) => state.streak);
  const weeklyXp = useOptimus((state) => state.weeklyXp);
  const badges = useOptimus((state) => state.badges);
  const queue = useOptimus((state) => state.syncQueue);
  const purchases = useOptimus((state) => state.purchases);
  const { user, isPending: authPending } = useCurrentUserState();
  const [name, setName] = useState(profile.displayName);
  const [editing, setEditing] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [coverStorageError, setCoverStorageError] = useState<string | null>(null);

  const level = levelInfo(xp);
  const league = currentLeague(weeklyXp);
  const pending = queue.filter((event) => !event.synced).length;
  const pendingPurchases = purchases.filter((purchase) => purchase.status !== "delivered").length;
  const selectedCover = COVERS.find((cover) => cover.id === profile.cover);
  const coverClass = profile.cover === "custom" ? undefined : selectedCover?.className;
  const coverStyle: CSSProperties | undefined =
    profile.cover === "custom" && (customCoverUrl || profile.coverDataUrl)
      ? coverImageStyle(customCoverUrl || profile.coverDataUrl || "")
      : selectedCover?.image
        ? coverImageStyle(selectedCover.image)
        : undefined;
  const avatar = AVATARS.find((item) => item.id === profile.avatar) ?? AVATARS[0];
  const AvatarIcon = avatar.icon;
  const studyLabel =
    (profile.studyLevel && STUDY_LEVEL_LABEL[profile.studyLevel]) ??
    YEARS.find((item) => item.year === profile.studyYear)?.label ??
    "Médecine";
  const connectedAccount = Boolean(user && !user.isDevFallback);

  useEffect(() => {
    if (profile.cover !== "custom") {
      setCustomCoverUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      return;
    }

    let disposed = false;
    let createdUrl: string | null = null;

    const hydrateCover = async () => {
      try {
        if (profile.coverDataUrl) {
          const legacyBlob = dataUrlToImageBlob(profile.coverDataUrl);
          await saveProfileCover(profile.optimusId, legacyBlob);
          if (!disposed) update({ coverDataUrl: null });
        }

        const blob = await loadProfileCover(profile.optimusId);
        if (!blob || disposed) return;
        createdUrl = URL.createObjectURL(blob);
        setCustomCoverUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return createdUrl;
        });
        setCoverStorageError(null);
      } catch (error) {
        console.warn("[profile-cover] IndexedDB restore deferred", error);
      }
    };

    void hydrateCover();
    return () => {
      disposed = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [profile.cover, profile.coverDataUrl, profile.optimusId, update]);

  function onCoverFile(file: File) {
    setCoverStorageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 400;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(
          image,
          (canvas.width - width) / 2,
          (canvas.height - height) / 2,
          width,
          height,
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            void saveProfileCover(profile.optimusId, blob)
              .then(() => {
                const nextUrl = URL.createObjectURL(blob);
                setCustomCoverUrl((previous) => {
                  if (previous) URL.revokeObjectURL(previous);
                  return nextUrl;
                });
                setCoverStorageError(null);
                update({ cover: "custom", coverDataUrl: null });
              })
              .catch((error) => {
                console.warn("[profile-cover] IndexedDB save failed", error);
                const sessionUrl = URL.createObjectURL(blob);
                setCustomCoverUrl((previous) => {
                  if (previous) URL.revokeObjectURL(previous);
                  return sessionUrl;
                });
                update({ cover: "custom", coverDataUrl: null });
                setCoverStorageError(
                  "La photo est affichée pour cette session, mais cet appareil n’a pas pu l’enregistrer durablement.",
                );
              });
          },
          "image/jpeg",
          0.72,
        );
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function chooseBuiltInCover(coverId: CoverId) {
    setCoverStorageError(null);
    setCustomCoverUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    void deleteProfileCover(profile.optimusId).catch((error) => {
      console.warn("[profile-cover] cleanup deferred", error);
    });
    update({ cover: coverId, coverDataUrl: null });
  }

  function finishEditing() {
    update({ displayName: name.trim() || profile.displayName });
    setEditing(false);
  }

  return (
    <Shell title="Profil">
      <div
        className={cn("relative h-44 overflow-hidden bg-secondary md:h-56", coverClass)}
        style={coverStyle}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-black/10" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute right-4 top-4 inline-flex h-9 items-center gap-2 rounded-full bg-bg/75 px-3 text-xs font-medium text-fg shadow-[var(--shadow-border)] backdrop-blur-sm"
        >
          <Camera className="size-4" />
          Couverture
        </button>
      </div>

      <Page className="-mt-12 pt-0">
        <div className="flex items-end justify-between gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Changer l’avatar"
            className="relative flex size-24 items-center justify-center rounded-full border-4 border-bg bg-primary-soft text-primary shadow-[var(--shadow-md)]"
          >
            <AvatarIcon className="size-10" strokeWidth={1.6} />
            <span className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border-2 border-bg bg-primary text-primary-fg">
              <Pencil className="size-3.5" />
            </span>
          </button>
          <Button variant="secondary" size="sm" onClick={() => setEditing((value) => !value)}>
            <Pencil className="size-4" />
            {editing ? "Fermer" : "Modifier le profil"}
          </Button>
        </div>

        <div className="mt-3">
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {profile.displayName}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-muted">{profile.optimusId}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-4" /> {studyLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {profile.faculty || profile.country}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="size-4" /> Série de {streak} jour{streak !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]">
          <ProfileStat label="XP" value={xp.toLocaleString("fr-FR")} />
          <ProfileStat label="Niveau" value={String(level.level)} bordered />
          <ProfileStat label="Ligue" value={league.label} bordered />
        </div>
        <Progress className="mt-2" value={level.progress} />

        <section className="mt-6 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Confort d’étude" title="Expérience sensorielle" />
          <ExperienceControls />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Les sons et vibrations accompagnent seulement les actions utiles. L’ambiance focus est
            facultative, ne démarre jamais automatiquement et s’arrête quand l’app passe en arrière-plan.
          </p>
        </section>

        {editing ? (
          <section className="mt-8 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
            <SectionTitle kicker="Personnalisation" title="Modifier mon profil" />

            <p className="text-xs font-medium text-muted">Identité visuelle</p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {AVATARS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={profile.avatar === item.id}
                    onClick={() => update({ avatar: item.id })}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full bg-secondary text-primary",
                      profile.avatar === item.id && "ring-2 ring-primary",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.7} />
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              <label className="block text-xs font-medium text-muted" htmlFor="display-name">
                Nom affiché
              </label>
              <Input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <label className="block pt-2 text-xs font-medium text-muted" htmlFor="year">
                Niveau actuel
              </label>
              <select
                id="year"
                className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
                value={String(profile.studyLevel ?? profile.studyYear)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^[1-6]$/.test(value)) {
                    const studyYear = Number(value);
                    update({ studyYear, studyLevel: studyYear as StudyLevel });
                  } else {
                    update({ studyYear: 0, studyLevel: value as StudyLevel });
                  }
                }}
              >
                <optgroup label="Études médicales">
                  {YEARS.map((year) => (
                    <option key={year.year} value={year.year}>
                      {year.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Autres">
                  {PROFESSIONAL_LEVELS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <label className="block pt-2 text-xs font-medium text-muted" htmlFor="faculty">
                Faculté ou établissement
              </label>
              <Input
                id="faculty"
                value={profile.faculty}
                placeholder="Ex. Faculté de Médecine d’Antananarivo"
                onChange={(event) => update({ faculty: event.target.value })}
              />
            </div>

            <p className="mt-6 text-xs font-medium text-muted">Photo de couverture</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COVERS.map((cover) => (
                <button
                  key={cover.id}
                  type="button"
                  onClick={() => chooseBuiltInCover(cover.id)}
                  className={cn(
                    "relative h-20 overflow-hidden rounded-[var(--radius-md)] bg-secondary text-left text-xs text-white",
                    cover.className,
                    profile.cover === cover.id &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={cover.image ? coverImageStyle(cover.image) : undefined}
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <span className="absolute inset-x-2 bottom-2 font-medium">
                    {cover.label}
                  </span>
                </button>
              ))}
            </div>
            <label className="mt-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-secondary px-4 text-sm shadow-[var(--shadow-border)]">
              <Camera className="size-4 text-primary" />
              Ajouter ma propre photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onCoverFile(file);
                }}
              />
            </label>
            {coverStorageError ? (
              <p className="mt-2 text-xs leading-relaxed text-danger" role="status">
                {coverStorageError}
              </p>
            ) : null}
            <Button className="mt-5 w-full" onClick={finishEditing}>
              Enregistrer les modifications
            </Button>
          </section>
        ) : null}

        <section className="mt-8">
          <SectionTitle
            kicker="Réussites"
            title="Mes badges"
            action={
              <span className="text-xs text-muted">
                {badges.length}/{BADGE_CATALOG.length}
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BADGE_CATALOG.map((badge) => {
              const earned = badges.includes(badge.id);
              const BadgeIcon = BADGE_ICONS[badge.id] ?? Award;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-lg)] p-3 shadow-[var(--shadow-border)]",
                    earned ? "bg-card" : "bg-secondary opacity-45",
                  )}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
                    aria-hidden="true"
                  >
                    <BadgeIcon className="size-5" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{badge.title}</p>
                    <p className="truncate text-xs text-muted">
                      {earned ? "Obtenu" : "À débloquer"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle kicker="Navigation" title="Mon espace" />
          <nav className="overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]">
            <ProfileMenuLink
              icon={BookOpen}
              label="Mes parcours"
              detail="Decks et progression"
              to="/parcours"
            />
            <ProfileMenuLink
              icon={Star}
              label="Optimus Premium"
              detail={profile.tier === "pro" ? "Accès actif" : "Decks dès 3 000 Ar"}
              to="/pro"
            />
            <ProfileMenuLink
              icon={ClipboardList}
              label="Mes achats"
              detail={
                purchases.length === 0
                  ? "Commandes et livraisons"
                  : pendingPurchases > 0
                    ? `${pendingPurchases} en cours`
                    : `${purchases.length} livré${purchases.length > 1 ? "s" : ""}`
              }
              to="/achats"
            />
            <ProfileMenuLink
              icon={ShieldCheck}
              label="Mes données"
              detail="Export, synchronisation et suppression"
              to="/donnees"
            />
            <ProfileMenuLink
              icon={Trophy}
              label="Classement"
              detail={`Ligue ${league.label}`}
              to="/classement"
            />
            <ProfileMenuLink
              icon={Download}
              label="Importer un Deck"
              detail="Ajouter un contenu protégé"
              to="/import"
            />
            <ProfileMenuLink
              icon={HelpCircle}
              label="Aide et contact"
              detail="Question, idée ou correction"
              to="/contact"
            />
            <ProfileMenuLink
              icon={HeartPulse}
              label="Soutenir le projet"
              detail="Encourager le développeur"
              to="/soutenir"
            />
            <ProfileMenuLink
              icon={Info}
              label="À propos"
              detail="Optimus et ses valeurs"
              to="/a-propos"
              last
            />
          </nav>
        </section>

        <section className="mt-8 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Compte et données
          </p>
          <p className="mt-2 text-sm font-medium">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              {authPending
                ? "Vérification du compte…"
                : connectedAccount
                  ? "Compte Optimus connecté"
                  : "Profil local"}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {authPending
              ? "Vérification de la session cloud en cours."
              : connectedAccount
                ? `${pending} changement${pending !== 1 ? "s" : ""} en attente de synchronisation sur cet appareil.`
                : "Votre profil et votre progression restent sur cet appareil tant que vous n’êtes pas connecté."}
          </p>
          {!authPending && !connectedAccount ? (
            <Link
              to="/login"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              Se connecter pour sauvegarder
            </Link>
          ) : null}
          {!authPending && connectedAccount ? (
            <Link
              to="/donnees"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)]"
            >
              Gérer mes données
            </Link>
          ) : null}
        </section>
      </Page>
    </Shell>
  );
}

function ProfileStat({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={cn("px-2 py-4 text-center", bordered && "border-l border-border")}>
      <p className="font-display text-xl font-medium">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function ProfileMenuLink({
  icon: Icon,
  label,
  detail,
  to,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  to:
    | "/parcours"
    | "/pro"
    | "/achats"
    | "/donnees"
    | "/classement"
    | "/import"
    | "/contact"
    | "/soutenir"
    | "/a-propos";
  last?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary",
        !last && "border-b border-border",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </Link>
  );
}

function coverImageStyle(url: string): CSSProperties {
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

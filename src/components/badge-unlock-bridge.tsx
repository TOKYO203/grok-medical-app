import { useEffect, useRef, useState } from "react";
import { Award } from "lucide-react";
import { BADGE_CATALOG, type BadgeId } from "@/content/badges";
import { useI18n } from "@/i18n";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";

const SEEN_BADGES_KEY = "optimus.seenBadges";
const TOAST_DISMISS_MS = 4200;

type SeenBadges = { known: boolean; seen: BadgeId[] };

function readSeenBadges(): SeenBadges {
  try {
    const raw = window.localStorage.getItem(SEEN_BADGES_KEY);
    if (raw === null) return { known: false, seen: [] };
    const parsed: unknown = JSON.parse(raw);
    return {
      known: true,
      seen: Array.isArray(parsed)
        ? parsed.filter((id): id is BadgeId => typeof id === "string")
        : [],
    };
  } catch {
    return { known: true, seen: [] };
  }
}

function writeSeenBadges(badges: BadgeId[]) {
  try {
    window.localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(badges));
  } catch {
    // Stockage indisponible (navigation privée) : le toast resurgira au montage suivant.
  }
}

/*
 * BadgeUnlockBridge (Session 11 — vague Progression) : le déblocage d'un badge
 * passait inaperçu — il fallait revisiter /profil pour le découvrir. Ce pont du
 * Shell compare les badges du store à ceux déjà vus (localStorage
 * optimus.seenBadges) et affiche un toast fixe bas de page au déblocage :
 * libellé localisé + titre du badge, auto-dismiss ~4,2 s. Au premier lancement
 * (clé absente), les badges existants sont consignés sans toast. L'animation
 * d'entrée en deux phases (translate-y/opacity via requestAnimationFrame) ne
 * joue que si les animations enrichies sont activées.
 */
export function BadgeUnlockBridge() {
  const { t } = useI18n();
  const badges = useOptimus((s) => s.badges);
  const { preferences } = useExperiencePreferences();
  const [fresh, setFresh] = useState<BadgeId | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { known, seen } = readSeenBadges();
    if (!known) {
      writeSeenBadges(badges);
      return;
    }
    const unlocked = badges.find((id) => !seen.includes(id));
    if (!unlocked) return;
    writeSeenBadges(badges);
    setFresh(unlocked);
    setShown(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFresh(null), TOAST_DISMISS_MS);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [badges]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (fresh === null) return null;
  const title = BADGE_CATALOG.find((b) => b.id === fresh)?.title ?? fresh;
  const animated = preferences.enhancedMotion;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-md)]",
        animated && "transition duration-300 ease-out",
        animated && (shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"),
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn">
        <Award className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="optimus-kicker block text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {t("ux.badgeUnlocked")}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium">{title}</span>
      </span>
    </div>
  );
}

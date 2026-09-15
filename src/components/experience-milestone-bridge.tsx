import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useExperiencePreferences } from "@/components/experience-controls";
import { BADGE_CATALOG } from "@/content/badges";
import { levelInfo } from "@/core/scoring";
import { emitExperienceFeedback } from "@/lib/experience-feedback";
import { useOptimus } from "@/state/store";

export function ExperienceMilestoneBridge() {
  const hydrated = useOptimus((state) => state.hydrated);
  const badges = useOptimus((state) => state.badges);
  const xp = useOptimus((state) => state.xp);
  const licenseReceipts = useOptimus((state) => state.licenseReceipts);
  const { preferences } = useExperiencePreferences();
  const initialized = useRef(false);
  const previousBadges = useRef(new Set<string>());
  const previousLevel = useRef(1);
  const previousLicenses = useRef(0);

  useEffect(() => {
    if (!hydrated) return;

    const level = levelInfo(xp).level;
    if (!initialized.current) {
      initialized.current = true;
      previousBadges.current = new Set(badges);
      previousLevel.current = level;
      previousLicenses.current = licenseReceipts.length;
      return;
    }

    const newBadgeId = badges.find((badgeId) => !previousBadges.current.has(badgeId));
    const newBadge = newBadgeId ? BADGE_CATALOG.find((badge) => badge.id === newBadgeId) : undefined;

    if (licenseReceipts.length > previousLicenses.current) {
      emitExperienceFeedback("premium", preferences);
      toast.success("Optimus Premium activé", {
        description: "Votre accès protégé est prêt sur cet appareil.",
      });
    } else if (newBadge) {
      emitExperienceFeedback("badge", preferences);
      toast.success("Badge débloqué", { description: newBadge.title });
    } else if (level > previousLevel.current) {
      emitExperienceFeedback("badge", preferences);
      toast.success("Niveau supérieur", { description: `Niveau ${level} atteint.` });
    }

    previousBadges.current = new Set(badges);
    previousLevel.current = level;
    previousLicenses.current = licenseReceipts.length;
  }, [badges, hydrated, licenseReceipts.length, preferences, xp]);

  return null;
}

import { useEffect, useRef } from "react";
import { useExperiencePreferences } from "@/components/experience-controls";
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
  const previousBadges = useRef(0);
  const previousLevel = useRef(1);
  const previousLicenses = useRef(0);

  useEffect(() => {
    if (!hydrated) return;

    const level = levelInfo(xp).level;
    if (!initialized.current) {
      initialized.current = true;
      previousBadges.current = badges.length;
      previousLevel.current = level;
      previousLicenses.current = licenseReceipts.length;
      return;
    }

    if (licenseReceipts.length > previousLicenses.current) {
      emitExperienceFeedback("premium", preferences);
    } else if (badges.length > previousBadges.current || level > previousLevel.current) {
      emitExperienceFeedback("badge", preferences);
    }

    previousBadges.current = badges.length;
    previousLevel.current = level;
    previousLicenses.current = licenseReceipts.length;
  }, [badges.length, hydrated, licenseReceipts.length, preferences, xp]);

  return null;
}

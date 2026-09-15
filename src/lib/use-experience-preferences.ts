import { useEffect, useState } from "react";
import {
  DEFAULT_EXPERIENCE_PREFERENCES,
  readExperiencePreferences,
  subscribeExperiencePreferences,
  writeExperiencePreferences,
  type ExperiencePreferences,
} from "@/lib/experience-feedback";

export function useExperiencePreferences() {
  const [preferences, setPreferences] = useState<ExperiencePreferences>(
    DEFAULT_EXPERIENCE_PREFERENCES,
  );

  useEffect(() => {
    setPreferences(readExperiencePreferences());
    return subscribeExperiencePreferences(setPreferences);
  }, []);

  const update = (patch: Partial<ExperiencePreferences>) => {
    const next = { ...readExperiencePreferences(), ...patch };
    writeExperiencePreferences(next);
    setPreferences(next);
  };

  return { preferences, update };
}

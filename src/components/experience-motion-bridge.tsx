import { useEffect } from "react";
import { useExperiencePreferences } from "@/components/experience-controls";

export function ExperienceMotionBridge() {
  const { preferences } = useExperiencePreferences();

  useEffect(() => {
    document.documentElement.dataset.optimusMotion = preferences.enhancedMotion ? "full" : "reduced";
    return () => {
      delete document.documentElement.dataset.optimusMotion;
    };
  }, [preferences.enhancedMotion]);

  return null;
}

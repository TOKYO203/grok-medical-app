/* ═══════════════════════════════════════════════════════════════════
   Sounds ECG — design sonore du moniteur (spec Adnet/Lapostolle)
   ───────────────────────────────────────────────────────────────────
   10 types de sons différenciés par gravité, joués via Web Audio.
   Priorités : critique > urgent > alerte > info.

   `SoundType` vit désormais dans le modèle canonique `@/core/ecg`
   (le domaine) ; il est ré-exporté ici pour que tous les imports
   historiques (`./sounds`, `@/lib/ecg/sounds`) continuent de marcher.
   ═══════════════════════════════════════════════════════════════════ */

import type { SoundType } from "@/core/ecg";

export type { SoundType };

export type SoundPriority = "info" | "alerte" | "urgent" | "critique";

export type SoundSpec = {
  /** Fréquence fondamentale (Hz) */
  freq: number;
  /** Durée (ms) */
  duration: number;
  /** Type d onde */
  wave: OscillatorType;
  /** Nombre de bips (1 = simple, 2 = double) */
  beeps: number;
  /** Délai entre bips si double (ms) */
  gapMs?: number;
  /** Modulation : aucun | montant | oscillant | aleatoire */
  mod?: "none" | "up" | "osc" | "rand";
  priority: SoundPriority;
  label: string;
};

export const SOUNDS: Record<SoundType, SoundSpec> = {
  bip_normal:        { freq: 1000, duration: 50,  wave: "sine",     beeps: 1, priority: "info",     label: "QRS détecté" },
  bip_lent:          { freq: 400,  duration: 200, wave: "sine",     beeps: 1, priority: "urgent",   label: "Bradycardie" },
  bip_rapide:        { freq: 1200, duration: 50,  wave: "sine",     beeps: 1, priority: "urgent",   label: "Tachycardie" },
  double_bip:        { freq: 800,  duration: 100, wave: "square",   beeps: 2, gapMs: 100, priority: "critique", label: "BAV / dissociation" },
  son_continu:       { freq: 200,  duration: 999, wave: "sawtooth", beeps: 1, priority: "critique", label: "FV / Asystole" },
  son_oscillant:     { freq: 500,  duration: 999, wave: "sine",     beeps: 1, mod: "osc", priority: "critique", label: "Torsades" },
  son_dents_scie:    { freq: 700,  duration: 999, wave: "triangle", beeps: 1, mod: "osc", priority: "alerte", label: "Flutter" },
  son_irregulier:    { freq: 600,  duration: 999, wave: "sine",     beeps: 1, mod: "rand", priority: "alerte", label: "FA" },
  son_grave_montant: { freq: 300,  duration: 600, wave: "sine",     beeps: 1, mod: "up", priority: "urgent", label: "Sus-décalage convexe" },
  son_aigu_montant:  { freq: 1500, duration: 400, wave: "sine",     beeps: 1, mod: "up", priority: "urgent", label: "Hyperkaliémie" },
  silence:           { freq: 0,    duration: 0,   wave: "sine",     beeps: 0, priority: "critique", label: "Asystole" },
};

const PRIORITY_ORDER: Record<SoundPriority, number> = { critique: 4, urgent: 3, alerte: 2, info: 1 };

export function canOverwrite(current: SoundType, next: SoundType): boolean {
  return PRIORITY_ORDER[SOUNDS[next].priority] >= PRIORITY_ORDER[SOUNDS[current].priority];
}
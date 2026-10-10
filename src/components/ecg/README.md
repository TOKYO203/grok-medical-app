# Moniteur ECG — conventions & limites

Ce dossier contient le rendu du moniteur 12 dérivations
(`EcgMonitor.tsx`) et son prototype d'oscilloscope (`EcgCinema.tsx`).
La logique de signal vit dans `src/lib/ecg/`, le modèle canonique dans
`src/core/ecg.ts`, les cas cliniques dans `src/content/data/ecg/`.

## `EcgMonitor.tsx` — repère « papier »

Le `viewBox` du SVG est **natif, en millimètres** : 1 unité = 1 mm.

| Axe | Échelle | Constante |
| --- | --- | --- |
| Abscisse | 25 mm/s | `ECG_NORMS.paperSpeedMmPerSec` |
| Ordonnée | N mm/mV (N = gain) | `ECG_NORMS.voltageMmPerMv` × gain |

La grille est donc un quadrillage **1 mm (mineur) / 5 mm (majeur)** exact.

Un seul cycle cardiaque est généré par dérivation (`cyclePathMm()` dans
`src/lib/ecg/waveform.ts`) puis répété par des `<use>` décalés d'une
largeur de cycle ; le défilement est un simple `translate` de groupe
appliqué **hors React** (aucun re-render par frame). Les dérivations
frontales (DIII / aVR / aVL / aVF) sont **dérivées de DI et DII** par la
loi d'Einthoven — elles ne sont jamais inventées.

## Convention `data-ecg-*` (contrats DOM / QA)

Tout le moniteur est instrumenté par des attributs `data-ecg-*`, stables
et destinés aux tests visuels automatisés (comptage de pixels, sélection
d'éléments). **Ne pas les renommer sans mettre à jour la QA.**

| Attribut | Porté par | Valeur |
| --- | --- | --- |
| `data-ecg-monitor` | racine du moniteur (div) | vide ; porte aussi `data-ecg-bpm`, `data-ecg-gain`, `data-ecg-reduced`, `data-ecg-leads` |
| `data-ecg-svg` | `<svg>` | vide ; porte `data-ecg-viewbox`, `data-ecg-sweep`, `data-ecg-mm-per-sec`, `data-ecg-mm-per-mv` |
| `data-ecg-grid` | `<rect>` de grille | vide |
| `data-ecg-scroll` | groupe défilant (`left` / `right`) | reçoit le `translate` animé |
| `data-ecg-lead` | groupe d'une dérivation | `I`, `II`, `III`, `aVR`, `aVL`, `aVF`, `V1`…`V6`, `PLETH` ; porte `data-ecg-baseline`, `data-ecg-cycle-mm` |
| `data-ecg-cycle` | chaque `<use>` | index de répétition (0, 1, 2…) |
| `data-ecg-cursor` | ligne de balayage | `left` / `right` |
| `data-ecg-gain-label` | libellé `25 mm/s · N mm/mV` | en **ambre** quand le gain est réduit |
| `data-ecg-gain-badge` | badge « Gain réduit » | présent uniquement si gain < 10 mm/mV |
| `data-ecg-gain-toggle` | conteneur des boutons de gain | contient `[data-ecg-set-gain="10"]` et `="5"` |
| `data-ecg-fullscreen` | bouton plein écran | vide |
| `data-ecg-annotation` | pastille d'annotation | `id` de l'annotation |

## Convention — coordonnées d'annotations en **fraction (0 → 1)**

Les `coords` de `EcgAnnotation` (`src/core/ecg.ts`) sont **relatives au
cadre du moniteur, en fraction** et non en pixels :

```jsonc
{ "x": 0.32, "y": 0.30 }        // 32 % de la largeur, 30 % de la hauteur
{ "x": 0.30, "y": 0.37, "x2": 0.375, "y2": 0.37 }  // tracé (caliper)
```

`x` / `y` = ancrage de la pastille ; `x2` / `y2` = second point pour un
`caliper`. La convention est indépendante de la résolution, du `viewBox`
(en mm) et du thème. **Ne jamais y remettre des pixels** (l'ancienne
convention 1200×320/400 a été retirée).

## Limitations connues (v1)

1. **Gain plancher à 5 mm/mV.** Sur un écran court (mobile en paysage)
   le gain passe automatiquement à **5 mm/mV** — libellé en ambre +
   badge « Gain réduit » — et l'utilisateur peut forcer 10 ou 5 via la
   toolbar. On ne descend **pas** à 2,5 mm/mV : l'amplitude peut donc
   écrêter la hauteur de ligne plutôt que de réduire la lisibilité du
   tracé. Limite assumée (`ECG_GAIN_STEPS` dans `src/core/ecg.ts`).
2. **ACFA rendue régulière.** La fibrillation auriculaire (`pAbsent`) est
   tracée avec un cycle **R-R constant** : visuellement régulière, alors
   qu'une FA réelle est irrégulière. Accepté pour la v1 (déterminisme du
   rendu, continuité parfaite du `<use>`, lisibilité pédagogique).
   TODO v2 : modulation aléatoire du cycle R-R (jitter RR) — voir le
   commentaire d'en-tête de `src/lib/ecg/waveform.ts`.

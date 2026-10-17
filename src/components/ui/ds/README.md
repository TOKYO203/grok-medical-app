# `src/components/ui/ds` — Design System (pilotes)

Composants fondés **exclusivement** sur les jetons de `src/styles/tokens.css`
(typographie, espacement, rayons, ombres, tones sémantiques).

| Fichier      | Export   | API principale                                                                             |
| ------------ | -------- | ------------------------------------------------------------------------------------------ |
| `Button.tsx` | `Button` | `variant` (primary, secondary, ghost, danger), `size` (sm, md, lg), `loading`, `fullWidth` |
| `Card.tsx`   | `Card`   | `padding` (none, sm, md, lg), `interactive`, `selected`                                    |
| `Badge.tsx`  | `Badge`  | `tone` (neutral, accent, success, warn, danger, info), `size` (sm, md), `dot`              |

## Pourquoi ce sous-dossier ?

Le bouton historique de l'application est `src/components/ui/button.tsx`
(minuscule, 25 appelants, API `button-variants.ts`). Un fichier `Button.tsx`
placé dans le **même** dossier déclenche `TS1149` (« File name differs from
already included file name only in casing »), car TypeScript compare les noms
sans tenir compte de la casse. Le sous-dossier `ds/` isole les pilotes sans
toucher aux composants existants.

## Règles

1. Aucune couleur, ombre, rayon ou espacement codé en dur : uniquement
   `var(--tone-*)`, `var(--r-*)`, `var(--sh-*)`, `var(--sp-*)`.
2. Le rendu suit le thème clair / sombre sans variante conditionnelle (les
   variables `--app-*` sont redéfinies par `<html data-theme>`).
3. La vitrine de contrôle est la route de développement `/kitchen-sink`
   (`src/routes/_dev.kitchen-sink.tsx`), qui répond **404 en production**.
4. Garde-fou : `scripts/design-system.test.mjs` vérifie la présence des jetons,
   l'absence de couleurs en dur dans les composants et le verrouillage DEV de
   la route.

## Migration prévue

La bascule des appelants historiques (`@/components/ui/button`) vers ce
`Button` se fera dans une session dédiée, avec revue visuelle écran par écran.

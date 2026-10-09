# Project Memory Bank

## Established Rules & Architecture
• Ce projet utilise Vite + React avec TypeScript.
• Tous les composants React sont dans src/components/.
• La commande de build est `npm run build`.
• Refonte UX 2026 : thème CLAIR par défaut + SOMBRE via <html data-theme>. Tokens sémantiques dans src/styles.css (--app-* redéfinis par thème, mappés en --color-* via @theme). Système de thème: src/lib/theme.ts (THEME_BOOT_SCRIPT anti-flash injecté dans __root.tsx `head`) + src/components/theme-toggle.tsx. Palette claire: primary #0f7a52 ; sombre: primary #4ec98f.
• Présentation du contenu : index unifié dans src/lib/library/content-index.ts (ContentItem: decks + cas + démarches + outils, avec facettes type/spécialité/année/niveau/compétence). Primitive de carte: src/components/content/content-card.tsx (ContentCard, TypeBadge). Hub filtrable: src/routes/bibliotheque.tsx. Navigation: Accueil · Bibliothèque · Cas · Réviser · Profil (+ groupe secondaire "Explorer": Parcours, Examen, Calculateurs, Classement, Import) dans src/components/shell.tsx.

# Note interne

Moteur d'histologie — branche feat/histologie (PR #321). 11 lames.

## Images

Chaque lame référence directement l'original Wikimedia Commons via `Special:FilePath` (paramètre `?width=` pour la taille), avec `source` (attribution auteur), `sourceUrl` (page du fichier) et `license` vérifiés sur la page Commons de chaque fichier.

Licences utilisées : CC BY-SA (Netha Hussain, Nephron, Patho, Librepath, Ed Uthman MD, ArkhipovSergey), CC BY 4.0 (Shiva Raj K.C. et al.), domaine public (Mikael Häggström, CDC PHIL/DPDx, AFIP). Aucune image Radiopaedia (licence CC BY-NC interdite).

Les fichiers `public/histologie/placeholder-*.svg` sont conservés comme secours mais ne sont plus référencés.

## Lames

adenocarcinome-colique, carcinome-epidermoide, cirrhose-alcoolique, goitre-basedowien, hodgkin, lepra, leucemie-aigue-blastique, paludisme, schistosomiase-rectale, thyroidite-hashimoto, tuberculose-ganglionnaire.

Toutes sauf adenocarcinome-colique et carcinome-epidermoide sont liées à une fiche pathologie (`linkedPathology`).

## Annotations

Les coordonnées (x, y, w, h en %) ont été calibrées sur les placeholders ; à affiner visuellement sur les images réelles après déploiement de la preview.

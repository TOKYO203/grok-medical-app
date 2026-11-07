# Précautions déploiement — ne plus revivre le gel de prod (post-mortem 2026-11-07)

## Ce qui s'est passé (résumé)

La prod Pages est restée figée ~2 jours sur un build ancien (567 questions)
pendant que tout le contenu récent (667 questions, orientations diagnostiques,
chirurgie 51-60) était fusionné dans main. Trois causes cumulées :

1. **Budget JS client trop serré** (2334 KiB calé sur l'époque des 567
   questions) : le catalogue decks a grossi avec le contenu légitime et
   `postbuild:budget` a fait échouer chaque build — sans que personne ne
   regarde le log de fin.
2. **Garde-fou better-auth trop strict** (PR #424) : il exigeait un marqueur
   de stub qui n'apparaît pas quand le module n'est pas importé, puis quand
   il l'est réellement sans être stubbé. Fatal sur des builds par ailleurs
   sains (23,63 MiB < 25 MiB).
3. **Croix rouges ignorées** : les échecs étaient visibles (Actions GitHub
   rouges, Pages rouges) depuis des jours mais aucun humain ne regardait.

## Règles de prévention

### R1 — Un push sur main doit toujours aboutir à une prod à jour

Après CHAQUE merge vers main, vérifier sous ~30 min :

- Actions GitHub : le run CI du commit est-il vert ?
- Dashboard Cloudflare Pages : le build du commit est-il vert ?
- `https://optimusmedical.pages.dev/decouvrir` : affiche-t-il bien le
  nombre de questions attendu (marqueur de fraîcheur : 667 aujourd'hui,
  il montera avec le contenu) ?

Si un de ces trois points est rouge ou périmé, le déploiement n'a PAS eu
lieu. Ne pas empiler d'autres merges dessus : corriger d'abord.

### R2 — Tout garde-fou de build doit échouer avec un message actionnable

Un garde-fou (`postbuild:budget`, `assert-worker-stubs`) doit :

- afficher la valeur mesurée ET le plafond dans son message ;
- dire quoi faire (« relever le plafond en documentant le relevé » ou
  « réduire le module X ») ;
- être recalibré dès qu'un chantier de contenu légitime l'approche.
  Un plafond « à 2 KiB près » est un piège : chaque ajout de contenu
  légitime le fait sauter. Marge conseillée : 5-10 % au-dessus du relevé.

### R3 — Un marqueur de stub ne doit jamais être fatal par lui seul

L'absence d'un marqueur prouve seulement que le stub n'est pas dans le
bundle. Avant d'échouer : vérifier si le module original est réellement
dans le bundle (sinon il n'y a rien à stubber) et si la taille reste sous
la limite. Ne mettre en fatal que ce qui casse réellement le déploiement.

### R4 — Ne jamais fusionner une PR de build sans la tester sur le vrai chemin

Une PR qui touche `vite.config.ts`, `scripts/**`, `package.json` ou
`.github/workflows/**` doit être validée par un build complet
(`npm run build:cloudflare` localement, ou un run Actions sur la branche)
AVANT le merge — pas seulement par un build Vercel/Netlify.

### R5 — Le marqueur de fraîcheur de la prod

`/decouvrir` affiche le nombre de questions du catalogue. C'est le
marqueur le plus rapide pour savoir si la prod est à jour : si le chiffre
affiché est inférieur à celui du dernier contenu fusionné, la prod est
figée. Ajouter un changement de ce chiffre à la checklist de release.

### R6 — Un seul chemin de déploiement à la fois

Pendant la migration Workers (PR #425/#426), DEUX chemins étaient
modifiables en parallèle (Pages + workflow Workers) et les erreurs se
sonta mélangées. Règle : la prod = Pages. Le workflow Deploy Worker est
en manuel uniquement, réservé à un futur besoin (limite 64 MiB). Ne pas
retoucher le chemin Pages tant qu'un déploiement n'a pas été validé.

### R7 — CI rouge = interdiction de merger

Le workflow CI échoue sur main depuis le 23 octobre (avant même le gel) :
le réflexe « le CI est rouge depuis longtemps, tant pis » est exactement
ce qui a permis au gel de durer. Un run rouge sur main doit être traité
le jour même, ou le workflow doit être explicitement réduit à ce qui
passe (mieux : le réparer).

## Checklist après chaque merge de contenu vers main

- [ ] Actions → CI du commit : vert ? (sinon : log, corriger, ne pas merger d'avantage)
- [ ] Cloudflare Pages → build du commit : vert + « Your site was deployed! »
- [ ] `/decouvrir` : nombre de questions = nombre attendu
- [ ] Ouvrir une fiche du nouveau contenu en navigation privée : elle répond

## Valeurs de référence (relevés du 2026-11-07)

| Métrique | Valeur |
| --- | --- |
| Worker Pages | 23,63 MiB (885 fichiers) — limite 25 MiB |
| Budget JS client | plafond 2560 KiB (relever à chaque gros chantier contenu) |
| Questions catalogue | 667 |
| Commande de build Pages | `npm run build:cloudflare` (dashboard) |

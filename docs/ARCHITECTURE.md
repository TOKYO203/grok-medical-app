# ARCHITECTURE — Structure du code Optimus

**Derniere mise a jour** : 2026-11-01

---

## Stack technique

- **Front** : React 19 + TanStack Start (SSR + routes typees)
- **Build** : Vite 8 + Cloudflare Pages
- **Serveur** : Cloudflare Workers (server functions TanStack)
- **DB** : Supabase (Postgres + Auth + RLS)
- **Paiement** : Lemon Squeezy (international) + Ariari (MVola Madagascar)
- **Style** : Tailwind v4 + CSS variables (design system maison)

---

## Structure actuelle

- `src/components/` : UI React (ui/, imagerie/, demarche/, etc.)
- `src/content/` : Domaine pur (data/, *.ts types, *.test.ts)
- `src/core/` : Logique metier pure (scoring, demarche)
- `src/lib/` : Utilitaires + integrations (auth, cloud, security, pathologies, ai, purchase-orders.ts, db.ts)
- `src/routes/` : Pages TanStack (api.*.ts + *.tsx)
- `src/server/` : Backend specifique (ariari/, lemonsqueezy/)
- `src/state/` : Zustand store (progression, entitlements)
- `src/i18n/` : Traductions FR/EN/ES/PT
- `src/styles.css` + `src/styles/tokens.css` : Design system

---

## Problemes identifies

### CRITIQUE — src/lib/purchase-orders.ts (800+ lignes)

5 responsabilites melangees :
1. Creation de commande (createPremiumPurchaseOrder)
2. Integration Ariari (createAriariCheckout)
3. Integration Lemon Squeezy
4. Verification de licence (deliverLicenseForOrder)
5. Admin (advancePurchase, listPremiumPurchaseOrders)

Consequences : difficile a tester, merge conflicts frequents.

### MOYEN — Pas de convention features/

Chaque module cree 4 fichiers dans 4 dossiers differents. Fonctionnel mais disperse.

### MINEUR — src/core/ vs src/content/

Les deux contiennent de la logique pure. Distinction pas claire.

---

## Structure cible

src/
├── features/            (purchase, auth, imagerie, histologie, examens...)
│                        (chaque feature : domain/, server/, components/, __tests__/)
├── shared/              (ui/, design/, utils/)
├── routes/              (mince)
├── state/ i18n/ styles.css

Chaque feature est une brique autonome.

---

## Plan de migration progressive

### Regle d'or

PAS DE BIG BANG. On ne refactore jamais un module qui marche. On migre quand on touche un fichier pour une raison metier.

### Session 2 — Refactor pilote (3h)

Choisir UN module (recommande : purchase-orders.ts) :
1. Creer src/features/purchase/ avec sous-dossiers
2. Deplacer types + fonctions pures dans domain/
3. Deplacer server fns dans server/
4. Garder exports publics (index.ts)
5. Tests unitaires sur domain/

Benefice : 800 lignes -> 4 fichiers de 200 lignes max.

### Session 3+

Chaque nouvelle feature va dans src/features/<nom>/. Ne pas migrer l'existant qui marche. Sur 3-6 mois, la nouvelle structure absorbe 80% du code.

---

## Regles de contribution

### 1 PR = 1 feature/chantier
- Jamais melanger refactor + feature + fix
- 1 PR = 1 objectif clair
- PR max ~500 lignes (au-dela, decouper)

### Tests obligatoires
- domain/ : tester (Vitest)
- Server fns : 1 test d'integration minimum
- UI : valider visuellement avant merge

### Typecheck avant push
npm run typecheck : 0 erreur obligatoire.

### Nouvelles routes API
1. authMiddleware si necessite une session
2. rateLimitRequest si public mais couteux (LLM)
3. Verifier la source avant tout effet metier

### Nouvelles tables Supabase
1. ENABLE ROW LEVEL SECURITY
2. Policies restrictives
3. Test manuel : user A ne lit pas les donnees de user B

### Nouveaux webhooks
1. Verifier signature ou statut
2. Idempotence
3. Retour 503 sur erreur transitoire

---

## Points de vigilance

### Cloudflare Workers
- Jamais process.env au top-level
- Toujours wrapper : function getX() { return process.env.X }
- Exemples : ariariApiBase(), isDatabaseConfigured()

### TanStack Start
- Routes API : createFileRoute avec server.handlers
- Server functions : createServerFn().middleware([authMiddleware])
- Ne jamais appeler un server fn depuis un server fn (double middleware)

### Supabase
- Client : anon key uniquement (RLS filtre)
- Serveur : service role key (bypass RLS, a proteger)
- Toujours persistSession: false cote server

### Design system
- Jamais de couleur en dur (#A67C1E)
- Toujours var(--app-*) ou classes Tailwind
- Ajouter une palette : styles.css + lib/theme.ts + traductions

---

## Ressources

- docs/SECURITY.md : Politique securite
- docs/HANDOFF-NEXT-SESSION.md : Prochaines features
- docs/IMAGING-SOURCES-POLICY.md : Licences images
- docs/LEGAL-GUARDRAILS.md : Regles legales
- AGENTS.md : Contrat sandbox IA

---

## Historique

- 2026-11-01 : creation. Documentation architecture actuelle + plan migration progressive vers src/features/.

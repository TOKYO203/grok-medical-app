# CSP : pourquoi `script-src 'unsafe-inline'` reste, et comment le retirer (2026-11-27)

## État actuel

`server/middleware/security-headers.ts` émet :

```text
script-src 'self' 'unsafe-inline' 'sha256-<hash du boot de thème>'
```

Le hash est correctement quoté depuis le correctif `SEC-CSP-1` (il était rejeté comme source
invalide), mais il est **ignoré par les navigateurs** tant que `'unsafe-inline'` figure dans
la directive : le hash ne sert donc aujourd'hui qu'à documenter la cible.

## Les deux sources d'inline

| Source | Nature | Hashable ? |
|---|---|---|
| `THEME_BOOT_SCRIPT` (`src/routes/__root.tsx:101`) | constante statique, calculée depuis la source | **oui** |
| Scripts d'hydratation émis par TanStack Start | sérialisation de l'état de la route, **différente à chaque requête** | **non** |

C'est ce second point qui a provoqué l'incident du 20/11 : le durcissement par hash seul
bloquait les scripts de données du router, l'application ne s'hydratait plus et restait sur
le rendu serveur (écran perçu comme vide). Le retour à `'unsafe-inline'` a été un
rétablissement, pas une décision de confort.

## Options examinées

1. **Hash par script** — impossible sur les scripts de données : leur contenu dépend de la
   requête (session, routeur, préchargements).
2. **Nonce par réponse** — la seule voie techniquement correcte : un nonce unique par réponse,
   appliqué à *tous* les `<script>` (thème + données). Cela suppose que TanStack Start
   accepte un nonce sur ses scripts émis ; à vérifier dans la version installée avant tout
   chantier.
3. **Sortir le boot de thème du HTML** — supprime un inline mais pas les scripts de données ;
   ne débloque donc pas le retrait d'`'unsafe-inline'`.
4. **Accepter `'unsafe-inline'` avec compensations** — état actuel : les autres directives
   restent strictes (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
   `form-action 'self'`), et la production n'injecte aucun HTML utilisateur.

## Décision

Rester en `'unsafe-inline'` **pour l'instant**, avec un garde-fou en CI
(`scripts/csp-inline-sources.test.mjs`) qui échoue si un **nouveau** script inline est écrit
dans le code applicatif. Cette protection ne couvre pas les scripts du framework : elle
empêche seulement la dérive de notre propre code.

## Critères d'acceptation pour retirer `'unsafe-inline'`

- [ ] TanStack Start accepte un nonce par réponse sur tous ses scripts (à vérifier).
- [ ] Le boot de thème porte le même nonce (ou reste une constante hashée).
- [ ] Build de production chargé en local avec `script-src 'self' 'nonce-…'` : aucune erreur
      console, hydratation complète.
- [ ] Les tests E2E et le smoke de production passent sans `'unsafe-inline'`.
- [ ] Mise à jour simultanée de `public/_headers` et du middleware (les deux politiques
      doivent rester identiques, test `security-hardening.test.mjs`).

Tant que ces cinq points ne sont pas réunis, retirer `'unsafe-inline'` revient à rejouer
l'incident du 20/11 avec une page blanche en production.

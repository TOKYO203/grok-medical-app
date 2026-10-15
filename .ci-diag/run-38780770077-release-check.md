### Diagnostic release-check (run 38780770077)

#### Échecs détectés
```
/tmp/release.log-  duration_ms: 0.864042
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: les dates courtes suivent la locale
/tmp/release.log:not ok 17 - les dates courtes suivent la locale
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 16.900883
/tmp/release.log-  type: 'test'
/tmp/release.log-  location: '/home/runner/work/grok-medical-app/grok-medical-app/src/i18n/format.test.ts:12:1'
/tmp/release.log-  failureType: 'testCodeFailure'
/tmp/release.log-  error: 'mois court pt (out.)'
/tmp/release.log-  code: 'ERR_ASSERTION'
/tmp/release.log-  name: 'AssertionError'
/tmp/release.log-  expected: true
/tmp/release.log-  actual: false
/tmp/release.log-  operator: '=='
/tmp/release.log-  stack: |-
/tmp/release.log-    TestContext.<anonymous> (file:///home/runner/work/grok-medical-app/grok-medical-app/src/i18n/format.test.ts:20:10)
/tmp/release.log-    Test.runInAsyncScope (node:async_hooks:214:14)
/tmp/release.log-    Test.run (node:internal/test_runner/test:1047:25)
/tmp/release.log-    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
/tmp/release.log-    Test.postRun (node:internal/test_runner/test:1173:19)
/tmp/release.log-    Test.run (node:internal/test_runner/test:1101:12)
/tmp/release.log-    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
/tmp/release.log-  ...
/tmp/release.log-# Subtest: les dates complètes et horodatages incluent l'année
/tmp/release.log-ok 18 - les dates complètes et horodatages incluent l'année
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 1.104326
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: les sorties différencient les locales supportées
/tmp/release.log-ok 19 - les sorties différencient les locales supportées
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.51683
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# [i18n] message manquant pour la clé : clé.inconnue
/tmp/release.log-# Subtest: fr, en, es et pt sont des catalogues jumeaux aux clés identiques
/tmp/release.log-ok 20 - fr, en, es et pt sont des catalogues jumeaux aux clés identiques
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 1.770727
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: translate résout les clés simples dans les quatre langues
/tmp/release.log-ok 21 - translate résout les clés simples dans les quatre langues
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.341953
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: translate fait un repli sur le français si la clé manque dans la langue
/tmp/release.log-ok 22 - translate fait un repli sur le français si la clé manque dans la langue
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.239062
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: une clé inconnue renvoie la clé elle-même
/tmp/release.log-ok 23 - une clé inconnue renvoie la clé elle-même
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 1.531925
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: les contrats de pluriel respectent les gabarits d'origine
/tmp/release.log-ok 24 - les contrats de pluriel respectent les gabarits d'origine
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.389764
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: année, ligue et niveau gardent leur formulation par langue
/tmp/release.log-ok 25 - année, ligue et niveau gardent leur formulation par langue
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.256047
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: les utilitaires de locale exposent le contrat des quatre langues
/tmp/release.log-ok 26 - les utilitaires de locale exposent le contrat des quatre langues
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 0.134749
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: verifyGateIdentityToken
/tmp/release.log-    # Subtest: returns the identity for a valid token
/tmp/release.log-    ok 1 - returns the identity for a valid token
/tmp/release.log-      ---
/tmp/release.log-      duration_ms: 13.820077
```


#### npmci
```
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 492 packages, and audited 493 packages in 10s

105 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

#### release
```
 complètes et horodatages incluent l'année
  ---
  duration_ms: 1.104326
  type: 'test'
  ...
# Subtest: les sorties différencient les locales supportées
ok 19 - les sorties différencient les locales supportées
  ---
  duration_ms: 0.51683
  type: 'test'
  ...
# [i18n] message manquant pour la clé : clé.inconnue
# Subtest: fr, en, es et pt sont des catalogues jumeaux aux clés identiques
ok 20 - fr, en, es et pt sont des catalogues jumeaux aux clés identiques
  ---
  duration_ms: 1.770727
  type: 'test'
  ...
# Subtest: translate résout les clés simples dans les quatre langues
ok 21 - translate résout les clés simples dans les quatre langues
  ---
  duration_ms: 0.341953
  type: 'test'
  ...
# Subtest: translate fait un repli sur le français si la clé manque dans la langue
ok 22 - translate fait un repli sur le français si la clé manque dans la langue
  ---
  duration_ms: 0.239062
  type: 'test'
  ...
# Subtest: une clé inconnue renvoie la clé elle-même
ok 23 - une clé inconnue renvoie la clé elle-même
  ---
  duration_ms: 1.531925
  type: 'test'
  ...
# Subtest: les contrats de pluriel respectent les gabarits d'origine
ok 24 - les contrats de pluriel respectent les gabarits d'origine
  ---
  duration_ms: 0.389764
  type: 'test'
  ...
# Subtest: année, ligue et niveau gardent leur formulation par langue
ok 25 - année, ligue et niveau gardent leur formulation par langue
  ---
  duration_ms: 0.256047
  type: 'test'
  ...
# Subtest: les utilitaires de locale exposent le contrat des quatre langues
ok 26 - les utilitaires de locale exposent le contrat des quatre langues
  ---
  duration_ms: 0.134749
  type: 'test'
  ...
# Subtest: verifyGateIdentityToken
    # Subtest: returns the identity for a valid token
    ok 1 - returns the identity for a valid token
      ---
      duration_ms: 13.820077
      type: 'test'
      ...
    # Subtest: omits optional claims as nulls
    ok 2 - omits optional claims as nulls
      ---
      duration_ms: 2.957434
      type: 'test'
      ...
    # Subtest: rejects a wrong audience
    ok 3 - rejects a wrong audience
      ---
      duration_ms: 3.430321
      type: 'test'
      ...
    # Subtest: rejects a wrong issuer
    ok 4 - rejects a wrong issuer
      ---
      duration_ms: 4.946262
      type: 'test'
      ...
    # Subtest: rejects an expired token
    ok 5 - rejects an expired token
      ---
      duration_ms: 3.159482
      type: 'test'
      ...
    # Subtest: rejects a token without exp
    ok 6 - rejects a token without exp
      ---
      duration_ms: 2.395997
      type: 'test'
      ...
    # Subtest: rejects a token signed by a different key with the same kid
    ok 7 - rejects a token signed by a different key with the same kid
      ---
      duration_ms: 1.771558
      type: 'test'
      ...
    # Subtest: refetches the JWKS when the kid rotates
    ok 8 - refetches the JWKS when the kid rotates
      ---
      duration_ms: 4.069281
      type: 'test'
      ...
    1..8
ok 27 - verifyGateIdentityToken
  ---
  duration_ms: 38.030441
  type: 'suite'
  ...
# Subtest: gateIdentityFromHeaders
    # Subtest: verifies the header token end to end and fails closed without it
    ok 1 - verifies the header token end to end and fails closed without it
      ---
      duration_ms: 27.805507
      type: 'test'
      ...
    # Subtest: activates on a deployed-shaped request without GROK_GATE_ORIGIN
    ok 2 - activates on a deployed-shaped request without GROK_GATE_ORIGIN
      ---
      duration_ms: 2.857086
      type: 'test'
      ...
    # Subtest: fails closed when GROK_PROJECT_ID is unset
    ok 3 - fails closed when GROK_PROJECT_ID is unset
      ---
      duration_ms: 1.542351
      type: 'test'
      ...
    1..3
ok 28 - gateIdentityFromHeaders
  ---
  duration_ms: 32.574909
  type: 'suite'
  ...
# Subtest: sessionBoundToGateIdentity
    # Subtest: keeps the session when it is bound to the same gate sub
    ok 1 - keeps the session when it is bound to the same gate sub
      ---
      duration_ms: 0.202528
      type: 'test'
      ...
    # Subtest: rotates when the session belongs to a different gate sub
    ok 2 - rotates when the session belongs to a different gate sub
      ---
      duration_ms: 0.100779
      type: 'test'
      ...
    # Subtest: rotates when the session user has no gate-bound account
    ok 3 - rotates when the session user has no gate-bound account
      ---
      duration_ms: 0.099196
      type: 'test'
      ...
    1..3
ok 29 - sessionBoundToGateIdentity
  ---
  duration_ms: 0.524212
  type: 'suite'
  ...
# Subtest: a normal imported deck fits the IndexedDB storage budget
ok 30 - a normal imported deck fits the IndexedDB storage budget
  ---
  duration_ms: 1.00531
  type: 'test'
  ...
# Subtest: an imported deck larger than 4 MiB is rejected before IndexedDB write
ok 31 - an imported deck larger than 4 MiB is rejected before IndexedDB write
  ---
  duration_ms: 40.788111
  type: 'test'
  ...
# Subtest: server rendering skips browser-only IndexedDB restoration without error
ok 32 - server rendering skips browser-only IndexedDB restoration without error
  ---
  duration_ms: 0.773939
  type: 'test'
  ...
# Subtest: canonicalSpecialty recognises the five premium families
ok 33 - canonicalSpecialty recognises the five premium families
  ---
  duration_ms: 1.570623
  type: 'test'
  ...
# Subtest: primarySpecialty keeps simple labels untouched
ok 34 - primarySpecialty keeps simple labels untouched
  ---
  duration_ms: 0.284549
  type: 'test'
  ...
# Subtest: primarySpecialty groups composite labels on the specialty that unlocks them
ok 35 - primarySpecialty groups composite labels on the specialty that unlocks them
  ---
  duration_ms: 0.18359
  type: 'test'
  ...
# Subtest: primarySpecialty never returns a label containing a separator
ok 36 - primarySpecialty never returns a label containing a separator
  ---
  duration_ms: 0.252572
  type: 'test'
  ...
# Subtest: specialtyCodeFromLabel matches the historical specialtyCode mapping
ok 37 - specialtyCodeFromLabel matches the historical specialtyCode mapping
  ---
  duration_ms: 0.182589
  type: 'test'
  ...
# Subtest: isCompositeSpecialty flags only multi-specialty labels
ok 38 - isCompositeSpecialty flags only multi-specialty labels
  ---
  duration_ms: 0.147428
  type: 'test'
  ...
# Subtest: server Optimus ID stays authoritative while monotonic learning progress is merged
ok 39 - server Optimus ID stays authoritative while monotonic learning progress is merged
  ---
  duration_ms: 9.08781
  type: 'test'
  ...
# Subtest: a new device keeps the cloud profile while still retaining newer learning progress
ok 40 - a new device keeps the cloud profile while still retaining newer learning progress
  ---
  duration_ms: 0.544081
  type: 'test'
  ...
# Subtest: week comparison is numeric, so W10 correctly supersedes W9
ok 41 - week comparison is numeric, so W10 correctly supersedes W9
  ---
  duration_ms: 0.82173
  type: 'test'
  ...
# Subtest: commerce fields are rejected instead of being mixed into learning sync
ok 42 - commerce fields are rejected instead of being mixed into learning sync
  ---
  duration_ms: 0.361262
  type: 'test'
  ...
# Subtest: formatMeasurement insère une espace fine insécable avant le symbole
ok 43 - formatMeasurement insère une espace fine insécable avant le symbole
  ---
  duration_ms: 15.5542
  type: 'test'
  ...
# Subtest: le séparateur décimal suit la langue de l'interface
ok 44 - le séparateur décimal suit la langue de l'interface
  ---
  duration_ms: 0.424324
  type: 'test'
  ...
# Subtest: le registre couvre les unités cliniques courantes avec symboles SI
ok 45 - le registre couvre les unités cliniques courantes avec symboles SI
  ---
  duration_ms: 0.231851
  type: 'test'
  ...
# Subtest: parseMeasurement accepte virgule et point, rejette l'invalide
ok 46 - parseMeasurement accepte virgule et point, rejette l'invalide
  ---
  duration_ms: 0.324017
  type: 'test'
  ...
# Subtest: legacy unversioned Optimus state keeps XP, progress and learner profile
ok 47 - legacy unversioned Optimus state keeps XP, progress and learner profile
  ---
  duration_ms: 1.636759
  type: 'test'
  ...
# Subtest: v3 renames the legacy 'Invité' placeholder to 'Nouveau' without touching real names
ok 48 - v3 renames the legacy 'Invité' placeholder to 'Nouveau' without touching real names
  ---
  duration_ms: 0.19642
  type: 'test'
  ...
# Subtest: malformed persisted fields are repaired instead of poisoning hydration
ok 49 - malformed persisted fields are repaired instead of poisoning hydration
  ---
  duration_ms: 0.198982
  type: 'test'
  ...
# Subtest: already current data is preserved while unsafe collection shapes are normalized
ok 50 - already current data is preserved while unsafe collection shapes are normalized
  ---
  duration_ms: 0.17621
  type: 'test'
  ...
1..50
# tests 61
# suites 3
# pass 60
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1735.176087
```

### Diagnostic release-check (run 38779041740)

#### npmci
```
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 492 packages, and audited 493 packages in 13s

105 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

#### release
```
on_ms: 1.038858
  type: 'test'
  ...
# Subtest: interactive learning cards share restrained motion and depth
ok 365 - interactive learning cards share restrained motion and depth
  ---
  duration_ms: 0.244025
  type: 'test'
  ...
# Subtest: parcours and clinical cases expose progress summaries and explicit states
ok 366 - parcours and clinical cases expose progress summaries and explicit states
  ---
  duration_ms: 0.159197
  type: 'test'
  ...
# Subtest: offline mode stays explicit without blocking local learning
ok 367 - offline mode stays explicit without blocking local learning
  ---
  duration_ms: 0.148648
  type: 'test'
  ...
# Subtest: app resume refreshes existing online workflows without pretending to be online
ok 368 - app resume refreshes existing online workflows without pretending to be online
  ---
  duration_ms: 0.151953
  type: 'test'
  ...
# Subtest: PWA installation is discoverable and standalone-aware
ok 369 - PWA installation is discoverable and standalone-aware
  ---
  duration_ms: 0.151213
  type: 'test'
  ...
# Subtest: global error state is user-facing in French and hides raw details in production
ok 370 - global error state is user-facing in French and hides raw details in production
  ---
  duration_ms: 0.161551
  type: 'test'
  ...
# Subtest: main navigation supports keyboard users and current-page semantics
ok 371 - main navigation supports keyboard users and current-page semantics
  ---
  duration_ms: 0.166621
  type: 'test'
  ...
# Subtest: progress motion still honors the global reduced-motion escape hatch
ok 372 - progress motion still honors the global reduced-motion escape hatch
  ---
  duration_ms: 0.333172
  type: 'test'
  ...
# Subtest: keeps VITE_-prefixed string entries
ok 373 - keeps VITE_-prefixed string entries
  ---
  duration_ms: 1.568405
  type: 'test'
  ...
# Subtest: drops non-VITE keys, non-string values and malformed documents
ok 374 - drops non-VITE keys, non-string values and malformed documents
  ---
  duration_ms: 0.250327
  type: 'test'
  ...
# Subtest: a missing app-env.json is a clean no-op
ok 375 - a missing app-env.json is a clean no-op
  ---
  duration_ms: 0.33266
  type: 'test'
  ...
# Subtest: reads the app env from a workspace
ok 376 - reads the app env from a workspace
  ---
  duration_ms: 0.483422
  type: 'test'
  ...
# Subtest: an explicit process-env override wins over the file
ok 377 - an explicit process-env override wins over the file
  ---
  duration_ms: 0.212136
  type: 'test'
  ...
# Subtest: a repository checkout without workspace app-env keeps the default
ok 378 - a repository checkout without workspace app-env keeps the default
  ---
  duration_ms: 0.209782
  type: 'test'
  ...
# Subtest: vite loadEnv resolves the wrapped value
ok 379 - vite loadEnv resolves the wrapped value
  ---
  duration_ms: 0.399565
  type: 'test'
  ...
# Subtest: the wrapped command runs with the app env applied
ok 380 - the wrapped command runs with the app env applied
  ---
  duration_ms: 67.854441
  type: 'test'
  ...
# Subtest: the wrapped command sees an explicit override, not the file value
ok 381 - the wrapped command sees an explicit override, not the file value
  ---
  duration_ms: 57.360732
  type: 'test'
  ...
# Subtest: the wrapper propagates the command's exit code
ok 382 - the wrapper propagates the command's exit code
  ---
  duration_ms: 52.462824
  type: 'test'
  ...
# Subtest: a signal-killed command is never reported as success
ok 383 - a signal-killed command is never reported as success
  ---
  duration_ms: 50.959971
  type: 'test'
  ...
# Subtest: the CLI still runs when invoked through a symlinked path
ok 384 - the CLI still runs when invoked through a symlinked path
  ---
  duration_ms: 62.375424
  type: 'test'
  ...
# Subtest: parseWriteAtomicArgs needs exactly a staged file and a target
ok 385 - parseWriteAtomicArgs needs exactly a staged file and a target
  ---
  duration_ms: 1.728434
  type: 'test'
  ...
# Subtest: stagingError refuses a temp inside public/ and a no-op move
ok 386 - stagingError refuses a temp inside public/ and a no-op move
  ---
  duration_ms: 0.323703
  type: 'test'
  ...
# Subtest: handOver replaces the target and clears the staged file
ok 387 - handOver replaces the target and clears the staged file
  ---
  duration_ms: 0.762452
  type: 'test'
  ...
# Subtest: handOver creates a missing target directory
ok 388 - handOver creates a missing target directory
  ---
  duration_ms: 0.525911
  type: 'test'
  ...
# Subtest: an interrupted pass leaves the target on its old bytes, temp-free
ok 389 - an interrupted pass leaves the target on its old bytes, temp-free
  ---
  duration_ms: 0.84189
  type: 'test'
  ...
# Subtest: a failed hand-over creates no directory for the target it never wrote
ok 390 - a failed hand-over creates no directory for the target it never wrote
  ---
  duration_ms: 0.371774
  type: 'test'
  ...
# Subtest: a staged file on another filesystem is refused, not copied
ok 391 - a staged file on another filesystem is refused, not copied
  ---
  duration_ms: 0.626558
  type: 'test'
  ...
# Subtest: cli: hands the file over, and refuses a temp staged in public/
ok 392 - cli: hands the file over, and refuses a temp staged in public/
  ---
  duration_ms: 63.581283
  type: 'test'
  ...
# Subtest: cli: relative paths follow the script's root, not the caller's cwd
ok 393 - cli: relative paths follow the script's root, not the caller's cwd
  ---
  duration_ms: 30.07114
  type: 'test'
  ...
# Subtest: every hand-over the og skill prints is one this script accepts
ok 394 - every hand-over the og skill prints is one this script accepts # SKIP
  ---
  duration_ms: 0.521623
  type: 'test'
  ...
# Subtest: cli: a missing staged file fails without touching the target
ok 395 - cli: a missing staged file fails without touching the target
  ---
  duration_ms: 30.705592
  type: 'test'
  ...
1..395
# tests 395
# suites 0
# pass 390
# fail 1
# cancelled 0
# skipped 4
# todo 0
# duration_ms 33611.343735
```

### Tentative de commentaire PR
```
{"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/issues/comments#create-an-issue-comment","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

### Etat de l'authentification gh
```
github.com
  ✓ Logged in to github.com account github-actions[bot] (GH_TOKEN)
  - Active account: true
  - Git operations protocol: https
  - Token: ghs_*************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************
```

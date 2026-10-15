### Diagnostic release-check (run 38779666624)

#### Échecs détectés
```
/tmp/release.log-  duration_ms: 0.346458
/tmp/release.log-  type: 'test'
/tmp/release.log-  ...
/tmp/release.log-# Subtest: GitHub CI runs the complete release readiness gate
/tmp/release.log:not ok 27 - GitHub CI runs the complete release readiness gate
/tmp/release.log-  ---
/tmp/release.log-  duration_ms: 2.214984
/tmp/release.log-  type: 'test'
/tmp/release.log-  location: '/home/runner/work/grok-medical-app/grok-medical-app/scripts/api-security.test.mjs:119:1'
/tmp/release.log-  failureType: 'testCodeFailure'
/tmp/release.log-  error: |-
/tmp/release.log-    The input did not match the regular expression /run: npm run release:check/. Input:
/tmp/release.log-    
/tmp/release.log-    'name: CI\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      'on:\n' +
/tmp/release.log-      '  push:\n' +
/tmp/release.log-      '    branches: [ main, fix/quality-gates, release/v1-hardening ]\n' +
/tmp/release.log-      '  pull_request:\n' +
/tmp/release.log-      '    branches: [ main, fix/quality-gates, release/v1-hardening ]\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      'permissions:\n' +
/tmp/release.log-      '  contents: read\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      'jobs:\n' +
/tmp/release.log-      '  release-check:\n' +
/tmp/release.log-      '    runs-on: ubuntu-latest\n' +
/tmp/release.log-      '    timeout-minutes: 20\n' +
/tmp/release.log-      '    permissions:\n' +
/tmp/release.log-      '      contents: write\n' +
/tmp/release.log-      '      issues: write\n' +
/tmp/release.log-      '      statuses: write\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '    steps:\n' +
/tmp/release.log-      '      - name: Checkout code\n' +
/tmp/release.log-      '        uses: actions/checkout@v7\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Setup Node.js\n' +
/tmp/release.log-      '        uses: actions/setup-node@v7\n' +
/tmp/release.log-      '        with:\n' +
/tmp/release.log-      "          node-version: '22'\n" +
/tmp/release.log-      "          cache: 'npm'\n" +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Install locked dependencies\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          set -o pipefail\n' +
/tmp/release.log-      '          npm ci --legacy-peer-deps 2>&1 | tee /tmp/npmci.log\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Run release readiness checks\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          set -o pipefail\n' +
/tmp/release.log-      '          npm run release:check 2>&1 | tee /tmp/release.log\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Audit primary screens at 320 / 360 / 390 px\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          set -o pipefail\n' +
/tmp/release.log-      '          npm run qa:mobile:built 2>&1 | tee /tmp/qa.log\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Publish diagnostics on failure\n' +
/tmp/release.log-      '        if: failure()\n' +
/tmp/release.log-      '        env:\n' +
/tmp/release.log-      '          GH_TOKEN: ${{ github.token }}\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          {\n' +
/tmp/release.log-      '            echo "### Diagnostic release-check (run ${{ github.run_id }})"\n' +
/tmp/release.log-      '            echo ""\n' +
/tmp/release.log-      '            echo "#### Échecs détectés"\n' +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log:      '            grep -B4 -A60 "not ok" /tmp/release.log /tmp/qa.log /tmp/npmci.log 2>/dev/null | head -c 20000\n' +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log-      '            echo ""\n' +
/tmp/release.log-      '            for f in npmci release qa; do\n' +
/tmp/release.log-      '              if [ -f /tmp/$f.log ]; then\n' +
/tmp/release.log-      '                echo ""\n' +
/tmp/release.log-      '                echo "#### $f"\n' +
/tmp/release.log-      "                echo '```'\n" +
/tmp/release.log-      '                tail -c 6000 /tmp/$f.log\n' +
/tmp/release.log-      "                echo '```'\n" +
/tmp/release.log-      '              fi\n' +
/tmp/release.log-      '            done\n' +
/tmp/release.log-      '          } > /tmp/diag.md\n' +
/tmp/release.log-      '          {\n' +
/tmp/release.log-      '            echo ""\n' +
/tmp/release.log-      '            echo "### Tentative de commentaire PR"\n' +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log-      '            gh api repos/TOKYO203/grok-medical-app/issues/50/comments -F body=@/tmp/diag.md 2>&1 || true\n' +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log-      '            echo ""\n' +
/tmp/release.log-      `            echo "### Etat de l'authentification gh"\n` +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log-      '            gh auth status 2>&1 || true\n' +
/tmp/release.log-      "            echo '```'\n" +
/tmp/release.log-      '          } >> /tmp/diag.md\n' +
/tmp/release.log-      '          base64 -w0 /tmp/diag.md > /tmp/diag.b64\n' +
/tmp/release.log-      '          gh api -X PUT "repos/TOKYO203/grok-medical-app/contents/.ci-diag/run-${{ github.run_id }}-release-check.md" \\\n' +
/tmp/release.log-      '            -f message="diag: échec release-check (run ${{ github.run_id }})" \\\n' +
/tmp/release.log-      '            -f branch=feat/i18n-session3 \\\n' +
/tmp/release.log-      '            -f content="$(cat /tmp/diag.b64)" || true\n' +
/tmp/release.log:      '          FIRST_ERR=$(grep -h -m1 -E "error TS|Error:|FAIL |not ok|AssertionError|ERESOLVE|Cannot find" /tmp/npmci.log /tmp/release.log /tmp/qa.log 2>/dev/null | head -c 130)\n' +
/tmp/release.log-      '          gh api "repos/TOKYO203/grok-medical-app/statuses/${{ github.event.pull_request.head.sha }}" -f state=failure -f context="diag/release-check" -f description="$FIRST_ERR" || true\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '  database-recovery-smoke:\n' +
/tmp/release.log-      '    name: PostgreSQL backup / restore smoke\n' +
/tmp/release.log-      '    runs-on: ubuntu-latest\n' +
/tmp/release.log-      '    timeout-minutes: 15\n' +
/tmp/release.log-      '    services:\n' +
/tmp/release.log-      '      postgres:\n' +
/tmp/release.log-      '        image: postgres:16\n' +
/tmp/release.log-      '        env:\n' +
/tmp/release.log-      '          POSTGRES_USER: optimus\n' +
/tmp/release.log-      '          POSTGRES_PASSWORD: optimus\n' +
/tmp/release.log-      '          POSTGRES_DB: optimus\n' +
/tmp/release.log-      '        ports:\n' +
/tmp/release.log-      '          - 5432:5432\n' +
/tmp/release.log-      '        options: >-\n' +
/tmp/release.log-      '          --health-cmd "pg_isready -U optimus -d optimus"\n' +
/tmp/release.log-      '          --health-interval 5s\n' +
/tmp/release.log-      '          --health-timeout 5s\n' +
/tmp/release.log-      '          --health-retries 10\n' +
/tmp/release.log-      '    env:\n' +
/tmp/release.log-      '      DATABASE_URL: postgresql://optimus:optimus@localhost:5432/optimus\n' +
/tmp/release.log-      '      PGPASSWORD: optimus\n' +
/tmp/release.log-      '      VITE_AUTH_ENABLED: "true"\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '    steps:\n' +
/tmp/release.log-      '      - name: Checkout code\n' +
/tmp/release.log-      '        uses: actions/checkout@v7\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Setup Node.js\n' +
/tmp/release.log-      '        uses: actions/setup-node@v7\n' +
/tmp/release.log-      '        with:\n' +
/tmp/release.log-      "          node-version: '22'\n" +
/tmp/release.log-      "          cache: 'npm'\n" +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Install locked dependencies\n' +
/tmp/release.log-      '        run: npm ci --legacy-peer-deps\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Ensure PostgreSQL client is available\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          if ! command -v pg_dump >/dev/null 2>&1; then\n' +
/tmp/release.log-      '            sudo apt-get update\n' +
/tmp/release.log-      '            sudo apt-get install -y postgresql-client\n' +
/tmp/release.log-      '          fi\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Prove empty and legacy identity migrations on disposable PostgreSQL databases\n' +
/tmp/release.log-      '        env:\n' +
/tmp/release.log-      '          TEST_POSTGRES_URL: postgresql://optimus:optimus@localhost:5432/optimus\n' +
/tmp/release.log-      '        run: node --test scripts/staging-migration.test.mjs\n' +
/tmp/release.log-      '\n' +
/tmp/release.log-      '      - name: Apply migrations and seed recovery probe\n' +
/tmp/release.log-      '        run: |\n' +
/tmp/release.log-      '          npm run db:migrate\n' +
/tmp/release.log-      `          psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'\n` +
/tmp/release.log-      '          create table if not exists disaster_recovery_probe (\n' +
/tmp/release.log-      '            id integer primary key,\n' +
/tmp/release.log-      '            marker text not null\n' +
/tmp/release.log-      '          );\n' +
/tmp/release.log-      '          insert into disaster_recovery_probe (id, marker)\n' +
/tmp/release.log-      "          values (1, 'optimus-recovery-ok')\n" +
--
/tmp/release.log-                echo "### Diagnostic release-check (run ${{ github.run_id }})"
/tmp/release.log-                echo ""
/tmp/release.log-                echo "#### Échecs détectés"
/tmp/release.log-                echo '```'
/tmp/release.log:                grep -B4 -A60 "not ok" /tmp/release.log /tmp/qa.log /tmp/npmci.log 2>/dev/null | head -c 20000
/tmp/release.log-                echo '```'
/tmp/release.log-                echo ""
/tmp/release.log-                for f in npmci release qa; do
/tmp/release.log-                  if [ -f /tmp/$f.log ]; then
/tmp/release.log-                    echo ""
/tmp/release.log-                    echo "#### $f"
/tmp/release.log-                    echo '```'
/tmp/release.log-                    tail -c 6000 /tmp/$f.log
/tmp/release.log-                    echo '```'
/tmp/release.log-                  fi
/tmp/release.log-                done
/tmp/release.log-              } > /tmp/diag.md
/tmp/release.log-              {
/tmp/release.log-                echo ""
/tmp/release.log-                echo "### Tentative de commentaire PR"
/tmp/release.log-                echo '```'
/tmp/release.log-                gh api repos/TOKYO203/grok-medical-app/issues/50/comments -F body=@/tmp/diag.md 2>&1 || true
/tmp/release.log-                echo '```'
/tmp/release.log-                echo ""
/tmp/release.log-                echo "### Etat de l'authentification gh"
/tmp/release.log-                echo '```'
/tmp/release.log-                gh auth status 2>&1 || true
/tmp/release.log-                echo '```'
/tmp/release.log-              } >> /tmp/diag.md
/tmp/release.log-              base64 -w0 /tmp/diag.md > /tmp/diag.b64
/tmp/release.log-              gh api -X PUT "repos/TOKYO203/grok-medical-app/contents/.ci-diag/run-${{ github.run_id }}-release-check.md" \
/tmp/release.log-                -f message="diag: échec release-check (run ${{ github.run_id }})" \
/tmp/release.log-                -f branch=feat/i18n-session3 \
/tmp/release.log-                -f content="$(cat /tmp/diag.b64)" || true
/tmp/release.log:              FIRST_ERR=$(grep -h -m1 -E "error TS|Error:|FAIL |not ok|AssertionError|ERESOLVE|Cannot find" /tmp/npmci.log /tmp/release.log /tmp/qa.log 2>/dev/null | head -c 130)
/tmp/release.log-              gh api "repos/TOKYO203/grok-medical-app/statuses/${{ github.event.pull_request.head.sha }}" -f state=failure -f context="diag/release-check" -f description="$FIRST_ERR" || true
/tmp/release.log-    
/tmp/release.log-      database-recovery-smoke:
/tmp/release.log-        name: PostgreSQL backup / restore smoke
/tmp/release.log-        runs-on: ubuntu-latest
/tmp/release.log-        timeout-minutes: 15
/tmp/release.log-        services:
/tmp/release.log-          postgres:
/tmp/release.log-            image: postgres:16
/tmp/release.log-            env:
/tmp/release.log-              POSTGRES_USER: optimus
/tmp/release.log-              POSTGRES_PASSWORD: optimus
/tmp/release.log-              POSTGRES_DB: optimus
/tmp/release.log-            ports:
/tmp/release.log-              - 5432:5432
/tmp/release.log-            options: >-
/tmp/release.log-              --health-cmd "pg_isready -U optimus -d optimus"
/tmp/release.log-              --health-interval 5s
/tmp/release.log-              --health-timeout 5s
/tmp/release.log-              --health-retries 10
/tmp/release.log-        env:
/tmp/release.log-          DATABASE_URL: postgresql://optimus:optimus@localhost:5432/optimus
/tmp/release.log-          PGPASSWORD: optimus
/tmp/release.log-          VITE_AUTH_ENABLED: "true"
/tmp/release.log-    
/tmp/release.log-        steps:
/tmp/release.log-          - name: Checkout code
/tmp/release.log-            uses: actions/checkout@v7
/tmp/release.log-    
/tmp/release.log-          - name: Setup Node.js
/tmp/release.log-            uses: actions/setup-node@v7
/tmp/release.log-            with:
/tmp/release.log-              node-version: '22'
/tmp/release.log-              cache: 'npm'
/tmp/release.log-    
/tmp/release.log-          - name: Install locked dependencies
/tmp/release.log-            run: npm ci --legacy-peer-deps
/tmp/release.log-    
/tmp/release.log-          - name: Ensure PostgreSQL client is available
/tmp/release.log-            run: |
/tmp/release.log-              if ! command -v pg_dump >/dev/null 2>&1; then
/tmp/release.log-                sudo apt-get update
/tmp/release.log-                sudo apt-get install -y postgresql-client
/tmp/release.log-              fi
/tmp/release.log-    
/tmp/release.log-          - name: Prove empty and legacy identity migrations on disposable PostgreSQL databases
/tmp/release.log-            env:
/tmp/release.log-              TEST_POSTGRES_URL: postgresql://optimus:optimus@localhost:5432/optimus
/tmp/release.log-            run: node --test scripts/staging-migration.test.mjs
/tmp/release.log-    
/tmp/release.log-          - name: Apply migrations and seed recovery probe
/tmp/release.log-            run: |
/tmp/release.log-              npm run db:migrate
/tmp/release.log-              psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
/tmp/release.log-              create table if not exists disaster_recovery_probe (
/tmp/release.log-                id integer primary key,
/tmp/release.log-                marker text not null
/tmp/release.log-              );
/tmp/release.log-              insert into disaster_recovery_probe (id, marker)
/tmp/release.log-              values (1, 'optimus-recovery-ok')
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
ion_ms: 0.945417
  type: 'test'
  ...
# Subtest: interactive learning cards share restrained motion and depth
ok 365 - interactive learning cards share restrained motion and depth
  ---
  duration_ms: 0.21318
  type: 'test'
  ...
# Subtest: parcours and clinical cases expose progress summaries and explicit states
ok 366 - parcours and clinical cases expose progress summaries and explicit states
  ---
  duration_ms: 0.12204
  type: 'test'
  ...
# Subtest: offline mode stays explicit without blocking local learning
ok 367 - offline mode stays explicit without blocking local learning
  ---
  duration_ms: 0.14056
  type: 'test'
  ...
# Subtest: app resume refreshes existing online workflows without pretending to be online
ok 368 - app resume refreshes existing online workflows without pretending to be online
  ---
  duration_ms: 0.109309
  type: 'test'
  ...
# Subtest: PWA installation is discoverable and standalone-aware
ok 369 - PWA installation is discoverable and standalone-aware
  ---
  duration_ms: 0.104942
  type: 'test'
  ...
# Subtest: global error state is user-facing in French and hides raw details in production
ok 370 - global error state is user-facing in French and hides raw details in production
  ---
  duration_ms: 0.085882
  type: 'test'
  ...
# Subtest: main navigation supports keyboard users and current-page semantics
ok 371 - main navigation supports keyboard users and current-page semantics
  ---
  duration_ms: 0.115699
  type: 'test'
  ...
# Subtest: progress motion still honors the global reduced-motion escape hatch
ok 372 - progress motion still honors the global reduced-motion escape hatch
  ---
  duration_ms: 0.299493
  type: 'test'
  ...
# Subtest: keeps VITE_-prefixed string entries
ok 373 - keeps VITE_-prefixed string entries
  ---
  duration_ms: 1.388231
  type: 'test'
  ...
# Subtest: drops non-VITE keys, non-string values and malformed documents
ok 374 - drops non-VITE keys, non-string values and malformed documents
  ---
  duration_ms: 0.229499
  type: 'test'
  ...
# Subtest: a missing app-env.json is a clean no-op
ok 375 - a missing app-env.json is a clean no-op
  ---
  duration_ms: 0.282046
  type: 'test'
  ...
# Subtest: reads the app env from a workspace
ok 376 - reads the app env from a workspace
  ---
  duration_ms: 0.34871
  type: 'test'
  ...
# Subtest: an explicit process-env override wins over the file
ok 377 - an explicit process-env override wins over the file
  ---
  duration_ms: 0.161948
  type: 'test'
  ...
# Subtest: a repository checkout without workspace app-env keeps the default
ok 378 - a repository checkout without workspace app-env keeps the default
  ---
  duration_ms: 0.143549
  type: 'test'
  ...
# Subtest: vite loadEnv resolves the wrapped value
ok 379 - vite loadEnv resolves the wrapped value
  ---
  duration_ms: 0.302451
  type: 'test'
  ...
# Subtest: the wrapped command runs with the app env applied
ok 380 - the wrapped command runs with the app env applied
  ---
  duration_ms: 62.794881
  type: 'test'
  ...
# Subtest: the wrapped command sees an explicit override, not the file value
ok 381 - the wrapped command sees an explicit override, not the file value
  ---
  duration_ms: 55.903714
  type: 'test'
  ...
# Subtest: the wrapper propagates the command's exit code
ok 382 - the wrapper propagates the command's exit code
  ---
  duration_ms: 56.701069
  type: 'test'
  ...
# Subtest: a signal-killed command is never reported as success
ok 383 - a signal-killed command is never reported as success
  ---
  duration_ms: 50.414851
  type: 'test'
  ...
# Subtest: the CLI still runs when invoked through a symlinked path
ok 384 - the CLI still runs when invoked through a symlinked path
  ---
  duration_ms: 59.383543
  type: 'test'
  ...
# Subtest: parseWriteAtomicArgs needs exactly a staged file and a target
ok 385 - parseWriteAtomicArgs needs exactly a staged file and a target
  ---
  duration_ms: 1.502022
  type: 'test'
  ...
# Subtest: stagingError refuses a temp inside public/ and a no-op move
ok 386 - stagingError refuses a temp inside public/ and a no-op move
  ---
  duration_ms: 0.327407
  type: 'test'
  ...
# Subtest: handOver replaces the target and clears the staged file
ok 387 - handOver replaces the target and clears the staged file
  ---
  duration_ms: 0.739576
  type: 'test'
  ...
# Subtest: handOver creates a missing target directory
ok 388 - handOver creates a missing target directory
  ---
  duration_ms: 0.377981
  type: 'test'
  ...
# Subtest: an interrupted pass leaves the target on its old bytes, temp-free
ok 389 - an interrupted pass leaves the target on its old bytes, temp-free
  ---
  duration_ms: 0.763844
  type: 'test'
  ...
# Subtest: a failed hand-over creates no directory for the target it never wrote
ok 390 - a failed hand-over creates no directory for the target it never wrote
  ---
  duration_ms: 0.286563
  type: 'test'
  ...
# Subtest: a staged file on another filesystem is refused, not copied
ok 391 - a staged file on another filesystem is refused, not copied
  ---
  duration_ms: 0.479682
  type: 'test'
  ...
# Subtest: cli: hands the file over, and refuses a temp staged in public/
ok 392 - cli: hands the file over, and refuses a temp staged in public/
  ---
  duration_ms: 60.967781
  type: 'test'
  ...
# Subtest: cli: relative paths follow the script's root, not the caller's cwd
ok 393 - cli: relative paths follow the script's root, not the caller's cwd
  ---
  duration_ms: 32.458551
  type: 'test'
  ...
# Subtest: every hand-over the og skill prints is one this script accepts
ok 394 - every hand-over the og skill prints is one this script accepts # SKIP
  ---
  duration_ms: 0.519124
  type: 'test'
  ...
# Subtest: cli: a missing staged file fails without touching the target
ok 395 - cli: a missing staged file fails without touching the target
  ---
  duration_ms: 31.671432
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
# duration_ms 33050.228096
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

// @ts-check
/**
 * Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
 * (deploy / Neon) and `src/lib/db.ts` (PGLite preview).
 *
 * Applied files are keyed by BASENAME, so the same file applies once even when
 * it can be discovered from different directories. Root migrations win over an
 * auth migration with the same basename; this keeps legacy workspaces that
 * copied `migrations/auth/*.sql` to `migrations/` idempotent.
 */

/**
 * The `_migrations` key for a migration path (or bare filename).
 * @param {string} path
 * @returns {string}
 */
export function migrationName(path) {
  return path.split("/").pop() ?? path;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isMigrationFile(path) {
  return path.endsWith(".sql");
}

/**
 * Select the migration paths visible for the current auth mode.
 *
 * Root migrations always apply. Auth migrations apply only when auth is enabled.
 * If a legacy workspace already copied an auth migration to the root, the root
 * copy wins by basename so the file cannot run twice.
 *
 * @param {Iterable<string>} rootPaths
 * @param {Iterable<string>} authPaths
 * @param {boolean} authEnabled
 * @returns {string[]}
 */
export function migrationPathsForAuth(rootPaths, authPaths, authEnabled) {
  const root = [...rootPaths].filter(isMigrationFile);
  if (!authEnabled) return root;

  const rootNames = new Set(root.map(migrationName));
  const auth = [...authPaths]
    .filter(isMigrationFile)
    .filter((path) => !rootNames.has(migrationName(path)));
  return [...root, ...auth];
}

/**
 * Migrations in `paths` that are not yet in `applied`, in apply order.
 * Non-`.sql` entries are dropped defensively.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(({ name }) => !done.has(name));
}



export type Permission = {
  role: string;
  permissions: string[];
};

/** Lightweight RBAC helper kept for future admin-surface work only.
 *
 * Not consulted by any deployed route today (`requireAdminKey` via the shared
 * constant-time guard is the real admin gate — see `src/lib/security/admin-auth.server.ts`).
 * This exists so a future admin UI can derive permissions consistently if needed.
 */
export function getPermissions(role: string): Permission {
  if (role === "admin") {
    return {
      role,
      permissions: [
        "manage_users",
        "manage_content",
        "view_logs",
      ],
    };
  }

  return {
    role,
    permissions: [
      "read_content",
      "complete_cases",
    ],
  };
}


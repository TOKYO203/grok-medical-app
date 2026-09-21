import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin-login")({ component: AdminLoginPage });

const STORAGE_KEY = "optimus.admin.session.v2";
const LEGACY_KEY = "optimus.admin.key";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminSession = {
  token: string;
  createdAt: number;
  expiresAt: number;
};

export type AdminSessionState = "none" | "expired" | "valid";

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<AdminSession>;
    if (
      typeof s.token !== "string" ||
      typeof s.expiresAt !== "number" ||
      typeof s.createdAt !== "number"
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return s as AdminSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getAdminSessionState(): AdminSessionState {
  if (typeof window === "undefined") return "none";
  const s = getAdminSession();
  if (s) {
    if (Date.now() < s.expiresAt) return "valid";
    window.localStorage.removeItem(STORAGE_KEY);
    return "expired";
  }
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    setAdminKey(legacy);
    window.localStorage.removeItem(LEGACY_KEY);
    return "valid";
  }
  return "none";
}

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  const state = getAdminSessionState();
  if (state !== "valid") return "";
  const s = getAdminSession();
  return s?.token ?? "";
}

export function setAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const session: AdminSession = {
    token: key,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.localStorage.removeItem(LEGACY_KEY);
}

export function clearAdminKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_KEY);
}

function AdminLoginPage() {
  const nav = useNavigate();
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);

  const [loading, setLoading] = useState(false);

  async function submit() {
    if (key.trim().length < 4) {
      setError(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: key.trim() }),
      });
      const data = (await res.json()) as { valid: boolean; debug?: unknown };
      console.log("[admin-login] verify response:", data);
      if (!data.valid) {
        setError(true);
        setLoading(false);
        return;
      }
      setAdminKey(key.trim());
      nav({ to: "/admin" });
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <Shell title="Admin">
      <Page className="mx-auto max-w-md">
        <div className="mt-10 flex flex-col items-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <KeyRound className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-medium">Accès administrateur</h1>
          <p className="mt-2 text-center text-sm text-muted">
            Entre le mot de passe admin pour accéder aux outils de modération.
          </p>
        </div>

        <div className="mt-6">
          <Input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Mot de passe"
            autoFocus
          />
          {error ? (
            <p className="mt-2 text-xs text-red-400">
              Mot de passe invalide.
            </p>
          ) : null}

          <Button className="mt-4 w-full" onClick={submit} disabled={loading}>
            {loading ? "Vérification…" : "Accéder"}
          </Button>

          <p className="mt-4 text-center text-[11px] text-subtle">
            Stocké localement sur cet appareil
          </p>
        </div>
      </Page>
    </Shell>
  );
}

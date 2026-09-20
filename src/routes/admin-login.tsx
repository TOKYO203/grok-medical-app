import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin-login")({ component: AdminLoginPage });

const STORAGE_KEY = "optimus.admin.key";

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearAdminKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function AdminLoginPage() {
  const nav = useNavigate();
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);

  function submit() {
    if (key.trim().length < 4) {
      setError(true);
      return;
    }
    setAdminKey(key.trim());
    nav({ to: "/admin-reports" });
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
              Mot de passe trop court (min. 4 caractères).
            </p>
          ) : null}

          <Button className="mt-4 w-full" onClick={submit}>
            Accéder
          </Button>

          <p className="mt-4 text-center text-[11px] text-subtle">
            Stocké localement sur cet appareil
          </p>
        </div>
      </Page>
    </Shell>
  );
}

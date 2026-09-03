import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/surveys")({ component: SurveysPage });

type Survey = {
  id: string;
  title: string;
  description?: string | null;
  published?: boolean;
};

function SurveysPage() {
  const [items, setItems] = useState<Survey[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/server/api/surveys")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Shell title="Sondages">
      <Page>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl">Sondages</h1>
          <Link to="/surveys/new" className="text-sm underline">
            Créer un sondage
          </Link>
        </div>

        {err ? (
          <p className="mt-4 text-sm text-muted">Erreur: {err}</p>
        ) : items === null ? (
          <p className="mt-4 text-sm text-muted">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Aucun sondage disponible.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((s) => (
              <li key={s.id} className="rounded bg-secondary p-3">
                <Link to={`/surveys/${s.id}`} className="font-medium">
                  {s.title}
                </Link>
                {s.description ? <p className="text-sm text-muted mt-1">{s.description}</p> : null}
                {s.published ? <p className="text-xs text-muted mt-1">Publié</p> : <p className="text-xs text-muted mt-1">Brouillon</p>}
              </li>
            ))}
          </ul>
        )}
      </Page>
    </Shell>
  );
}

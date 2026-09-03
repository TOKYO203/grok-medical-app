import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/publications")({ component: PublicationsPage });

type Publication = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  published_at?: string | null;
};

function PublicationsPage() {
  const [items, setItems] = useState<Publication[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/server/api/publications")
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
    <Shell title="Publications">
      <Page>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl">Publications</h1>
          <Link to="/publications/new" className="text-sm underline">
            Nouvelle publication
          </Link>
        </div>

        {err ? (
          <p className="mt-4 text-sm text-muted">Erreur: {err}</p>
        ) : items === null ? (
          <p className="mt-4 text-sm text-muted">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Aucune publication disponible.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((p) => (
              <li key={p.id} className="rounded bg-secondary p-3">
                <Link to={`/publications/${p.slug}`} className="font-medium">
                  {p.title}
                </Link>
                {p.summary ? <p className="text-sm text-muted mt-1">{p.summary}</p> : null}
                {p.published_at ? <p className="text-xs text-muted mt-1">Publié: {new Date(p.published_at).toLocaleString()}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Page>
    </Shell>
  );
}

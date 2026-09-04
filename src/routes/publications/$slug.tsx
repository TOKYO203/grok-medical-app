import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/publications/$slug")({ component: PublicationPage });

type Publication = { id: string; slug: string; title: string; summary?: string; body?: any };

function PublicationPage() {
  const { slug } = Route.useParams();
  const [item, setItem] = useState<Publication | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!slug) return;
    fetch(`/server/api/publications/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setItem(data || null);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  return (
    <Shell title={item?.title ?? "Publication"}>
      <Page>
        <Link to="/publications" className="text-sm text-muted underline">← Retour aux publications</Link>
        {err ? <p className="mt-4 text-sm text-danger">Erreur: {err}</p> : null}
        {!item ? (
          <p className="mt-4 text-sm text-muted">Chargement…</p>
        ) : (
          <article className="mt-4 prose max-w-none">
            <h1>{item.title}</h1>
            {item.summary ? <p className="text-sm text-muted">{item.summary}</p> : null}
            <div dangerouslySetInnerHTML={{ __html: (item.body?.content as string) ?? "" }} />
          </article>
        )}
      </Page>
    </Shell>
  );
}

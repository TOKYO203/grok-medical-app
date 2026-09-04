import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/publications/new")({ component: NewPublication });

function NewPublication() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/server/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, body: { type: 'md', content: summary }, created_by: '00000000-0000-0000-0000-000000000000' })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || JSON.stringify(data));
      setResult(data);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Nouvelle publication">
      <Page>
        <h1 className="font-display text-2xl">Nouvelle publication</h1>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <label className="block text-xs text-muted">Titre</label>
          <Input value={title} onChange={(e: any) => setTitle(e.target.value)} />

          <label className="block text-xs text-muted">Résumé / Corps (markdown)</label>
          <textarea className="w-full rounded px-3 py-2 bg-secondary" rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} />

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? 'Envoi...' : 'Créer'}</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/publications' })}>Annuler</Button>
          </div>
        </form>

        {error ? <p className="mt-4 text-sm text-danger">Erreur: {error}</p> : null}
        {result ? (
          <div className="mt-4 rounded bg-card p-3">
            <p className="font-medium">Publication créée</p>
            <p className="text-sm">Slug: {result.slug}</p>
            <Link to={`/publications/${result.slug}`} className="text-sm underline">Voir la publication</Link>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}

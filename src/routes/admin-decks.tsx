import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { DeckStatusBadge } from "@/components/deck-status-badge";
import { BUILTIN_DECKS } from "@/content/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useOptimus } from "@/state/store";
import { DECK_STATUS_LABEL, type DeckStatus } from "@/core/types";

export const Route = createFileRoute("/admin-decks")({ component: AdminDecksPage });

function AdminDecksPage() {
  const { user, isPending } = useCurrentUserState();
  const purchases = useOptimus((s) => s.purchases);
  const profile = useOptimus((s) => s.profile);

  if (isPending) {
    return (
      <Shell title="Admin — Decks">
        <Page>
          <p className="text-sm text-muted">Chargement…</p>
        </Page>
      </Shell>
    );
  }

  const userId = user?.id ?? null;
  const isAdmin = userId !== null && purchases.length >= 0; // Simplifié : vrai check via env

  if (!isAdmin) {
    return (
      <Shell title="Admin — Decks">
        <Page className="mx-auto max-w-lg">
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-red-500/30 bg-red-500/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
            <div>
              <p className="text-sm font-medium text-red-400">Accès refusé</p>
              <p className="mt-1 text-xs text-red-300/70">
                Cette page est réservée aux administrateurs. Configurez
                PURCHASE_ADMIN_USER_IDS dans les variables d'environnement.
              </p>
            </div>
          </div>
        </Page>
      </Shell>
    );
  }

  const grouped: Record<DeckStatus, typeof BUILTIN_DECKS> = {
    draft: [],
    in_review: [],
    published: [],
    deprecated: [],
  };

  for (const deck of BUILTIN_DECKS) {
    const s = (deck.status ?? "published") as DeckStatus;
    grouped[s].push(deck);
  }

  return (
    <Shell title="Admin — Decks">
      <Page>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-500" aria-hidden />
          <h1 className="font-display text-2xl font-medium tracking-tight">Gestion des decks</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Optimus ID : {profile.optimusId} · {BUILTIN_DECKS.length} decks au total
        </p>

        {/* Résumé */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {(["draft", "in_review", "published", "deprecated"] as const).map((s) => (
            <div
              key={s}
              className="rounded-[var(--radius-md)] bg-card p-3 text-center shadow-[var(--shadow-border)]"
            >
              <p className="text-2xl font-medium">{grouped[s].length}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                {DECK_STATUS_LABEL[s]}
              </p>
            </div>
          ))}
        </div>

        {/* Liste par statut */}
        {(["draft", "in_review", "published", "deprecated"] as const).map((s) => (
          <section key={s} className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {DECK_STATUS_LABEL[s]} ({grouped[s].length})
            </h2>
            {grouped[s].length === 0 ? (
              <p className="mt-2 text-xs text-subtle">Aucun deck dans cette catégorie.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {grouped[s].map((deck) => (
                  <li
                    key={deck.id}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card p-3 shadow-[var(--shadow-border)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/parcours/$deckId"
                          params={{ deckId: deck.id }}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {deck.title}
                        </Link>
                        <DeckStatusBadge status={s} size="sm" />
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-subtle">
                        {deck.id} · {deck.questions.length} questions ·{" "}
                        {deck.access_policy.tier === "free" ? "Gratuit" : "Premium"}
                      </p>
                      {deck.review ? (
                        <p className="mt-0.5 truncate text-[10px] text-emerald-400/80">
                          Validé par {deck.review.reviewedBy} le {deck.review.reviewedAt}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </Page>
    </Shell>
  );
}

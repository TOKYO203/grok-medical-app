import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, FileText, Lock, ShieldAlert, Stethoscope } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { ContentLocked } from "@/components/premium/content-locked";
import { buttonVariants } from "@/components/ui/button-variants";
import { FicheView } from "@/components/demarche/fiche-view";
import { FlashcardsView } from "@/components/demarche/flashcards-view";
import { MindmapView } from "@/components/demarche/mindmap-view";
import { ViewTabs, type DemarcheView } from "@/components/demarche/view-tabs";
import { getBuiltinDeck, getCase } from "@/content/catalog";
import { premiumSpecialtyIdFor, type PremiumSpecialtyId } from "@/content/purchase-order";
import { useI18n } from "@/i18n";
import { specialtyPackProduct } from "@/lib/library/content-index";
import { loadPathologyContent, loadPathologyPreview } from "@/lib/pathologies/catalog";
import { pathologyEntry } from "@/lib/pathologies/manifest";
import { consumeExpiredSessionFlag, getToken } from "@/lib/auth/session";
import { isTrialActive, trialRemainingDays } from "@/lib/premium-trial";
import { hasEntitlement, useOptimus } from "@/state/store";

/** Une fiche de nosographie n'a pas de QCM : trois vues, pas quatre. */
type PathologieView = "fiche" | "flashcards" | "mindmap";

const VIEW_IDS: PathologieView[] = ["fiche", "flashcards", "mindmap"];

function isPathologieView(value: unknown): value is PathologieView {
  return typeof value === "string" && (VIEW_IDS as string[]).includes(value);
}

export const Route = createFileRoute("/pathologie/$slug")({
  component: PathologiePage,
  validateSearch: (search: Record<string, unknown>): { vue?: PathologieView } => ({
    vue: isPathologieView(search.vue) ? search.vue : undefined,
  }),
  /**
   * Le contenu est servi par le garde Premium (`/content/$type/$file`) : le
   * loader distingue donc TROIS états, et non plus « fiche ou 404 ».
   *   • `ok`      → fiche complète (jeton de contenu valide) ;
   *   • `locked`  → pas de licence / jeton expiré : page 200 + bandeau Premium
   *                 (un 401 en pleine navigation afficherait une erreur brute) ;
   *   • `missing` → 404 réelle (slug inconnu).
   */
  loader: async ({ params }) => {
    const loaded = await loadPathologyContent(params.slug);
    if (loaded.status === "missing") throw notFound();
    return loaded;
  },
  pendingComponent: PathologiePending,
  notFoundComponent: PathologieNotFound,
});

function PathologiePage() {
  const loaded = Route.useLoaderData();
  const { vue } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const entitlements = useOptimus((s) => s.entitlements);
  const premiumTrial = useOptimus((s) => s.premiumTrial);

  // Tous les hooks sont appelés AVANT ce retour anticipé : l'ordre des hooks
  // reste stable entre l'état verrouillé et l'état ouvert.
  if (loaded.status === "locked") return <PathologieLocked />;

  const content = loaded.data;
  const view: PathologieView = vue ?? "fiche";
  const specialty = content.curriculum.specialty;
  const premiumSpecialty = premiumSpecialtyIdFor(specialty);
  const trialActive = isTrialActive(premiumTrial);
  const isPro = hasEntitlement("OPTIMUS_PRO", entitlements);
  const open = isPro || hasEntitlement(specialtyPackProduct(specialty), entitlements) || trialActive;

  function goToView(next: DemarcheView) {
    if (!isPathologieView(next)) return;
    void navigate({ to: "/pathologie/$slug", params: { slug: content.slug }, search: { vue: next } });
  }

  // `flatMap` plutôt que `filter` : le type est réduit sans dépendre du
  // narrowing des prédicats (`Array.prototype.filter(Boolean)` ne le fait pas).
  const decks = content.related.deckIds.flatMap((id) => {
    const deck = getBuiltinDeck(id);
    return deck ? [deck] : [];
  });
  const cases = content.related.caseIds.flatMap((id) => {
    const item = getCase(id);
    return item ? [item] : [];
  });
  const reviewing = content.reviewStatus !== "reviewed";

  return (
    <Shell title="Nosographie">
      <Page className="mx-auto max-w-lg">
        <Link
          to="/programme"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("pathologie.back")}
        </Link>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {t("nav.nosography")} · {specialty}
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">{content.title}</h1>
        <p className="mt-2 text-sm text-muted">{content.subtitle}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
          <span className="font-mono tabular-nums">
            {t("pathologie.item", { n: content.curriculum.referential.localNumber })}
          </span>
          <span aria-hidden>·</span>
          <span>{content.curriculum.referential.sectionLabel}</span>
          <span aria-hidden>·</span>
          <span>
            {content.sections.length} sections · {content.flashcards.length} cartes
          </span>
        </p>

        {reviewing ? (
          <div
            data-pathologie-review={content.reviewStatus}
            className="mt-4 rounded-[var(--radius-lg)] bg-warn/10 p-3.5 ring-1 ring-warn/35"
          >
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              {t("pathologie.reviewPending")}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {t("pathologie.reviewPendingBody")}
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          <ViewTabs
            value={view}
            onChange={goToView}
            views={VIEW_IDS}
            ariaLabelKey="pathologie.tabsAria"
          />
        </div>

        {trialActive && !isPro ? (
          <p className="mt-3 text-xs font-medium text-primary">
            Essai Premium · {trialRemainingDays(premiumTrial)} jour
            {trialRemainingDays(premiumTrial) > 1 ? "s" : ""} restants — fiche complète ouverte
          </p>
        ) : null}

        {view === "fiche" ? <FicheView content={content} /> : null}

        {view === "flashcards" ? (
          open ? (
            <FlashcardsView content={content} />
          ) : (
            <LockedPanel
              title={t("pathologie.lockedTitle")}
              body={t("pathologie.lockedBody")}
              premiumSpecialty={premiumSpecialty}
            />
          )
        ) : null}

        {view === "mindmap" ? (
          open ? (
            <MindmapView content={content} />
          ) : (
            <LockedPanel
              title={t("pathologie.lockedTitle")}
              body={t("pathologie.lockedBody")}
              premiumSpecialty={premiumSpecialty}
            />
          )
        ) : null}

        {decks.length > 0 || cases.length > 0 ? (
          <section className="mt-8" data-pathologie-related>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {t("pathologie.related")}
            </h2>
            <ul className="mt-3 space-y-2">
              {decks.map((deck) => (
                <li key={deck.id}>
                  <Link
                    to="/parcours/$deckId"
                    params={{ deckId: deck.id }}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-surface"
                  >
                    <BookOpen className="size-4 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-[0.12em] text-subtle">
                        {t("pathologie.deck")}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-fg">
                        {deck.title}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
              {cases.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/cas/$caseId"
                    params={{ caseId: item.id }}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-surface"
                  >
                    <Stethoscope className="size-4 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-[0.12em] text-subtle">
                        {t("pathologie.case")}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-fg">
                        {item.title}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {content.editorial.verificationNotes.length > 0 ? (
          <details className="mt-6 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted">
              <FileText className="size-3.5 shrink-0" aria-hidden />
              {t("pathologie.verificationNotes")}
              <span className="ml-auto font-mono text-[11px] tabular-nums text-subtle">
                {content.editorial.verificationNotes.length}
              </span>
            </summary>
            <ul className="mt-3 space-y-2">
              {content.editorial.verificationNotes.map((note, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-[11px] leading-relaxed text-muted"
                  data-pathologie-note
                >
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Page>
    </Shell>
  );
}

function LockedPanel({
  title,
  body,
  premiumSpecialty,
}: {
  title: string;
  body: string;
  premiumSpecialty: PremiumSpecialtyId | null;
}) {
  const { t } = useI18n();
  return (
    <section className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-md)]">
      <div className="premium-hero p-5 text-primary-fg">
        <Lock className="size-6" aria-hidden />
        <h2 className="mt-3 font-display text-2xl font-medium">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{body}</p>
      </div>
      <div className="p-5">
        <Link
          to="/pro"
          search={{ ...(premiumSpecialty ? { specialty: premiumSpecialty } : {}) }}
          className={buttonVariants({ size: "lg", className: "w-full" })}
        >
          {t("pathologie.unlock")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link to="/programme" className="mt-3 block text-center text-sm text-muted">
          {t("pathologie.back")}
        </Link>
      </div>
    </section>
  );
}

function PathologiePending() {
  return (
    <Shell title="Nosographie">
      <Page className="mx-auto max-w-lg">
        <div data-pathologie-pending className="h-4 w-32 animate-pulse rounded bg-secondary" />
        <div className="mt-4 h-8 w-56 animate-pulse rounded bg-secondary" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-secondary" />
        <div className="mt-6 h-24 w-full animate-pulse rounded-[var(--radius-lg)] bg-secondary" />
      </Page>
    </Shell>
  );
}

function PathologieNotFound() {
  const { t } = useI18n();
  return (
    <Shell title="Nosographie">
      <Page className="mx-auto max-w-lg">
        <p className="text-sm text-muted">{t("pathologie.notFound")}</p>
        <Link to="/programme" className="mt-4 inline-flex text-sm font-medium text-primary">
          {t("pathologie.back")}
        </Link>
      </Page>
    </Shell>
  );
}

/**
 * État VERROUILLÉ d'une fiche de nosographie.
 *
 * Le loader a reçu un 401/503 du garde de contenu : rien de la fiche n'est
 * présent dans la page. On affiche l'aperçu PUBLIC (titre, objectif, intitulés
 * de sections) pour que l'écran reste informatif, puis le chemin d'activation.
 */
function PathologieLocked() {
  const { slug } = Route.useParams();
  const { t } = useI18n();

  // Le MANIFESTE est public : il donne le titre et la spécialité sans requête,
  // donc dès le rendu serveur (l'aperçu, lui, arrive par fetch après montage).
  const entry = pathologyEntry(slug);

  const [preview, setPreview] = useState<
    { title?: string; subtitle?: string; objective?: string } | undefined
  >(undefined);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadPathologyPreview(slug).then((loaded) => {
      if (!cancelled && loaded) setPreview(loaded);
    });

    // `getToken()` purge un éventuel jeton périmé ; le drapeau permet ensuite
    // de distinguer « jamais activé » de « accès de 24 h expiré ».
    getToken();
    if (consumeExpiredSessionFlag() && !cancelled) setExpired(true);

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <Shell title="Nosographie">
      <Page className="mx-auto max-w-lg" data-pathologie-locked>
        <Link
          to="/programme"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("pathologie.back")}
        </Link>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {t("nav.nosography")}
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          {preview?.title ?? entry?.title ?? t("content.lockedTitle")}
        </h1>
        {preview?.subtitle ? <p className="mt-2 text-sm text-muted">{preview.subtitle}</p> : null}

        <ContentLocked
          preview={preview ? { subtitle: preview.subtitle, objective: preview.objective } : undefined}
          sessionExpired={expired}
        >
          <Link to="/programme" className="font-medium text-primary">
            {t("pathologie.back")}
          </Link>
        </ContentLocked>
      </Page>
    </Shell>
  );
}

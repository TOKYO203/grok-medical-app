import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  GraduationCap,
  Layers,
  Minus,
  Sparkles,
} from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import {
  CURRENCIES,
  detectPreferredCurrency,
  formatPrice,
  PRICES_MGA,
  type Currency,
} from "@/content/pricing";
import { PREMIUM_SPECIALTIES } from "@/content/purchase-order";

export const Route = createFileRoute("/tarifs")({ component: TarifsPage });

type FeatureValue = boolean | "limité";

const FEATURES: { label: string; free: FeatureValue; premium: FeatureValue }[] = [
  { label: "Modules ECG interactifs (23 cas)", free: true, premium: true },
  { label: "Auscultation cardio-pulmonaire", free: true, premium: true },
  { label: "Calculateurs cliniques", free: true, premium: true },
  { label: "Programme national (240 items)", free: true, premium: true },
  { label: "Decks de spécialité complets", free: false, premium: true },
  { label: "Cas cliniques détaillés", free: "limité", premium: true },
  { label: "Démarches cliniques complètes", free: false, premium: true },
  { label: "Mises à jour de contenu incluses", free: false, premium: true },
];

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return <Check className="size-4 text-[#A67C1E]" aria-label="Inclus" />;
  }
  if (value === "limité") {
    return <span className="text-[11px] font-medium text-muted">Limité</span>;
  }
  return <Minus className="size-4 text-muted/50" aria-label="Non inclus" />;
}

function TarifsPage() {
  const [currency, setCurrency] = useState<Currency>(() => detectPreferredCurrency());

  return (
    <Shell title="Tarifs">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Tarifs"
            title="Choisis ton niveau d'accès"
            description="Un contenu médical de référence, conçu pour les étudiants malgaches. Achat unique, pas d'abonnement, paiement en Ariary."
          />
        }
      >
        {/* Sélecteur de devise (A01) */}
        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Devise d'affichage des prix">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={currency === code}
              onClick={() => setCurrency(code)}
              className={
                "h-9 rounded-[var(--radius-md)] px-3 text-xs font-semibold uppercase tracking-wide shadow-[var(--shadow-border)] transition-colors " +
                (currency === code ? "bg-primary text-primary-fg" : "bg-secondary text-fg hover:bg-secondary/70")
              }
            >
              {code}
            </button>
          ))}
          <p className="w-full text-xs leading-relaxed text-muted sm:w-auto sm:flex-1 sm:pl-2">
            Conversion indicative — le paiement officiel reste en Ariary via Mobile Money.
          </p>
        </div>

        {/* Comparatif Gratuit / Premium */}
        <section className="mt-8">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-border)]">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-4 py-3 md:grid-cols-[2fr_auto_auto] md:px-6">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Fonctionnalités</span>
              <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">Gratuit</span>
              <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#A67C1E]">Premium</span>
            </div>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/40 px-4 py-3 last:border-b-0 md:grid-cols-[2fr_auto_auto] md:px-6"
              >
                <span className="text-sm text-fg">{f.label}</span>
                <span className="flex w-16 justify-center"><FeatureCell value={f.free} /></span>
                <span className="flex w-16 justify-center"><FeatureCell value={f.premium} /></span>
              </div>
            ))}
          </div>
        </section>

        {/* Offres Premium */}
        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-[#A67C1E]" />
              <h2 className="font-display text-xl font-medium">Deck individuel</h2>
            </div>
            <p className="mt-2 text-sm text-muted">Un module de révision ciblé pour préparer un chapitre précis.</p>
            <p className="mt-4 font-display text-3xl font-medium text-fg">
              {formatPrice(PRICES_MGA.deck, currency)}
              <span className="ml-1 text-sm font-normal text-muted">/ deck</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Achat unique, à vie</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Accès hors-ligne inclus</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Idéal pour réviser un thème</li>
            </ul>
            <Link
              to="/pro"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-[#A67C1E] hover:text-[#A67C1E]"
            >
              Choisir un deck
              <ArrowRight className="size-4" />
            </Link>
          </article>

          <article className="relative flex flex-col rounded-[var(--radius-lg)] border border-[#A67C1E]/60 bg-card p-6 shadow-[var(--shadow-border)]">
            <span className="absolute -top-3 right-5 rounded-full bg-[#A67C1E] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#EDE0C8]">
              Recommandé
            </span>
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-[#A67C1E]" />
              <h2 className="font-display text-xl font-medium">Pack spécialité</h2>
            </div>
            <p className="mt-2 text-sm text-muted">Tous les decks d'une spécialité + cas cliniques + démarches complètes.</p>
            <p className="mt-4 font-display text-3xl font-medium text-fg">
              {formatPrice(PRICES_MGA.specialty, currency)}
              <span className="ml-1 text-sm font-normal text-muted">/ spécialité</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Achat unique, à vie</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Contenu complet de la spécialité</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />Économique vs decks séparés</li>
            </ul>
            <Link
              to="/pro"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#A67C1E] px-4 py-2.5 text-sm font-semibold text-[#EDE0C8] transition-opacity hover:opacity-90"
            >
              Choisir ma spécialité
              <ArrowRight className="size-4" />
            </Link>
          </article>
        </section>

        {/* Spécialités disponibles */}
        <section className="mt-12">
          <h2 className="font-display text-lg font-medium text-fg">Spécialités disponibles</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PREMIUM_SPECIALTIES.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-fg shadow-[var(--shadow-border)]"
              >
                <BadgeCheck className="size-4 text-[#A67C1E]" />
                {s.label}
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{s.code}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Offre École */}
        <section className="mt-12">
          <article className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-border)] md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="mt-1 size-6 shrink-0 text-[#A67C1E]" />
              <div>
                <h2 className="font-display text-xl font-medium text-fg">Offre École & Établissement</h2>
                <p className="mt-1 text-sm text-muted">
                  Licences multi-sièges pour facultés, associations et groupes d'étudiants.
                  Tarif dégressif et accompagnement dédié.
                </p>
              </div>
            </div>
            <Link
              to="/contact"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] px-4 py-2.5 text-sm font-medium text-[#A67C1E] transition-colors hover:bg-[#A67C1E] hover:text-[#EDE0C8]"
            >
              Demander un devis
              <ArrowRight className="size-4" />
            </Link>
          </article>
        </section>

        {/* Essai gratuit 7 jours (A03) */}
        <section className="mt-10 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[#A67C1E]/50 bg-[#A67C1E]/10 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[#A67C1E]" />
            <div>
              <h2 className="font-display text-lg font-medium text-fg">Essai Premium · 7 jours gratuits</h2>
              <p className="mt-1 text-sm text-muted">
                Cas cliniques et démarches Premium en accès complet pendant 7 jours, sans paiement ni clé.
              </p>
            </div>
          </div>
          <Link
            to="/pro"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#A67C1E] px-4 py-2.5 text-sm font-semibold text-[#EDE0C8] transition-opacity hover:opacity-90"
          >
            Démarrer mon essai
            <ArrowRight className="size-4" />
          </Link>
        </section>

        {/* Note paiement */}
        <section className="mt-10 rounded-[var(--radius-md)] bg-[#A67C1E]/10 p-4 text-sm text-muted">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[#A67C1E]" />
            <span>
              Paiement unique en Ariary via Mobile Money (MVola, Orange Money, Airtel Money).
              Aucun abonnement, aucune carte bancaire requise. Contenu accessible hors-ligne.
            </span>
          </p>
        </section>
      </Page>
    </Shell>
  );
}

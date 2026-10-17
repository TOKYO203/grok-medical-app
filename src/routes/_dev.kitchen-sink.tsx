import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Badge, type BadgeTone } from "@/components/ui/ds/Badge";
import { Button, type ButtonVariant } from "@/components/ui/ds/Button";
import { Card } from "@/components/ui/ds/Card";
import { cn } from "@/lib/utils";

/* ============================================================================
   Kitchen Sink — vitrine du Design System (route de DÉVELOPPEMENT)
   ----------------------------------------------------------------------------
   Sert de référence visuelle et de cible de QA pour les fondations :
   9 niveaux typographiques, 5 tones sémantiques (défaut / survol / désactivé),
   boutons (4 variantes × états) et cartes pilotes.

   La route vit sous le layout `_dev.tsx`, qui renvoie un 404 en production ;
   elle n'est jamais liée depuis la navigation de l'application.

   NOTE BUDGET : la MISE EN PAGE de cette vitrine utilise l'échelle Tailwind
   (`p-4`, `gap-2`, `space-y-6`…), identique par construction aux jetons
   (`--sp-N` = N × 4 px, Tailwind N = N × 0,25 rem = N × 4 px à 16 px racine).
   Les jetons restent le contrat des COMPOSANTS et sont montrés plus bas via
   des styles inline (`var(--sp-N)`, `var(--r-*)`, `var(--tone-*)`) : cela évite
   d'embarquer ~50 utilitaires arbitraires quasi identiques dans la feuille de
   style de production.
   ============================================================================ */

export const Route = createFileRoute("/_dev/kitchen-sink")({
  head: () => ({
    meta: [
      { title: "Kitchen Sink — Optimus Design System" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: KitchenSinkPage,
});

type ToneId = Extract<BadgeTone, "danger" | "warn" | "info" | "success" | "accent">;

const TYPE_SCALE = [
  {
    id: "display-xl",
    label: "Display XL",
    use: "Entrée de page / hero",
    spec: "44 → 64 px · LH 1.02 · −0.04em",
    className: "type-display-xl",
    sample: "La médecine se raisonne.",
  },
  {
    id: "display-lg",
    label: "Display LG",
    use: "Titre de section majeure",
    spec: "36 → 48 px · LH 1.06 · −0.035em",
    className: "type-display-lg",
    sample: "Apprendre. Raisonner. Progresser.",
  },
  {
    id: "display-md",
    label: "Display MD",
    use: "Titre de page interne",
    spec: "30 → 36 px · LH 1.10 · −0.03em",
    className: "type-display-md",
    sample: "Un design system pour Optimus",
  },
  {
    id: "title-lg",
    label: "Titre LG",
    use: "Titre de bloc de contenu",
    spec: "28 px · LH 1.20 · −0.022em",
    className: "type-title-lg",
    sample: "Cardiologie — 36 decks progressifs",
  },
  {
    id: "title",
    label: "Titre",
    use: "Titre de carte / panneau",
    spec: "22 px · LH 1.30 · −0.018em",
    className: "type-title",
    sample: "Syndrome coronarien aigu",
  },
  {
    id: "subtitle",
    label: "Sous-titre",
    use: "Accroche, chapô, libellé fort",
    spec: "18 px · LH 1.40 · −0.01em",
    className: "type-subtitle",
    sample: "Relire une fiche avant la garde",
  },
  {
    id: "body",
    label: "Corps",
    use: "Texte courant",
    spec: "16 px · LH 1.60 · 0em",
    className: "type-body",
    sample:
      "Chaque décision clinique s'appuie sur une trame stable : signaler, hiérarchiser, vérifier.",
  },
  {
    id: "body-sm",
    label: "Corps SM",
    use: "Texte secondaire, aides",
    spec: "14 px · LH 1.55 · +0.005em",
    className: "type-body-sm",
    sample:
      "Les tokens remplacent les valeurs codées en dur : un thème clair, un thème sombre, un seul contrat.",
  },
  {
    id: "micro",
    label: "Micro",
    use: "Étiquette, kicker, unité",
    spec: "12 px · LH 1.45 · +0.06em · capitales",
    className: "type-micro",
    sample: "Étiquette · 12 px",
  },
] as const;

const TONES: ReadonlyArray<{ id: ToneId; label: string; usage: string }> = [
  { id: "danger", label: "Danger", usage: "Erreur, contre-indication, urgence vitale" },
  { id: "warn", label: "Warn", usage: "Prudence, approximation, donnée à vérifier" },
  { id: "info", label: "Info", usage: "Examen, complément, contexte neutre" },
  { id: "success", label: "Success", usage: "Validation, objectif atteint" },
  { id: "accent", label: "Accent", usage: "Signature or, mise en avant éditoriale" },
];

const BUTTON_VARIANTS: ReadonlyArray<{
  id: ButtonVariant;
  label: string;
  usage: string;
  hoverClass: string;
}> = [
  {
    id: "primary",
    label: "Primary",
    usage: "Action principale d'un écran",
    hoverClass: "border-transparent bg-[var(--button-primary-hover)] text-primary-fg",
  },
  {
    id: "secondary",
    label: "Secondary",
    usage: "Action secondaire sur surface",
    hoverClass: "border-border bg-secondary text-fg",
  },
  {
    id: "ghost",
    label: "Ghost",
    usage: "Action discrète, dans une ligne",
    hoverClass: "border-transparent bg-secondary text-fg",
  },
  {
    id: "danger",
    label: "Danger",
    usage: "Action destructive ou irréversible",
    hoverClass: "border-transparent bg-[var(--button-danger-hover)] text-[var(--tone-danger-fg)]",
  },
];

const SPACING_STEPS = Array.from({ length: 16 }, (_, index) => index + 1);
const RADIUS_STEPS = ["sm", "md", "lg", "xl"] as const;
const SHADOW_STEPS = ["subtle", "medium", "overlay"] as const;

function Section({
  id,
  kicker,
  title,
  description,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} data-kitchen-section={id} className="space-y-5">
      <div>
        <p className="type-micro text-[var(--tone-accent)]">{kicker}</p>
        <h2 id={`${id}-title`} className="type-title-lg mt-1">
          {title}
        </h2>
        {description ? (
          <p className="type-body-sm mt-2 max-w-2xl text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StateCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="type-micro text-muted">{label}</span>
      <div className="flex min-h-11 items-center">{children}</div>
    </div>
  );
}

function KitchenSinkPage() {
  return (
    <Shell title="Design System">
      <Page className="mx-auto max-w-5xl space-y-12 py-8 pb-32">
        <div data-kitchen-sink="root">
          <PageHeader
            kicker="Fondations · Session A"
            title="Design System"
            description="Vitrine de contrôle des tokens et des composants pilotes. Route de développement : elle répond 404 en production et n'apparaît jamais dans la navigation."
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot>
              Développement uniquement
            </Badge>
            <code className="type-micro rounded-[var(--r-sm)] border border-border bg-secondary px-2 py-1 text-muted">
              /kitchen-sink
            </code>
            <code className="type-micro rounded-[var(--r-sm)] border border-border bg-secondary px-2 py-1 text-muted">
              src/styles/tokens.css
            </code>
          </div>
        </div>

        {/* ---------------------------------------------------------------- Typo */}
        <Section
          id="typography"
          kicker="01 · Typographie"
          title="9 niveaux, de display-xl à micro"
          description="Chaque niveau expose une taille, un interlignage et une approche (tracking). Les tailles d'affichage sont fluides (clamp), les niveaux de lecture sont fixes."
        >
          <div className="space-y-2">
            {TYPE_SCALE.map((level) => (
              <div
                key={level.id}
                data-type-level={level.id}
                className="rounded-[var(--r-lg)] border border-border bg-card p-4"
              >
                <div className="grid gap-3 md:grid-cols-[13rem_1fr] md:items-baseline">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{level.label}</p>
                    <p className="type-micro mt-1 text-muted">.{level.className}</p>
                    <p className="type-body-sm mt-1 text-muted">{level.use}</p>
                    <p className="type-micro mt-2 text-subtle">{level.spec}</p>
                  </div>
                  <p className={cn(level.className, "min-w-0 break-words")}>{level.sample}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* --------------------------------------------------------------- Tones */}
        <Section
          id="tones"
          kicker="02 · Tones sémantiques"
          title="5 tons, 3 états"
          description="Chaque ton est décliné en défaut, survol et désactivé. Les fonds doux et les liserés sont dérivés du même jeton (color-mix) : les tones ne changent jamais de sens d'un thème à l'autre."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TONES.map((tone) => (
              <Card key={tone.id} padding="md" data-tone-card={tone.id}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={tone.id} size="md">
                    {tone.label}
                  </Badge>
                  <code className="type-micro text-muted">--tone-{tone.id}</code>
                </div>
                <p className="type-body-sm mt-3 text-muted">{tone.usage}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(
                    [
                      { suffix: "", label: "Défaut" },
                      { suffix: "-hover", label: "Survol" },
                      { suffix: "-disabled", label: "Désactivé" },
                    ] as const
                  ).map((state) => (
                    <div key={state.label}>
                      <div
                        aria-hidden="true"
                        data-tone-swatch={state.suffix === "" ? "default" : state.suffix.slice(1)}
                        className="h-12 rounded-[var(--r-sm)] border border-border"
                        style={{ background: `var(--tone-${tone.id}${state.suffix})` }}
                      />
                      <p className="type-micro mt-1 text-muted">{state.label}</p>
                    </div>
                  ))}
                </div>
                <p
                  className="type-body-sm mt-4 font-semibold"
                  style={{ color: `var(--tone-${tone.id})` }}
                >
                  Texte sur fond neutre — AA
                </p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------------- Buttons */}
        <Section
          id="buttons"
          kicker="03 · Boutons"
          title="4 variantes × 4 états"
          description="Normal, chargement, désactivé — et un aperçu statique de la couleur de survol (le survol et le focus réels s'essaient sur la colonne « Normal »)."
        >
          <div className="space-y-3">
            {BUTTON_VARIANTS.map((variant) => (
              <div
                key={variant.id}
                data-button-variant={variant.id}
                className="rounded-[var(--r-lg)] border border-border bg-card p-5"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{variant.label}</p>
                    <p className="type-body-sm text-muted">{variant.usage}</p>
                  </div>
                  <code className="type-micro text-muted">variant=&quot;{variant.id}&quot;</code>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StateCell label="Normal">
                    <Button variant={variant.id}>{variant.label}</Button>
                  </StateCell>
                  <StateCell label="Chargement">
                    <Button variant={variant.id} loading loadingLabel="Chargement en cours">
                      {variant.label}
                    </Button>
                  </StateCell>
                  <StateCell label="Désactivé">
                    <Button variant={variant.id} disabled>
                      {variant.label}
                    </Button>
                  </StateCell>
                  <StateCell label="Survol (aperçu)">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex h-11 select-none items-center justify-center rounded-[var(--r-md)] border px-4 text-sm font-medium",
                        variant.hoverClass,
                      )}
                    >
                      {variant.label}
                    </span>
                  </StateCell>
                </div>
              </div>
            ))}
          </div>

          <Card padding="md" data-button-sizes>
            <p className="type-micro text-muted">Tailles</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm">Small · 36 px</Button>
              <Button size="md">Medium · 44 px</Button>
              <Button size="lg">Large · 48 px</Button>
              <Button variant="secondary" fullWidth className="sm:w-auto sm:min-w-56">
                Pleine largeur (mobile)
              </Button>
            </div>
          </Card>
        </Section>

        {/* --------------------------------------------------------------- Cards */}
        <Section
          id="cards"
          kicker="04 · Cartes"
          title="Padding, interaction, sélection"
          description="La carte est une surface neutre : le rayon, l'ombre et le padding viennent des tokens. `interactive` ajoute l'affordance de survol, `selected` l'état sélectionné."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {(["sm", "md", "lg"] as const).map((padding) => (
              <Card key={padding} padding={padding} data-card-padding={padding}>
                <p className="type-micro text-muted">padding=&quot;{padding}&quot;</p>
                <p className="type-body-sm mt-2">
                  Rayon <code>--r-lg</code>, ombre <code>--sh-subtle</code>.
                </p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card interactive padding="md" data-card-demo="interactive">
              <p className="type-subtitle">Carte interactive</p>
              <p className="type-body-sm mt-2 text-muted">
                Survol : élévation <code>--sh-medium</code> et déplacement de 2 px.
              </p>
            </Card>
            <Card selected padding="md" data-card-demo="selected">
              <div className="flex flex-wrap items-center gap-2">
                <p className="type-subtitle">Carte sélectionnée</p>
                <Badge tone="success">Choisie</Badge>
              </div>
              <p className="type-body-sm mt-2 text-muted">
                Bordure <code>primary</code> + anneau <code>ring-primary/40</code>.
              </p>
            </Card>
          </div>
        </Section>

        {/* -------------------------------------------------------------- Échelles */}
        <Section
          id="scales"
          kicker="05 · Échelles"
          title="Espacement, rayons, ombres"
          description="Contrôle visuel des échelles de base : le pas d'espacement est strict (4 px × N), les rayons vont de 6 à 20 px et les ombres de subtle à overlay."
        >
          <Card padding="md">
            <p className="type-micro text-muted">Espacement — --sp-1 (4 px) → --sp-16 (64 px)</p>
            <ul className="mt-3 space-y-2">
              {SPACING_STEPS.map((step) => (
                <li key={step} className="flex items-center gap-3">
                  <code className="type-micro w-16 shrink-0 text-muted">--sp-{step}</code>
                  <span
                    aria-hidden="true"
                    data-spacing-step={step}
                    className="h-2 shrink-0 rounded-[var(--r-pill)] bg-primary"
                    style={{ width: `var(--sp-${step})` }}
                  />
                  <span className="type-micro text-subtle">{step * 4} px</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="md">
              <p className="type-micro text-muted">Rayons</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {RADIUS_STEPS.map((radius) => (
                  <div key={radius} className="text-center">
                    <div
                      aria-hidden="true"
                      data-radius-step={radius}
                      className="size-16 border border-border bg-secondary"
                      style={{ borderRadius: `var(--r-${radius})` }}
                    />
                    <code className="type-micro mt-1 block text-muted">--r-{radius}</code>
                  </div>
                ))}
              </div>
            </Card>
            <Card padding="md">
              <p className="type-micro text-muted">Ombres</p>
              <div className="mt-3 flex flex-wrap gap-4">
                {SHADOW_STEPS.map((shadow) => (
                  <div key={shadow} className="text-center">
                    <div
                      aria-hidden="true"
                      data-shadow-step={shadow}
                      className="size-16 rounded-[var(--r-md)] bg-card"
                      style={{ boxShadow: `var(--sh-${shadow})` }}
                    />
                    <code className="type-micro mt-1 block text-muted">--sh-{shadow}</code>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>
      </Page>
    </Shell>
  );
}

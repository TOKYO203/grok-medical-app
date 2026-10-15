import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MessageCircle, Github, Sparkles } from "lucide-react";
import { Shell } from "@/components/shell";
import { MEDICAL_CONTENT_VERSION } from "@/content/medical-version";

export const Route = createFileRoute("/a-propos")({ component: AboutPage });

const NAME = "Fondation Optimus";
const FOUNDER = "FETRA Mandresy Onja Andrianantenaina";
const EMAIL = "fondationoptimus@gmail.com";
const WHATSAPP = "261341995741";
const GITHUB = "https://github.com/TOKYO203";

function AboutPage() {
  return (
    <Shell title="À propos">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>

        <div className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-4 p-6">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-2xl text-primary">
              O
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-medium leading-tight break-words">
                {NAME}
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Fondation · Made in Madagascar 🇲🇬
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border p-6">
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary/50 px-4 py-3 text-sm transition-colors hover:bg-secondary"
            >
              <Mail className="size-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Email</span>
              <span className="truncate text-xs text-subtle">{EMAIL}</span>
            </a>

            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary/50 px-4 py-3 text-sm transition-colors hover:bg-secondary"
            >
              <MessageCircle className="size-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">WhatsApp</span>
              <span className="truncate text-xs text-subtle">034 19 957 41</span>
            </a>

            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary/50 px-4 py-3 text-sm transition-colors hover:bg-secondary"
            >
              <Github className="size-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">GitHub</span>
              <span className="truncate text-xs text-subtle">TOKYO203</span>
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card/50 p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Fondée par
          </p>
          <p className="mt-1 text-sm font-medium">{FOUNDER}</p>
          <p className="mt-0.5 text-xs text-subtle">
            Fondateur d'Optimus
          </p>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card/50 p-4 text-center shadow-[var(--shadow-border)]">
          <Sparkles className="mx-auto size-4 text-primary" aria-hidden />
          <p className="mt-2 text-xs text-muted">
            Optimus est né d&apos;une conviction simple : la médecine s&apos;apprend en raisonnant, pas en récitant.
          </p>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Notre histoire
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Étudiant en médecine à Madagascar, j'ai cherché un outil qui combine
            rigueur académique et accessibilité. Ne le trouvant pas, je l'ai construit.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            Optimus est aujourd'hui une plateforme ouverte, pensée pour les étudiants
            malgaches — de la première année à l'internat.
          </p>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Cadre d&apos;usage
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Optimus est un outil éducatif, non d’un substitut au jugement clinique
            professionnel : la décision médicale et la responsabilité de la prise en
            charge restent celles du praticien formé.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Précision : « Optimus Clinical AI » est un tuteur pédagogique — il commente
            et oriente la révision, il ne pose aucun diagnostic, ne donne aucune conduite
            à tenir et n&apos;est pas un dispositif médical.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/confidentialite"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/70"
            >
              Confidentialité
            </Link>
            <Link
              to="/conditions"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/70"
            >
              Conditions d&apos;utilisation
            </Link>
            <Link
              to="/conseil-editorial"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/70"
            >
              Conseil éditorial
            </Link>
            <Link
              to="/validation-clinique"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/70"
            >
              Validation clinique
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-subtle">
          Fondation Optimus · Made in Madagascar 🇲🇬 · v1.0 · 2026 · Contenu médical{" "}
          {MEDICAL_CONTENT_VERSION}
        </p>
      </div>
    </Shell>
  );
}

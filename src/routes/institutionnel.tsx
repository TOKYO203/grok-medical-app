import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Send,
  Stethoscope,
} from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Page, PageHeader, Shell } from "@/components/shell";

export const Route = createFileRoute("/institutionnel")({
  component: InstitutionnelPage,
});

// Tarifs indicatifs — B2B-INSTITUTIONNEL-V2.md §3 : validation propriétaire en
// attente, aucun montant ici n'est un engagement commercial.
const OFFERS = [
  {
    icon: GraduationCap,
    name: "Promo",
    audience: "Une promotion ou un tutorat",
    content: "Licences multi-sièges (au-delà de 10) et suivi de progression agrégé de la promotion.",
    price: "~10 000 Ar / siège / trimestre (dégressif)",
  },
  {
    icon: Building2,
    name: "École",
    audience: "Faculté ou école de prépa",
    content: "Toutes les promotions, tableau de bord établissement et support prioritaire.",
    price: "Devis annuel",
  },
  {
    icon: Stethoscope,
    name: "Département / CHU",
    audience: "Service hospitalier",
    content: "Accès formation continue des internes et rapports trimestriels d'usage.",
    price: "Devis annuel",
  },
];

const PROOFS = [
  "567 questions expliquées et sourcées",
  "78 calculateurs cliniques",
  "Protocole de relecture v2026.10-Mada",
  "Conseil éditorial et registre publics",
];

const FAQ = [
  {
    q: "Comment fonctionne la facturation ?",
    a: "Les offres École et Département / CHU sont facturées annuellement ; l'offre Promo au trimestre, par siège.",
  },
  {
    q: "Comment sont comptés les sièges ?",
    a: "Un siège = un étudiant de la promotion, au-delà d'un minimum de 10. Le tarif unitaire est dégressif selon le volume.",
  },
  {
    q: "Les enseignants ont-ils un accès ?",
    a: "Oui. L'offre École inclut un accès enseignant : suivi de la progression de la promotion, sans accès aux comptes individuels.",
  },
  {
    q: "Que devient la progression des étudiants ?",
    a: "Les données de progression appartiennent à chaque étudiant ; l'établissement ne voit que des agrégés de promotion. Détail sur la page Données.",
  },
];

const STUDENT_RANGES = [
  { value: "lt50", label: "Moins de 50 étudiants" },
  { value: "50-100", label: "50 à 100 étudiants" },
  { value: "100-250", label: "100 à 250 étudiants" },
  { value: "250-500", label: "250 à 500 étudiants" },
  { value: "gt500", label: "Plus de 500 étudiants" },
];

function InstitutionnelPage() {
  return (
    <Shell title="Établissements">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Offre établissements"
            title="Optimus pour votre promotion"
            description="Un socle de révision sourcé et relu, avec un suivi de progression pour toute votre promotion."
          />
        }
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>

        {/* 1 — Hero (B2B-INSTITUTIONNEL-V2.md §2) */}
        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl font-medium tracking-tight">
            Équipez votre promotion d&apos;un socle de révision unique, sourcé et relu.
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Vous devez défendre l&apos;outil devant votre hiérarchie : chaque fiche affiche ses
            sources, chaque deck son statut de relecture — rien à prendre sur parole.
          </p>
          <a
            href="#demonstration"
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] px-4 py-2.5 text-sm font-medium text-[#A67C1E] transition-colors hover:bg-[#A67C1E] hover:text-[#EDE0C8]"
          >
            Demander une démonstration
          </a>
        </section>

        {/* 2 — Problème */}
        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Le problème, sur le terrain</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li>Photocopies hétérogènes : chaque promotion révise sur des supports d&apos;âge et de qualité variables.</li>
            <li>Suivi de progression impossible : personne ne sait qui révise, ni quoi.</li>
            <li>Aucune traçabilité qualité : les erreurs se recopient d&apos;une année sur l&apos;autre.</li>
          </ul>
        </section>

        {/* 3 — Solution */}
        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Ce qu&apos;Optimus apporte</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li>Couverture du programme : 240 items de fiches et de QCM.</li>
            <li>Sources affichées section par section, sous chaque contenu.</li>
            <li>Statut de relecture public et daté, deck par deck.</li>
            <li>Suivi de progression agrégé pour la promotion.</li>
          </ul>
        </section>

        {/* 4 — Preuves */}
        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Des preuves, pas des promesses</h2>
          <ul className="mt-3 grid gap-2">
            {PROOFS.map((proof) => (
              <li key={proof} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {proof}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Le détail des statuts de relecture est public sur la page{" "}
            <Link
              to="/validation-clinique"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Validation clinique
            </Link>
            .
          </p>
        </section>

        {/* 5 — Les 3 offres (§3) */}
        <section className="mt-4 space-y-3">
          {OFFERS.map((offer) => (
            <article
              key={offer.name}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#A67C1E]/15">
                <offer.icon className="size-4 text-[#A67C1E]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{offer.name}</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-subtle">
                  {offer.audience}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{offer.content}</p>
                <p className="mt-2 text-xs font-medium text-fg">{offer.price}</p>
              </div>
            </article>
          ))}
          <p className="text-[11px] text-subtle">
            Tarifs indicatifs, à valider avec la Fondation — aucun montant ci-dessus n&apos;est un
            engagement.
          </p>
        </section>

        {/* 6 — FAQ établissements */}
        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Questions fréquentes des établissements</h2>
          <div className="mt-3 space-y-3">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="text-xs font-medium text-fg">{item.q}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 7 — Lead capture (§4) */}
        <LeadForm />

        {/* 8 — CTA final */}
        <section className="mt-4 rounded-[var(--radius-lg)] border border-[#A67C1E]/50 bg-[#A67C1E]/10 p-5">
          <h2 className="text-sm font-medium text-fg">Parlons de votre promotion.</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Démonstration (visio ou présentiel à Antananarivo), puis pilote d&apos;une promotion
            pendant un trimestre avec bilan d&apos;usage — avant tout engagement annuel.
          </p>
        </section>

      </Page>
    </Shell>
  );
}

function LeadForm() {
  const [establishment, setEstablishment] = useState("");
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [studentRange, setStudentRange] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const requiredFilled = Boolean(
    establishment.trim() && role.trim() && fullName.trim() && email.trim(),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorText("");
    try {
      const response = await fetch("/api/institution-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishment,
          role,
          fullName,
          email,
          phone: phone.trim() || undefined,
          studentRange: studentRange || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (response.status === 202) {
        setStatus("sent");
        return;
      }
      let reason = "Envoi impossible pour le moment. Réessayez plus tard.";
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) reason = body.error;
      } catch {
        // Réponse illisible : le message par défaut suffit.
      }
      setErrorText(reason);
      setStatus("error");
    } catch {
      setErrorText("Connexion impossible. Vérifiez votre réseau puis réessayez.");
      setStatus("error");
    }
  }

  return (
    <section
      id="demonstration"
      className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]"
    >
      <h2 className="text-sm font-medium">Demander une démonstration</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Réponse sous 48 h ouvrées. Votre demande arrive dans notre back-office — pas dans une
        boîte mail : rien ne se perd.
      </p>

      {status === "sent" ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[#A67C1E]/50 bg-[#A67C1E]/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            <CheckCircle2 className="size-4 text-[#A67C1E]" aria-hidden />
            Demande enregistrée
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Merci. Nous revenons vers vous sous 48 h ouvrées pour convenir d&apos;une
            démonstration.
          </p>
        </div>
      ) : (
        <form className="mt-4 grid gap-3" onSubmit={submit}>
          <label className="block text-xs text-muted">
            Établissement *
            <Input
              className="mt-1"
              value={establishment}
              onChange={(e) => setEstablishment(e.target.value)}
              placeholder="Faculté, école, CHU…"
              autoComplete="organization"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Votre fonction *
              <Input
                className="mt-1"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Responsable pédagogique…"
                required
              />
            </label>
            <label className="block text-xs text-muted">
              Votre nom *
              <Input
                className="mt-1"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          </div>
          <label className="block text-xs text-muted">
            E-mail professionnel *
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Téléphone / WhatsApp
              <Input
                className="mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+261 …"
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
            <label className="block text-xs text-muted">
              Nombre d&apos;étudiants
              <select
                className="mt-1 flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60"
                value={studentRange}
                onChange={(e) => setStudentRange(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                {STUDENT_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-muted">
            Message
            <Textarea
              className="mt-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contexte, calendrier souhaité…"
            />
          </label>

          {status === "error" ? (
            <p role="alert" className="text-xs text-fg">
              {errorText}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!requiredFilled || status === "sending"}
            className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] bg-[#A67C1E] px-4 py-3 text-sm font-medium text-[#EDE0C8] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "sending" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {status === "sending" ? "Envoi…" : "Envoyer la demande"}
          </button>
        </form>
      )}
    </section>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Send, ArrowLeft, Save } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Textarea } from "@/components/ui/input";
import { useOptimus } from "@/state/store";
import { useLocale } from "@/i18n";
import { formatShortDate } from "@/i18n/format";
import type { ContactDraft } from "@/core/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contact")({ component: ContactPage });

const EMAIL = "fondationoptimus@gmail.com";
const WHATSAPP = "261341995741";
const WHATSAPP_DISPLAY = "034 19 957 41";
// B20 — corps prérempli du devis École (canal institutionnel).
const SCHOOL_SUBJECT = "Devis École & Établissement";
const SCHOOL_BODY = "Établissement :\nNombre de licences :\nAnnée(s) concernée(s) :\n";

const KINDS: { id: ContactDraft["kind"]; label: string }[] = [
  { id: "contact", label: "Nous contacter" },
  { id: "bug", label: "Problème" },
  { id: "correction", label: "Correction médicale" },
  { id: "deck", label: "Proposer un deck" },
  { id: "idea", label: "Suggestion" },
  { id: "school", label: "École ou établissement" },
];

type Step = "idle" | "form" | "choose";

function ContactPage() {
  const add = useOptimus((s) => s.addContact);
  const locale = useLocale();
  const contacts = useOptimus((s) => s.contacts);
  const [step, setStep] = useState<Step>("idle");
  const [kind, setKind] = useState<ContactDraft["kind"]>("contact");
  const [body, setBody] = useState("");

  const subject = KINDS.find((k) => k.id === kind)?.label ?? "Contact";
  const trimmed = body.trim();
  const hasText = trimmed.length > 0;
  const waHref = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("[" + subject + "]\n\n" + trimmed)}`;
  const mailHref = `mailto:${EMAIL}?subject=${encodeURIComponent("[Optimus] " + subject)}&body=${encodeURIComponent(trimmed)}`;

  function pickKind(id: ContactDraft["kind"]) {
    setKind(id);
    setStep("form");
  }

  function saveDraft() {
    add(kind, trimmed);
    setBody("");
    setStep("idle");
    toast.success("Brouillon conservé");
  }

  function reset() {
    setBody("");
    setStep("idle");
  }

  return (
    <Shell title="Contact">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Contact</h1>
        <p className="mt-2 text-sm text-muted">
          Une question, un bug, une correction ? Écris-nous directement.
        </p>

        {/* ─── Cartes contact direct (toujours visibles) ─── */}
        <div className="mt-5 grid gap-2">
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
              <MessageCircle className="size-4 text-[#25D366]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wider text-muted">WhatsApp</span>
              <span className="block text-sm font-medium">{WHATSAPP_DISPLAY}</span>
            </span>
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Mail className="size-4 text-primary" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wider text-muted">Email</span>
              <span className="block truncate text-sm font-medium">{EMAIL}</span>
            </span>
          </a>
        </div>

        {/* ─── Écoles & établissements (B20) ─── */}
        <div className="mt-3 rounded-[var(--radius-md)] border border-[#A67C1E]/50 bg-[#A67C1E]/10 p-4">
          <p className="text-sm font-medium text-fg">École, faculté ou association ?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Licences multi-sièges, tarif dégressif et accompagnement dédié. Écrivez-nous
            par email : l&apos;objet « Devis École » est prérempli.
          </p>
          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent("[Optimus] " + SCHOOL_SUBJECT)}&body=${encodeURIComponent(SCHOOL_BODY)}`}
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] px-4 py-2.5 text-sm font-medium text-[#A67C1E] transition-colors hover:bg-[#A67C1E] hover:text-[#F4F1FA]"
          >
            <Mail className="size-4" aria-hidden />
            Demander un devis par email
          </a>
          <Link
            to="/institutionnel"
            className="mt-2 block text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Page établissements (demande de démonstration) →
          </Link>
        </div>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-subtle">
          <span className="h-px flex-1 bg-border" />
          Ou écris-nous
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* ─── ÉTAPE 1 : Sujets ─── */}
        {step === "idle" ? (
          <div className="grid gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => pickKind(k.id)}
                className="flex items-center justify-between rounded-[var(--radius-md)] bg-card px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                <span className="font-medium">{k.label}</span>
                <span className="text-muted">→</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* ─── ÉTAPE 2 : Formulaire ─── */}
        {step === "form" ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Sujet
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted hover:text-fg"
              >
                ← Changer
              </button>
            </div>
            <p className="mt-1 text-sm font-medium">{subject}</p>

            <Textarea
              className="mt-3"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Écris ton message..."
              autoFocus
            />

            <button
              type="button"
              disabled={!hasText}
              onClick={() => setStep("choose")}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-3 text-sm font-medium text-primary-fg transition-opacity",
                hasText ? "hover:opacity-90" : "cursor-not-allowed opacity-40",
              )}
            >
              <Send className="size-4" aria-hidden />
              Envoyer
            </button>
          </div>
        ) : null}

        {/* ─── ÉTAPE 3 : Choix du canal ─── */}
        {step === "choose" ? (
          <div>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Modifier le message
            </button>

            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Comment veux-tu l'envoyer ?
            </p>

            <div className="mt-3 grid gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimeout(reset, 300)}
                className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <MessageCircle className="size-4" aria-hidden />
                Envoyer via WhatsApp
              </a>
              <a
                href={mailHref}
                onClick={() => setTimeout(reset, 300)}
                className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80"
              >
                <Mail className="size-4" aria-hidden />
                Envoyer par email
              </a>
              <button
                type="button"
                onClick={saveDraft}
                className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card px-4 py-3 text-sm font-medium shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                <Save className="size-4" aria-hidden />
                Garder comme brouillon
              </button>
            </div>

            <div className="mt-5 rounded-[var(--radius-md)] bg-card/50 p-3 text-xs text-muted">
              <p className="font-medium">Aperçu :</p>
              <p className="mt-1 whitespace-pre-wrap break-words">
                [{subject}] {trimmed}
              </p>
            </div>
          </div>
        ) : null}

        {/* ─── Brouillons ─── */}
        {contacts.length > 0 && step === "idle" ? (
          <div className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Tes brouillons ({contacts.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {contacts.slice().reverse().map((c) => (
                <li
                  key={c.id}
                  className="rounded-[var(--radius-md)] bg-card p-3 text-sm shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {KINDS.find((k) => k.id === c.kind)?.label ?? c.kind}
                    </p>
                    <span className="text-[11px] text-subtle">
                      {formatShortDate(c.createdAt, locale)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words">{c.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}

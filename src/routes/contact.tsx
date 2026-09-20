import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useOptimus } from "@/state/store";
import type { ContactDraft } from "@/core/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMAIL = "fetramandresyo@gmail.com";
const WHATSAPP = "261341995741";
const WHATSAPP_DISPLAY = "034 19 957 41";

export const Route = createFileRoute("/contact")({ component: ContactPage });

const KINDS: { id: ContactDraft["kind"]; label: string }[] = [
  { id: "contact", label: "Nous contacter" },
  { id: "bug", label: "Problème" },
  { id: "correction", label: "Correction médicale" },
  { id: "deck", label: "Proposer un deck" },
  { id: "idea", label: "Suggestion" },
];

function ContactPage() {
  const add = useOptimus((s) => s.addContact);
  const contacts = useOptimus((s) => s.contacts);
  const [kind, setKind] = useState<ContactDraft["kind"]>("contact");
  const [body, setBody] = useState("");

  const subject = KINDS.find((k) => k.id === kind)?.label ?? "Contact";
  const trimmed = body.trim();
  const canSend = trimmed.length >= 8;
  const waHref = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`[${subject}]\n\n${trimmed}`)}`;
  const mailHref = `mailto:${EMAIL}?subject=${encodeURIComponent(`[Optimus] ${subject}`)}&body=${encodeURIComponent(trimmed)}`;

  return (
    <Shell title="Contact">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Contact</h1>
        <p className="mt-2 text-sm text-muted">
          Une question, un bug, une correction ? Écris-nous directement.
        </p>
        <div className="mt-5 grid gap-2">
          <a href={"https://wa.me/" + WHATSAPP} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
              <span className="text-lg">&#x1F4AC;</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wider text-muted">WhatsApp</span>
              <span className="block text-sm font-medium">{WHATSAPP_DISPLAY}</span>
            </span>
          </a>
          <a href={"mailto:" + EMAIL}
             className="flex items-center gap-3 rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <span className="text-lg">&#x2709;&#xFE0F;</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wider text-muted">Email</span>
              <span className="block truncate text-sm font-medium">{EMAIL}</span>
            </span>
          </a>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={cn(
                "h-9 rounded-full px-3 text-sm",
                kind === k.id ? "bg-primary text-primary-fg" : "bg-card shadow-[var(--shadow-border)]",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <Textarea
          className="mt-4"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Décrivez le point — une référence si c’est une correction médicale."
        />
        {canSend ? (
          <div className="mt-3 grid gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              &#x1F4AC; Envoyer via WhatsApp
            </a>
            <a
              href={mailHref}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80"
            >
              &#x2709;&#xFE0F; Envoyer par email
            </a>
          </div>
        ) : null}
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={!canSend}
          onClick={() => {
            add(kind, trimmed);
            setBody("");
            toast.success("Brouillon conservé sur cet appareil");
          }}
        >
          Conserver comme brouillon
        </Button>
        {contacts.length > 0 ? (
          <ul className="mt-8 space-y-2">
            {contacts
              .slice()
              .reverse()
              .map((c) => (
                <li key={c.id} className="rounded-[var(--radius-md)] bg-card p-3 text-sm shadow-[var(--shadow-border)]">
                  <p className="text-xs uppercase tracking-wider text-muted">
                    {c.kind} · {c.sent ? "envoyé" : "brouillon local"}
                  </p>
                  <p className="mt-1">{c.body}</p>
                </li>
              ))}
          </ul>
        ) : null}
      </Page>
    </Shell>
  );
}

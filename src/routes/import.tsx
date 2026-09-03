import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { importDeckJson, type ImportStep } from "@/content/validator";
import { useAllDecks, useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({ component: ImportPage });

const SAMPLE = `{
  "schema_version": 2,
  "deck_id": "DEMO-IMPORT-001",
  "version": "1.0.0",
  "metadata": {
    "title": "Deck de démonstration",
    "subject": "Cardiologie",
    "study_year": 5,
    "difficulty": "intermediate"
  },
  "questions": [
    {
      "prompt": "Le biomarqueur de référence d'un SCA non ST+ est :",
      "choices": ["BNP", "CRP", "Troponine cardiaque", "D-dimères"],
      "correct": 2,
      "explanation": "La troponine ultrasensible, avec cinétique, définit la nécrose myocardique.",
      "sources": [{ "title": "ESC", "citation": "Guidelines ACS 2023.", "year": 2023, "organization": "ESC" }],
      "competency": "diagnosis",
      "difficulty": "base"
    }
  ],
  "sources": [{ "title": "ESC", "citation": "Guidelines ACS 2023.", "year": 2023 }]
}`;

function ImportPage() {
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<ImportStep[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const importDeck = useOptimus((s) => s.importDeck);
  const decks = useAllDecks();

  async function run() {
    const result = await importDeckJson(text, decks.map((d) => d.id));
    setSteps(result.steps);
    if (result.ok) {
      setWarnings(result.warnings);
      importDeck(result.deck);
      toast.success(`${result.deck.title} accepté`);
    } else {
      setWarnings([]);
      toast.error(result.error);
    }
  }

  return (
    <Shell title="Import">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Importer un deck</h1>
        <p className="mt-2 text-sm text-muted">
          JSON → schéma → questions → sources → doublons → hash → signature → acceptation. Les sources sont
          obligatoires.
        </p>
        <Textarea
          className="mt-5 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Collez un deck JSON v2…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void run()} disabled={!text.trim()}>
            Valider
          </Button>
          <Button variant="secondary" onClick={() => setText(SAMPLE)}>
            Exemple
          </Button>
          <a href="/decks/cardio-ic-v2.json" className="inline-flex h-11 items-center text-sm text-muted" download>
            Télécharger un modèle
          </a>
        </div>
        {steps.length > 0 ? (
          <ol className="mt-6 space-y-2">
            {steps.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "rounded-[var(--radius-md)] px-3 py-2 text-sm shadow-[var(--shadow-border)]",
                  s.ok ? "bg-card" : "bg-danger/15",
                )}
              >
                <span className="font-medium">{s.label}</span>
                <span className="ml-2 text-muted">{s.detail}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {warnings.map((w) => (
          <p key={w} className="mt-2 text-xs text-muted">
            {w}
          </p>
        ))}
        <Link to="/parcours" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Retour au parcours →
        </Link>
      </Page>
    </Shell>
  );
}

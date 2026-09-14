import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  getDeviceEncryptionIdentity,
  type DeviceEncryptionIdentity,
} from "@/content/device-encryption";
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
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceEncryptionIdentity | null>(null);
  const importDeck = useOptimus((s) => s.importDeck);
  const profile = useOptimus((s) => s.profile);
  const decks = useAllDecks();

  useEffect(() => {
    if (profile.optimusId === "OM-GUEST") return;
    void getDeviceEncryptionIdentity().then(setDeviceIdentity);
  }, [profile.optimusId]);

  async function run() {
    const result = await importDeckJson(
      text,
      decks.map((d) => d.id),
      profile.optimusId,
      import.meta.env.VITE_DECK_SIGNING_PUBLIC_KEY,
      deviceIdentity ? { ...deviceIdentity, deviceId: profile.deviceId } : undefined,
    );
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

  async function copyDeviceRequest() {
    if (!deviceIdentity) return;
    const request = JSON.stringify({
      format: "optimus-device-request-v1",
      optimus_id: profile.optimusId,
      device_id: profile.deviceId,
      device_key_id: deviceIdentity.keyId,
      public_key: deviceIdentity.publicKey,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Demande Deck Optimus", text: request });
        toast.success("Demande d’achat partagée");
      } else {
        await navigator.clipboard.writeText(request);
        toast.success("Demande d’achat copiée");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Partage impossible — réessayez");
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setText(await file.text());
      setSteps([]);
      setWarnings([]);
      toast.success(`${file.name} prêt à être vérifié`);
    } catch {
      toast.error("Impossible de lire ce fichier");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <Shell title="Import">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Importer un deck</h1>
        <p className="mt-2 text-sm text-muted">
          JSON → schéma → questions → sources → doublons → hash → signature → acceptation. Les
          sources sont obligatoires.
        </p>
        <section className="mt-5 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            🔐 Protection Premium
          </p>
          {profile.optimusId === "OM-GUEST" ? (
            <div className="mt-2">
              <p className="text-sm leading-relaxed text-muted">
                Créez d’abord votre compte Free dans le profil pour obtenir un Deck lié à votre
                appareil.
              </p>
              <Link to="/profil" className="mt-2 inline-block text-sm font-medium text-accent">
                Ouvrir mon profil →
              </Link>
            </div>
          ) : deviceIdentity ? (
            <>
              <p className="mt-2 text-sm font-medium">Cet appareil est prêt</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Copiez cette demande et envoyez-la avec votre preuve de paiement. Le Deck reçu ne
                pourra être ouvert que sur cet appareil.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                size="sm"
                onClick={() => void copyDeviceRequest()}
              >
                Partager ma demande d’achat
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Préparation sécurisée de l’appareil…</p>
          )}
        </section>
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
          <label className="inline-flex h-11 cursor-pointer items-center rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium transition-colors hover:bg-secondary/80">
            Choisir le fichier reçu
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void loadFile(event)}
            />
          </label>
          <Button variant="secondary" onClick={() => setText(SAMPLE)}>
            Exemple
          </Button>
          <a
            href="/decks/cardio-ic-v2.json"
            className="inline-flex h-11 items-center text-sm text-muted"
            download
          >
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

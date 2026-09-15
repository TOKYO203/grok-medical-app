import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CloudOff, Download, ShieldCheck, Trash2 } from "lucide-react";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  deleteOptimusCloudState,
  exportOptimusAccountData,
  pullOptimusState,
  resumeOptimusCloudSync,
} from "@/lib/optimus-sync";

export const Route = createFileRoute("/donnees")({ component: DataPage });

type CloudStatus = "loading" | "active" | "suspended" | "unavailable";

function DataPage() {
  const { user, isPending } = useCurrentUserState();
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("loading");
  const [busy, setBusy] = useState<"export" | "delete" | "resume" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
    let cancelled = false;
    void pullOptimusState()
      .then((state) => {
        if (!cancelled) setCloudStatus(state.syncSuspended ? "suspended" : "active");
      })
      .catch(() => {
        if (!cancelled) setCloudStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

  async function exportData() {
    setBusy("export");
    setMessage(null);
    try {
      const data = await exportOptimusAccountData();
      const payload = {
        ...data,
        account: {
          userId: user?.id ?? null,
          email: user?.primaryEmail ?? null,
          displayName: user?.displayName ?? null,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `optimus-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Votre export Optimus a été préparé.");
    } catch {
      setMessage("L’export n’a pas pu être préparé. Réessayez après reconnexion.");
    } finally {
      setBusy(null);
    }
  }

  async function eraseCloudLearning() {
    if (confirmation !== "SUPPRIMER") return;
    setBusy("delete");
    setMessage(null);
    try {
      await deleteOptimusCloudState({ data: { confirmation: "DELETE_OPTIMUS_DATA" } });
      setCloudStatus("suspended");
      setConfirmation("");
      setMessage(
        "Votre progression pédagogique cloud a été supprimée et la synchronisation est suspendue sur tous vos appareils.",
      );
    } catch {
      setMessage("La suppression n’a pas abouti. Aucune donnée locale n’a été modifiée.");
    } finally {
      setBusy(null);
    }
  }

  async function resumeSync() {
    setBusy("resume");
    setMessage(null);
    try {
      await resumeOptimusCloudSync({ data: { confirmation: "RESUME_OPTIMUS_SYNC" } });
      window.location.reload();
    } catch {
      setBusy(null);
      setMessage("La synchronisation n’a pas pu être réactivée.");
    }
  }

  if (isPending) {
    return (
      <Shell title="Mes données">
        <Page className="py-8">
          <p className="text-sm text-muted">Vérification de votre session…</p>
        </Page>
      </Shell>
    );
  }

  if (!user || user.isDevFallback) {
    return (
      <Shell title="Mes données">
        <Page className="py-8">
          <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
            <SectionTitle kicker="Compte" title="Connexion requise" />
            <p className="text-sm leading-6 text-muted">
              L’export et la suppression des données cloud nécessitent un compte Optimus connecté.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              Se connecter
            </Link>
          </section>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell title="Mes données">
      <Page className="space-y-6 py-8 pb-32">
        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Confidentialité" title="Exporter mes données" />
          <p className="text-sm leading-6 text-muted">
            Téléchargez une copie JSON de votre progression cloud, de vos commandes, de vos réponses
            nominatives aux enquêtes et de vos signalements de contenu liés à ce compte.
          </p>
          <div className="mt-4 rounded-[var(--radius-lg)] bg-secondary p-4 text-xs leading-5 text-muted">
            <ShieldCheck className="mb-2 size-5 text-primary" />
            Les clés privées de l’appareil et les fichiers bruts de preuve de paiement ne figurent pas
            dans l’export : Optimus ne les stocke pas dans le cloud.
          </div>
          <Button className="mt-4 w-full" onClick={() => void exportData()} disabled={busy !== null}>
            <Download className="size-4" />
            {busy === "export" ? "Préparation…" : "Télécharger mon export"}
          </Button>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Synchronisation" title="Progression pédagogique cloud" />
          <p className="text-sm leading-6 text-muted">
            État : {cloudStatus === "suspended" ? "suspendue après suppression" : "active"}.
          </p>
          {cloudStatus === "suspended" ? (
            <div className="mt-4 rounded-[var(--radius-lg)] bg-secondary p-4">
              <div className="flex items-start gap-3">
                <CloudOff className="mt-0.5 size-5 shrink-0 text-muted" />
                <p className="text-sm leading-6 text-muted">
                  Le serveur bloque les nouveaux envois depuis tous vos appareils. Réactiver la
                  synchronisation permettra à cet appareil de créer à nouveau une sauvegarde cloud.
                </p>
              </div>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                disabled={busy !== null}
                onClick={() => void resumeSync()}
              >
                {busy === "resume" ? "Réactivation…" : "Réactiver la synchronisation"}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-[var(--radius-xl)] border border-danger/30 bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Zone sensible" title="Supprimer ma progression cloud" />
          <p className="text-sm leading-6 text-muted">
            Cette action efface la sauvegarde pédagogique du serveur et suspend immédiatement la
            synchronisation sur tous les appareils. Vos données locales, clés privées et contenus
            Premium liés à l’appareil ne sont pas effacés.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            Les commandes, références de paiement et événements d’audit commerciaux ne sont pas
            supprimés par cette action. Leur conservation est gérée séparément pour la traçabilité
            commerciale et la révocation des licences.
          </p>
          <label className="mt-4 block text-xs font-medium text-muted" htmlFor="delete-confirmation">
            Saisissez SUPPRIMER pour confirmer
          </label>
          <Input
            id="delete-confirmation"
            className="mt-2"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            autoComplete="off"
          />
          <Button
            variant="danger"
            className="mt-4 w-full"
            disabled={confirmation !== "SUPPRIMER" || busy !== null || cloudStatus === "suspended"}
            onClick={() => void eraseCloudLearning()}
          >
            <Trash2 className="size-4" />
            {busy === "delete" ? "Suppression…" : "Supprimer la progression cloud"}
          </Button>
        </section>

        {message ? (
          <p role="status" className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted">
            {message}
          </p>
        ) : null}

        <p className="text-center text-xs text-muted">
          <Link to="/profil" className="font-medium text-primary hover:underline">
            Retour au profil
          </Link>
        </p>
      </Page>
    </Shell>
  );
}

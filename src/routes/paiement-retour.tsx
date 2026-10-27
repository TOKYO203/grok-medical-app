import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/paiement-retour")({
  component: PaiementRetour,
});

function PaiementRetour() {
  const search = Route.useSearch() as { status?: string; payment_id?: string };
  const success = search.status === "success";
  const paymentId = search.payment_id ?? "—";

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold mb-4">
        {success ? "Paiement reçu 🎉" : "Paiement en cours"}
      </h1>
      <p className="text-lg mb-6">
        {success
          ? "Ton paiement Mobile Money a été reçu. La licence est en cours de création."
          : "Si tu as payé, la confirmation arrive. Le statut sera mis à jour dans quelques secondes."}
      </p>
      <p className="text-sm text-neutral-600 mb-8">
        Référence Ariari : <code>{paymentId}</code>
      </p>
      <Link
        to="/tarifs"
        className="inline-block px-6 py-3 rounded-lg bg-[#3E4A2A] text-white hover:bg-[#2d3620]"
      >
        Retour à mes offres
      </Link>
    </main>
  );
}

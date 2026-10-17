import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { SigneView } from "@/components/signes/signe-view";
import { useState } from "react";
import mockData from "@/content/data/signes/mock.json";
import type { SignesCatalog } from "@/core/signes/types";

export const Route = createFileRoute("/signes")({ component: SignesPage });

function SignesPage() {
  const catalog = mockData as SignesCatalog;
  const [index, setIndex] = useState(0);
  const currentItem = catalog.items[index];

  return (
    <Shell title="Signes & Syndromes">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">Mode entraînement (Mécanique)</p>
          <span className="rounded-full bg-secondary px-2 py-1 text-xs">
            {index + 1} / {catalog.items.length}
          </span>
        </div>

        <SigneView key={currentItem.id} item={currentItem} />

        <div className="mt-4 flex justify-between">
          <button
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
            className="px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            Précédent
          </button>
          <button
            disabled={index === catalog.items.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            className="px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            Suivant
          </button>
        </div>
      </div>
    </Shell>
  );
}

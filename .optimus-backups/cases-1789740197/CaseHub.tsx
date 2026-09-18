import { DiagnosticCategoryCard } from "./DiagnosticCategoryCard";

type Props = {
  categories: Record<string, number>;
};

export function CaseHub({
  categories,
}: Props) {

  return (
    <section className="space-y-3">

      <h2 className="font-display text-xl font-medium">
        Explorer par spécialité
      </h2>

      {Object.entries(categories).map(
        ([name, count]) => (
          <DiagnosticCategoryCard
            key={name}
            name={name}
            count={count}
          />
        ),
      )}

    </section>
  );
}

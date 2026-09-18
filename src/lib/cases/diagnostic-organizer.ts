import type { DiagnosticCase } from "@/core/types";

export function splitSpecialties(
  specialty: string,
): string[] {
  return specialty
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function groupDiagnosticsBySpecialty(
  diagnostics: DiagnosticCase[],
) {
  const groups: Record<string, DiagnosticCase[]> = {};

  for (const diagnostic of diagnostics) {
    const specialties = splitSpecialties(
      diagnostic.specialty ?? "Autre",
    );

    for (const specialty of specialties) {
      if (!groups[specialty]) {
        groups[specialty] = [];
      }

      groups[specialty].push(diagnostic);
    }
  }

  return groups;
}

export function searchDiagnostics(
  diagnostics: DiagnosticCase[],
  query: string,
) {
  const normalized = query.toLowerCase().trim();

  if (!normalized) {
    return diagnostics;
  }

  return diagnostics.filter((diagnostic) =>
    `${diagnostic.title} ${diagnostic.specialty}`
      .toLowerCase()
      .includes(normalized),
  );
}

export function countDiagnosticGroups(
  diagnostics: DiagnosticCase[],
) {
  return Object.keys(
    groupDiagnosticsBySpecialty(diagnostics),
  ).length;
}

export type ReferencePopulation = {
  label: string;
  unit: string;
  min: number | null;
  max: number | null;
  note?: string;
};

export type ReferenceValue = {
  id: string;
  name: string;
  abbreviation?: string;
  category: string;
  subcategory?: string;
  ranges: ReferencePopulation[];
  interpretationLow?: string;
  interpretationHigh?: string;
  sources: { label: string; url?: string }[];
};

export type ReferenceCategory = {
  id: string;
  label: string;
  count: number;
};

type ReferenceCategoryIndex = { categories: ReferenceCategory[] };

export function listCategories(): ReferenceCategory[] {
  const index = import.meta.glob<{ default: ReferenceCategoryIndex }>(
    "./data/valeurs-reference/_index.json",
    { eager: true },
  );
  const entry = Object.values(index)[0];
  return entry?.default.categories ?? [];
}

export function loadCategoryValues(categoryId: string): ReferenceValue[] {
  const modules = import.meta.glob<{ default: { values: ReferenceValue[] } }>(
    "./data/valeurs-reference/*.json",
    { eager: true },
  );
  for (const [path, mod] of Object.entries(modules)) {
    if (path.includes(`/${categoryId}.json`) && !path.includes("_index")) {
      return mod.default.values ?? [];
    }
  }
  return [];
}

export function loadAllValues(): ReferenceValue[] {
  const modules = import.meta.glob<{ default: { values: ReferenceValue[] } }>(
    "./data/valeurs-reference/*.json",
    { eager: true },
  );
  const all: ReferenceValue[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    if (path.includes("_index")) continue;
    all.push(...(mod.default.values ?? []));
  }
  return all;
}

export function filterValues(values: ReferenceValue[], query: string): ReferenceValue[] {
  if (!query.trim()) return values;
  const q = query.toLowerCase().trim();
  return values.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      (v.abbreviation?.toLowerCase().includes(q) ?? false) ||
      v.category.toLowerCase().includes(q) ||
      (v.subcategory?.toLowerCase().includes(q) ?? false),
  );
}

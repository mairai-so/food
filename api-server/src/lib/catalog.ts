import type { MenuItem } from "./data-store.js";

export type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  active: boolean;
  itemCount: number;
};

export function normalizeCategoryName(value: string | undefined | null): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function categoryId(name: string): string {
  return encodeURIComponent(normalizeCategoryName(name));
}

export function categoryNameFromId(id: string): string | null {
  try {
    const decoded = decodeURIComponent(id);
    const normalized = normalizeCategoryName(decoded);
    return normalized || null;
  } catch {
    return null;
  }
}

export function buildCatalogCategories(items: ReadonlyArray<Pick<MenuItem, "category">>): CatalogCategory[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = normalizeCategoryName(item.category) || "Geral";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
    .map(([name, itemCount], sortOrder) => ({
      id: categoryId(name),
      name,
      description: "",
      sortOrder,
      active: true,
      itemCount,
    }));
}

export function categoryItemsInScope(
  items: ReadonlyArray<MenuItem>,
  companyId: string,
  lojaId?: string,
  belongsToStore?: (itemStoreId: string | undefined, resolvedStoreId: string, companyId: string) => boolean,
): MenuItem[] {
  return items.filter((item) => {
    if (item.restaurantId !== companyId) return false;
    if (!lojaId || !belongsToStore) return true;
    return belongsToStore(item.lojaId, lojaId, companyId);
  });
}

export function renameCategory(
  items: MenuItem[],
  currentName: string,
  nextName: string,
  predicate: (item: MenuItem) => boolean = () => true,
): number {
  const current = normalizeCategoryName(currentName);
  const next = normalizeCategoryName(nextName);
  let changed = 0;
  for (const item of items) {
    if (predicate(item) && normalizeCategoryName(item.category) === current) {
      item.category = next;
      changed += 1;
    }
  }
  return changed;
}

export function deactivateCategory(
  items: MenuItem[],
  name: string,
  predicate: (item: MenuItem) => boolean = () => true,
): number {
  const current = normalizeCategoryName(name);
  let changed = 0;
  for (const item of items) {
    if (predicate(item) && normalizeCategoryName(item.category) === current) {
      item.category = "Geral";
      changed += 1;
    }
  }
  return changed;
}

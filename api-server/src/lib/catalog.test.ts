import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogCategories,
  categoryId,
  categoryNameFromId,
  categoryItemsInScope,
  deactivateCategory,
  normalizeCategoryName,
  renameCategory,
} from "./catalog.ts";
import type { MenuItem } from "./data-store.ts";

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "item-1",
    restaurantId: "company-a",
    lojaId: "store-a",
    name: "Prato",
    description: "",
    price: 20,
    category: "Pratos",
    available: true,
    prepTime: 15,
    ...overrides,
  };
}

test("deriva categorias estáveis dos itens reais", () => {
  const categories = buildCatalogCategories([
    { category: " Pratos  " },
    { category: "Bebidas" },
    { category: "Pratos" },
    { category: "" },
  ]);

  assert.deepEqual(categories.map((category) => [category.name, category.itemCount]), [
    ["Bebidas", 1],
    ["Geral", 1],
    ["Pratos", 2],
  ]);
  assert.equal(categoryNameFromId(categoryId(" Pratos ")), "Pratos");
});

test("filtra catálogo por empresa e loja sem misturar tenants", () => {
  const items = [
    item({ id: "a-1", lojaId: "store-a" }),
    item({ id: "a-2", lojaId: "store-b" }),
    item({ id: "b-1", restaurantId: "company-b", lojaId: "store-a" }),
    item({ id: "legacy", lojaId: undefined }),
  ];
  const belongs = (itemStoreId: string | undefined, resolvedStoreId: string) => itemStoreId === resolvedStoreId || (!itemStoreId && resolvedStoreId === "store-a");

  assert.deepEqual(categoryItemsInScope(items, "company-a", "store-a", belongs).map((entry) => entry.id), ["a-1", "legacy"]);
  assert.deepEqual(categoryItemsInScope(items, "company-a", "store-b", belongs).map((entry) => entry.id), ["a-2"]);
});

test("renomeia categoria apenas dentro do escopo selecionado", () => {
  const items = [item({ id: "a-1" }), item({ id: "a-2", lojaId: "store-b" }), item({ id: "b-1", restaurantId: "company-b" })];
  const changed = renameCategory(items, "Pratos", "Principais", (entry) => entry.restaurantId === "company-a" && entry.lojaId === "store-a");

  assert.equal(changed, 1);
  assert.equal(items[0].category, "Principais");
  assert.equal(items[1].category, "Pratos");
  assert.equal(items[2].category, "Pratos");
});

test("desativar categoria move itens para Geral e preserva os itens", () => {
  const items = [item({ id: "a-1" }), item({ id: "a-2", category: "Pratos" })];
  const changed = deactivateCategory(items, normalizeCategoryName("Pratos"));

  assert.equal(changed, 2);
  assert.deepEqual(items.map((entry) => entry.category), ["Geral", "Geral"]);
  assert.deepEqual(items.map((entry) => entry.id), ["a-1", "a-2"]);
});

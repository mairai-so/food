import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, ChevronDown, Edit3, Grid3X3, List, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { useTranslation } from "@/i18n/IdiomaContext";
import { lojaHeaders } from "@/lib/loja";

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryName?: string;
  available: boolean;
  prepTime: number;
  prepTimeMinutes?: number;
};

type CatalogCategory = {
  id: string;
  name: string;
  itemCount: number;
  active: boolean;
};

type ItemForm = {
  name: string;
  description: string;
  price: string;
  category: string;
  prepTime: string;
  available: boolean;
};

const EMPTY_FORM: ItemForm = {
  name: "",
  description: "",
  price: "",
  category: "Geral",
  prepTime: "15",
  available: true,
};

function authHeaders(): Record<string, string> {
  const token = window.localStorage.getItem("miar-owner-token") ?? window.sessionStorage.getItem("miar-owner-token") ?? "";
  return { Authorization: `Bearer ${token}`, ...lojaHeaders() };
}

async function catalogFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : `Falha ao comunicar com o catálogo (${response.status})`);
  }
  return body as T;
}

function currency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Catalogo() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextItems, nextCategories] = await Promise.all([
        catalogFetch<CatalogItem[]>("/api/menu/items"),
        catalogFetch<CatalogCategory[]>("/api/menu/categories"),
      ]);
      setItems(nextItems);
      setCategories(nextCategories);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("catalog.error.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.description}`.toLocaleLowerCase("pt-BR").includes(query);
      const matchesCategory = !categoryFilter || (item.categoryName ?? item.category) === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, items, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category: categoryFilter || "Geral" });
    setNotice("");
  };

  const openEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.categoryName ?? item.category ?? "Geral",
      prepTime: String(item.prepTimeMinutes ?? item.prepTime ?? 15),
      available: item.available,
    });
    setNotice("");
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Geral",
        price: Number(form.price),
        prepTime: Number(form.prepTime),
        available: form.available,
      };
      if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
        throw new Error(t("catalog.error.required"));
      }
      if (editingId) {
        await catalogFetch<CatalogItem>(`/api/menu/items/${encodeURIComponent(editingId)}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice(t("catalog.notice.updated"));
      } else {
        await catalogFetch<CatalogItem>("/api/menu/items", { method: "POST", body: JSON.stringify(payload) });
        setNotice(t("catalog.notice.created"));
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("catalog.error.save"));
    } finally {
      setSaving(false);
    }
  };

  const deactivateItem = async (item: CatalogItem) => {
    if (!window.confirm(t("catalog.confirm.deactivateItem"))) return;
    setError("");
    try {
      await catalogFetch(`/api/menu/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setNotice(t("catalog.notice.deactivated"));
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("catalog.error.save"));
    }
  };

  const renameCategory = async (category: CatalogCategory) => {
    const nextName = categoryNameDraft.trim();
    if (!nextName) return;
    setError("");
    try {
      await catalogFetch(`/api/menu/categories/${encodeURIComponent(category.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      });
      setEditingCategoryId(null);
      setCategoryNameDraft("");
      setNotice(t("catalog.notice.categoryUpdated"));
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("catalog.error.save"));
    }
  };

  const deactivateCategory = async (category: CatalogCategory) => {
    if (!window.confirm(t("catalog.confirm.deactivateCategory"))) return;
    setError("");
    try {
      await catalogFetch(`/api/menu/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
      if (categoryFilter === category.name) setCategoryFilter("");
      setNotice(t("catalog.notice.categoryDeactivated"));
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("catalog.error.save"));
    }
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/painel" className="mb-3 inline-flex items-center text-xs text-slate-500 transition hover:text-slate-200">← {t("catalog.back")}</Link>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">{t("catalog.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("catalog.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t("catalog.subtitle")}</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.98]">
            <Plus size={17} /> {t("catalog.newItem")}
          </button>
        </div>

        {(error || notice) && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`} role="status">
            {error || notice}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-xl shadow-slate-950/20 sm:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="relative min-w-0 flex-1">
                  <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("catalog.search")} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400" />
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1" aria-label={t("catalog.viewLabel")}>
                    <button type="button" onClick={() => setView("grid")} aria-label={t("catalog.gridView")} className={`rounded-lg p-2 ${view === "grid" ? "bg-slate-800 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}><Grid3X3 size={16} /></button>
                    <button type="button" onClick={() => setView("list")} aria-label={t("catalog.listView")} className={`rounded-lg p-2 ${view === "list" ? "bg-slate-800 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}><List size={16} /></button>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">{filteredItems.length} / {items.length}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label={t("catalog.categories")}>
                <button type="button" onClick={() => setCategoryFilter("")} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${!categoryFilter ? "border-emerald-400 bg-emerald-400/10 text-emerald-300" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>{t("catalog.allCategories")}</button>
                {categories.map((category) => (
                  <button type="button" key={category.id} onClick={() => setCategoryFilter(category.name)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${categoryFilter === category.name ? "border-emerald-400 bg-emerald-400/10 text-emerald-300" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>{category.name} <span className="text-slate-600">{category.itemCount}</span></button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((key) => <div key={key} className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
                <Tag className="mx-auto text-slate-600" size={28} />
                <h2 className="mt-3 font-semibold text-slate-200">{t("catalog.emptyTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("catalog.emptyText")}</p>
                <button type="button" onClick={openCreate} className="mt-4 rounded-xl border border-emerald-400/40 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-400/10">{t("catalog.newItem")}</button>
              </div>
            ) : (
              <div className={`mt-5 ${view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}`}>
                {filteredItems.map((item) => (
                  <article key={item.id} className={`group rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-600 ${view === "list" ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="truncate font-semibold text-slate-100">{item.name}</p>
                          <p className="mt-1 text-xs text-emerald-300">{item.categoryName ?? item.category}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.available ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>{item.available ? t("catalog.available") : t("catalog.inactive")}</span>
                      </div>
                      <p className="mt-3 min-h-10 text-sm leading-5 text-slate-400">{item.description || t("catalog.noDescription")}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-lg font-semibold text-slate-100">{currency(item.price)}</span>
                        <span className="text-xs text-slate-500">{item.prepTimeMinutes ?? item.prepTime ?? 15} min</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-slate-800 pt-3 sm:mt-0 sm:border-t-0 sm:pt-0">
                      <button type="button" onClick={() => openEdit(item)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"><Edit3 size={14} /> {t("catalog.edit")}</button>
                      {item.available && <button type="button" onClick={() => void deactivateItem(item)} aria-label={`${t("catalog.deactivate")} ${item.name}`} className="rounded-lg border border-rose-500/30 px-3 py-2 text-rose-300 hover:bg-rose-500/10"><Trash2 size={14} /></button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <form onSubmit={saveItem} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">{editingId ? t("catalog.editEyebrow") : t("catalog.createEyebrow")}</p>
                  <h2 className="mt-2 text-lg font-semibold">{editingId ? t("catalog.editTitle") : t("catalog.createTitle")}</h2>
                </div>
                {editingId && <button type="button" onClick={openCreate} aria-label={t("catalog.cancel")} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100"><X size={17} /></button>}
              </div>
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-slate-400">{t("catalog.name")}<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400" /></label>
                <label className="block text-xs text-slate-400">{t("catalog.category")}<input list="catalog-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400" /><datalist id="catalog-categories">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-slate-400">{t("catalog.price")}<input required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400" /></label>
                  <label className="block text-xs text-slate-400">{t("catalog.prepTime")}<input min="0" step="1" type="number" value={form.prepTime} onChange={(event) => setForm({ ...form, prepTime: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400" /></label>
                </div>
                <label className="block text-xs text-slate-400">{t("catalog.description")}<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400" /></label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-300"><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} className="h-4 w-4 accent-emerald-500" />{t("catalog.availableForSale")}</label>
                <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? t("catalog.saving") : <><Check size={16} /> {editingId ? t("catalog.saveChanges") : t("catalog.createItem")}</>}</button>
              </div>
            </form>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">{t("catalog.categoriesEyebrow")}</p><h2 className="mt-2 text-lg font-semibold">{t("catalog.categoriesTitle")}</h2></div>
                <Tag size={18} className="text-sky-300" />
              </div>
              <div className="mt-4 space-y-2">
                {categories.length === 0 ? <p className="text-sm text-slate-500">{t("catalog.noCategories")}</p> : categories.map((category) => (
                  <div key={category.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    {editingCategoryId === category.id ? (
                      <div className="flex gap-2"><input autoFocus value={categoryNameDraft} onChange={(event) => setCategoryNameDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400" /><button type="button" onClick={() => void renameCategory(category)} aria-label={t("catalog.saveCategory")} className="rounded-lg bg-sky-400 px-2.5 text-slate-950"><Check size={15} /></button><button type="button" onClick={() => setEditingCategoryId(null)} aria-label={t("catalog.cancel")} className="rounded-lg border border-slate-700 px-2.5 text-slate-300"><X size={15} /></button></div>
                    ) : (
                      <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => setCategoryFilter(category.name)} className="min-w-0 truncate text-left text-sm font-medium text-slate-200 hover:text-emerald-300">{category.name} <span className="ml-1 text-xs font-normal text-slate-500">{category.itemCount}</span></button><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setEditingCategoryId(category.id); setCategoryNameDraft(category.name); }} aria-label={`${t("catalog.rename")} ${category.name}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100"><Pencil size={14} /></button><button type="button" onClick={() => void deactivateCategory(category)} aria-label={`${t("catalog.deactivate")} ${category.name}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button></div></div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-600">{t("catalog.categoryRule")}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

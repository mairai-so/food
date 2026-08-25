import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { restaurants, menuItems, tables, stockItems, createMenuItem, feedPosts, addFeedPost, FEED_MEDIA_POR_PLANO, getSettings, resolverLojaId, pertenceALoja, type FeedPostMediaType } from "../lib/data-store";
import { execute, query, queryOne } from "../lib/db";
import { requireAnyAuth, requireClientAuth, requireOwnerAuth, verifyToken } from "./auth";
import { saveSnapshotConfirmed } from "../lib/persistence";
import {
  buildCatalogCategories,
  categoryItemsInScope,
  categoryNameFromId,
  normalizeCategoryName,
  renameCategory,
  deactivateCategory,
} from "../lib/catalog";

const router: IRouter = Router();

type SearchSort = "relevance" | "distance" | "free_delivery" | "quality" | "price" | "speed" | "promotions";
const SEARCH_SORTS = new Set<SearchSort>(["relevance", "distance", "free_delivery", "quality", "price", "speed", "promotions"]);

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function preferenceWeight(preferences: unknown, sort: SearchSort): number {
  if (!Array.isArray(preferences)) return 0;
  const index = preferences.indexOf(sort);
  return index < 0 ? 0 : preferences.length - index;
}

function matchesLocation(address: string, location?: string): boolean {
  return !location || normalizeSearch(address).includes(normalizeSearch(location));
}

export async function initFeedModerationTables(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS feed_publication_moderation (
      post_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'removed')),
      report_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS feed_publication_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id TEXT NOT NULL,
      reporter_client_id UUID NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS feed_publication_moderation_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('substantiated', 'dismissed')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

router.get("/restaurants", async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };
  let result = restaurants;
  if (search) {
    const q = search.toLowerCase();
    result = restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
    );
  }
  res.json(result);
});

router.get("/search", async (req, res): Promise<void> => {
  const queryText = String(req.query.q ?? req.query.search ?? "").trim();
  const normalizedQuery = normalizeSearch(queryText);
  const location = String(req.query.location ?? "").trim();
  const sortParam = String(req.query.sort ?? "relevance") as SearchSort;
  const sort = SEARCH_SORTS.has(sortParam) ? sortParam : "relevance";
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  const openNow = req.query.openNow === "true";

  let preferences: unknown = [];
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const payload = verifyToken(header.slice(7));
    if (payload?.isClientUser && typeof payload.clientId === "string") {
      const account = await queryOne<{ discoveryPreferences: unknown }>(
        "SELECT discovery_preferences AS \"discoveryPreferences\" FROM client_accounts WHERE id = $1",
        [payload.clientId],
      );
      preferences = account?.discoveryPreferences ?? [];
    }
  }

  const restaurantResults = restaurants
    .filter((restaurant) => matchesLocation(restaurant.address, location))
    .filter((restaurant) => !openNow || restaurant.openNow)
    .filter((restaurant) => !Number.isFinite(minPrice) || restaurant.pricePerPerson >= minPrice)
    .filter((restaurant) => !Number.isFinite(maxPrice) || restaurant.pricePerPerson <= maxPrice)
    .map((restaurant) => {
      const restaurantText = normalizeSearch(`${restaurant.name} ${restaurant.cuisine} ${restaurant.address}`);
      const textMatch = !normalizedQuery || restaurantText.includes(normalizedQuery);
      const matchingItems = menuItems.filter((item) => item.restaurantId === restaurant.id && item.available && (!normalizedQuery || normalizeSearch(`${item.name} ${item.category} ${item.description}`).includes(normalizedQuery)));
      const matches = textMatch || matchingItems.length > 0;
      const score = (textMatch ? 10 : 0)
        + (matchingItems.length ? 8 : 0)
        + preferenceWeight(preferences, "quality") * (restaurant.rating / 5)
        + preferenceWeight(preferences, "distance") * (1 / Math.max(restaurant.distance, 0.1))
        + preferenceWeight(preferences, "price") * (1 / Math.max(restaurant.pricePerPerson, 1)) * 20
        + preferenceWeight(preferences, "speed") * (1 / Math.max(restaurant.waitTime, 1)) * 10
        + (sort === "quality" ? restaurant.rating * 10 : 0)
        + (sort === "distance" ? 1 / Math.max(restaurant.distance, 0.1) * 10 : 0)
        + (sort === "price" ? 1 / Math.max(restaurant.pricePerPerson, 1) * 100 : 0)
        + (sort === "speed" ? 1 / Math.max(restaurant.waitTime, 1) * 100 : 0);
      return {
        kind: "restaurant" as const,
        restaurant,
        matchingItems,
        score,
        highlights: [
          ...(restaurant.distance <= 1.5 ? ["distance"] : []),
          ...(restaurant.rating >= 4.7 ? ["quality"] : []),
          ...(restaurant.pricePerPerson <= 50 ? ["price"] : []),
          ...(restaurant.waitTime > 0 && restaurant.waitTime <= 10 ? ["speed"] : []),
          ...(restaurant.openNow ? ["open"] : []),
        ],
      };
    })
    .filter((result) => !normalizedQuery || normalizeSearch(`${result.restaurant.name} ${result.restaurant.cuisine} ${result.restaurant.address} ${result.matchingItems.map((item) => `${item.name} ${item.category}`).join(" ")}`).includes(normalizedQuery))
    .sort((a, b) => b.score - a.score);

  res.json({ query: queryText, sort, appliedPreferences: Array.isArray(preferences) ? preferences : [], location: location || null, results: restaurantResults });
});

router.get("/restaurants/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const restaurant = restaurants.find((r) => r.id === id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurante não encontrado" });
    return;
  }
  res.json(restaurant);
});

// Rota pública (App Cliente). Query opcional ?lojaId=xxx — se a conta usa
// cardápio por loja e um lojaId válido for passado, filtra; caso contrário
// (cardápio compartilhado, ou nenhum lojaId informado), retorna tudo, igual
// ao comportamento de sempre. Nunca quebra pra quem não usa multi-loja.
router.get("/restaurants/:id/menu", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const settings = getSettings(id);
  const lojaIdQuery = (req.query.lojaId as string) || undefined;
  const items = menuItems.filter((m) => {
    if (m.restaurantId !== id) return false;
    if (!settings.cardapioPorLoja || !lojaIdQuery) return true; // compartilhado ou sem loja informada
    return pertenceALoja(m.lojaId, lojaIdQuery, id);
  });
  res.json(items);
});

router.get("/restaurants/:id/tables", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const availableTables = tables.filter(
    (t) => t.restaurantId === id && t.status === "free"
  );
  res.json(availableTables);
});

router.post("/feed", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).owner.companyId as string;
  const restaurant = restaurants.find((r) => r.id === companyId);
  if (!restaurant) {
    res.status(404).json({ error: "Estabelecimento não encontrado" });
    return;
  }

  const body = req.body as {
    mediaType?: FeedPostMediaType;
    title?: string;
    content?: string;
    mediaUrl?: string;
    emoji?: string;
  };

  const mediaType = body.mediaType ?? "texto";
  const title = body.title?.trim();
  const content = body.content?.trim();

  if (!title || !content) {
    res.status(400).json({ error: "title e content são obrigatórios" });
    return;
  }

  // Formato de post permitido depende do plano do estabelecimento (regra
  // comercial 09/08/2026). Isso é só sobre o que o ESTABELECIMENTO consegue
  // publicar — não afeta a visibilidade dele nem o que o CLIENTE posta.
  const permitidos = FEED_MEDIA_POR_PLANO[getSettings(companyId).plano] ?? FEED_MEDIA_POR_PLANO["tio-do-dog"];
  if (!permitidos.includes(mediaType)) {
    res.status(403).json({
      error: `Seu plano (${getSettings(companyId).plano}) só permite postar: ${permitidos.join(", ")}. Para postar em ${mediaType}, é preciso fazer upgrade de plano.`,
    });
    return;
  }

  if ((mediaType === "imagem" || mediaType === "video") && !body.mediaUrl) {
    res.status(400).json({ error: "mediaUrl é obrigatório para posts de imagem ou vídeo" });
    return;
  }

  const post = addFeedPost({
    id: randomUUID(),
    restaurantId: companyId,
    restaurantName: restaurant.name,
    segment: restaurant.cuisine,
    mediaType,
    title,
    content,
    mediaUrl: body.mediaUrl,
    emoji: body.emoji ?? "📣",
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(post);
});

// Public feed endpoint
router.get("/feed", async (_req, res): Promise<void> => {
  const states = await query<{ post_id: string; status: string }>(
    "SELECT post_id, status FROM feed_publication_moderation WHERE status <> 'active'",
  );
  const unavailable = new Set(states.map((state) => state.post_id));
  res.json(feedPosts.filter((post) => !unavailable.has(post.id)));
});

router.post("/feed/:postId/report", requireClientAuth, async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const post = feedPosts.find((candidate) => candidate.id === postId);
  const reason = String((req.body as { reason?: string })?.reason ?? "").trim();
  const reporterClientId = (req as any).clientId as string;

  if (!post) {
    res.status(404).json({ error: "Publicação não encontrada" });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: "Motivo da denúncia é obrigatório" });
    return;
  }
  if (reason.length > 500) {
    res.status(400).json({ error: "Motivo da denúncia deve ter no máximo 500 caracteres" });
    return;
  }

  const report = await queryOne<{ id: string }>(
    `INSERT INTO feed_publication_reports (post_id, reporter_client_id, reason)
     VALUES ($1, $2, $3) RETURNING id`,
    [postId, reporterClientId, reason],
  );
  const moderation = await queryOne<{ report_count: number }>(
    `INSERT INTO feed_publication_moderation (post_id, status, report_count)
     VALUES ($1, 'under_review', 1)
     ON CONFLICT (post_id) DO UPDATE SET
       report_count = feed_publication_moderation.report_count + 1,
       status = CASE WHEN feed_publication_moderation.status = 'removed' THEN 'removed' ELSE 'under_review' END,
       updated_at = NOW()
     RETURNING report_count`,
    [postId],
  );

  res.status(202).json({
    id: report?.id,
    postId,
    status: "under_review",
    reportCount: moderation?.report_count ?? 1,
    message: "Denúncia registrada e encaminhada para análise.",
  });
});

router.get("/feed/moderation/reports", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).owner.companyId as string;
  const postIds = feedPosts.filter((post) => post.restaurantId === companyId).map((post) => post.id);
  const rows = await query(
    `SELECT r.*, m.status, m.report_count
     FROM feed_publication_reports r
     JOIN feed_publication_moderation m ON m.post_id = r.post_id
     WHERE r.post_id = ANY($1::text[])
     ORDER BY r.created_at DESC`,
    [postIds],
  );
  res.json(rows);
});

router.patch("/feed/moderation/:postId", requireOwnerAuth, async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const companyId = (req as any).owner.companyId as string;
  const post = feedPosts.find((candidate) => candidate.id === postId && candidate.restaurantId === companyId);
  const { decision, notes } = req.body as { decision?: string; notes?: string };
  if (!post) { res.status(404).json({ error: "Publicação não encontrada neste estabelecimento" }); return; }
  if (decision !== "substantiated" && decision !== "dismissed") {
    res.status(400).json({ error: "Decisão deve ser substantiated ou dismissed" });
    return;
  }
  await execute(
    `INSERT INTO feed_publication_moderation_decisions (post_id, moderator_id, decision, notes)
     VALUES ($1, $2, $3, $4)`,
    [postId, (req as any).owner.ownerId as string, decision, notes?.trim() || null],
  );
  await execute(
    `UPDATE feed_publication_moderation SET status = $1, updated_at = NOW() WHERE post_id = $2`,
    [decision === "substantiated" ? "removed" : "active", postId],
  );
  res.json({ postId, status: decision === "substantiated" ? "removed" : "active", decision });
});

// Public endpoint — near-expiry stock alerts for a restaurant (no auth required)
router.get("/restaurants/:id/stock-alerts", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const now = Date.now();
  const alerts = stockItems
    .filter((s) => {
      if (s.restaurantId !== id || !s.expiresAt) return false;
      const msLeft = new Date(s.expiresAt).getTime() - now;
      const daysLeft = msLeft / 86400000;
      return daysLeft >= 0 && daysLeft <= s.alertDaysBefore;
    })
    .map((s) => ({
      name: s.name,
      daysLeft: Math.ceil((new Date(s.expiresAt!).getTime() - now) / 86400000),
    }));
  res.json(alerts);
});

export default router;

// ─── Criar item de cardápio (tenant-scoped) ────────────────────────────────────
router.post("/menu-items", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  // Só grava lojaId se a conta realmente usa cardápio por loja — senão o
  // prato fica "solto" (sem lojaId), aparecendo em todas as lojas da conta.
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const { name, description, price, category, prepTime, available } = req.body as {
    name: string; description?: string; price: number; category?: string;
    prepTime?: number; available?: boolean;
  };
  if (!name || typeof price !== "number") {
    res.status(400).json({ error: "name e price são obrigatórios" });
    return;
  }
  // CORRIGIDO 29/07/2026: usa createMenuItem() em vez de menuItems.push()
  // direto — o push manual não chamava scheduleSave, então o prato sumia
  // se o servidor reiniciasse antes de outra escrita salvar o array inteiro.
  const newItem = createMenuItem({
    restaurantId: companyId,
    lojaId,
    name,
    description: description ?? "",
    price,
    category: category ?? "Geral",
    prepTime: prepTime ?? 15,
    available: available ?? true,
  });
  res.status(201).json(newItem);
});

// ─── Ficha técnica (29/07/2026) ────────────────────────────────────────────────
// Vincula um prato aos itens de estoque que ele consome, com a quantidade por
// unidade vendida. É essa ficha que alimenta a baixa automática de estoque
// (orders.ts) e, depois, a análise de rentabilidade por prato.
// NÃO fica pendurada em miar-compat.ts (rota antiga sem autenticação) — fica
// aqui, exigindo login de dono/funcionário e checando companyId de verdade.

// Alias para a rota do Gestor que usa /restaurants/me/menu-completo.
router.get("/restaurants/me/menu-completo", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const items = menuItems.filter((m) => m.restaurantId === companyId && (!lojaId || pertenceALoja(m.lojaId, lojaId, companyId)));
  res.json(items);
});

router.get("/restaurants/:id/menu-completo", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const items = menuItems.filter((m) => m.restaurantId === companyId && (!lojaId || pertenceALoja(m.lojaId, lojaId, companyId)));
  res.json(items);
});

router.patch("/menu-items/:id/ficha-tecnica", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const menuItem = menuItems.find((m) => m.id === req.params.id && m.restaurantId === companyId);
  if (!menuItem) { res.status(404).json({ error: "Prato não encontrado" }); return; }

  const { fichaTecnica } = req.body as {
    fichaTecnica?: { stockItemId: string; quantidadePorUnidade: number }[];
  };
  if (!Array.isArray(fichaTecnica)) {
    res.status(400).json({ error: "fichaTecnica precisa ser um array de { stockItemId, quantidadePorUnidade }" });
    return;
  }

  // Valida que todo insumo citado existe de verdade e pertence a este restaurante
  // — nunca aceita vincular a um item de estoque de outro tenant.
  for (const ing of fichaTecnica) {
    const stockItem = stockItems.find((s) => s.id === ing.stockItemId && s.restaurantId === companyId);
    if (!stockItem) {
      res.status(400).json({ error: `Item de estoque ${ing.stockItemId} não encontrado neste restaurante` });
      return;
    }
    if (typeof ing.quantidadePorUnidade !== "number" || ing.quantidadePorUnidade <= 0) {
      res.status(400).json({ error: `quantidadePorUnidade inválida para ${stockItem.name}` });
      return;
    }
  }

  menuItem.fichaTecnica = fichaTecnica;
  res.json(menuItem);
});


// ─── Catálogo do Gestor — derivado da fonte única `menuItems` ───────────────────
// Categorias não são uma coleção adicional: são nomes derivados dos produtos.
// Assim, uma categoria nova nasce ao cadastrar o primeiro item nessa categoria;
// renomear e desativar categoria atualizam os próprios menuItems e o snapshot
// existente, sem criar outro datastore, schema ou fonte de verdade.

type CatalogItemBody = {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  prepTime?: number;
  available?: boolean;
};

function catalogScope(req: any): { companyId: string; lojaId?: string } {
  const companyId = req.owner?.companyId ?? req.auth?.companyId;
  const settings = getSettings(companyId);
  if (!settings.cardapioPorLoja) return { companyId };
  const requested = String(req.headers["x-loja-id"] ?? req.query?.lojaId ?? "").trim() || undefined;
  return { companyId, lojaId: resolverLojaId(companyId, requested) };
}

function scopedCatalogItems(req: any) {
  const { companyId, lojaId } = catalogScope(req);
  return {
    companyId,
    lojaId,
    items: categoryItemsInScope(menuItems, companyId, lojaId, pertenceALoja),
  };
}

function toCatalogItem(item: typeof menuItems[number]) {
  return {
    ...item,
    categoryId: encodeURIComponent(normalizeCategoryName(item.category) || "Geral"),
    categoryName: normalizeCategoryName(item.category) || "Geral",
    prepTimeMinutes: item.prepTime,
  };
}

router.get("/menu/categories", requireOwnerAuth, async (req, res): Promise<void> => {
  const { items } = scopedCatalogItems(req);
  res.json(buildCatalogCategories(items));
});

router.get("/menu/items", requireOwnerAuth, async (req, res): Promise<void> => {
  const { items } = scopedCatalogItems(req);
  const search = String(req.query.search ?? "").trim().toLocaleLowerCase("pt-BR");
  const category = normalizeCategoryName(String(req.query.category ?? ""));
  const available = req.query.available === undefined ? undefined : String(req.query.available) === "true";
  const filtered = items.filter((item) => {
    if (search && !`${item.name} ${item.description}`.toLocaleLowerCase("pt-BR").includes(search)) return false;
    if (category && normalizeCategoryName(item.category) !== category) return false;
    if (available !== undefined && item.available !== available) return false;
    return true;
  });
  res.json(filtered.map(toCatalogItem));
});

router.post("/menu/items", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = catalogScope(req);
  const settings = getSettings(companyId);
  const body = req.body as CatalogItemBody;
  const name = normalizeCategoryName(body.name);
  const category = normalizeCategoryName(body.category) || "Geral";
  const price = Number(body.price);
  if (!name || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "name e price válido são obrigatórios" });
    return;
  }
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(companyId, String(req.headers["x-loja-id"] ?? "").trim() || undefined)
    : undefined;
  const item = createMenuItem({
    restaurantId: companyId,
    lojaId,
    name,
    description: String(body.description ?? "").trim(),
    price,
    category,
    prepTime: Number.isFinite(Number(body.prepTime)) && Number(body.prepTime) >= 0 ? Number(body.prepTime) : 15,
    available: body.available !== false,
  });
  res.status(201).json(toCatalogItem(item));
});

async function updateCatalogItem(req: any, res: any): Promise<void> {
  const { companyId, lojaId } = catalogScope(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const item = menuItems.find((candidate) => candidate.id === id && candidate.restaurantId === companyId);
  if (!item || (lojaId && !pertenceALoja(item.lojaId, lojaId, companyId))) {
    res.status(404).json({ error: "Item de cardápio não encontrado nesta loja" });
    return;
  }
  const body = req.body as CatalogItemBody;
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) { res.status(400).json({ error: "name não pode ficar vazio" }); return; }
    item.name = name;
  }
  if (body.description !== undefined) item.description = String(body.description).trim();
  if (body.category !== undefined) {
    const category = normalizeCategoryName(body.category);
    if (!category) { res.status(400).json({ error: "category não pode ficar vazia" }); return; }
    item.category = category;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) { res.status(400).json({ error: "price inválido" }); return; }
    item.price = price;
  }
  if (body.prepTime !== undefined) {
    const prepTime = Number(body.prepTime);
    if (!Number.isFinite(prepTime) || prepTime < 0) { res.status(400).json({ error: "prepTime inválido" }); return; }
    item.prepTime = prepTime;
  }
  if (body.available !== undefined) item.available = Boolean(body.available);
  await saveSnapshotConfirmed("menuItems", menuItems);
  res.json(toCatalogItem(item));
}

router.patch("/menu/items/:id", requireOwnerAuth, updateCatalogItem);
router.patch("/menu-items/:id", requireOwnerAuth, updateCatalogItem);

async function deactivateCatalogItem(req: any, res: any): Promise<void> {
  const { companyId, lojaId } = catalogScope(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const item = menuItems.find((candidate) => candidate.id === id && candidate.restaurantId === companyId);
  if (!item || (lojaId && !pertenceALoja(item.lojaId, lojaId, companyId))) {
    res.status(404).json({ error: "Item de cardápio não encontrado nesta loja" });
    return;
  }
  item.available = false;
  await saveSnapshotConfirmed("menuItems", menuItems);
  res.json({ ok: true, deactivated: true, item: toCatalogItem(item) });
}

router.delete("/menu/items/:id", requireOwnerAuth, deactivateCatalogItem);
router.delete("/menu-items/:id", requireOwnerAuth, deactivateCatalogItem);

router.patch("/menu/categories/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId, lojaId, items } = scopedCatalogItems(req);
  const currentName = categoryNameFromId(String(req.params.id));
  const nextName = normalizeCategoryName((req.body as { name?: string }).name);
  if (!currentName || !nextName) {
    res.status(400).json({ error: "categoria e name são obrigatórios" });
    return;
  }
  const changed = renameCategory(
    menuItems,
    currentName,
    nextName,
    (item) => item.restaurantId === companyId && (!lojaId || pertenceALoja(item.lojaId, lojaId, companyId)),
  );
  if (!changed && !items.some((item) => normalizeCategoryName(item.category) === currentName)) {
    res.status(404).json({ error: "Categoria não encontrada nesta loja" });
    return;
  }
  await saveSnapshotConfirmed("menuItems", menuItems);
  res.json(buildCatalogCategories(scopedCatalogItems(req).items).find((category) => category.name === nextName));
});

router.delete("/menu/categories/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId, lojaId, items } = scopedCatalogItems(req);
  const currentName = categoryNameFromId(String(req.params.id));
  if (!currentName) { res.status(400).json({ error: "categoria inválida" }); return; }
  if (!items.some((item) => normalizeCategoryName(item.category) === currentName)) {
    res.status(404).json({ error: "Categoria não encontrada nesta loja" });
    return;
  }
  const moved = deactivateCategory(
    menuItems,
    currentName,
    (item) => item.restaurantId === companyId && (!lojaId || pertenceALoja(item.lojaId, lojaId, companyId)),
  );
  await saveSnapshotConfirmed("menuItems", menuItems);
  res.json({ ok: true, deactivated: true, movedTo: "Geral", movedItems: moved });
});

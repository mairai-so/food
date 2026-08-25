import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { query, queryOne, execute } from "../lib/db";
import { requireOwnerAuth } from "./auth";

const router: IRouter = Router();

// ── POST /api/analytics/search — registrar evento de busca
router.post("/analytics/search", async (req, res): Promise<void> => {
  const { userId, searchQuery, restaurantId, found = true } = req.body as {
    userId?: string;
    searchQuery?: string;
    restaurantId?: string;
    found?: boolean;
  };

  const now = new Date();
  await execute(
    `INSERT INTO search_events (user_id, query, restaurant_id, found, hour_of_day, day_of_week)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId ?? null, searchQuery ?? null, restaurantId ?? null, found, now.getHours(), now.getDay()]
  );

  res.json({ ok: true });
});

// ── POST /api/analytics/recommendation — registrar recomendação da IA
router.post("/analytics/recommendation", async (req, res): Promise<void> => {
  const { userId, restaurantId, restaurantName, reasons, accepted } = req.body as {
    userId?: string;
    restaurantId: string;
    restaurantName: string;
    reasons: string[];
    accepted?: boolean;
  };

  await execute(
    `INSERT INTO recommendation_events (user_id, restaurant_id, restaurant_name, reasons, accepted)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId ?? null, restaurantId, restaurantName, reasons, accepted ?? null]
  );

  res.json({ ok: true });
});

// ── GET /api/analytics/restaurant/:restaurantId — inteligência para o restaurante
router.get("/analytics/restaurant/:restaurantId", requireOwnerAuth, async (req, res): Promise<void> => {
  const { restaurantId } = req.params;

  const [impressions, acceptances, hourlyDemand, topSearches, missedSearches] = await Promise.all([
    // Total de vezes recomendado
    queryOne<{ total: string }>(
      "SELECT COUNT(*) AS total FROM recommendation_events WHERE restaurant_id = $1",
      [restaurantId]
    ),
    // Taxa de aceitação
    queryOne<{ accepted: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE accepted = true) AS accepted,
              COUNT(*) AS total
       FROM recommendation_events WHERE restaurant_id = $1`,
      [restaurantId]
    ),
    // Demanda por hora do dia (últimos 7 dias)
    query<{ hour_of_day: number; count: string }>(
      `SELECT hour_of_day, COUNT(*) AS count
       FROM search_events
       WHERE restaurant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY hour_of_day ORDER BY hour_of_day`,
      [restaurantId]
    ),
    // Buscas mais frequentes que encontraram este restaurante
    query<{ query: string; count: string }>(
      `SELECT query, COUNT(*) AS count FROM search_events
       WHERE restaurant_id = $1 AND query IS NOT NULL AND found = true
       GROUP BY query ORDER BY count DESC LIMIT 10`,
      [restaurantId]
    ),
    // Produtos/buscas que NÃO encontraram resultado (oportunidades)
    query<{ query: string; count: string }>(
      `SELECT query, COUNT(*) AS count FROM search_events
       WHERE found = false AND query IS NOT NULL
       GROUP BY query ORDER BY count DESC LIMIT 10`,
      []
    ),
  ]);

  const totalImp = parseInt(impressions?.total ?? "0");
  const totalAcc = parseInt(acceptances?.total ?? "0");
  const accepted = parseInt(acceptances?.accepted ?? "0");

  res.json({
    impressions: totalImp,
    acceptanceRate: totalAcc > 0 ? Math.round((accepted / totalAcc) * 100) : 0,
    hourlyDemand: hourlyDemand.map((r) => ({ hour: r.hour_of_day, count: parseInt(r.count) })),
    topSearchTerms: topSearches.map((r) => ({ term: r.query, count: parseInt(r.count) })),
    missedOpportunities: missedSearches.map((r) => ({ term: r.query, count: parseInt(r.count) })),
  });
});

// ── GET /api/analytics/platform — inteligência global da plataforma (admin MIAR)
router.get("/analytics/platform", requireOwnerAuth, async (req, res): Promise<void> => {
  const [dailySearches, topRestaurants, peakHours, recentMissed] = await Promise.all([
    // Buscas por dia (últimos 14 dias)
    query<{ day: string; count: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM search_events
       WHERE created_at >= NOW() - INTERVAL '14 days'
       GROUP BY 1 ORDER BY 1`,
      []
    ),
    // Restaurantes mais recomendados
    query<{ restaurant_name: string; count: string }>(
      `SELECT restaurant_name, COUNT(*) AS count
       FROM recommendation_events
       GROUP BY restaurant_name ORDER BY count DESC LIMIT 10`,
      []
    ),
    // Picos de demanda por hora
    query<{ hour_of_day: number; count: string }>(
      `SELECT hour_of_day, COUNT(*) AS count
       FROM search_events WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY hour_of_day ORDER BY count DESC`,
      []
    ),
    // Produtos mais buscados sem resultado (últimos 7 dias)
    query<{ query: string; count: string }>(
      `SELECT query, COUNT(*) AS count FROM search_events
       WHERE found = false AND created_at >= NOW() - INTERVAL '7 days' AND query IS NOT NULL
       GROUP BY query ORDER BY count DESC LIMIT 20`,
      []
    ),
  ]);

  res.json({
    dailySearches: dailySearches.map((r) => ({ day: r.day, count: parseInt(r.count) })),
    topRestaurants: topRestaurants.map((r) => ({ name: r.restaurant_name, count: parseInt(r.count) })),
    peakHours: peakHours.map((r) => ({ hour: r.hour_of_day, count: parseInt(r.count) })),
    missedOpportunities: recentMissed.map((r) => ({ term: r.query, count: parseInt(r.count) })),
  });
});

// ── GET /api/analytics/predict/:hour — previsão de demanda para próximas horas
router.get("/analytics/predict/:hour", requireOwnerAuth, async (req, res): Promise<void> => {
  const targetHour = parseInt(String(req.params.hour)) || new Date().getHours();

  const historical = await query<{ hour_of_day: number; avg_count: string }>(
    `SELECT hour_of_day, AVG(daily_count) AS avg_count FROM (
       SELECT date_trunc('day', created_at) AS day, hour_of_day, COUNT(*) AS daily_count
       FROM search_events
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
     ) sub
     WHERE hour_of_day BETWEEN $1 AND $2
     GROUP BY hour_of_day ORDER BY hour_of_day`,
    [targetHour, Math.min(targetHour + 4, 23)]
  );

  const predictions = historical.map((r) => {
    const avg = parseFloat(r.avg_count);
    const level = avg < 5 ? "baixa" : avg < 20 ? "moderada" : avg < 50 ? "alta" : "muito alta";
    return {
      hour: r.hour_of_day,
      predictedDemand: Math.round(avg),
      level,
      recommendation:
        level === "alta" || level === "muito alta"
          ? "Reforce equipe e aumente produção"
          : level === "moderada"
          ? "Mantenha operação normal"
          : "Período tranquilo — bom para manutenção",
    };
  });

  res.json({ predictions, generatedAt: new Date().toISOString() });
});

export default router;

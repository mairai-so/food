export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setAuthTokenSetter,
  startTokenRefreshLoop,
  setExtraHeadersGetter,
  customFetch,
} from "./custom-fetch";
export type { AuthTokenGetter, CustomFetchOptions } from "./custom-fetch";

import * as React from "react";
import { useEffect, useState } from "react";

export function MiarEditaMenu() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const token = ['miar-owner-token', 'miar-caixa-token', 'miar-garcom-token', 'miar-cozinha-token', 'miar-entregador-token', 'miar-equipe-token', 'miar-gestor-mobile-token']
      .map((key) => localStorage.getItem(key))
      .find(Boolean);
    if (!token) return;
    fetch('/api/features/miar-edita', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() as Promise<{ enabled?: boolean }> : null)
      .then((data) => setEnabled(Boolean(data?.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;
  const gestorUrl = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_GESTOR_URL ?? 'https://miar-gestor-37za.onrender.com';
  return React.createElement('a', { href: `${gestorUrl.replace(/\/$/, '')}/miar-edita`, target: '_blank', rel: 'noreferrer', style: { display: 'block', marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#b7d83d', color: '#10161b', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' } }, 'MIAR AI EDITA');
}

// ── Compatibility aliases ──────────────────────────────────────────────────
// Several app artifacts were written with hook names that differ from the ones
// Orval generated. Rather than touching each artifact we re-export them here.
export {
  useLogin         as useLoginOwner,
  getGetMeQueryKey as getMeQueryKey,
  getGetDashboardStatsQueryKey as getDashboardStatsQueryKey,
  useListTables    as useGetTables,
  useUpdateTable   as useUpdateTableStatus,
  getListTablesQueryKey as getGetTablesQueryKey,
  useListOrders    as useGetOrders,
  useListStock     as useGetStockItems,
  useAiChat        as useSendChatMessage,
  useGetSettings,
  useUpdateSettings,
  useUpdateOrderStatus,
  useListOrders,
  useListStock,
} from "./generated/api";

// useGetAuthStatus — thin wrapper over GET /api/auth/status.
// The server always returns { registered: false } in multi-tenant mode.
import { useQuery } from "@tanstack/react-query";

export function useGetAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { registered: false, companyName: null };
      return res.json() as Promise<{ registered: boolean; companyName: string | null }>;
    },
    staleTime: 60_000,
  });
}

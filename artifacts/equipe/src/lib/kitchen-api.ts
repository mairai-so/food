// Camada de compatibilidade da Cozinha.
// A Cozinha (importada do protótipo Food-Improvement) usa nomes de hooks
// que não existem no cliente gerado do monorepo (useGetKitchenOrders,
// useGetKitchenSettings, useUpdateKitchenOrderStatus, useSendVoiceCommand,
// useUpdateKitchenSettings, useGetExpiringItems). Este arquivo liga esses
// nomes aos hooks REAIS do @workspace/api-client-react, sem tocar no código
// gerado. Assim a Cozinha compila e funciona ligada à mesma API das outras
// telas (pedidos, settings, estoque, chat/voz).

import {
  useGetOrders,
  useUpdateOrderStatus,
  useGetSettings,
  useUpdateSettings,
  useGetStockItems,
  useSendChatMessage,
  type RestaurantSettings,
} from '@workspace/api-client-react';

// ---------- Tipos que a Cozinha espera ----------

export interface KitchenOrderItem {
  id?: string | number;
  name: string;
  quantity: number;
  unit?: string;
  notes?: string | null;
}

export interface KitchenOrder {
  id: string;
  status: string;
  type?: string;
  tableId?: number | null;
  tableNumber?: string | number | null;
  items: KitchenOrderItem[];
  total?: number;
  notes?: string | null;
  estimatedMinutes?: number | null;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  customerAllergies?: string[];
  customerPreferences?: string;
  isPriority?: boolean;
}

export type { KitchenOrderItem as OrderItem };

// ---------- Pedidos ----------

export function useGetKitchenOrders(options?: any) {
  const query = useGetOrders(options);
  const data = query.data as Array<Record<string, any>> | undefined;
  const filtered: KitchenOrder[] | undefined = data
    ? data
        .filter((o: Record<string, any>) => o?.status && o.status !== 'paid' && o.status !== 'delivered')
        .map((o: Record<string, any>) => ({
          ...o,
          id: String(o.id ?? ''),
          status: String(o.status ?? 'pending'),
          items: Array.isArray(o.items) ? o.items : [],
        })) as KitchenOrder[]
    : undefined;
  return { ...query, data: filtered } as Omit<typeof query, 'data'> & {
    data: KitchenOrder[] | undefined;
  };
}

export function useUpdateKitchenOrderStatus(options?: any) {
  // Mesma assinatura usada na cozinha: mutate({ id, data: { status } })
  return useUpdateOrderStatus(options);
}

// ---------- Configurações da cozinha ----------

// A cozinha lê muitas flags de voz/alerta que não existem em
// RestaurantSettings. Guardamos essas preferências no localStorage do
// navegador (são preferências de operação da tela, não do restaurante),
// e mesclamos com o RestaurantSettings real para o resto do app.

const KITCHEN_PREFS_KEY = 'miar.cozinha.prefs';

// Todas as preferências operacionais da cozinha, mescladas com o
// RestaurantSettings real. Todas opcionais para uso flexível na UI.
export interface KitchenSettings extends Partial<RestaurantSettings> {
  autoAnnounceOrders?: boolean;
  announceAllergiesOnly?: boolean;
  announceOnButton?: boolean;
  flashOnNewOrder?: boolean;
  soundOnNewOrder?: boolean;
  browserNotifications?: boolean;
  browserNotifyOnOrder?: boolean;
  browserNotifyOnExpiry?: boolean;
  burnAlertEnabled?: boolean;
  burnAlertMinutesOver?: number;
  voiceSpeed?: number;
  voicePitch?: number;
  showClock?: boolean;
  showCopyButton?: boolean;
  soundOnExpiry?: boolean;
  autoAnnounceExpiry?: boolean;
  announceExpiryOnOpen?: boolean;
  announceExpiryOnButton?: boolean;
}

const KITCHEN_DEFAULTS = {
  autoAnnounceOrders: true,
  announceAllergiesOnly: false,
  announceOnButton: true,
  flashOnNewOrder: true,
  soundOnNewOrder: true,
  browserNotifications: false,
  browserNotifyOnOrder: true,
  browserNotifyOnExpiry: true,
  burnAlertEnabled: true,
  burnAlertMinutesOver: 5,
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  showClock: true,
  showCopyButton: true,
  soundOnExpiry: true,
  autoAnnounceExpiry: false,
  announceExpiryOnOpen: false,
  announceExpiryOnButton: true,
};

function readKitchenPrefs(): Record<string, any> {
  try {
    const raw =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(KITCHEN_PREFS_KEY)
        : null;
    return raw ? { ...KITCHEN_DEFAULTS, ...JSON.parse(raw) } : { ...KITCHEN_DEFAULTS };
  } catch {
    return { ...KITCHEN_DEFAULTS };
  }
}

function writeKitchenPrefs(patch: Record<string, any>) {
  try {
    if (typeof window === 'undefined') return;
    const merged = { ...readKitchenPrefs(), ...patch };
    window.localStorage.setItem(KITCHEN_PREFS_KEY, JSON.stringify(merged));
    // avisa a própria aba para re-renderizar
    window.dispatchEvent(new Event('miar-kitchen-prefs'));
  } catch {
    /* ignore */
  }
}

import { useEffect, useState } from 'react';

export function useGetKitchenSettings(options?: any) {
  const query = useGetSettings(options);
  const [prefs, setPrefs] = useState<Record<string, any>>(readKitchenPrefs);

  useEffect(() => {
    const sync = () => setPrefs(readKitchenPrefs());
    window.addEventListener('miar-kitchen-prefs', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('miar-kitchen-prefs', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const base = (query.data ?? {}) as Partial<RestaurantSettings>;
  const merged: KitchenSettings = { ...prefs, ...base };
  return { ...query, data: merged } as Omit<typeof query, 'data'> & {
    data: KitchenSettings;
  };
}

export function useUpdateKitchenSettings(_options?: any) {
  const server = useUpdateSettings(_options);
  // mutate({ data: { <key>: value } }) — grava prefs locais e, se a chave
  // pertencer ao RestaurantSettings real, também manda pro servidor.
  const mutate = (vars: { data: Record<string, any> }, opts?: any) => {
    const data = vars?.data ?? {};
    writeKitchenPrefs(data);
    if (opts?.onSuccess) opts.onSuccess(readKitchenPrefs());
  };
  return { ...server, mutate, mutateAsync: async (v: any) => mutate(v) } as any;
}

// ---------- Assistente de voz ----------

// A cozinha faz sendCommand({ data: { command, context } }) e espera
// { answer }. Ligamos ao chat real do backend (useSendChatMessage), que
// recebe { messages, restaurantContext } e devolve { message }.
export function useSendVoiceCommand(options?: any) {
  const chat = useSendChatMessage(options);
  const mutate = (
    vars: { data: { command: string; context?: string } },
    opts?: any,
  ) => {
    const command = vars?.data?.command ?? '';
    const context = vars?.data?.context;
    const normalizedContext =
      typeof context === 'string' &&
      ['general', 'sales', 'stock', 'kitchen', 'delivery', 'marketing'].includes(context)
        ? context
        : 'general';

    chat.mutate(
      {
        data: {
          message: command,
          context: normalizedContext as any,
        },
      },
      {
        ...opts,
        onSuccess: (resp: any) => {
          const answer = resp?.message ?? '';
          if (opts?.onSuccess) opts.onSuccess({ answer });
        },
      },
    );
  };
  return { ...chat, mutate } as any;
}

// ---------- Itens a vencer (barra lateral de validade) ----------

export interface ExpiringItem {
  id?: number;
  name: string;
  quantity?: number;
  unit?: string;
  expiresAt?: string | null;
  daysUntilExpiry: number;
  urgency: 'critical' | 'warning' | 'notice';
}

export function useGetExpiringItems(options?: any) {
  const query = useGetStockItems(options);
  const items = (query.data as Array<Record<string, any>> | undefined) ?? undefined;

  const mapped: ExpiringItem[] | undefined = items
    ? items
        .filter((it: Record<string, any>) => !!it?.expiresAt)
        .map((it: Record<string, any>) => {
          const expiresAt = String(it.expiresAt ?? '');
          const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
          const urgency: ExpiringItem['urgency'] =
            days <= 1 ? 'critical' : days <= 3 ? 'warning' : 'notice';
          return {
            id: it.id,
            name: String(it.name ?? 'Item'),
            quantity: it.quantity,
            unit: it.unit,
            expiresAt,
            daysUntilExpiry: days,
            urgency,
          } satisfies ExpiringItem;
        })
        .filter((it) => it.daysUntilExpiry <= 7)
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    : undefined;

  return { ...query, data: mapped } as Omit<typeof query, 'data'> & {
    data: ExpiringItem[] | undefined;
  };
}

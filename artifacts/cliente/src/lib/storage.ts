import type { UserProfile, HistoryRecord, ActiveOrder, LoyaltyData, LoyaltyLevel, SavedAddress } from '../types';

export function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; }
  catch { return fallback; }
}
export function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const getUser = (): UserProfile | null => lsGet<UserProfile | null>('miar_user', null);
export const setUser = (u: UserProfile) => lsSet('miar_user', u);
export const isOnboarded = () => lsGet<boolean>('miar_onboarded', false);
export const setOnboarded = () => lsSet('miar_onboarded', true);
export const isSetupDone = () => lsGet<boolean>('miar_setup_done', false);
export const setSetupDone = () => lsSet('miar_setup_done', true);
export const clearSetupDone = () => { try { localStorage.removeItem('miar_setup_done'); } catch {} };

export const getHistory = (): HistoryRecord[] => lsGet<HistoryRecord[]>('miar_history', []);
export const addHistory = (r: HistoryRecord) => lsSet('miar_history', [...getHistory(), r]);
export const replaceHistory = (records: HistoryRecord[]) => lsSet('miar_history', records);
export const clearHistory = () => { try { localStorage.removeItem('miar_history'); } catch {} };
export const markRated = (id: string) =>
  lsSet('miar_history', getHistory().map(h => h.id === id ? { ...h, rated: true } : h));

export const getActiveOrder = (): ActiveOrder | null => lsGet<ActiveOrder | null>('miar_active', null);
export const setActiveOrder = (o: ActiveOrder | null) => lsSet('miar_active', o);

// ── Client auth token (JWT da API) ────────────────────────────────────────────
export const getClientToken = (): string | null => {
  try { return localStorage.getItem('miar_client_token'); } catch { return null; }
};
export const setClientToken = (token: string) => {
  try { localStorage.setItem('miar_client_token', token); } catch {}
};
export const clearClientToken = () => {
  try { localStorage.removeItem('miar_client_token'); } catch {}
};

export const getSavedAddresses = (): SavedAddress[] => lsGet<SavedAddress[]>('miar_saved_addresses', []);
export const setSavedAddresses = (addresses: SavedAddress[]) => lsSet('miar_saved_addresses', addresses);

export const getFavorites = (): string[] => lsGet<string[]>('miar_favs', []);
export const toggleFavorite = (id: string): string[] => {
  const favs = getFavorites();
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  lsSet('miar_favs', next); return next;
};

export const cartKey = (rid: string) => `miar_cart_${rid}`;

export const getLoyalty = (): LoyaltyData =>
  lsGet<LoyaltyData>('miar_loyalty', { points: 0, totalSpent: 0, level: 'bronze' });

export const addPoints = (amount: number): LoyaltyData => {
  const cur = getLoyalty();
  const points = cur.points + Math.floor(amount);
  const totalSpent = cur.totalSpent + amount;
  let level: LoyaltyLevel = 'bronze';
  if (totalSpent >= 2000) level = 'diamante';
  else if (totalSpent >= 500) level = 'ouro';
  else if (totalSpent >= 150) level = 'prata';
  const next = { points, totalSpent, level };
  lsSet('miar_loyalty', next); return next;
};

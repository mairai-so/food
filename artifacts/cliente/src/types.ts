export type OrderMode = 'dine-in' | 'delivery' | 'pickup';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';
export type AppTab = 'home' | 'search' | 'feed' | 'jobs' | 'chat' | 'profile' | 'trends' | 'artista';
export type SubView = 'menu' | 'tracking' | 'reservation' | 'profile-setup' | null;
export type LoyaltyLevel = 'bronze' | 'prata' | 'ouro' | 'diamante';

export interface Restaurant {
  id: string; name: string; segment?: string; cuisine?: string; address?: string;
  rating?: number; distance?: number; pricePerPerson?: number; openNow?: boolean; waitTime?: number;
  preOrderEnabled?: boolean; reserveMesasEnabled?: boolean;
}
export interface MenuItem {
  id: string; name: string; price: number; category?: string; description?: string;
}
export interface CartItem extends MenuItem { qty: number; note: string; }
export interface StockAlert { name: string; daysLeft: number; }
export interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string; }

export interface HistoryRecord {
  id: string; restaurantName: string; restaurantId: string;
  mode: OrderMode; total: number; createdAt: string; vehiclePlate?: string;
  items: { name: string; quantity: number; menuItemId: string; price: number }[];
  rated?: boolean;
}
export interface ActiveOrder {
  id: string; restaurantName: string; restaurantId: string; mode: OrderMode;
  tableId?: string; tableNumber?: number;
}
export interface UserProfile {
  id: string; name: string; email: string; isGuest: boolean; phone?: string;
  gender?: 'masculino' | 'feminino' | 'prefiro-nao-dizer' | 'outro';
  healthConditions: string[]; healthOther?: string;
  nutritionGoals: string[];
  dislikedIngredients: string[]; likedThings: string[];
  meatPreference?: 'mal-passada' | 'ao-ponto' | 'bem-passada';
  communicationStyle: string;
  shareDataWithRestaurants: boolean; allowAIMemory: boolean;
  discoveryPreferences?: DiscoveryPreference[];
  savedAddresses?: SavedAddress[];
  /** MIAR Apoia — perfil de artista/atleta, opcional. */
  ehArtista?: boolean;
  nivelArtista?: 'profissional' | 'amador';
  areaArtista?: 'musica' | 'stand-up' | 'teatro' | 'danca' | 'artes-visuais' | 'outro';
  areaArtistaOutro?: string;
  desejaConvitesTrabalho?: boolean;
  desejaAgregarAppArtista?: boolean;
  desejaMensagensEventos?: boolean;
}
export type DiscoveryPreference = 'speed' | 'price' | 'free_delivery' | 'promotions' | 'distance' | 'quality';
export interface SavedAddress {
  id: string; label: string; recipientName?: string; street: string; number: string;
  complement?: string; neighborhood: string; city: string; state: string; postalCode?: string;
  latitude?: number; longitude?: number; isDefault?: boolean;
}
export interface SearchResult {
  kind: 'restaurant';
  restaurant: Restaurant;
  matchingItems: MenuItem[];
  score: number;
  highlights: string[];
}
export interface LoyaltyData {
  points: number; totalSpent: number; level: LoyaltyLevel;
}
export interface ClientAuthToken {
  token: string;
  clientId?: string;
  userId?: string; // phone_users id (WhatsApp OTP)
  name: string;
  email?: string;
  phone?: string;
  role: string;
}
export interface FeedPost {
  id: string; restaurantId: string; restaurantName: string; segment?: string;
  mediaType: 'texto' | 'imagem' | 'video' | 'publicidade';
  title: string; content: string; mediaUrl?: string; emoji: string; createdAt: string;
}

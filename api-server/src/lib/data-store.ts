import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { loadSnapshot, scheduleSave } from "./persistence.js";
import {
  registerFinancialMovementInMemory,
  type FinancialMovement,
  type FinancialMovementKind,
  type FinancialDirection,
  type FinancialPaymentMethod,
  type FinancialMovementStatus,
  type NewFinancialMovement,
} from "./financial-ledger-domain.js";

export type {
  FinancialMovement,
  FinancialMovementKind,
  FinancialDirection,
  FinancialPaymentMethod,
  FinancialMovementStatus,
  NewFinancialMovement,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  rating: number;
  distance: number;
  pricePerPerson: number;
  cuisine: string;
  address: string;
  preOrderEnabled: boolean;
  reserveMesasEnabled: boolean;
  qrEntranceEnabled: boolean;
  priorityPaymentEnabled: boolean;
  imageUrl?: string;
  openNow: boolean;
  waitTime: number;
}

export interface FichaTecnicaIngrediente {
  stockItemId: string;
  quantidadePorUnidade: number; // quanto desse insumo 1 unidade do prato usa
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  // Só é usado quando settings.cardapioPorLoja === true. Compartilhado
  // (padrão) = undefined, o prato aparece em todas as lojas da conta.
  lojaId?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  prepTime: number;
  // Ficha técnica (adicionado 29/07/2026) — vazio = sem ficha técnica ainda,
  // pedido desse prato não desconta estoque automaticamente.
  fichaTecnica?: FichaTecnicaIngrediente[];
}

// ─── Lojas (Multi-Loja — um gestor com duas ou mais lojas na mesma conta) ──────
// restaurantId aqui é o companyId da conta (o "dono"). lojaId identifica a
// unidade física dentro dessa conta. Todo registro operacional (mesa, estoque,
// pedido, funcionário, caixa) carrega lojaId opcional — quando ausente, é
// tratado como pertencente à loja padrão da conta (compatibilidade com dados
// antigos de contas de loja única).
export interface Loja {
  id: string;
  restaurantId: string; // companyId dono da conta
  nome: string;
  endereco?: string;
  ativa: boolean;
  padrao: boolean; // loja criada automaticamente na primeira vez que a conta é usada
  criadaEm: string;
}

export let lojas: Loja[] = [];

/** Retorna as lojas ativas de uma conta, criando a loja padrão se ainda não existir nenhuma. */
export function listarLojas(companyId: string): Loja[] {
  const existentes = lojas.filter((l) => l.restaurantId === companyId);
  if (existentes.length === 0) {
    return [getOrCriarLojaPadrao(companyId)];
  }
  return existentes;
}

export function getOrCriarLojaPadrao(companyId: string): Loja {
  let padrao = lojas.find((l) => l.restaurantId === companyId && l.padrao);
  if (!padrao) {
    padrao = {
      id: randomUUID(),
      restaurantId: companyId,
      nome: "Loja Principal",
      ativa: true,
      padrao: true,
      criadaEm: new Date().toISOString(),
    };
    lojas.push(padrao);
    scheduleSave("lojas", lojas);
  }
  return padrao;
}

export function criarLoja(companyId: string, nome: string, endereco?: string): Loja {
  const loja: Loja = {
    id: randomUUID(),
    restaurantId: companyId,
    nome,
    endereco,
    ativa: true,
    padrao: false,
    criadaEm: new Date().toISOString(),
  };
  lojas.push(loja);
  scheduleSave("lojas", lojas);
  return loja;
}

export function atualizarLoja(companyId: string, id: string, updates: Partial<Pick<Loja, "nome" | "endereco" | "ativa">>): Loja | null {
  const idx = lojas.findIndex((l) => l.id === id && l.restaurantId === companyId);
  if (idx === -1) return null;
  lojas[idx] = { ...lojas[idx], ...updates };
  scheduleSave("lojas", lojas);
  return lojas[idx];
}

/**
 * Resolve qual loja um request está operando. Nunca confia num lojaId vindo
 * do cliente sem checar que ela pertence à mesma conta (companyId) do token —
 * isso evitaria um dono ver/mexer numa loja de outra conta só adivinhando o id.
 */
export function resolverLojaId(companyId: string, lojaIdSolicitado?: string | null): string {
  if (lojaIdSolicitado) {
    const pertence = lojas.some((l) => l.id === lojaIdSolicitado && l.restaurantId === companyId);
    if (pertence) return lojaIdSolicitado;
  }
  return getOrCriarLojaPadrao(companyId).id;
}

/** Um registro pertence à loja resolvida se tiver o mesmo lojaId, OU se for um
 * registro antigo sem lojaId e a loja resolvida for a loja padrão da conta. */
export function pertenceALoja(registroLojaId: string | undefined, lojaIdResolvido: string, companyId: string): boolean {
  if (registroLojaId) return registroLojaId === lojaIdResolvido;
  return lojaIdResolvido === getOrCriarLojaPadrao(companyId).id;
}

// Sentinela pra item de estoque "compartilhado entre todas as lojas" —
// diferente de item sem lojaId (que hoje pertence só à loja padrão).
// Adicionado 15/08/2026 a pedido do Robson: cadastro de estoque deve
// permitir, item por item, "compartilhado" (ex.: bebida igual nas duas
// lojas) ou "separado" (ex.: limpeza própria de cada loja) — não é
// tudo-ou-nada como o cardapioPorLoja/comprasPorLoja.
//
// Escopo deliberadamente restrito ao Estoque: NÃO alterei pertenceALoja()
// em si (usada em outros ~30 lugares — pedido, mesa, cardápio, etc. — onde
// "sem lojaId" precisa continuar significando "só a loja padrão", nunca
// "todas"). Essa função nova só entra onde o item de estoque de fato
// oferece a opção de ser compartilhado.
export const LOJA_ID_COMPARTILHADO = "todas" as const;

export function itemDeEstoquePertenceALoja(registroLojaId: string | undefined, lojaIdResolvido: string, companyId: string): boolean {
  if (registroLojaId === LOJA_ID_COMPARTILHADO) return true;
  return pertenceALoja(registroLojaId, lojaIdResolvido, companyId);
}

export interface Table {
  id: string;
  restaurantId: string;
  lojaId?: string;
  number: number;
  seats: number;
  /** "paid" = bill fully settled but guests haven't scanned the exit QR yet (semi-free: cashier alerted, table not released) */
  status: "free" | "occupied" | "reserved" | "cleaning" | "paid";
  reservedBy?: string;
  preOrderId?: string;
  qrToken: string;
  /** Separate, unique QR token used only to close out / leave the table */
  exitQrToken: string;
}

// ─── Cashier alerts (real-time-ish notifications for the staff panel) ──────────
// No websockets in this project — the staff panel polls this list. An alert is
// created the moment every guest at a table has paid in full, so the cashier
// knows the table is "semi-free" and can release it once the guests physically leave.
export interface CashierAlert {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  type: "payment_complete";
  createdAt: string;
  resolvedAt?: string;
}

// ─── Table Sessions (shared "tab" opened when guests sit at a table) ───────────

export interface Guest {
  id: string;
  name: string;
  isComandante: boolean;
  joinedAt: string;
}

export interface SessionOrderItem {
  id: string;
  guestId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  status: "pending" | "preparing" | "ready";
  notes?: string;
}

export interface Payment {
  id: string;
  guestId: string;
  amount: number;
  /** How the share was settled. "cash" is marked by staff/comandante after physically collecting money. */
  method: "pix" | "card" | "cash" | "debit" | "credit" | "voucher" | "app";
  status: "pending" | "paid" | "failed" | "refunded" | "reconciling";
  paidAt?: string;
  providerPaymentId?: string;
  failureReason?: string;
  /** True when staff/comandante marked this paid on someone else's behalf (e.g. cash) */
  markedByStaff?: boolean;
}

export interface TableSession {
  id: string;
  tableId: string;
  tableNumber: number;
  restaurantId: string;
  status: "open" | "closed";
  /** equal: split evenly · byItems: each guest pays what they ordered · custom: manual amounts, remainder split evenly among the rest */
  splitMode: "equal" | "byItems" | "custom";
  guests: Guest[];
  items: SessionOrderItem[];
  payments: Payment[];
  /** Only used when splitMode === "custom" — guestId -> fixed amount they'll pay */
  customAmounts: Record<string, number>;
  subtotal: number;
  createdAt: string;
  closedAt?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  status: "pending" | "preparing" | "ready";
  notes?: string;
}

export interface PreOrder {
  id: string;
  restaurantId: string;
  lojaId?: string;
  restaurantName: string;
  tableId: string;
  tableNumber: number;
  status: "pending" | "arrived" | "preparing" | "ready" | "cancelled";
  items: OrderItem[];
  total: number;
  paidAt?: string;
  isPriority: boolean;
  expectedArrivalAt?: string;
  arrivedAt?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  restaurantId?: string;
  lojaId?: string;
  tableId: string;
  tableNumber: number;
  status: "pending" | "preparing" | "ready" | "delivered" | "paid";
  /** Estado detalhado do fluxo operacional legado, agora persistido no mesmo pedido. */
  operationalStatus?: "received" | "confirmed" | "preparing" | "ready" | "delivering" | "completed" | "cancelled";
  mode?: "delivery" | "pickup" | "dine-in";
  items: OrderItem[];
  total: number;
  isPriority: boolean;
  paidAt?: string;
  paymentMethod?: string;
  paymentId?: string;
  paymentStatus?: "pending" | "paid";
  customerName?: string;
  vehiclePlate?: string;
  /** ID do cadastro real na tabela client_accounts (preenchido quando o cliente está autenticado). */
  clientAccountId?: string;
  createdAt: string;
  estimatedMinutes: number;
  /** true depois que a baixa automática de estoque já rodou pra este pedido — evita descontar 2x. */
  estoqueBaixado?: boolean;
}

export interface BaixaEstoqueResultado {
  ok: boolean;
  motivo?: string;
  movimentos: { stockItemId: string; nome: string; quantidadeBaixada: number; unidade: string }[];
}

/**
 * Baixa automática de estoque na confirmação do pedido (29/07/2026).
 * Atômica: calcula TODAS as baixas primeiro; só aplica se todas forem válidas.
 * Pratos sem ficha técnica cadastrada são ignorados (não bloqueiam o pedido,
 * só não geram baixa — fica visível pra quem quiser completar a ficha depois).
 */
export function baixarEstoquePorPedido(order: Order, restaurantId: string): BaixaEstoqueResultado {
  const planejado: { stockItem: StockItem; quantidadeBaixada: number }[] = [];

  for (const orderItem of order.items) {
    const menuItem = menuItems.find(m => m.id === orderItem.menuItemId && m.restaurantId === restaurantId);
    if (!menuItem?.fichaTecnica?.length) continue; // sem ficha técnica = não baixa, não bloqueia

    for (const ingrediente of menuItem.fichaTecnica) {
      const stockItem = stockItems.find(s => s.id === ingrediente.stockItemId && s.restaurantId === restaurantId);
      if (!stockItem) continue; // insumo vinculado não existe mais — ignora, não trava o pedido
      const quantidadeBaixada = ingrediente.quantidadePorUnidade * orderItem.quantity;
      const existente = planejado.find(p => p.stockItem.id === stockItem.id);
      if (existente) existente.quantidadeBaixada += quantidadeBaixada;
      else planejado.push({ stockItem, quantidadeBaixada });
    }
  }

  if (planejado.length === 0) {
    return { ok: true, movimentos: [] };
  }

  // Aplica tudo de uma vez (atômico dentro do processo — sem baixa parcial)
  const movimentos = planejado.map(p => {
    updateStockItem(p.stockItem.id, { quantity: p.stockItem.quantity - p.quantidadeBaixada });
    return {
      stockItemId: p.stockItem.id,
      nome: p.stockItem.name,
      quantidadeBaixada: p.quantidadeBaixada,
      unidade: p.stockItem.unit,
    };
  });

  // Rastreabilidade: cada baixa fica registrada com o pedido de origem.
  auditLogs.push({
    id: randomUUID(),
    restaurantId,
    employeeId: "system-estoque",
    employeeName: "Baixa automática",
    employeeRole: "system",
    action: "BAIXA_ESTOQUE_PEDIDO",
    description: `Pedido ${order.id} (mesa ${order.tableNumber}) baixou ${movimentos.length} insumo(s) do estoque`,
    metadata: { orderId: order.id, movimentos },
    timestamp: new Date().toISOString(),
  } as AuditLog);
  scheduleSave("auditLogs", auditLogs);

  return { ok: true, movimentos };
}

export interface CameraConfig {
  id: string;
  name: string;
  type: "device" | "mjpeg" | "hls";
  url?: string;
}

export type PlanoMiar = "tio-do-dog" | "inicial" | "intermediario" | "premium";

export interface RestaurantSettings {
  preOrderEnabled: boolean;
  reserveMesasEnabled: boolean;
  qrEntranceEnabled: boolean;
  priorityPaymentEnabled: boolean;
  // Multi-loja (14/08/2026) — decisão comercial de cada conta, não decisão
  // técnica: false (padrão) = mesmo cardápio em todas as lojas da conta;
  // true = cada loja mantém seu próprio cardápio, independente das outras.
  cardapioPorLoja: boolean;
  // Multi-loja (15/08/2026) — mesma lógica do cardápio, aplicada às listas
  // de compras: false (padrão) = uma lista só, compartilhada por toda a
  // conta; true = cada loja mantém sua própria lista de compras, separada
  // das outras. Decisão comercial do gestor, chavinha em Configurações.
  comprasPorLoja: boolean;
  tipType: "disabled" | "percentage" | "fixed";
  tipPercentages: number[];
  tipFixedAmount?: number;
  tipMin: number;
  tipMax: number;
  couvertEnabled: boolean;
  couvertValue: number;
  couvertPerPerson: boolean;
  reservationDurationMinutes: number;
  reservationWarningMinutes: number;
  maxReservationsPerHour: number;
  estimatedPrepTimeMinutes: number;
  qrEntranceToken: string;
  /** Copy-paste Pix code shown to guests alongside the QR when paying their share. */
  pixKey: string;
  /** Data URL of a photo of the restaurant's real Pix QR code, uploaded in Settings. */
  pixQrImageUrl: string;
  /** Camera configurations persisted server-side. */
  cameras: CameraConfig[];
  /**
   * Mem0 API key do proprietário — permite memória persistente para IA do restaurante.
   * Obtenha em https://app.mem0.ai/dashboard/api-keys
   */
  mem0ApiKey: string;
  /** Gestor liga/desliga o modo pessoal da MIAR (companhia fora do expediente) pro restaurante inteiro. Aberto por padrão. */
  modoPessoalHabilitado?: boolean;
  /**
   * Perímetro de segurança física — o dono decide se quer travar o uso dos
   * apps de operação (caixa, garçom, cozinha, entregador) a "dentro do
   * restaurante". Duas camadas que se cobrem: rede local (Wi-Fi da casa) e,
   * se o celular estiver em dados móveis, o GPS dentro de um raio da casa.
   * Sempre desligável pelo dono — pode ter um motivo legítimo pra não usar.
   */
  perimetro: {
    ativo: boolean;
    aplicarNoGestor: boolean;
    raioMetros: number;
    latitude?: number;
    longitude?: number;
    redesLocaisPermitidas: string[]; // prefixos de IP da rede do restaurante (ex.: "192.168.1.")
  };
  /**
   * Programa de fidelidade — o estabelecimento escolhe no cadastro (e pode
   * mudar depois em Configurações) se participa, e qual(is) régua(s):
   *  - porConsumo: a cada N pedidos do mesmo cliente, ganha um item.
   *  - porIndicacao: a cada N pessoas indicadas que viraram clientes ativos,
   *    ganha um item. Os dois contadores são independentes entre si.
   */
  fidelidade: {
    ativo: boolean;
    porConsumo: boolean;
    pedidosParaResgate: number;
    itemRecompensaConsumo: string;
    porIndicacao: boolean;
    indicacoesParaResgate: number;
    itemRecompensaIndicacao: string;
  };
  /**
   * Plano comercial do estabelecimento. Define, entre outras coisas, o
   * formato de post que o estabelecimento pode publicar no Feed do Cliente
   * (ver FEED_MEDIA_POR_PLANO mais abaixo). Isso é só sobre o que o
   * ESTABELECIMENTO consegue postar pra se divulgar — não afeta em nada a
   * visibilidade do estabelecimento no Feed nem a descoberta via IA/Top10,
   * que são iguais em todos os planos (alimentadas pelo cliente).
   */
  plano: PlanoMiar;
  /**
   * Idioma padrão do estabelecimento, escolhido no cadastro. Todo usuário
   * vinculado (funcionário, e por extensão o contexto do cliente que
   * acessa esse estabelecimento) herda esse idioma como ponto de partida
   * — mas cada pessoa pode trocar depois individualmente, por app, em
   * Configurações. Isso não trava ninguém, só evita que todo mundo comece
   * em português por padrão quando o dono é paraguaio, por exemplo.
   */
  idiomaPadrao: "pt" | "es" | "gn";
  /**
   * Apoio social voluntário — além do 6% que o MIAR AI/FOOD já destina por
   * conta própria (Cultura, Esporte, Educação, Saúde, Saúde Mental + 1%
   * livre), o estabelecimento pode optar por contribuir também, com valor
   * fixo em R$ ou percentual sobre o próprio plano. Essa contribuição
   * soma no valor cobrado mensalmente. O retorno é pensado como crédito
   * no próprio município onde foi arrecadado — governança e mecanismo de
   * repasse ainda em definição, não inventar detalhes aqui além do valor
   * e da intenção capturados no cadastro.
   */
  apoioSocial: {
    ativo: boolean;
    tipo: "fixo" | "percentual";
    valor: number;
  };
  /**
   * Fiado — lembrete diário e discreto pro cliente que está devendo.
   * Sem tom de cobrança, sem vermelho de vergonha: "Bom dia! Hoje seu
   * débito é R$ X. N dias em aberto." Horário configurável pelo gestor,
   * padrão 8h da manhã. Continua todo dia até quitar.
   */
  fiadoLembreteHora: number;
  /**
   * MIAR Apoia — participação do estabelecimento no lado da demanda:
   * se trabalha com shows/eventos, quais áreas, e se quer receber
   * contatos/currículos de artistas. Cruza com o campo ehArtista do
   * perfil do Cliente (ver types.ts do app cliente).
   */
  shows: {
    trabalhaComShows: boolean;
    areas: string[];
    todasAreas: boolean;
    recebeContatos: boolean;
  };
}

export interface Feedback {
  id: string;
  restaurantId: string;
  tableId?: string;
  foodRating: number;
  foodComment?: string;
  waiterRating?: number;
  waiterName?: string;
  waiterComment?: string;
  otherComment?: string;
  customerName?: string;
  customerEmail?: string;
  isAnonymous: boolean;
  createdAt: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const restaurants: Restaurant[] = [
  {
    id: "rest-1",
    name: "Churrascaria do Vale",
    rating: 4.8,
    distance: 1.2,
    pricePerPerson: 85,
    cuisine: "Churrascaria",
    address: "Rua das Palmeiras, 450 - Jardim Europa",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 15,
  },
  {
    id: "rest-2",
    name: "La Trattoria",
    rating: 4.6,
    distance: 0.8,
    pricePerPerson: 60,
    cuisine: "Italiana",
    address: "Av. Paulista, 1200 - Bela Vista",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: false,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 10,
  },
  {
    id: "rest-3",
    name: "Sabor da Casa",
    rating: 4.3,
    distance: 2.5,
    pricePerPerson: 45,
    cuisine: "Brasileira",
    address: "Rua Consolação, 88 - Centro",
    preOrderEnabled: false,
    reserveMesasEnabled: false,
    qrEntranceEnabled: false,
    priorityPaymentEnabled: false,
    openNow: true,
    waitTime: 5,
  },
  {
    id: "rest-4",
    name: "Sakura Sushi Bar",
    rating: 4.7,
    distance: 3.1,
    pricePerPerson: 95,
    cuisine: "Japonesa",
    address: "Rua da Liberdade, 340 - Liberdade",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 20,
  },
  {
    id: "rest-5",
    name: "Pizzaria Napolitana",
    rating: 4.4,
    distance: 1.8,
    pricePerPerson: 50,
    cuisine: "Pizzaria",
    address: "Alameda Santos, 600 - Cerqueira César",
    preOrderEnabled: true,
    reserveMesasEnabled: false,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: false,
    openNow: false,
    waitTime: 0,
  },
];

export const menuItems: MenuItem[] = [
  // Churrascaria
  { id: "m-1-1", restaurantId: "rest-1", name: "Picanha Grelhada", description: "400g de picanha premium com alho e sal grosso, acompanha vinagrete e farofa", price: 89, category: "Grelhados", available: true, prepTime: 20 },
  { id: "m-1-2", restaurantId: "rest-1", name: "Costela Bovina", description: "Costela assada lentamente por 12h, desmanchando no garfo", price: 75, category: "Grelhados", available: true, prepTime: 30 },
  { id: "m-1-3", restaurantId: "rest-1", name: "Frango à Brasa", description: "Meio frango marinado em ervas e limão, grelhado na brasa", price: 48, category: "Grelhados", available: true, prepTime: 15 },
  { id: "m-1-4", restaurantId: "rest-1", name: "Caipirinha Artesanal", description: "Limão siciliano, açúcar demerara e cachaça premium", price: 22, category: "Bebidas", available: true, prepTime: 3 },
  { id: "m-1-5", restaurantId: "rest-1", name: "Refrigerante", description: "Lata 350ml gelada", price: 8, category: "Bebidas", available: true, prepTime: 1 },
  { id: "m-1-6", restaurantId: "rest-1", name: "Salada Mista", description: "Folhas verdes, tomate cereja, pepino, cenoura e molho especial da casa", price: 22, category: "Entradas", available: true, prepTime: 5 },
  { id: "m-1-7", restaurantId: "rest-1", name: "Pão de Alho Gratinado", description: "Baguete com manteiga de alho e queijo parmesão", price: 18, category: "Entradas", available: true, prepTime: 8 },
  { id: "m-1-8", restaurantId: "rest-1", name: "Pudim de Leite", description: "Pudim caseiro com calda de caramelo", price: 18, category: "Sobremesas", available: true, prepTime: 3 },
  // Italiana
  { id: "m-2-1", restaurantId: "rest-2", name: "Carbonara Clássica", description: "Spaghetti al dente com guanciale, pecorino romano, ovo e pimenta preta", price: 52, category: "Massas", available: true, prepTime: 15 },
  { id: "m-2-2", restaurantId: "rest-2", name: "Penne all'Arrabbiata", description: "Penne com molho de tomate picante, alho e manjericão fresco", price: 44, category: "Massas", available: true, prepTime: 12 },
  { id: "m-2-3", restaurantId: "rest-2", name: "Risoto de Funghi", description: "Arroz arbóreo com mix de cogumelos, vinho branco e parmesão", price: 58, category: "Risoto", available: true, prepTime: 20 },
  { id: "m-2-4", restaurantId: "rest-2", name: "Bruschetta", description: "Pão artesanal tostado com tomate, alho, azeite e manjericão", price: 28, category: "Entradas", available: true, prepTime: 5 },
  { id: "m-2-5", restaurantId: "rest-2", name: "Vinho Tinto Taça", description: "Seleção do sommelier, uvas reserva", price: 32, category: "Bebidas", available: true, prepTime: 2 },
  { id: "m-2-6", restaurantId: "rest-2", name: "Tiramisù", description: "Clássico italiano com mascarpone, espresso e cacau amargo", price: 28, category: "Sobremesas", available: true, prepTime: 3 },
  // Japonesa
  { id: "m-4-1", restaurantId: "rest-4", name: "Combo Sashimi 15 peças", description: "Atum, salmão, pargo, polvo e camarão fresquíssimos", price: 88, category: "Sashimi", available: true, prepTime: 10 },
  { id: "m-4-2", restaurantId: "rest-4", name: "Hot Roll Philadelphia", description: "Salmão, cream cheese e pepino empanado frito, 8 peças", price: 42, category: "Especiais", available: true, prepTime: 12 },
  { id: "m-4-3", restaurantId: "rest-4", name: "Uramaki Skin", description: "Pele de salmão crocante, cream cheese, cebolinha, 8 peças", price: 38, category: "Especiais", available: true, prepTime: 10 },
  { id: "m-4-4", restaurantId: "rest-4", name: "Edamame", description: "Vagem de soja temperada com sal grosso e gengibre", price: 18, category: "Entradas", available: true, prepTime: 5 },
  { id: "m-4-5", restaurantId: "rest-4", name: "Sake Japonês", description: "Dose 60ml, temperatura ambiente ou quente", price: 28, category: "Bebidas", available: true, prepTime: 2 },
  // Pizzaria
  { id: "m-5-1", restaurantId: "rest-5", name: "Margherita DOP", description: "Molho San Marzano, mozzarella di bufala, manjericão fresco", price: 52, category: "Tradicionais", available: true, prepTime: 18 },
  { id: "m-5-2", restaurantId: "rest-5", name: "Quattro Stagioni", description: "Presunto, cogumelos, alcachofra e azeitonas em quatro quadrantes", price: 62, category: "Especiais", available: true, prepTime: 20 },
  { id: "m-5-3", restaurantId: "rest-5", name: "Calzone Frango", description: "Massa dobrada com frango desfiado, catupiry e milho", price: 55, category: "Calzone", available: true, prepTime: 22 },
  // Brasileira
  { id: "m-3-1", restaurantId: "rest-3", name: "Prato Feito Completo", description: "Arroz, feijão, bife acebolado, salada e farofa", price: 28, category: "Pratos do Dia", available: true, prepTime: 10 },
  { id: "m-3-2", restaurantId: "rest-3", name: "Feijoada Completa", description: "Feijoada tradicional com todos os acompanhamentos — sábados", price: 45, category: "Especiais", available: true, prepTime: 15 },
];

export const tables: Table[] = [
  // ── Churrascaria do Vale (rest-1) — 12 mesas ──────────────────────────────
  { id: "t-r1-01", restaurantId: "rest-1", number: 1,  seats: 2, status: "free",     qrToken: "a1b2c3d4-0001-4000-8000-rest1table001", exitQrToken: "e1b2c3d4-0001-4000-8000-rest1exit001" },
  { id: "t-r1-02", restaurantId: "rest-1", number: 2,  seats: 4, status: "occupied", qrToken: "a1b2c3d4-0002-4000-8000-rest1table002", exitQrToken: "e1b2c3d4-0002-4000-8000-rest1exit002" },
  { id: "t-r1-03", restaurantId: "rest-1", number: 3,  seats: 4, status: "free",     qrToken: "a1b2c3d4-0003-4000-8000-rest1table003", exitQrToken: "e1b2c3d4-0003-4000-8000-rest1exit003" },
  { id: "t-r1-04", restaurantId: "rest-1", number: 4,  seats: 6, status: "reserved", qrToken: "a1b2c3d4-0004-4000-8000-rest1table004", exitQrToken: "e1b2c3d4-0004-4000-8000-rest1exit004" },
  { id: "t-r1-05", restaurantId: "rest-1", number: 5,  seats: 2, status: "free",     qrToken: "a1b2c3d4-0005-4000-8000-rest1table005", exitQrToken: "e1b2c3d4-0005-4000-8000-rest1exit005" },
  { id: "t-r1-06", restaurantId: "rest-1", number: 6,  seats: 8, status: "occupied", qrToken: "a1b2c3d4-0006-4000-8000-rest1table006", exitQrToken: "e1b2c3d4-0006-4000-8000-rest1exit006" },
  { id: "t-r1-07", restaurantId: "rest-1", number: 7,  seats: 4, status: "free",     qrToken: "a1b2c3d4-0007-4000-8000-rest1table007", exitQrToken: "e1b2c3d4-0007-4000-8000-rest1exit007" },
  { id: "t-r1-08", restaurantId: "rest-1", number: 8,  seats: 6, status: "cleaning", qrToken: "a1b2c3d4-0008-4000-8000-rest1table008", exitQrToken: "e1b2c3d4-0008-4000-8000-rest1exit008" },
  { id: "t-r1-09", restaurantId: "rest-1", number: 9,  seats: 4, status: "free",     qrToken: "a1b2c3d4-0009-4000-8000-rest1table009", exitQrToken: "e1b2c3d4-0009-4000-8000-rest1exit009" },
  { id: "t-r1-10", restaurantId: "rest-1", number: 10, seats: 4, status: "occupied", qrToken: "a1b2c3d4-0010-4000-8000-rest1table010", exitQrToken: "e1b2c3d4-0010-4000-8000-rest1exit010" },
  { id: "t-r1-11", restaurantId: "rest-1", number: 11, seats: 2, status: "occupied", qrToken: "a1b2c3d4-0011-4000-8000-rest1table011", exitQrToken: "e1b2c3d4-0011-4000-8000-rest1exit011" },
  { id: "t-r1-12", restaurantId: "rest-1", number: 12, seats: 6, status: "free",     qrToken: "a1b2c3d4-0012-4000-8000-rest1table012", exitQrToken: "e1b2c3d4-0012-4000-8000-rest1exit012" },
  // ── La Trattoria (rest-2) ─────────────────────────────────────────────────
  { id: "t-r2-01", restaurantId: "rest-2", number: 1,  seats: 2, status: "free",     qrToken: "b2c3d4e5-0001-4000-8000-rest2table001", exitQrToken: "f2c3d4e5-0001-4000-8000-rest2exit001" },
  { id: "t-r2-02", restaurantId: "rest-2", number: 2,  seats: 4, status: "free",     qrToken: "b2c3d4e5-0002-4000-8000-rest2table002", exitQrToken: "f2c3d4e5-0002-4000-8000-rest2exit002" },
  { id: "t-r2-03", restaurantId: "rest-2", number: 3,  seats: 4, status: "occupied", qrToken: "b2c3d4e5-0003-4000-8000-rest2table003", exitQrToken: "f2c3d4e5-0003-4000-8000-rest2exit003" },
  { id: "t-r2-04", restaurantId: "rest-2", number: 4,  seats: 6, status: "free",     qrToken: "b2c3d4e5-0004-4000-8000-rest2table004", exitQrToken: "f2c3d4e5-0004-4000-8000-rest2exit004" },
  // ── Sakura Sushi Bar (rest-4) ─────────────────────────────────────────────
  { id: "t-r4-01", restaurantId: "rest-4", number: 1,  seats: 2, status: "free",     qrToken: "c3d4e5f6-0001-4000-8000-rest4table001", exitQrToken: "d3d4e5f6-0001-4000-8000-rest4exit001" },
  { id: "t-r4-02", restaurantId: "rest-4", number: 2,  seats: 4, status: "free",     qrToken: "c3d4e5f6-0002-4000-8000-rest4table002", exitQrToken: "d3d4e5f6-0002-4000-8000-rest4exit002" },
  { id: "t-r4-03", restaurantId: "rest-4", number: 3,  seats: 6, status: "occupied", qrToken: "c3d4e5f6-0003-4000-8000-rest4table003", exitQrToken: "d3d4e5f6-0003-4000-8000-rest4exit003" },
  { id: "t-r4-04", restaurantId: "rest-4", number: 4,  seats: 4, status: "free",     qrToken: "c3d4e5f6-0004-4000-8000-rest4table004", exitQrToken: "d3d4e5f6-0004-4000-8000-rest4exit004" },
];

export const preOrders: PreOrder[] = [
  {
    id: "po-1",
    restaurantId: "rest-1",
    restaurantName: "Churrascaria do Vale",
    tableId: "t-4",
    tableNumber: 4,
    status: "pending",
    items: [
      { id: "oi-1", menuItemId: "m-1-1", name: "Picanha Grelhada", price: 89, quantity: 2, status: "pending" },
      { id: "oi-2", menuItemId: "m-1-4", name: "Caipirinha Artesanal", price: 22, quantity: 2, status: "pending" },
    ],
    total: 222,
    isPriority: true,
    paidAt: new Date(Date.now() - 30 * 60000).toISOString(),
    expectedArrivalAt: new Date(Date.now() + 12 * 60000).toISOString(),
    customerName: "João Silva",
    customerPhone: "(11) 99999-1234",
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "po-2",
    restaurantId: "rest-1",
    restaurantName: "Churrascaria do Vale",
    tableId: "t-3",
    tableNumber: 3,
    status: "pending",
    items: [
      { id: "oi-3", menuItemId: "m-1-2", name: "Costela Bovina", price: 75, quantity: 1, status: "pending" },
      { id: "oi-4", menuItemId: "m-1-5", name: "Refrigerante", price: 8, quantity: 2, status: "pending" },
    ],
    total: 91,
    isPriority: false,
    expectedArrivalAt: new Date(Date.now() + 22 * 60000).toISOString(),
    customerName: "Maria Costa",
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
  },
];

export const orders: Order[] = [
  {
    id: "ord-1",
    tableId: "t-2",
    tableNumber: 2,
    status: "preparing",
    items: [
      { id: "oi-10", menuItemId: "m-1-1", name: "Picanha Grelhada", price: 89, quantity: 2, status: "preparing" },
      { id: "oi-11", menuItemId: "m-1-6", name: "Salada Mista", price: 22, quantity: 1, status: "ready" },
      { id: "oi-12", menuItemId: "m-1-4", name: "Caipirinha Artesanal", price: 22, quantity: 2, status: "ready" },
    ],
    total: 244,
    isPriority: true,
    paidAt: new Date(Date.now() - 10 * 60000).toISOString(),
    customerName: "Carlos Eduardo",
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    estimatedMinutes: 8,
  },
  {
    id: "ord-2",
    tableId: "t-6",
    tableNumber: 6,
    status: "pending",
    items: [
      { id: "oi-20", menuItemId: "m-1-3", name: "Frango à Brasa", price: 48, quantity: 3, status: "pending" },
      { id: "oi-21", menuItemId: "m-1-7", name: "Pão de Alho Gratinado", price: 18, quantity: 2, status: "preparing" },
      { id: "oi-22", menuItemId: "m-1-5", name: "Refrigerante", price: 8, quantity: 4, status: "ready" },
    ],
    total: 212,
    isPriority: false,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    estimatedMinutes: 15,
  },
  {
    id: "ord-3",
    tableId: "t-demo-1",
    tableNumber: 10,
    status: "preparing",
    items: [
      { id: "oi-30", menuItemId: "m-1-1", name: "Picanha Grelhada", price: 89, quantity: 1, status: "preparing" },
      { id: "oi-31", menuItemId: "m-1-8", name: "Pudim de Leite", price: 18, quantity: 2, status: "pending" },
    ],
    total: 125,
    isPriority: false,
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    estimatedMinutes: 12,
  },
];

const DEFAULT_SETTINGS: RestaurantSettings = {
  preOrderEnabled: true,
  reserveMesasEnabled: true,
  qrEntranceEnabled: true,
  priorityPaymentEnabled: true,
  cardapioPorLoja: false,
  comprasPorLoja: false,
  tipType: "percentage",
  tipPercentages: [10, 15, 20],
  tipMin: 0,
  tipMax: 500,
  couvertEnabled: false,
  couvertValue: 15,
  couvertPerPerson: true,
  reservationDurationMinutes: 45,
  reservationWarningMinutes: 5,
  maxReservationsPerHour: 8,
  estimatedPrepTimeMinutes: 20,
  qrEntranceToken: "e5f6a7b8-cafe-4000-8000-miar0rest0001",
  pixKey: "00020126580014BR.GOV.BCB.PIX0136miar.vrfood@pix.com.br5204000053039865802BR5913MIAR VR FOOD6009SAO PAULO62070503***6304ABCD",
  pixQrImageUrl: "",
  cameras: [],
  mem0ApiKey: "",
  modoPessoalHabilitado: true,
  perimetro: {
    ativo: false,
    aplicarNoGestor: false,
    raioMetros: 150,
    redesLocaisPermitidas: [],
  },
  fidelidade: {
    ativo: false,
    porConsumo: false,
    pedidosParaResgate: 10,
    itemRecompensaConsumo: "",
    porIndicacao: false,
    indicacoesParaResgate: 10,
    itemRecompensaIndicacao: "",
  },
  plano: "tio-do-dog",
  idiomaPadrao: "pt",
  apoioSocial: {
    ativo: false,
    tipo: "percentual",
    valor: 0,
  },
  fiadoLembreteHora: 8,
  shows: {
    trabalhaComShows: false,
    areas: [],
    todasAreas: false,
    recebeContatos: false,
  },
};

// RestaurantSettings agora é POR ESTABELECIMENTO, não mais um objeto único
// global — corrigido em 12/08/2026. Antes, todo restaurante cadastrado
// compartilhava o mesmo plano, fidelidade, idioma padrão, apoio social e
// configuração de shows, o que quebrava qualquer coisa que dependesse
// dessas configurações assim que houvesse mais de um estabelecimento
// pagante ao mesmo tempo.
export const settingsByCompany = new Map<string, RestaurantSettings>();

// Mantido por compatibilidade com o restaurante de demonstração único que
// várias rotas antigas ainda assumem (rest-1 e afins) — nunca usar em
// código novo, sempre passar o companyId explícito.
const DEMO_COMPANY_ID = "rest-1";
settingsByCompany.set(DEMO_COMPANY_ID, { ...DEFAULT_SETTINGS });

export function getSettings(companyId: string = DEMO_COMPANY_ID): RestaurantSettings {
  let s = settingsByCompany.get(companyId);
  if (!s) {
    s = { ...DEFAULT_SETTINGS };
    settingsByCompany.set(companyId, s);
  }
  return s;
}

export function updateSettings(companyId: string, updates: Partial<RestaurantSettings>): void {
  const atual = getSettings(companyId);
  settingsByCompany.set(companyId, { ...atual, ...updates });
  scheduleSave("settingsByCompany", Array.from(settingsByCompany.entries()));
}

// Formato de post que o estabelecimento pode publicar no Feed, por plano
// (registro 27 da memória comercial, 09/08/2026). Ordem cumulativa: cada
// plano tem acesso aos formatos dos planos abaixo dele também.
export const FEED_MEDIA_POR_PLANO: Record<PlanoMiar, FeedPostMediaType[]> = {
  "tio-do-dog": ["texto"],
  inicial: ["texto", "imagem"],
  intermediario: ["texto", "imagem", "video"],
  premium: ["texto", "imagem", "video", "publicidade"],
};

export const feedbacks: Feedback[] = [];

// ─── Configuração de onboarding do estabelecimento ─────────────────────────────
// Movido de routes/setup.ts (09/08/2026) — era um Map em memória pura, sem
// nenhuma chamada de scheduleSave/loadSnapshot, então TODO cardápio e feature
// configurados no onboarding se perdiam a cada restart do servidor.
export interface EstabelecimentoFeature {
  id: string;
  value: string | null;
}

export interface EstabelecimentoItem {
  category: string;
  name: string;
  price: number | null;
}

export interface EstabelecimentoConfig {
  restaurantId: string;
  segmentId: string;
  features: EstabelecimentoFeature[];
  items: EstabelecimentoItem[];
  updatedAt: string;
}

export const estabelecimentoConfigs = new Map<string, EstabelecimentoConfig>();

export function setEstabelecimentoConfig(companyId: string, config: EstabelecimentoConfig): void {
  estabelecimentoConfigs.set(companyId, config);
  scheduleSave("estabelecimentoConfigs", Array.from(estabelecimentoConfigs.entries()));
}

// ─── Feed do Cliente (Feed Gastronômico) ───────────────────────────────────────
// Post feito pelo ESTABELECIMENTO pra se divulgar. Formato permitido depende
// do plano (ver FEED_MEDIA_POR_PLANO). Visibilidade/descoberta/Top10 são
// iguais em todos os planos — essa restrição é só sobre o que o
// estabelecimento consegue publicar, não sobre quem aparece.
export type FeedPostMediaType = "texto" | "imagem" | "video" | "publicidade";

export interface FeedPost {
  id: string;
  restaurantId: string;
  restaurantName: string;
  segment: string;
  mediaType: FeedPostMediaType;
  title: string;
  content: string;
  mediaUrl?: string;
  emoji: string;
  createdAt: string;
}

export const feedPosts: FeedPost[] = [
  {
    id: "fp-1", restaurantId: "rest-1", restaurantName: "Churrascaria do Vale", segment: "churrascaria", // tenant-isolation-ok — dado de demo público do feed de rede, não é dado de tenant real
    mediaType: "texto", title: "Picanha na Brasa — 20% OFF hoje!", emoji: "🔥",
    content: "Toda terça-feira é dia de picanha com desconto especial. Válido para consumo no salão.",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "fp-2", restaurantId: "rest-2", restaurantName: "La Trattoria", segment: "italiana", // tenant-isolation-ok
    mediaType: "texto", title: "Novo prato: Risoto de Funghi Porcini", emoji: "🍄",
    content: "Acabamos de adicionar ao cardápio um risoto especial com funghi porcini importado. Venha experimentar!",
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "fp-3", restaurantId: "rest-3", restaurantName: "Sabor da Casa", segment: "brasileira", // tenant-isolation-ok
    mediaType: "texto", title: "Festival de Feijoada — Sábado!", emoji: "🫘",
    content: "Sábado teremos nosso tradicional Festival de Feijoada completa com caipirinha inclusa. Reserve já sua mesa.",
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "fp-4", restaurantId: "rest-4", restaurantName: "Sakura Sushi Bar", segment: "japonesa", // tenant-isolation-ok
    mediaType: "texto", title: "Hot Roll de Salmão Trufado chegou!", emoji: "🍣",
    content: "Lançamos o nosso Hot Roll especial com salmão, cream cheese e azeite de trufas. Edição limitada.",
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: "fp-5", restaurantId: "rest-5", restaurantName: "Pizzaria Napolitana", segment: "pizzaria", // tenant-isolation-ok
    mediaType: "texto", title: "Segunda-feira: Pizza em dobro", emoji: "🍕",
    content: "Peça uma pizza grande e ganhe uma média de qualquer sabor. Toda segunda-feira no delivery.",
    createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
];

export function addFeedPost(post: FeedPost): FeedPost {
  feedPosts.push(post);
  scheduleSave("feedPosts", feedPosts);
  return post;
}

// ─── Cashier Sessions ─────────────────────────────────────────────────────────

export type CashierMovementType =
  | 'open'          // turno aberto
  | 'close'         // turno fechado
  | 'sangria'       // retirada de dinheiro
  | 'reforco'       // entrada de dinheiro extra
  | 'sale_cash'     // venda em dinheiro
  | 'sale_card'     // venda em cartão (genérico/legado — preferir sale_debit/sale_credit)
  | 'sale_debit'    // venda em cartão de débito
  | 'sale_credit'   // venda em cartão de crédito
  | 'sale_voucher'  // venda em vale-alimentação/refeição (Alelo, VR, Sodexo, Ticket)
    | 'sale_pix'     // venda em PIX
  | 'sale_app'     // pagamento confirmado pelo App/provedor
  | 'sale_mixed';   // venda mista

export interface CashierMovement {
  id: string;
  type: CashierMovementType;
  amount: number;           // valor da venda (subtotal + gorjeta)
  receivedAmount?: number;  // quanto o cliente entregou (dinheiro)
  changeGiven?: number;     // troco devolvido
  description: string;
  operatorName: string;
  orderId?: string;
  tableNumber?: number;
  voucherBrand?: 'alelo' | 'vr' | 'sodexo' | 'ticket' | 'outro'; // só quando type === 'sale_voucher'
  paymentBreakdown?: { dinheiro?: number; cartao?: number; debito?: number; credito?: number; voucher?: number; pix?: number; app?: number };
  timestamp: string;
}

export interface CashierSession {
  id: string;
  restaurantId: string;
  lojaId?: string;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
  initialFloat: number;      // fundo de caixa inicial
  operatorName: string;
  movements: CashierMovement[];
  // Preenchidos no fechamento
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  closingNotes?: string;
  openingDenominations?: Record<string, number>;
  closingDenominations?: Record<string, number>;
  handoff?: {
    mode: 'with_sangria' | 'without_sangria';
    outgoingOperatorName: string;
    incomingOperatorName?: string;
    outgoingNotes?: string;
    incomingNotes?: string;
    countedCash?: number;
    receivedAt?: string;
    incomingOperatorId?: string;
    at: string;
  };
}

// ─── Financial Ledger (fonte financeira única) ─────────────────────────────────
// O Ledger usa a mesma persistência/snapshot do data-store e nunca substitui
// pedidos, sessões de mesa ou movimentos do Caixa. Ele registra os eventos
// financeiros confirmados e mantém uma chave idempotente por tenant.
export const financialMovements: FinancialMovement[] = [];

/** Registra um movimento uma única vez por tenant e chave idempotente. */
export function registerFinancialMovement(input: NewFinancialMovement): FinancialMovement {
  const movement = registerFinancialMovementInMemory(financialMovements, input);
  scheduleSave("financialMovements", financialMovements);
  return movement;
}

export function listFinancialMovements(restaurantId: string, lojaId?: string): FinancialMovement[] {
  return financialMovements.filter(
    (movement) => movement.restaurantId === restaurantId && (!lojaId || pertenceALoja(movement.lojaId, lojaId, restaurantId)),
  );
}

export let cashierSessions: CashierSession[] = [];

// CORRIGIDO: antes não filtrava por companyId nem lojaId — qualquer restaurante
// logado enxergava/mexia no turno aberto de OUTRO restaurante, bastava o timing.
// Agora sempre exige companyId; lojaId é resolvido pelo caller (padrão = loja
// principal da conta quando a conta ainda não usa multi-loja).
export function getCurrentCashierSession(companyId: string, lojaId: string): CashierSession | undefined {
  return cashierSessions.find(
    (s) => s.status === 'open' && s.restaurantId === companyId && pertenceALoja(s.lojaId, lojaId, companyId)
  );
}

export function getCashierSummary(session: CashierSession) {
  const sales = session.movements.filter(m =>
    ['sale_cash', 'sale_card', 'sale_debit', 'sale_credit', 'sale_voucher', 'sale_pix', 'sale_app', 'sale_mixed'].includes(m.type)
  );
  const sangrias = session.movements.filter(m => m.type === 'sangria');
  const reforcos = session.movements.filter(m => m.type === 'reforco');

  const totalCash = sales
    .filter(m => m.type === 'sale_cash')
    .reduce((s, m) => s + (m.receivedAmount ?? m.amount) - (m.changeGiven ?? 0), 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.dinheiro ?? 0), 0);

  const totalCard = sales
    .filter(m => m.type === 'sale_card').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.cartao ?? 0), 0);

  const totalDebit = sales
    .filter(m => m.type === 'sale_debit').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.debito ?? 0), 0);

  const totalCredit = sales
    .filter(m => m.type === 'sale_credit').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.credito ?? 0), 0);

  const totalVoucher = sales
    .filter(m => m.type === 'sale_voucher').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.voucher ?? 0), 0);

  const totalPix = sales
    .filter(m => m.type === 'sale_pix').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.pix ?? 0), 0);

  const totalApp = sales
    .filter(m => m.type === 'sale_app').reduce((s, m) => s + m.amount, 0)
    + sales.filter(m => m.type === 'sale_mixed')
      .reduce((s, m) => s + (m.paymentBreakdown?.app ?? 0), 0);

  const totalSangria = sangrias.reduce((s, m) => s + m.amount, 0);
  const totalReforco = reforcos.reduce((s, m) => s + m.amount, 0);
  const totalRevenue = sales.reduce((s, m) => s + m.amount, 0);

  const cashInDrawer = session.initialFloat + totalCash + totalReforco - totalSangria;

  const closingDifference = session.actualCash == null ? undefined : session.actualCash - cashInDrawer;
  return {
    totalCash, totalCard, totalDebit, totalCredit, totalVoucher, totalPix, totalApp,
    totalSangria, totalReforco, totalRevenue, cashInDrawer, salesCount: sales.length,
    reconciliation: {
      cash: { expected: cashInDrawer, counted: session.actualCash, difference: session.difference ?? closingDifference },
      pix: { confirmed: totalPix },
      credit: { confirmed: totalCredit },
      debit: { confirmed: totalDebit },
      voucher: { confirmed: totalVoucher },
      app: { confirmed: totalApp },
    },
  };
}

// ─── AI Chat Storage ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Per-user chat history (client app). Keyed by persistent userId UUID. */
export const userChats = new Map<string, ChatMessage[]>();

/** Shared chat history for all restaurant terminals. */
export let restaurantSharedChat: ChatMessage[] = [];
export function setRestaurantSharedChat(msgs: ChatMessage[]): void {
  restaurantSharedChat = msgs;
  scheduleSave("restaurantSharedChat", msgs);
}

// ─── Nutri Saúde — Chat & Perfil (mesmo padrão de snapshot já usado acima) ────

export interface NutriProfile {
  onboardingSeen?: boolean;
  goal?: string;
  goalOther?: string;
  healthConditions?: string[];
  healthNotes?: string;
  aboutYou?: string;
  symptoms?: string[];
  triggerFoods?: string[];
  routineNotes?: string;
  updatedAt: string;
}

export const nutriChats = new Map<string, ChatMessage[]>();
export const nutriProfiles = new Map<string, NutriProfile>();

export function getNutriChat(userId: string): ChatMessage[] {
  return nutriChats.get(userId) ?? [];
}
export function setNutriChat(userId: string, msgs: ChatMessage[]): void {
  nutriChats.set(userId, msgs);
  scheduleSave("nutriChats", Array.from(nutriChats.entries()));
}
export function getNutriProfile(userId: string): NutriProfile | undefined {
  return nutriProfiles.get(userId);
}
export function setNutriProfile(userId: string, profile: NutriProfile): void {
  nutriProfiles.set(userId, profile);
  scheduleSave("nutriProfiles", Array.from(nutriProfiles.entries()));
}
export function deleteNutriProfile(userId: string): void {
  nutriProfiles.delete(userId);
  scheduleSave("nutriProfiles", Array.from(nutriProfiles.entries()));
}

// ─── Table Sessions (in-memory) ────────────────────────────────────────────────

export const tableSessions: TableSession[] = [];

export const cashierAlerts: CashierAlert[] = [];

// ─── Fiado — crédito do cliente com o estabelecimento ──────────────────────────
// Cada linha é uma compra fiada. valorPago vai subindo conforme o cliente
// paga (parcial ou total). O saldo em aberto é sempre valorTotal - valorPago.
// Lembrete diário (fiado-scheduler.ts) olha pra essas linhas.
export interface FiadoRecord {
  id: string;
  restaurantId: string;
  clientAccountId: string;
  clientName: string;
  valorTotal: number;
  valorPago: number;
  orderId?: string;
  criadoEm: string;
  quitadoEm?: string;
  /** Última data (YYYY-MM-DD) em que o lembrete diário já foi mostrado pro
   * cliente — evita mostrar de novo no mesmo dia toda vez que ele abre o app. */
  ultimoLembreteData?: string;
}

export const fiadoRecords: FiadoRecord[] = [];

export function saldoFiadoEmAberto(restaurantId: string, clientAccountId: string): number {
  return fiadoRecords
    .filter((f) => f.restaurantId === restaurantId && f.clientAccountId === clientAccountId && !f.quitadoEm)
    .reduce((acc, f) => acc + (f.valorTotal - f.valorPago), 0);
}

// ─── Auditoria de estoque por câmera — alerta silencioso de possível fraude ────
// Quando o funcionário registra uma auditoria de estoque, o app do celular
// deve forçar captura direta pela câmera (input com capture=camera), nunca
// permitir escolher da galeria. Isso é reforçado no servidor: se o método de
// captura reportado pelo app não for "camera-ao-vivo", ou se o timestamp do
// arquivo divergir muito do horário do servidor, gera um alerta que SÓ o
// dono vê — o funcionário não sabe que esse alerta existe.
export interface StockAuditAlert {
  id: string;
  restaurantId: string;
  employeeId?: string;
  employeeName?: string;
  motivo: string;
  capturaMethod: string;
  createdAt: string;
  resolvedAt?: string;
}

export const stockAuditAlerts: StockAuditAlert[] = [];

// ─── Waiter calls (garçom chamado pela mesa) ──────────────────────────────────
export interface WaiterCall {
  id: string;
  restaurantId: string;
  lojaId?: string;
  tableId: string;
  tableNumber: number;
  message?: string;
  status: "pending" | "claimed";
  claimedBy?: string;
  createdAt: string;
  claimedAt?: string;
}

export const waiterCalls: WaiterCall[] = [];

// ─── Recados internos (mural da casa: caixa ⇄ salão) ──────────────────────────
// Dois tipos que não se misturam:
//  - "operacao": voz do comando (ex.: "acabou troco", "abrimos em 10 min")
//  - "mesa": nota amarrada a uma mesa (some quando a mesa fecha)
// Leitura confirmada por pessoa (quem bateu o "li").
export interface Recado {
  id: string;
  restaurantId: string;
  tipo: "operacao" | "mesa";
  autor: string;
  texto: string;
  mesa?: number;
  criadoEm: string;
  leram: string[];
  fechado?: boolean;
}

export let recados: Recado[] = [];

// ─── Fidelidade ────────────────────────────────────────────────────────────────

export interface LoyaltyRecord {
  clientAccountId: string;
  points: number;
  level: 'bronze' | 'prata' | 'ouro' | 'diamante';
  updatedAt: string;
}
export let loyaltyRecords: LoyaltyRecord[] = [];

// ─── Resgate de fidelidade — evento real (15/08/2026) ──────────────────────────
// Antes só existia o campo de configuração da régua (fidelidade.porConsumo /
// pedidosParaResgate), sem nenhum registro de quando um resgate de fato
// acontece. Isso bloqueava o critério de elegibilidade da promoção de
// lançamento estendida (12 meses) descrito no manual, seção 27.2 — que exige
// resgate REAL confirmado pelo app, não só o toggle ligado.
export interface LoyaltyResgate {
  id: string;
  restaurantId: string;
  clientAccountId: string;
  tipo: 'consumo'; // 'indicacao' fica pra quando o rastreamento de indicação existir
  marcoAtingido: number; // ex: 10, 20, 30... (múltiplo de pedidosParaResgate)
  itemRecompensa: string;
  status: 'pendente' | 'entregue';
  createdAt: string;
  entregueAt?: string;
  entreguePor?: string;
}
export let loyaltyResgates: LoyaltyResgate[] = [];

// Chamado sempre que um pedido de um cliente autenticado é marcado como pago.
// Conta quantos pedidos pagos esse cliente já fez nesse restaurante; se bateu
// um múltiplo exato do marco configurado (pedidosParaResgate) e ainda não
// existe resgate pendente/entregue pra esse marco específico, cria um resgate
// PENDENTE — o gestor confirma a entrega física depois (é essa confirmação
// que conta como "resgate real" pra seção 27.2).
export function checarResgatePorConsumo(restaurantId: string, clientAccountId: string): LoyaltyResgate | null {
  const settings = getSettings(restaurantId);
  if (!settings.fidelidade?.ativo || !settings.fidelidade?.porConsumo) return null;
  const marco = settings.fidelidade.pedidosParaResgate;
  if (!marco || marco <= 0) return null;

  const pedidosPagos = orders.filter(
    (o) => o.restaurantId === restaurantId && o.clientAccountId === clientAccountId && o.status === 'paid'
  ).length;

  if (pedidosPagos === 0 || pedidosPagos % marco !== 0) return null;

  const jaExiste = loyaltyResgates.some(
    (r) => r.restaurantId === restaurantId && r.clientAccountId === clientAccountId && r.marcoAtingido === pedidosPagos
  );
  if (jaExiste) return null;

  const resgate: LoyaltyResgate = {
    id: randomUUID(),
    restaurantId,
    clientAccountId,
    tipo: 'consumo',
    marcoAtingido: pedidosPagos,
    itemRecompensa: settings.fidelidade.itemRecompensaConsumo || 'Item de fidelidade',
    status: 'pendente',
    createdAt: new Date().toISOString(),
  };
  loyaltyResgates.push(resgate);
  return resgate;
}

// Usado pela promoção de lançamento (seção 27.2 do manual): só existe
// desconto estendido a 12 meses se houver ao menos UM resgate de fato
// ENTREGUE (não basta pendente, nem só o toggle configurado).
export function temResgateEntregue(restaurantId: string): boolean {
  return loyaltyResgates.some((r) => r.restaurantId === restaurantId && r.status === 'entregue');
}

// ─── Atalhos Inteligentes (seção 125 do Manual de Fábrica) ─────────────────────
// Cada estabelecimento personaliza os atalhos do sistema. Suporta teclado
// (combinação de teclas) e mouse (botão lateral/extra). Escopo por usuário
// (dono ou funcionário) dentro do restaurante — dois usuários do mesmo
// restaurante podem ter combinações diferentes para a mesma função.
export type AtalhoTipo = "teclado" | "mouse";

export interface AtalhoAcao {
  action: string; // chave estável, ex.: "novo-pedido"
  label: string; // nome exibido, ex.: "Novo Pedido"
}

// Lista de funções atribuíveis, conforme a seção 125 do manual.
export const ATALHO_ACOES_DISPONIVEIS: AtalhoAcao[] = [
  { action: "novo-pedido", label: "Novo Pedido" },
  { action: "abrir-caixa", label: "Abrir Caixa" },
  { action: "fechar-caixa", label: "Fechar Caixa" },
  { action: "cancelar-pedido", label: "Cancelar Pedido" },
  { action: "adicionar-item", label: "Adicionar Item" },
  { action: "excluir-item", label: "Excluir Item" },
  { action: "enviar-cozinha", label: "Enviar para Cozinha" },
  { action: "marcar-pedido-pronto", label: "Marcar Pedido Pronto" },
  { action: "imprimir-comanda", label: "Imprimir Comanda" },
  { action: "abrir-estoque", label: "Abrir Estoque" },
  { action: "abrir-dashboard", label: "Abrir Dashboard" },
  { action: "nova-compra", label: "Nova Compra" },
  { action: "novo-cliente", label: "Novo Cliente" },
  { action: "consultar-mesa", label: "Consultar Mesa" },
  { action: "finalizar-conta", label: "Finalizar Conta" },
];

// Atalhos de teclado padrão de fábrica (o usuário pode alterar tudo depois).
export const ATALHOS_PADRAO: Array<{ action: string; key: string; tipo: AtalhoTipo }> = [
  { action: "novo-pedido", key: "alt+1", tipo: "teclado" },
  { action: "abrir-dashboard", key: "alt+2", tipo: "teclado" },
  { action: "abrir-caixa", key: "alt+3", tipo: "teclado" },
  { action: "abrir-estoque", key: "alt+4", tipo: "teclado" },
  { action: "enviar-cozinha", key: "alt+5", tipo: "teclado" },
];

export interface Atalho {
  id: string;
  restaurantId: string;
  userId: string; // ownerId ou employeeId de quem configurou
  action: string;
  key: string; // ex.: "ctrl+shift+p" ou "mouse:botao-lateral-1"
  tipo: AtalhoTipo;
  atualizadoEm: string;
}

export let atalhos: Atalho[] = [];

export function getAtalhosDoUsuario(restaurantId: string, userId: string): Atalho[] {
  return atalhos.filter((a) => a.restaurantId === restaurantId && a.userId === userId);
}

// Retorna o atalho já existente que usa a mesma combinação, para o mesmo
// usuário, numa ação diferente — usado para detectar conflito antes de salvar.
export function encontrarConflitoAtalho(
  restaurantId: string,
  userId: string,
  key: string,
  tipo: AtalhoTipo,
  actionIgnorada?: string
): Atalho | undefined {
  return atalhos.find(
    (a) =>
      a.restaurantId === restaurantId &&
      a.userId === userId &&
      a.tipo === tipo &&
      a.key === key &&
      a.action !== actionIgnorada
  );
}

export function definirAtalho(
  restaurantId: string,
  userId: string,
  action: string,
  key: string,
  tipo: AtalhoTipo
): Atalho {
  const existente = atalhos.find(
    (a) => a.restaurantId === restaurantId && a.userId === userId && a.action === action
  );
  if (existente) {
    existente.key = key;
    existente.tipo = tipo;
    existente.atualizadoEm = new Date().toISOString();
    scheduleSave("atalhos", atalhos);
    return existente;
  }
  const novo: Atalho = {
    id: randomUUID(),
    restaurantId,
    userId,
    action,
    key,
    tipo,
    atualizadoEm: new Date().toISOString(),
  };
  atalhos.push(novo);
  scheduleSave("atalhos", atalhos);
  return novo;
}

export function removerAtalho(restaurantId: string, userId: string, action: string): boolean {
  const antes = atalhos.length;
  atalhos = atalhos.filter(
    (a) => !(a.restaurantId === restaurantId && a.userId === userId && a.action === action)
  );
  if (atalhos.length !== antes) {
    scheduleSave("atalhos", atalhos);
    return true;
  }
  return false;
}

export function restaurarAtalhosPadrao(restaurantId: string, userId: string): Atalho[] {
  atalhos = atalhos.filter((a) => !(a.restaurantId === restaurantId && a.userId === userId));
  const criados = ATALHOS_PADRAO.map((padrao) => {
    const novo: Atalho = {
      id: randomUUID(),
      restaurantId,
      userId,
      action: padrao.action,
      key: padrao.key,
      tipo: padrao.tipo,
      atualizadoEm: new Date().toISOString(),
    };
    atalhos.push(novo);
    return novo;
  });
  scheduleSave("atalhos", atalhos);
  return criados;
}

export function addRecado(r: Recado): Recado {
  recados.unshift(r);
  if (recados.length > 200) recados = recados.slice(0, 200);
  scheduleSave("recados", recados);
  return r;
}

export function marcarRecadoLido(id: string, quem: string, restaurantId: string): Recado | undefined {
  const r = recados.find((x) => x.id === id && x.restaurantId === restaurantId);
  if (!r) return undefined;
  if (!r.leram.includes(quem)) r.leram.push(quem);
  scheduleSave("recados", recados);
  return r;
}

export function fecharRecadosDaMesa(mesa: number, restaurantId: string): void {
  let mudou = false;
  for (const r of recados) {
    if (r.tipo === "mesa" && r.mesa === mesa && r.restaurantId === restaurantId && !r.fechado) {
      r.fechado = true;
      mudou = true;
    }
  }
  if (mudou) scheduleSave("recados", recados);
}

// ─── Mural de Empregos (seção 21/57 do manual) ─────────────────────────────────
// Conecta estabelecimentos, profissionais e candidatos. Uso é gratuito, sem
// cobrança adicional em nenhum plano — regra comercial fixa. Toda vaga passa
// pelo mesmo filtro de moderação (duas camadas) usado no Feed Interno antes
// de ficar visível publicamente.
export type VagaStatus = "ativa" | "pausada" | "encerrada";
export type VagaTipo = "efetivo" | "freela" | "temporario" | "meio-periodo";

export interface Vaga {
  id: string;
  restaurantId: string;
  restaurantName: string;
  titulo: string;
  descricao: string;
  cargo: string;
  tipo: VagaTipo;
  remuneracao?: string;
  contato: string;
  status: VagaStatus;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VagaInteresse {
  id: string;
  vagaId: string;
  nome: string;
  telefone: string;
  mensagem?: string;
  criadoEm: string;
}

export let vagas: Vaga[] = [];
export let vagaInteresses: VagaInteresse[] = [];

export function addVaga(v: Vaga): Vaga {
  vagas.push(v);
  scheduleSave("vagas", vagas);
  return v;
}

export function atualizarStatusVaga(id: string, restaurantId: string, status: VagaStatus): Vaga | undefined {
  const vaga = vagas.find((v) => v.id === id && v.restaurantId === restaurantId);
  if (!vaga) return undefined;
  vaga.status = status;
  vaga.atualizadoEm = new Date().toISOString();
  scheduleSave("vagas", vagas);
  return vaga;
}

export function addVagaInteresse(i: VagaInteresse): VagaInteresse {
  vagaInteresses.push(i);
  scheduleSave("vaga-interesses", vagaInteresses);
  return i;
}

// ─── MIAR Apoia — Perfil de Artista/Atleta ─────────────────────────────────────
// Conecta o cliente que marcou "sou artista" no perfil com estabelecimentos
// que trabalham com shows e querem receber contato. Guardado por clientId,
// só um perfil por pessoa (upsert). Área "todas" no filtro do estabelecimento
// (shows.todasAreas) bate com qualquer área de artista.
export type AreaArtista = "musica" | "stand-up" | "teatro" | "danca" | "artes-visuais" | "outro";
export type NivelArtista = "profissional" | "amador";

export interface PerfilArtista {
  clientId: string;
  nome: string;
  cidade?: string;
  nivel: NivelArtista;
  area?: AreaArtista;
  areaOutro?: string;
  desejaConvitesTrabalho: boolean;
  desejaMensagensEventos: boolean;
  contato?: string;
  atualizadoEm: string;
}

export const perfisArtista = new Map<string, PerfilArtista>();

export function salvarPerfilArtista(p: PerfilArtista): PerfilArtista {
  perfisArtista.set(p.clientId, p);
  scheduleSave("perfis-artista", Array.from(perfisArtista.entries()));
  return p;
}

export function getPerfilArtista(clientId: string): PerfilArtista | undefined {
  return perfisArtista.get(clientId);
}

// ─── Espaço do Artista — Agenda de Eventos, Cachês e Consumo ───────────────────
// Detalhamento do "Espaço do Artista" (Manual, seções 19 e 145): o ambiente
// do artista concentra num só lugar agenda de eventos, valores/cachês e
// controle de consumo — evitando planilha ou canal separado. O artista
// também acessa o ambiente Cliente normalmente (mesma identidade/login,
// decisão já registrada); o que ele consome ali se relaciona com a conta
// dele aqui, e o lado financeiro do estabelecimento acompanha cachê e
// consumo pelo painel do Gestor.

export type StatusEventoArtista = "convidado" | "confirmado" | "recusado" | "concluido" | "cancelado";

export interface EventoArtista {
  id: string;
  artistaClientId: string;
  restaurantId: string;
  restaurantName: string;
  titulo: string;
  data: string; // ISO
  cache?: number; // valor combinado em R$, opcional (pode ser voluntário/sem cachê)
  couvertParaArtista?: number; // parte do couvert destinada ao artista, se aplicável
  contrato?: string; // texto livre — termos combinados, quando aplicável
  status: StatusEventoArtista;
  criadoEm: string;
  atualizadoEm: string;
}

export const eventosArtista: EventoArtista[] = [];

export function addEventoArtista(e: EventoArtista): EventoArtista {
  eventosArtista.push(e);
  scheduleSave("eventos-artista", eventosArtista);
  return e;
}

export function atualizarStatusEventoArtista(
  id: string,
  quemPodeAlterar: { artistaClientId?: string; restaurantId?: string },
  status: StatusEventoArtista
): EventoArtista | undefined {
  const evento = eventosArtista.find(
    (e) =>
      e.id === id &&
      (quemPodeAlterar.artistaClientId ? e.artistaClientId === quemPodeAlterar.artistaClientId : true) &&
      (quemPodeAlterar.restaurantId ? e.restaurantId === quemPodeAlterar.restaurantId : true)
  );
  if (!evento) return undefined;
  evento.status = status;
  evento.atualizadoEm = new Date().toISOString();
  scheduleSave("eventos-artista", eventosArtista);
  return evento;
}

// Consumo do artista no estabelecimento — pode ser cortesia (cortesia:true,
// não entra no fechamento do cachê) ou descontado do cachê combinado
// (cortesia:false, o financeiro do Gestor soma isso na hora de fechar conta
// com o artista). Vinculado ao evento quando o consumo acontece no dia do
// show; pode existir consumo avulso (artistaClientId sem eventoId) quando o
// artista frequenta o estabelecimento fora de um evento.
export interface ConsumoArtista {
  id: string;
  artistaClientId: string;
  restaurantId: string;
  eventoId?: string;
  descricao: string;
  valor: number;
  cortesia: boolean;
  criadoEm: string;
}

export const consumosArtista: ConsumoArtista[] = [];

export function addConsumoArtista(c: ConsumoArtista): ConsumoArtista {
  consumosArtista.push(c);
  scheduleSave("consumos-artista", consumosArtista);
  return c;
}

export interface DeliveryObservation {
  id: string;
  restaurantId: string;
  addressKey: string;
  addressText?: string;
  customerId?: string;
  customerName?: string;
  orderId?: string;
  note: string;
  tags: string[];
  severity: "info" | "warning" | "critical";
  internalOnly: boolean;
  createdBy: string;
  createdAt: string;
}

export interface DeliveryGovernanceIncident {
  id: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  notes?: string;
  severity: "info" | "warning" | "critical";
  createdBy: string;
  createdAt: string;
  status: "none" | "warning" | "suspension" | "banned";
  penaltyLevel: number;
}

export interface DeliveryGovernanceProfile {
  restaurantId: string;
  employeeId: string;
  employeeName: string;
  negativeEvents: number;
  penaltyStatus: "none" | "warning" | "suspension" | "banned";
  suspensionUntil?: string;
  lastIncidentAt?: string;
  incidents: DeliveryGovernanceIncident[];
}

export interface DeliveryGovernanceConfig {
  active: boolean;
  warningThreshold: number;
  suspensionThreshold: number;
  banThreshold: number;
  suspensionDays: number;
  requireAudit: boolean;
}

export const deliveryObservations: DeliveryObservation[] = [];
export const deliveryGovernanceProfiles: DeliveryGovernanceProfile[] = [];
export const deliveryGovernanceIncidents: DeliveryGovernanceIncident[] = [];
export const deliveryGovernanceConfig: DeliveryGovernanceConfig = {
  active: true,
  warningThreshold: 1,
  suspensionThreshold: 2,
  banThreshold: 3,
  suspensionDays: 48,
  requireAudit: true,
};

// CORRIGIDO (15/08/2026) — vazamento multi-tenant: deliveryGovernanceConfig
// era um único objeto global; se o restaurante A mudasse o limite de
// suspensão, isso afetava TODOS os restaurantes da plataforma. Mesmo
// problema que RestaurantSettings já tinha e foi corrigido em 12/08 —
// aplicando o mesmo padrão (Map por companyId, fallback pro default acima
// só na primeira leitura de cada empresa).
const deliveryGovernanceConfigByCompany = new Map<string, DeliveryGovernanceConfig>();

export function getDeliveryGovernanceConfig(companyId: string): DeliveryGovernanceConfig {
  let c = deliveryGovernanceConfigByCompany.get(companyId);
  if (!c) {
    c = { ...deliveryGovernanceConfig };
    deliveryGovernanceConfigByCompany.set(companyId, c);
  }
  return c;
}

export function updateDeliveryGovernanceConfig(companyId: string, updates: Partial<DeliveryGovernanceConfig>): DeliveryGovernanceConfig {
  const atual = getDeliveryGovernanceConfig(companyId);
  const novo = { ...atual, ...updates };
  deliveryGovernanceConfigByCompany.set(companyId, novo);
  scheduleSave("deliveryGovernanceConfigByCompany", Array.from(deliveryGovernanceConfigByCompany.entries()));
  return novo;
}

export function createDeliveryObservation(data: Omit<DeliveryObservation, "id" | "createdAt">): DeliveryObservation {
  const item: DeliveryObservation = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  deliveryObservations.unshift(item);
  scheduleSave("deliveryObservations", deliveryObservations);
  return item;
}

export function listDeliveryObservations(restaurantId: string, addressKey?: string): DeliveryObservation[] {
  const normalized = addressKey?.trim().toLowerCase();
  return deliveryObservations
    .filter((item) => item.restaurantId === restaurantId && (!normalized || item.addressKey.toLowerCase().includes(normalized)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createDeliveryGovernanceIncident(data: Omit<DeliveryGovernanceIncident, "id" | "createdAt">): DeliveryGovernanceIncident {
  const item: DeliveryGovernanceIncident = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  deliveryGovernanceIncidents.unshift(item);
  scheduleSave("deliveryGovernanceIncidents", deliveryGovernanceIncidents);
  return item;
}

export function upsertDeliveryGovernanceProfile(restaurantId: string, employeeId: string, employeeName: string, incident: DeliveryGovernanceIncident): DeliveryGovernanceProfile {
  const config = getDeliveryGovernanceConfig(restaurantId);
  const existing = deliveryGovernanceProfiles.find((profile) => profile.employeeId === employeeId && profile.restaurantId === restaurantId);
  const incidents = [incident, ...(existing?.incidents ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const negativeEvents = incidents.length;
  const penaltyStatus = negativeEvents >= config.banThreshold
    ? "banned"
    : negativeEvents >= config.suspensionThreshold
      ? "suspension"
      : negativeEvents >= config.warningThreshold
        ? "warning"
        : "none";
  const profile: DeliveryGovernanceProfile = {
    restaurantId,
    employeeId,
    employeeName,
    negativeEvents,
    penaltyStatus,
    suspensionUntil: penaltyStatus === "suspension" && config.suspensionDays > 0
      ? new Date(Date.now() + config.suspensionDays * 60 * 60 * 1000).toISOString()
      : undefined,
    lastIncidentAt: incident.createdAt,
    incidents,
  };
  if (existing) {
    Object.assign(existing, profile);
    return existing;
  }
  deliveryGovernanceProfiles.push(profile);
  return profile;
}

export function listDeliveryGovernanceProfiles(restaurantId: string): DeliveryGovernanceProfile[] {
  return deliveryGovernanceProfiles
    .filter((profile) => profile.restaurantId === restaurantId)
    .sort((a, b) => b.lastIncidentAt?.localeCompare(a.lastIncidentAt ?? "") ?? 0);
}

export function findOpenSessionByTableId(tableId: string): TableSession | undefined {
  return tableSessions.find((s) => s.tableId === tableId && s.status === "open");
}

export function recomputeSessionSubtotal(session: TableSession): void {
  session.subtotal = session.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** Per-guest share of the bill, according to the session's current split mode. */
export function computeGuestShares(session: TableSession): Record<string, number> {
  const shares: Record<string, number> = {};
  for (const guest of session.guests) shares[guest.id] = 0;

  if (session.splitMode === "byItems") {
    for (const item of session.items) {
      shares[item.guestId] = (shares[item.guestId] ?? 0) + item.price * item.quantity;
    }
  } else if (session.splitMode === "custom") {
    // Guests with an explicit amount pay exactly that; the remainder of the bill
    // is split evenly among the guests who don't have a fixed amount set.
    const fixed = session.customAmounts ?? {};
    const guestsWithFixed = session.guests.filter((g) => typeof fixed[g.id] === "number");
    const guestsWithoutFixed = session.guests.filter((g) => typeof fixed[g.id] !== "number");
    let fixedTotal = 0;
    for (const g of guestsWithFixed) {
      shares[g.id] = fixed[g.id]!;
      fixedTotal += fixed[g.id]!;
    }
    const remainder = Math.max(0, session.subtotal - fixedTotal);
    const perRemaining = guestsWithoutFixed.length > 0 ? remainder / guestsWithoutFixed.length : 0;
    for (const g of guestsWithoutFixed) shares[g.id] = perRemaining;
  } else {
    // Equal split among all current guests
    const perGuest = session.guests.length > 0 ? session.subtotal / session.guests.length : 0;
    for (const guest of session.guests) shares[guest.id] = perGuest;
  }

  return shares;
}

/** True when every guest with a positive share has a "paid" payment recorded. */
export function isSessionFullyPaid(session: TableSession): boolean {
  const shares = computeGuestShares(session);
  const paidGuestIds = new Set(session.payments.filter((p) => p.status === "paid").map((p) => p.guestId));
  return session.guests.every((g) => paidGuestIds.has(g.id) || (shares[g.id] ?? 0) <= 0);
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  restaurantId: string;
  lojaId?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;          // kg, un, L, pacotes, caixas, garrafas, sacos
  minQuantity: number;   // alert threshold
  expiresAt?: string;    // ISO date — null = sem prazo definido
  alertDaysBefore: number; // warn X days before expiry (default 3)
  lastCountedAt: string;
  updatedAt: string;
  barcode?: string;      // EAN-13 / Code128 value — gerado automaticamente pelo módulo de código de barras
  /** Custo por unidade (R$/kg, R$/un, etc.) — adicionado 30/07/2026, base
   * pro cálculo de rentabilidade por prato. Sem isso, o custo do
   * ingrediente entra como "não informado" no cálculo, nunca inventado. */
  unitCost?: number;
}

export let stockItems: StockItem[] = [
  // ── Carnes ────────────────────────────────────────────────────────────────
  { id: "si-001", restaurantId: "rest-1", name: "Picanha",        category: "Carnes",    quantity: 12,  unit: "kg",     minQuantity: 5,  alertDaysBefore: 2, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-002", restaurantId: "rest-1", name: "Costela Bovina", category: "Carnes",    quantity: 8,   unit: "kg",     minQuantity: 4,  alertDaysBefore: 2, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-003", restaurantId: "rest-1", name: "Frango Inteiro", category: "Carnes",    quantity: 6,   unit: "un",     minQuantity: 3,  alertDaysBefore: 2, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-004", restaurantId: "rest-1", name: "Linguiça",       category: "Carnes",    quantity: 4,   unit: "kg",     minQuantity: 2,  alertDaysBefore: 2, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // ── Grãos e Massas ────────────────────────────────────────────────────────
  { id: "si-010", restaurantId: "rest-1", name: "Arroz",          category: "Grãos",     quantity: 3,   unit: "sacos",  minQuantity: 2,  alertDaysBefore: 7, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-011", restaurantId: "rest-1", name: "Feijão Preto",   category: "Grãos",     quantity: 2,   unit: "sacos",  minQuantity: 1,  alertDaysBefore: 7, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-012", restaurantId: "rest-1", name: "Farofa Pronta",  category: "Grãos",     quantity: 5,   unit: "pacotes",minQuantity: 2,  alertDaysBefore: 7, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // ── Laticínios ────────────────────────────────────────────────────────────
  { id: "si-020", restaurantId: "rest-1", name: "Manteiga",       category: "Laticínios",quantity: 3,   unit: "kg",     minQuantity: 1,  expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),  alertDaysBefore: 7, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-021", restaurantId: "rest-1", name: "Queijo Parmesão",category: "Laticínios",quantity: 2,   unit: "kg",     minQuantity: 1,  expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),  alertDaysBefore: 3, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // ── Temperos ──────────────────────────────────────────────────────────────
  { id: "si-030", restaurantId: "rest-1", name: "Sal Grosso",     category: "Temperos",  quantity: 8,   unit: "kg",     minQuantity: 3,  alertDaysBefore: 30, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-031", restaurantId: "rest-1", name: "Alho",           category: "Temperos",  quantity: 2,   unit: "kg",     minQuantity: 1,  expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(), alertDaysBefore: 5, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-032", restaurantId: "rest-1", name: "Azeite",         category: "Temperos",  quantity: 4,   unit: "garrafas",minQuantity: 2, alertDaysBefore: 30, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // ── Bebidas ───────────────────────────────────────────────────────────────
  { id: "si-040", restaurantId: "rest-1", name: "Refrigerante",   category: "Bebidas",   quantity: 48,  unit: "latas",  minQuantity: 12, alertDaysBefore: 30, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-041", restaurantId: "rest-1", name: "Água Mineral",   category: "Bebidas",   quantity: 30,  unit: "garrafas",minQuantity: 10,alertDaysBefore: 60, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-042", restaurantId: "rest-1", name: "Cachaça Premium",category: "Bebidas",   quantity: 3,   unit: "garrafas",minQuantity: 1, alertDaysBefore: 180,lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // ── Descartáveis ──────────────────────────────────────────────────────────
  { id: "si-050", restaurantId: "rest-1", name: "Guardanapos",    category: "Descartáveis",quantity: 20,unit: "pacotes", minQuantity: 5, alertDaysBefore: 90, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "si-051", restaurantId: "rest-1", name: "Carvão",         category: "Outros",    quantity: 5,   unit: "sacos",  minQuantity: 2,  alertDaysBefore: 90, lastCountedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export function createMenuItem(data: Omit<MenuItem, "id">): MenuItem {
  const item: MenuItem = { ...data, id: randomUUID() };
  menuItems.push(item);
  scheduleSave("menuItems", menuItems);
  return item;
}

export function createStockItem(data: Omit<StockItem, "id" | "updatedAt" | "lastCountedAt">): StockItem {
  const item: StockItem = {
    ...data,
    id: randomUUID(),
    lastCountedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  stockItems.push(item);
  scheduleSave("stockItems", stockItems);
  return item;
}

export function updateStockItem(id: string, updates: Partial<StockItem>): StockItem | null {
  const idx = stockItems.findIndex(i => i.id === id);
  if (idx === -1) return null;
  stockItems[idx] = { ...stockItems[idx], ...updates, updatedAt: new Date().toISOString() };
  scheduleSave("stockItems", stockItems);
  return stockItems[idx];
}

export function deleteStockItem(id: string): boolean {
  const idx = stockItems.findIndex(i => i.id === id);
  if (idx === -1) return false;
  stockItems.splice(idx, 1);
  scheduleSave("stockItems", stockItems);
  return true;
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export let suppliers: Supplier[] = [
  { id: "sup-001", restaurantId: "rest-1", name: "Frigorífico Vale Verde", contact: "Carlos Mendes", phone: "(11) 99801-2233", email: "vendas@valeverde.com.br", category: "Carnes", notes: "Entrega às terças e quintas. Paga em 30 dias.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "sup-002", restaurantId: "rest-1", name: "Distribuidora Grão Fino", contact: "Ana Paula", phone: "(11) 3344-5566", email: "ana@graofino.com.br", category: "Grãos", notes: "Mínimo R$ 500 por pedido. Entrega em 48h.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "sup-003", restaurantId: "rest-1", name: "Bebidas Neves Ltda", contact: "João Neves", phone: "(11) 97654-3210", email: "joao@bevidaneves.com.br", category: "Bebidas", notes: "Frete grátis acima de R$ 300.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export function createSupplier(data: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Supplier {
  const item: Supplier = { id: randomUUID(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  suppliers.push(item);
  scheduleSave("suppliers", suppliers);
  return item;
}

export function updateSupplier(id: string, updates: Partial<Supplier>): Supplier | null {
  const idx = suppliers.findIndex(s => s.id === id);
  if (idx === -1) return null;
  suppliers[idx] = { ...suppliers[idx], ...updates, updatedAt: new Date().toISOString() };
  scheduleSave("suppliers", suppliers);
  return suppliers[idx];
}

export function deleteSupplier(id: string): boolean {
  const idx = suppliers.findIndex(s => s.id === id);
  if (idx === -1) return false;
  suppliers.splice(idx, 1);
  scheduleSave("suppliers", suppliers);
  return true;
}

// ─── Listas de Compras (Miar Ária) ────────────────────────────────────────────

export interface PurchaseListItem {
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  precoEstimado: number;
  fornecedorSugerido: string;
  prioridade: "alta" | "media" | "baixa";
  // ── Conferência de recebimento (adicionado 29/07/2026) ──────────────────
  // stockItemId: vínculo com o item de estoque real, pra saber onde somar
  // a quantidade recebida. Fica null até alguém confirmar o vínculo (ou
  // o sistema achar por nome igual na hora de gerar a lista).
  stockItemId?: string | null;
  quantidadeRecebida?: number | null; // null = ainda não conferido
}

export interface PurchaseList {
  id: string;
  restaurantId: string;
  // Multi-loja (15/08/2026): só preenchido quando settings.comprasPorLoja
  // === true. Mesmo critério de "sem lojaId" já usado em menu-items e
  // stock — lista sem lojaId é compartilhada/vista por qualquer loja.
  lojaId?: string;
  titulo: string;
  resumo: string;
  itens: PurchaseListItem[];
  totalEstimado: number;
  observacoes: string;
  userRequest: string;
  createdAt: string;
  // ── Conferência de recebimento ───────────────────────────────────────────
  // "aguardando" = nota lançada, ninguém conferiu ainda o que chegou
  // "parcial"    = algum item recebido em quantidade diferente do esperado
  // "completo"   = todos os itens conferidos batendo com o esperado
  recebimentoStatus: "aguardando" | "parcial" | "completo";
  recebidoEm?: string | null;
}

export let purchaseLists: PurchaseList[] = [];

export function createPurchaseList(data: Omit<PurchaseList, "id" | "createdAt" | "recebimentoStatus" | "recebidoEm">): PurchaseList {
  const item: PurchaseList = {
    id: randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
    recebimentoStatus: "aguardando",
    recebidoEm: null,
  };
  purchaseLists.unshift(item);
  if (purchaseLists.length > 50) purchaseLists.splice(50);
  scheduleSave("purchaseLists", purchaseLists);
  return item;
}

export function registrarRecebimento(
  listId: string,
  companyId: string,
  recebidos: { indice: number; quantidadeRecebida: number }[],
): PurchaseList | null {
  const list = purchaseLists.find(l => l.id === listId && l.restaurantId === companyId);
  if (!list) return null;

  let algumaDivergencia = false;
  let todosConferidos = true;

  for (const r of recebidos) {
    const item = list.itens[r.indice];
    if (!item) continue;
    const quantidadeAnterior = item.quantidadeRecebida ?? 0;
    const deltaRecebido = r.quantidadeRecebida - quantidadeAnterior;
    item.quantidadeRecebida = r.quantidadeRecebida;

    // Só mexe no estoque pelo delta da conferência. Repetir a mesma conferência
    // não pode somar a mercadoria duas vezes; corrigir uma quantidade também
    // precisa refletir somente a diferença em relação ao valor anterior.
    if (item.stockItemId && deltaRecebido !== 0) {
      const stockItem = stockItems.find(s => s.id === item.stockItemId && s.restaurantId === companyId);
      if (stockItem) {
        updateStockItem(stockItem.id, {
          quantity: Math.max(0, stockItem.quantity + deltaRecebido),
          lastCountedAt: new Date().toISOString(),
        });
      }
    }
  }

  for (const item of list.itens) {
    if (item.quantidadeRecebida == null) { todosConferidos = false; continue; }
    if (item.quantidadeRecebida !== item.quantidade) algumaDivergencia = true;
  }

  list.recebimentoStatus = !todosConferidos
    ? (list.itens.some(i => i.quantidadeRecebida != null) ? "parcial" : "aguardando")
    : (algumaDivergencia ? "parcial" : "completo");
  list.recebidoEm = new Date().toISOString();

  scheduleSave("purchaseLists", purchaseLists);
  return list;
}

// ─── Employees ────────────────────────────────────────────────────────────────

export interface EmployeePermissions {
  viewKitchen: boolean;
  viewCashier: boolean;
  viewTables: boolean;
  viewStock: boolean;
  viewCameras: boolean;
  viewReports: boolean;
  viewEmployees: boolean;
  viewSettings: boolean;
  deleteOrders: boolean;
  deleteTables: boolean;
  editStock: boolean;
  deleteStock: boolean;
  closeCashier: boolean;
  manageEmployees: boolean;
  manageSettings: boolean;
  /** Chave adicionada em 29/07/2026: chat flutuante da MIAR nos apps de
   * funcionário (Caixa, Garçom, Equipe). Cozinha NÃO usa essa chave — lá a
   * MIAR é diferenciada (voz, "VIP") e sempre presente, não passa por permissão.
   * Default false — o gestor precisa liberar explicitamente por funcionário/cargo. */
  useMiaChat: boolean;
  useMiarEdita: boolean;
}

export type EmployeeRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'cook' | 'delivery' | 'custom';

export interface Employee {
  id: string;
  restaurantId: string;
  lojaId?: string;
  name: string;
  role: EmployeeRole;
  pin: string;       // 4-6 digits plain text (demo)
  qrToken: string;
  permissions: EmployeePermissions;
  active: boolean;
  phone?: string;
  createdAt: string;
  /** Portabilidade de reputação — autodeclarado pelo próprio entregador ao se
   * cadastrar, dizendo que já tem histórico em outro app de entrega. NÃO é
   * verificado pelo MIAR (não há integração real com plataformas externas),
   * por isso nunca deve ser somado ao penaltyStatus real do sistema — é só
   * contexto informativo pro gestor decidir se aprova o cadastro. */
  reputacaoExterna?: {
    plataforma: string;
    notaAutoDeclarada?: number;
    observacao?: string;
    autoDeclarado: true;
    declaradoEm: string;
  };
}

export interface PunchRecord {
  id: string;
  restaurantId: string;
  employeeId: string;
  employeeName: string;
  type: 'in' | 'out';
  timestamp: string;
}

export interface AuditLog {
  id: string;
  restaurantId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

const ALL_PERMS: EmployeePermissions = {
  viewKitchen: true, viewCashier: true, viewTables: true, viewStock: true,
  viewCameras: true, viewReports: true, viewEmployees: true, viewSettings: true,
  deleteOrders: true, deleteTables: true, editStock: true, deleteStock: true,
  closeCashier: true, manageEmployees: true, manageSettings: true, useMiaChat: true, useMiarEdita: true,
};

export const DEFAULT_PERMISSIONS: Record<EmployeeRole, EmployeePermissions> = {
  owner:   { ...ALL_PERMS },
  // Chat da MIAR fica FALSE por padrão pra todos que não são dono — o gestor
  // precisa acionar a chave manualmente por funcionário/cargo (29/07/2026).
  manager: { ...ALL_PERMS, manageSettings: false, useMiaChat: false },
  cashier: { viewKitchen: true, viewCashier: true, viewTables: true, viewStock: false, viewCameras: false, viewReports: false, viewEmployees: false, viewSettings: false, deleteOrders: false, deleteTables: false, editStock: false, deleteStock: false, closeCashier: true, manageEmployees: false, manageSettings: false, useMiaChat: false, useMiarEdita: false },
  waiter:  { viewKitchen: true, viewCashier: false, viewTables: true, viewStock: false, viewCameras: false, viewReports: false, viewEmployees: false, viewSettings: false, deleteOrders: false, deleteTables: false, editStock: false, deleteStock: false, closeCashier: false, manageEmployees: false, manageSettings: false, useMiaChat: false, useMiarEdita: false },
  cook:    { viewKitchen: true, viewCashier: false, viewTables: false, viewStock: true, viewCameras: false, viewReports: false, viewEmployees: false, viewSettings: false, deleteOrders: false, deleteTables: false, editStock: true, deleteStock: false, closeCashier: false, manageEmployees: false, manageSettings: false, useMiaChat: false, useMiarEdita: false },
  delivery:{ viewKitchen: false, viewCashier: false, viewTables: true, viewStock: false, viewCameras: false, viewReports: false, viewEmployees: false, viewSettings: false, deleteOrders: false, deleteTables: false, editStock: false, deleteStock: false, closeCashier: false, manageEmployees: false, manageSettings: false, useMiaChat: false, useMiarEdita: false },
  custom:  { viewKitchen: false, viewCashier: false, viewTables: false, viewStock: false, viewCameras: false, viewReports: false, viewEmployees: false, viewSettings: false, deleteOrders: false, deleteTables: false, editStock: false, deleteStock: false, closeCashier: false, manageEmployees: false, manageSettings: false, useMiaChat: false, useMiarEdita: false },
};

export let employees: Employee[] = [];

export let punchRecords: PunchRecord[] = [];
export let auditLogs: AuditLog[] = [];

// ─── Rentabilidade por prato (30/07/2026) ──────────────────────────────────
// Responde ao que já foi especificado antes: custo real do prato = custo
// dos ingredientes (via ficha técnica) + rateio proporcional do custo fixo
// mensal sobre o volume vendido no período. NUNCA inventa custo de
// ingrediente que não foi informado — fica marcado como "não informado".

export interface CostSettings {
  restaurantId: string;
  custoFixoMensal: number;       // aluguel + funcionários + água + luz + etc, tudo somado
  margemAlvoPercent: number;     // ex: 60 = quer pelo menos 60% de margem
  frequenciaRelatorio: "diario" | "semanal" | "quinzenal" | "mensal" | "desligado";
  updatedAt: string;
}

export let costSettings: CostSettings[] = [];

export function getCostSettings(restaurantId: string): CostSettings {
  const existing = costSettings.find((c) => c.restaurantId === restaurantId);
  if (existing) return existing;
  // Default seguro: sem custo fixo configurado ainda, sem alerta de margem.
  return {
    restaurantId,
    custoFixoMensal: 0,
    margemAlvoPercent: 0,
    frequenciaRelatorio: "desligado",
    updatedAt: new Date().toISOString(),
  };
}

export function setCostSettings(
  restaurantId: string,
  updates: Partial<Omit<CostSettings, "restaurantId" | "updatedAt">>
): CostSettings {
  const current = getCostSettings(restaurantId);
  const next: CostSettings = { ...current, ...updates, restaurantId, updatedAt: new Date().toISOString() };
  const idx = costSettings.findIndex((c) => c.restaurantId === restaurantId);
  if (idx === -1) costSettings.push(next);
  else costSettings[idx] = next;
  scheduleSave("costSettings", costSettings);
  return next;
}

export interface RentabilidadePrato {
  menuItemId: string;
  nome: string;
  precoVenda: number;
  custoIngredientes: number;
  ingredientesSemCusto: string[]; // nomes de insumos usados sem unitCost informado
  custoFixoRateado: number;
  custoTotal: number;
  lucroReais: number;
  margemPercent: number;
  quantidadeVendidaPeriodo: number;
  alertaMargemBaixa: boolean;
  precoMinimoParaMargemAlvo: number | null;
}

/**
 * Calcula a rentabilidade de cada prato com ficha técnica cadastrada, no
 * período [desde, até]. Pratos sem ficha técnica não entram (não tem como
 * saber o custo de ingrediente sem ela) — aparecem em `semFichaTecnica`.
 */
export function calcularRentabilidadePorPrato(
  restaurantId: string,
  desde: Date,
  ate: Date,
  lojaId?: string
): { pratos: RentabilidadePrato[]; semFichaTecnica: string[] } {
  const settings = getCostSettings(restaurantId);
  const itens = menuItems.filter((m) => m.restaurantId === restaurantId && (!lojaId || pertenceALoja(m.lojaId, lojaId, restaurantId)));
  const pedidosPeriodo = orders.filter(
    (o) => o.restaurantId === restaurantId && (!lojaId || pertenceALoja(o.lojaId, lojaId, restaurantId)) && new Date(o.createdAt) >= desde && new Date(o.createdAt) <= ate
  );

  // Quantidade vendida de cada prato no período (todos os itens do cardápio,
  // não só os com ficha técnica — usado pra ratear o custo fixo direito).
  const vendidoPorPrato = new Map<string, number>();
  let totalUnidadesVendidas = 0;
  for (const pedido of pedidosPeriodo) {
    for (const item of pedido.items) {
      vendidoPorPrato.set(item.menuItemId, (vendidoPorPrato.get(item.menuItemId) ?? 0) + item.quantity);
      totalUnidadesVendidas += item.quantity;
    }
  }

  const rateioFixoPorUnidade = totalUnidadesVendidas > 0 ? settings.custoFixoMensal / totalUnidadesVendidas : 0;

  const pratos: RentabilidadePrato[] = [];
  const semFichaTecnica: string[] = [];

  for (const item of itens) {
    if (!item.fichaTecnica?.length) {
      semFichaTecnica.push(item.name);
      continue;
    }

    let custoIngredientes = 0;
    const ingredientesSemCusto: string[] = [];
    for (const ing of item.fichaTecnica) {
      const stockItem = stockItems.find((s) => s.id === ing.stockItemId && s.restaurantId === restaurantId);
      if (!stockItem) continue;
      if (typeof stockItem.unitCost !== "number") {
        ingredientesSemCusto.push(stockItem.name);
        continue;
      }
      custoIngredientes += stockItem.unitCost * ing.quantidadePorUnidade;
    }

    const quantidadeVendidaPeriodo = vendidoPorPrato.get(item.id) ?? 0;
    const custoFixoRateado = rateioFixoPorUnidade;
    const custoTotal = custoIngredientes + custoFixoRateado;
    const lucroReais = item.price - custoTotal;
    const margemPercent = item.price > 0 ? (lucroReais / item.price) * 100 : 0;
    const alertaMargemBaixa = settings.margemAlvoPercent > 0 && margemPercent < settings.margemAlvoPercent;
    const precoMinimoParaMargemAlvo =
      settings.margemAlvoPercent > 0 && settings.margemAlvoPercent < 100
        ? custoTotal / (1 - settings.margemAlvoPercent / 100)
        : null;

    pratos.push({
      menuItemId: item.id,
      nome: item.name,
      precoVenda: item.price,
      custoIngredientes,
      ingredientesSemCusto,
      custoFixoRateado,
      custoTotal,
      lucroReais,
      margemPercent,
      quantidadeVendidaPeriodo,
      alertaMargemBaixa,
      precoMinimoParaMargemAlvo,
    });
  }

  return { pratos, semFichaTecnica };
}

// CORRIGIDO 30/07/2026: PIN agora comparado via bcrypt.compare, nunca em texto puro.
export async function verifyEmployeePin(employeeId: string, pin: string): Promise<Employee | null> {
  const emp = employees.find(e => e.id === employeeId && e.active);
  if (!emp) return null;
  const bate = await bcrypt.compare(pin, emp.pin);
  return bate ? emp : null;
}

export function recordPunch(qrToken: string): { record: PunchRecord; employee: Employee } | null {
  const emp = employees.find(e => e.qrToken === qrToken && e.active);
  if (!emp) return null;
  const lastPunch = [...punchRecords].reverse().find(p => p.employeeId === emp.id);
  const type: 'in' | 'out' = (!lastPunch || lastPunch.type === 'out') ? 'in' : 'out';
  const record: PunchRecord = {
    id: randomUUID(), restaurantId: "rest-1",
    employeeId: emp.id, employeeName: emp.name,
    type, timestamp: new Date().toISOString(),
  };
  punchRecords.push(record);
  scheduleSave("punchRecords", punchRecords);
  return { record, employee: emp };
}

// ─── Marketing Campaigns ──────────────────────────────────────────────────────

export interface MarketingCampaign {
  id: string;
  restaurantId: string;
  title: string;
  targetSegment: string;          // instagram | whatsapp | google | tiktok | geral
  headline: string;               // Título principal do criativo
  copy: string;                   // Texto completo da campanha
  hashtags: string[];             // Sugestão de hashtags
  callToAction: string;           // Ex: "Peça agora pelo link!"
  imageSuggestion: string;        // Descrição da imagem ideal
  tone: string;                   // descontraído | premium | urgente | emocional
  generatedAt: string;
  sourceImages: number;           // Quantas fotos foram analisadas (sem salvar o conteúdo)
}

export let marketingCampaigns: MarketingCampaign[] = [];

export function createMarketingCampaign(data: Omit<MarketingCampaign, "id" | "generatedAt">): MarketingCampaign {
  const campaign: MarketingCampaign = {
    ...data,
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
  };
  marketingCampaigns.push(campaign);
  scheduleSave("marketingCampaigns", marketingCampaigns);
  return campaign;
}

export function deleteMarketingCampaign(id: string): boolean {
  const idx = marketingCampaigns.findIndex(c => c.id === id);
  if (idx === -1) return false;
  marketingCampaigns.splice(idx, 1);
  scheduleSave("marketingCampaigns", marketingCampaigns);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE INTELIGENCIA DE DEMANDA
// Toda busca do cliente vira um sinal — encontrou ou nao. Registra sempre,
// prioriza por volume. E o coracao do produto: medir o DESEJO, nao so a venda.
// ─────────────────────────────────────────────────────────────────────────────
export type EstadoDemanda =
  | "encontrada"        // buscou e a cidade tem
  | "nao_encontrada"    // buscou e a cidade NAO tem (demanda reprimida)
  | "rejeicao"          // encontrou compativel e passou reto
  | "conversao";        // buscou, achou e pediu

export interface SinalDemanda {
  id: string;
  termo: string;              // o que a pessoa procurou, cru
  termoNormalizado: string;   // minusculo/sem acento pra agrupar
  estado: EstadoDemanda;
  regiao: string;             // cidade/regiao
  origem: "morador" | "visitante";
  resultados: number;         // quantos estabelecimentos casaram
  criadoEm: string;           // ISO
}

export let sinaisDemanda: SinalDemanda[] = [];

function normalizarTermo(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function registrarSinalDemanda(data: {
  termo: string;
  estado: EstadoDemanda;
  regiao?: string;
  origem?: "morador" | "visitante";
  resultados?: number;
}): SinalDemanda {
  const sinal: SinalDemanda = {
    id: randomUUID(),
    termo: data.termo.trim(),
    termoNormalizado: normalizarTermo(data.termo),
    estado: data.estado,
    regiao: (data.regiao ?? "Ponta Pora").trim(),
    origem: data.origem ?? "morador",
    resultados: data.resultados ?? 0,
    criadoEm: new Date().toISOString(),
  };
  sinaisDemanda.push(sinal);
  scheduleSave("sinaisDemanda", sinaisDemanda);
  return sinal;
}

// Agrega os sinais num periodo: agrupa por termo, separa reprimida de rejeicao,
// e da o nivel de prioridade por volume (1 / 10 / 100).
export function agregarDemanda(diasAtras = 30): Array<{
  termo: string;
  regiao: string;
  total: number;
  naoEncontrada: number;
  rejeicao: number;
  encontrada: number;
  visitantes: number;
  nivel: "identificada" | "recorrente" | "forte";
}> {
  const limite = Date.now() - diasAtras * 86400000;
  const grupos = new Map<string, any>();
  for (const s of sinaisDemanda) {
    if (new Date(s.criadoEm).getTime() < limite) continue;
    const chave = `${s.termoNormalizado}|${s.regiao.toLowerCase()}`;
    const g = grupos.get(chave) ?? {
      termo: s.termo, regiao: s.regiao, total: 0,
      naoEncontrada: 0, rejeicao: 0, encontrada: 0, visitantes: 0,
    };
    g.total += 1;
    if (s.estado === "nao_encontrada") g.naoEncontrada += 1;
    else if (s.estado === "rejeicao") g.rejeicao += 1;
    else g.encontrada += 1;
    if (s.origem === "visitante") g.visitantes += 1;
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      nivel: g.total >= 100 ? "forte" : g.total >= 10 ? "recorrente" : "identificada",
    }))
    .sort((a, b) => b.naoEncontrada - a.naoEncontrada || b.total - a.total);
}


export function createId(): string {
  return randomUUID();
}

// ─── Bulk save (called by post-request middleware) ────────────────────────────

export async function saveAllStoreData(): Promise<void> {
  scheduleSave("restaurants", restaurants);
  scheduleSave("menuItems", menuItems);
  scheduleSave("tables", tables);
  scheduleSave("preOrders", preOrders);
  scheduleSave("orders", orders);
  scheduleSave("settingsByCompany", Array.from(settingsByCompany.entries()));
  scheduleSave("feedbacks", feedbacks);
  scheduleSave("cashierSessions", cashierSessions);
  scheduleSave("financialMovements", financialMovements);
  scheduleSave("tableSessions", tableSessions);
  scheduleSave("cashierAlerts", cashierAlerts);
  scheduleSave("fiadoRecords", fiadoRecords);
  scheduleSave("stockItems", stockItems);
  scheduleSave("employees", employees);
  scheduleSave("deliveryObservations", deliveryObservations);
  scheduleSave("deliveryGovernanceIncidents", deliveryGovernanceIncidents);
  scheduleSave("deliveryGovernanceProfiles", deliveryGovernanceProfiles);
  scheduleSave("punchRecords", punchRecords);
  scheduleSave("auditLogs", auditLogs);
  scheduleSave("restaurantSharedChat", restaurantSharedChat);
  scheduleSave("nutriChats", Array.from(nutriChats.entries()));
  scheduleSave("nutriProfiles", Array.from(nutriProfiles.entries()));
  scheduleSave("marketingCampaigns", marketingCampaigns);
  scheduleSave("suppliers", suppliers);
  scheduleSave("purchaseLists", purchaseLists);
}

// ─── Load all store data from DB on startup ───────────────────────────────────

export async function loadStoreData(): Promise<void> {
  try {
    const [
      restoredRestaurants,
      restoredMenuItems,
      restoredTables,
      restoredPreOrders,
      restoredOrders,
      restoredSettingsByCompany,
      restoredFeedbacks,
      restoredCashierSessions,
      restoredFinancialMovements,
      restoredTableSessions,
      restoredFiadoRecords,
      restoredCashierAlerts,
      restoredStockItems,
      restoredEmployees,
      restoredDeliveryObservations,
      restoredDeliveryGovernanceIncidents,
      restoredDeliveryGovernanceProfiles,
      restoredPunchRecords,
      restoredAuditLogs,
      restoredSharedChat,
      restoredMarketingCampaigns,
      restoredSinaisDemanda,
      restoredSuppliers,
      restoredPurchaseLists,
      restoredRecados,
      restoredLoyaltyRecords,
      restoredAtalhos,
      restoredVagas,
      restoredVagaInteresses,
      restoredFeedPosts,
      restoredEstabelecimentoConfigs,
      restoredPerfisArtista,
      restoredEventosArtista,
      restoredConsumosArtista,
      restoredLojas,
    ] = await Promise.all([
      loadSnapshot<Restaurant[]>("restaurants"),
      loadSnapshot<MenuItem[]>("menuItems"),
      loadSnapshot<Table[]>("tables"),
      loadSnapshot<PreOrder[]>("preOrders"),
      loadSnapshot<Order[]>("orders"),
      loadSnapshot<Array<[string, RestaurantSettings]>>("settingsByCompany"),
      loadSnapshot<Feedback[]>("feedbacks"),
      loadSnapshot<CashierSession[]>("cashierSessions"),
      loadSnapshot<FinancialMovement[]>("financialMovements"),
      loadSnapshot<TableSession[]>("tableSessions"),
      loadSnapshot<FiadoRecord[]>("fiadoRecords"),
      loadSnapshot<CashierAlert[]>("cashierAlerts"),
      loadSnapshot<StockItem[]>("stockItems"),
      loadSnapshot<Employee[]>("employees"),
      loadSnapshot<DeliveryObservation[]>("deliveryObservations"),
      loadSnapshot<DeliveryGovernanceIncident[]>("deliveryGovernanceIncidents"),
      loadSnapshot<DeliveryGovernanceProfile[]>("deliveryGovernanceProfiles"),
      loadSnapshot<PunchRecord[]>("punchRecords"),
      loadSnapshot<AuditLog[]>("auditLogs"),
      loadSnapshot<ChatMessage[]>("restaurantSharedChat"),
      loadSnapshot<MarketingCampaign[]>("marketingCampaigns"),
      loadSnapshot<SinalDemanda[]>("sinaisDemanda"),
      loadSnapshot<Supplier[]>("suppliers"),
      loadSnapshot<PurchaseList[]>("purchaseLists"),
      loadSnapshot<Recado[]>("recados"),
      loadSnapshot<LoyaltyRecord[]>("loyaltyRecords"),
      loadSnapshot<Atalho[]>("atalhos"),
      loadSnapshot<Vaga[]>("vagas"),
      loadSnapshot<VagaInteresse[]>("vaga-interesses"),
      loadSnapshot<FeedPost[]>("feedPosts"),
      loadSnapshot<Array<[string, EstabelecimentoConfig]>>("estabelecimentoConfigs"),
      loadSnapshot<Array<[string, PerfilArtista]>>("perfis-artista"),
      loadSnapshot<EventoArtista[]>("eventos-artista"),
      loadSnapshot<ConsumoArtista[]>("consumos-artista"),
      loadSnapshot<Loja[]>("lojas"),
    ]);

    if (restoredRestaurants) restaurants.splice(0, restaurants.length, ...restoredRestaurants);
    if (restoredMenuItems) menuItems.splice(0, menuItems.length, ...restoredMenuItems);
    if (restoredTables) tables.splice(0, tables.length, ...restoredTables);
    if (restoredPreOrders) preOrders.splice(0, preOrders.length, ...restoredPreOrders);
    if (restoredOrders) orders.splice(0, orders.length, ...restoredOrders);
    if (restoredSettingsByCompany) {
      settingsByCompany.clear();
      for (const [k, v] of restoredSettingsByCompany) settingsByCompany.set(k, v);
    }
    if (restoredFeedbacks) feedbacks.splice(0, feedbacks.length, ...restoredFeedbacks);
    if (restoredCashierSessions) cashierSessions.splice(0, cashierSessions.length, ...restoredCashierSessions);
    if (restoredFinancialMovements) financialMovements.splice(0, financialMovements.length, ...restoredFinancialMovements);
    if (restoredTableSessions) tableSessions.splice(0, tableSessions.length, ...restoredTableSessions);
    if (restoredFiadoRecords) fiadoRecords.splice(0, fiadoRecords.length, ...restoredFiadoRecords);
    if (restoredCashierAlerts) cashierAlerts.splice(0, cashierAlerts.length, ...restoredCashierAlerts);
    if (restoredStockItems) stockItems.splice(0, stockItems.length, ...restoredStockItems);
    if (restoredEmployees) employees.splice(0, employees.length, ...restoredEmployees);
    if (restoredDeliveryObservations) deliveryObservations.splice(0, deliveryObservations.length, ...restoredDeliveryObservations);
    if (restoredDeliveryGovernanceIncidents) deliveryGovernanceIncidents.splice(0, deliveryGovernanceIncidents.length, ...restoredDeliveryGovernanceIncidents);
    if (restoredDeliveryGovernanceProfiles) deliveryGovernanceProfiles.splice(0, deliveryGovernanceProfiles.length, ...restoredDeliveryGovernanceProfiles);
    if (restoredPunchRecords) punchRecords.splice(0, punchRecords.length, ...restoredPunchRecords);
    if (restoredAuditLogs) auditLogs.splice(0, auditLogs.length, ...restoredAuditLogs);
    if (restoredSharedChat) setRestaurantSharedChat(restoredSharedChat);
    if (restoredMarketingCampaigns) marketingCampaigns.splice(0, marketingCampaigns.length, ...restoredMarketingCampaigns);
    if (restoredSinaisDemanda) sinaisDemanda.splice(0, sinaisDemanda.length, ...restoredSinaisDemanda);
    if (restoredSuppliers) suppliers.splice(0, suppliers.length, ...restoredSuppliers);
    if (restoredPurchaseLists) purchaseLists.splice(0, purchaseLists.length, ...restoredPurchaseLists);
    if (restoredRecados) recados.splice(0, recados.length, ...restoredRecados);
    if (restoredLoyaltyRecords) loyaltyRecords.splice(0, loyaltyRecords.length, ...restoredLoyaltyRecords);
    if (restoredAtalhos) atalhos.splice(0, atalhos.length, ...restoredAtalhos);
    if (restoredVagas) vagas.splice(0, vagas.length, ...restoredVagas);
    if (restoredVagaInteresses) vagaInteresses.splice(0, vagaInteresses.length, ...restoredVagaInteresses);
    if (restoredFeedPosts) feedPosts.splice(0, feedPosts.length, ...restoredFeedPosts);
    if (restoredEstabelecimentoConfigs) {
      estabelecimentoConfigs.clear();
      for (const [k, v] of restoredEstabelecimentoConfigs) estabelecimentoConfigs.set(k, v);
    }
    if (restoredPerfisArtista) {
      perfisArtista.clear();
      for (const [k, v] of restoredPerfisArtista) perfisArtista.set(k, v);
    }
    if (restoredEventosArtista) eventosArtista.splice(0, eventosArtista.length, ...restoredEventosArtista);
    if (restoredConsumosArtista) consumosArtista.splice(0, consumosArtista.length, ...restoredConsumosArtista);
    if (restoredLojas) lojas.splice(0, lojas.length, ...restoredLojas);

    console.log("[persistence] store data loaded from DB");
  } catch (err) {
    console.error("[persistence] failed to load store data:", err);
  }
}

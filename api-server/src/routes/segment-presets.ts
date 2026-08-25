import { Router, type IRouter } from "express";
import { menuItems, stockItems, createStockItem, createMenuItem, getSettings, resolverLojaId } from "../lib/data-store";
import { logger } from "../lib/logger";
import { requireOwnerAuth } from "./auth.js";

const router: IRouter = Router();

// ─── Segment Presets — dados pré-configurados por nicho ──────────────────────
// Quando um cliente faz onboarding, escolhe o segmento e o sistema injeta
// cardápio, estoque e fluxos pré-configurados para aquele nicho.

export interface SegmentPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  menus: Array<{
    name: string;
    category: string;
    price: number;
    description: string;
    prepTime: number;        // minutos
    available: boolean;
  }>;
  stock: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
    minQuantity: number;
    alertDaysBefore: number;
  }>;
  workflows: string[];       // dicas operacionais para o segmento
}

const SEGMENT_PRESETS: SegmentPreset[] = [
  // ── Churrascaria ─────────────────────────────────────────────────────────
  {
    id: "churrascaria",
    name: "Churrascaria",
    description: "Rodízio e cortes bovinos, suínos e frango. Foco em volume e velocidade no buffet.",
    icon: "🔥",
    menus: [
      { name: "Rodízio Completo", category: "Pratos Principais", price: 79.90, description: "Picanha, costela, linguiça, frango e acompanhamentos", prepTime: 5, available: true },
      { name: "Rodízio Executivo", category: "Pratos Principais", price: 54.90, description: "Frango, linguiça, maminha e acompanhamentos", prepTime: 5, available: true },
      { name: "Picanha na Brasa", category: "Cortes Especiais", price: 89.90, description: "250g de picanha premium ao ponto do cliente", prepTime: 20, available: true },
      { name: "Costela Bovina", category: "Cortes Especiais", price: 74.90, description: "Costela assada por 12h na brasa", prepTime: 10, available: true },
      { name: "Caipirinha Artesanal", category: "Bebidas", price: 18.90, description: "Cachaça premium com limão siciliano", prepTime: 3, available: true },
      { name: "Caipirinha de Morango", category: "Bebidas", price: 21.90, description: "Com morango fresco e cachaça envelhecida", prepTime: 3, available: true },
      { name: "Farofa da Casa", category: "Acompanhamentos", price: 14.90, description: "Farofa de bacon com manteiga", prepTime: 2, available: true },
      { name: "Vinagrete", category: "Acompanhamentos", price: 9.90, description: "Tomate, cebola e pimentão", prepTime: 1, available: true },
    ],
    stock: [
      { name: "Picanha", category: "Carnes", quantity: 30, unit: "kg", minQuantity: 8, alertDaysBefore: 2 },
      { name: "Costela Bovina", category: "Carnes", quantity: 20, unit: "kg", minQuantity: 5, alertDaysBefore: 2 },
      { name: "Frango Inteiro", category: "Carnes", quantity: 15, unit: "un", minQuantity: 5, alertDaysBefore: 2 },
      { name: "Linguiça Defumada", category: "Carnes", quantity: 10, unit: "kg", minQuantity: 3, alertDaysBefore: 2 },
      { name: "Maminha", category: "Carnes", quantity: 12, unit: "kg", minQuantity: 4, alertDaysBefore: 2 },
      { name: "Carvão Vegetal", category: "Insumos", quantity: 10, unit: "sacos", minQuantity: 3, alertDaysBefore: 7 },
      { name: "Sal Grosso", category: "Temperos", quantity: 15, unit: "kg", minQuantity: 4, alertDaysBefore: 30 },
      { name: "Cachaça Premium", category: "Bebidas", quantity: 8, unit: "garrafas", minQuantity: 2, alertDaysBefore: 60 },
      { name: "Farinha de Mandioca", category: "Grãos", quantity: 5, unit: "sacos", minQuantity: 2, alertDaysBefore: 30 },
      { name: "Bacon Fatiado", category: "Carnes", quantity: 3, unit: "kg", minQuantity: 1, alertDaysBefore: 3 },
    ],
    workflows: [
      "Acender as brasas 45min antes da abertura",
      "Conferir temperatura da chapa: 280°C para selagem",
      "Rodízio: manter 3 espetos circulando por garçom",
      "Abastecimento do buffet: checar a cada 15min",
      "Cortes especiais: comunicar cozinha com 20min de antecedência",
    ],
  },

  // ── Pizzaria ──────────────────────────────────────────────────────────────
  {
    id: "pizzaria",
    name: "Pizzaria",
    description: "Pizzas artesanais, massas frescas e calzones. Foco em delivery e salão familiar.",
    icon: "🍕",
    menus: [
      { name: "Margherita", category: "Pizzas Clássicas", price: 42.90, description: "Molho de tomate, mozzarella e manjericão fresco", prepTime: 18, available: true },
      { name: "Calabresa", category: "Pizzas Clássicas", price: 46.90, description: "Calabresa fatiada, cebola e azeitona", prepTime: 18, available: true },
      { name: "Quatro Queijos", category: "Pizzas Especiais", price: 54.90, description: "Mozzarella, gorgonzola, parmesão e provolone", prepTime: 20, available: true },
      { name: "Frango com Catupiry", category: "Pizzas Especiais", price: 51.90, description: "Frango desfiado, catupiry e milho verde", prepTime: 20, available: true },
      { name: "Pizza Doce de Nutella", category: "Sobremesas", price: 38.90, description: "Nutella, morango e leite condensado", prepTime: 15, available: true },
      { name: "Calzone de Presunto", category: "Calzones", price: 36.90, description: "Presunto, mozzarella e molho por fora", prepTime: 20, available: true },
      { name: "Refrigerante 2L", category: "Bebidas", price: 14.90, description: "Coca-Cola, Guaraná ou Fanta", prepTime: 1, available: true },
      { name: "Suco de Laranja", category: "Bebidas", price: 12.90, description: "Laranja natural 500ml", prepTime: 5, available: true },
    ],
    stock: [
      { name: "Farinha de Trigo", category: "Grãos", quantity: 8, unit: "sacos", minQuantity: 2, alertDaysBefore: 7 },
      { name: "Mozzarella", category: "Laticínios", quantity: 10, unit: "kg", minQuantity: 3, alertDaysBefore: 3 },
      { name: "Molho de Tomate", category: "Molhos", quantity: 20, unit: "latas", minQuantity: 5, alertDaysBefore: 30 },
      { name: "Calabresa", category: "Carnes", quantity: 5, unit: "kg", minQuantity: 2, alertDaysBefore: 4 },
      { name: "Frango Desfiado", category: "Carnes", quantity: 4, unit: "kg", minQuantity: 1, alertDaysBefore: 2 },
      { name: "Catupiry", category: "Laticínios", quantity: 6, unit: "un", minQuantity: 2, alertDaysBefore: 5 },
      { name: "Gorgonzola", category: "Laticínios", quantity: 2, unit: "kg", minQuantity: 0.5, alertDaysBefore: 4 },
      { name: "Levedura", category: "Insumos", quantity: 20, unit: "pacotes", minQuantity: 5, alertDaysBefore: 10 },
      { name: "Azeite", category: "Temperos", quantity: 6, unit: "garrafas", minQuantity: 2, alertDaysBefore: 60 },
      { name: "Caixa para Pizza G", category: "Descartáveis", quantity: 200, unit: "un", minQuantity: 50, alertDaysBefore: 30 },
    ],
    workflows: [
      "Pré-aquecer o forno a 350°C por 30min antes da abertura",
      "Preparar massa às 15h para uso noturno (fermentação 4h)",
      "Montar estação de montagem: tomate, queijo, coberturas em ordem",
      "Delivery: tempo meta 35min da saída até entrega",
      "Verificar temperatura do forno a cada 2 pizzas",
    ],
  },

  // ── Bar com Show ──────────────────────────────────────────────────────────
  {
    id: "bar-com-show",
    name: "Bar com Show",
    description: "Petiscos, drinks e música ao vivo. Foco em bebidas, giro de mesas e entretenimento.",
    icon: "🎵",
    menus: [
      { name: "Porção de Fritas", category: "Petiscos", price: 24.90, description: "400g de batata frita crocante com maionese temperada", prepTime: 12, available: true },
      { name: "Bolinho de Bacalhau", category: "Petiscos", price: 32.90, description: "10 unidades crocantes com molho tártaro", prepTime: 15, available: true },
      { name: "Coxinha de Frango", category: "Petiscos", price: 28.90, description: "8 coxinhas artesanais", prepTime: 12, available: true },
      { name: "Tábua Fria", category: "Petiscos", price: 54.90, description: "Embutidos, queijos, torradas e geleias", prepTime: 8, available: true },
      { name: "Caipirinha de Limão", category: "Drinks", price: 19.90, description: "Cachaça premium, limão e açúcar demerara", prepTime: 3, available: true },
      { name: "Caipiroska de Morango", category: "Drinks", price: 22.90, description: "Vodka, morango fresco e limão", prepTime: 4, available: true },
      { name: "Long Island", category: "Drinks", price: 28.90, description: "Vodka, rum, gin, tequila, triple sec e Coca", prepTime: 5, available: true },
      { name: "Cerveja Artesanal 500ml", category: "Bebidas", price: 18.90, description: "IPA, Pale Ale ou Witbier", prepTime: 1, available: true },
    ],
    stock: [
      { name: "Cachaça Boa", category: "Bebidas", quantity: 12, unit: "garrafas", minQuantity: 3, alertDaysBefore: 30 },
      { name: "Vodka Premium", category: "Bebidas", quantity: 8, unit: "garrafas", minQuantity: 2, alertDaysBefore: 60 },
      { name: "Cerveja Artesanal IPA", category: "Bebidas", quantity: 48, unit: "garrafas", minQuantity: 12, alertDaysBefore: 30 },
      { name: "Limão Tahiti", category: "Frutas", quantity: 5, unit: "kg", minQuantity: 2, alertDaysBefore: 3 },
      { name: "Morango", category: "Frutas", quantity: 3, unit: "kg", minQuantity: 1, alertDaysBefore: 2 },
      { name: "Batata Palito", category: "Congelados", quantity: 10, unit: "pacotes", minQuantity: 3, alertDaysBefore: 30 },
      { name: "Bacalhau Dessalgado", category: "Pescados", quantity: 3, unit: "kg", minQuantity: 1, alertDaysBefore: 3 },
      { name: "Gelo em Cubo", category: "Insumos", quantity: 20, unit: "sacos", minQuantity: 8, alertDaysBefore: 1 },
      { name: "Coqueteleira", category: "Equipamentos", quantity: 4, unit: "un", minQuantity: 2, alertDaysBefore: 365 },
      { name: "Guardanapos", category: "Descartáveis", quantity: 30, unit: "pacotes", minQuantity: 8, alertDaysBefore: 30 },
    ],
    workflows: [
      "Mise en place do bar: preparar xaropes e pré-cortar limões às 17h",
      "Gelo: verificar estoque 1h antes do show",
      "Happy Hour: drinks com 30% de desconto das 17h às 20h",
      "Show ao vivo: fechar pedidos 30min antes para foco no entretenimento",
      "Última chamada: anunciar 45min antes do fechamento",
    ],
  },

  // ── Restaurante Japonês ───────────────────────────────────────────────────
  {
    id: "restaurante-japones",
    name: "Restaurante Japonês",
    description: "Sushis, sashimis, temakis e pratos quentes. Foco em qualidade do peixe e apresentação.",
    icon: "🍣",
    menus: [
      { name: "Combinado Especial 30 peças", category: "Combinados", price: 89.90, description: "Salmão, atum, camarão, pepino e cream cheese", prepTime: 20, available: true },
      { name: "Temaki de Salmão", category: "Temakis", price: 22.90, description: "Salmão fresco com cream cheese e cebolinha", prepTime: 8, available: true },
      { name: "Sashimi de Salmão (10 pçs)", category: "Sashimis", price: 44.90, description: "Fatias de salmão fresco premium", prepTime: 10, available: true },
      { name: "Gyoza (6 unidades)", category: "Entradas", price: 28.90, description: "Panquecas recheadas de carne e legumes", prepTime: 12, available: true },
      { name: "Hot Roll (8 pçs)", category: "Rolls Quentes", price: 36.90, description: "Empanado com salmão e cream cheese", prepTime: 15, available: true },
      { name: "Lámen Tonkotsu", category: "Pratos Quentes", price: 42.90, description: "Caldo de osso de porco, macarrão, ovo e chashu", prepTime: 15, available: true },
      { name: "Saquê Quente 180ml", category: "Bebidas", price: 16.90, description: "Saquê tradicional japonês aquecido", prepTime: 3, available: true },
      { name: "Chá Verde Gelado", category: "Bebidas", price: 8.90, description: "Matcha natural 300ml", prepTime: 2, available: true },
    ],
    stock: [
      { name: "Salmão Fresco", category: "Pescados", quantity: 8, unit: "kg", minQuantity: 2, alertDaysBefore: 1 },
      { name: "Atum Sashimi Grade", category: "Pescados", quantity: 4, unit: "kg", minQuantity: 1, alertDaysBefore: 1 },
      { name: "Camarão VG", category: "Pescados", quantity: 3, unit: "kg", minQuantity: 1, alertDaysBefore: 2 },
      { name: "Arroz Japonês Koshihikari", category: "Grãos", quantity: 5, unit: "sacos", minQuantity: 1, alertDaysBefore: 30 },
      { name: "Alga Nori", category: "Insumos", quantity: 10, unit: "pacotes", minQuantity: 3, alertDaysBefore: 60 },
      { name: "Cream Cheese", category: "Laticínios", quantity: 4, unit: "kg", minQuantity: 1, alertDaysBefore: 5 },
      { name: "Shoyu Premium", category: "Molhos", quantity: 6, unit: "garrafas", minQuantity: 2, alertDaysBefore: 90 },
      { name: "Wasabi", category: "Temperos", quantity: 2, unit: "kg", minQuantity: 0.5, alertDaysBefore: 30 },
      { name: "Gengibre em Conserva", category: "Temperos", quantity: 3, unit: "potes", minQuantity: 1, alertDaysBefore: 30 },
      { name: "Vinagre de Arroz", category: "Temperos", quantity: 4, unit: "garrafas", minQuantity: 1, alertDaysBefore: 180 },
    ],
    workflows: [
      "Recebimento de peixe: inspeção visual e de odor obrigatória",
      "Temperatura do salmão: manter entre 0°C e 4°C sempre",
      "Arroz de sushi: preparar 2h antes, temperatura 30°C para modelagem",
      "Comunicar esgotamento de peixe ao maître imediatamente",
      "Limpeza da bancada de sushi a cada 30min com álcool 70%",
    ],
  },

  // ── Hamburgueria ──────────────────────────────────────────────────────────
  {
    id: "hamburgueria",
    name: "Hamburgueria",
    description: "Smash burgers artesanais, batatas especiais e milkshakes. Foco em delivery e balcão.",
    icon: "🍔",
    menus: [
      { name: "Smash Clássico", category: "Burgers", price: 32.90, description: "180g blend especial, cheddar, alface, tomate e maionese", prepTime: 10, available: true },
      { name: "Smash Duplo", category: "Burgers", price: 44.90, description: "2x180g blend especial, cheddar duplo e molho especial", prepTime: 12, available: true },
      { name: "Burger Bacon Crispy", category: "Burgers", price: 46.90, description: "Blend 180g, bacon crocante, BBQ, cheddar e cebola caramelizada", prepTime: 13, available: true },
      { name: "Veggie Burger", category: "Burgers", price: 36.90, description: "Hambúrguer de grão-de-bico, rúcula e maionese de ervas", prepTime: 12, available: true },
      { name: "Batata Frita Salted", category: "Acompanhamentos", price: 18.90, description: "Batata corte palito com sal especial", prepTime: 8, available: true },
      { name: "Batata Smash", category: "Acompanhamentos", price: 22.90, description: "Batata amassada com alho manteiga e parmesão", prepTime: 10, available: true },
      { name: "Milkshake Chocolate", category: "Bebidas", price: 22.90, description: "Chocolate belga com sorvete de creme", prepTime: 5, available: true },
      { name: "Refrigerante Lata", category: "Bebidas", price: 7.90, description: "Coca-Cola, Pepsi, Guaraná ou Sprite", prepTime: 1, available: true },
    ],
    stock: [
      { name: "Blend de Hambúrguer 180g", category: "Carnes", quantity: 80, unit: "un", minQuantity: 20, alertDaysBefore: 2 },
      { name: "Pão Brioche", category: "Panificados", quantity: 80, unit: "un", minQuantity: 20, alertDaysBefore: 2 },
      { name: "Cheddar Fatiado", category: "Laticínios", quantity: 2, unit: "kg", minQuantity: 0.5, alertDaysBefore: 5 },
      { name: "Bacon Fatiado", category: "Carnes", quantity: 3, unit: "kg", minQuantity: 1, alertDaysBefore: 3 },
      { name: "Batata Palito Congelada", category: "Congelados", quantity: 15, unit: "pacotes", minQuantity: 4, alertDaysBefore: 30 },
      { name: "Alface Americana", category: "Hortifrúti", quantity: 5, unit: "pés", minQuantity: 2, alertDaysBefore: 2 },
      { name: "Tomate", category: "Hortifrúti", quantity: 4, unit: "kg", minQuantity: 1, alertDaysBefore: 3 },
      { name: "Maionese Temperada", category: "Molhos", quantity: 4, unit: "kg", minQuantity: 1, alertDaysBefore: 10 },
      { name: "Molho BBQ", category: "Molhos", quantity: 3, unit: "garrafas", minQuantity: 1, alertDaysBefore: 30 },
      { name: "Sorvete de Creme", category: "Congelados", quantity: 5, unit: "potes", minQuantity: 2, alertDaysBefore: 30 },
    ],
    workflows: [
      "Chapa: pré-aquecer a 250°C por 20min antes da abertura",
      "Blend: descongelar na geladeira (4°C) — nunca em temperatura ambiente",
      "Smash: prensar forte por 30s na chapa, virar apenas 1 vez",
      "Delivery: embalar com papel alumínio + caixa isolante para manter temperatura",
      "Fritas: fritura a 180°C por 4min — nunca reaproveitar óleo com mais de 8h",
    ],
  },

  // ── Drive-thru de Bebidas ────────────────────────────────────────────────
  {
    id: "drive-thru-bebidas",
    name: "Drive-thru de Bebidas",
    description: "Bebidas geladas, combos rápidos e retirada no carro.",
    icon: "🥤",
    menus: [
      { name: "Refrigerante Lata", category: "Bebidas Geladas", price: 7.90, description: "Coca-Cola, Guaraná ou Sprite bem gelado", prepTime: 1, available: true },
      { name: "Água Mineral", category: "Bebidas Geladas", price: 4.90, description: "Água mineral sem gás 500ml", prepTime: 1, available: true },
      { name: "Suco Natural", category: "Bebidas Geladas", price: 9.90, description: "Suco natural preparado na hora", prepTime: 3, available: true },
      { name: "Energético", category: "Bebidas Geladas", price: 12.90, description: "Energético  lata 473ml", prepTime: 1, available: true },
      { name: "Cerveja Long Neck", category: "Cervejas", price: 9.90, description: "Cerveja long neck servida gelada", prepTime: 1, available: true },
      { name: "Combo Cerveja", category: "Combos", price: 49.90, description: "Pack com 6 cervejas long neck", prepTime: 2, available: true },
      { name: "Combo Festa", category: "Combos", price: 89.90, description: "Cervejas, refrigerantes e gelo para compartilhar", prepTime: 5, available: true },
      { name: "Gelo", category: "Conveniência", price: 12.90, description: "Saco de gelo de 5kg", prepTime: 1, available: true },
    ],
    stock: [
      { name: "Refrigerante Lata", category: "Bebidas", quantity: 120, unit: "un", minQuantity: 30, alertDaysBefore: 30 },
      { name: "Água Mineral", category: "Bebidas", quantity: 100, unit: "un", minQuantity: 24, alertDaysBefore: 30 },
      { name: "Suco Natural", category: "Bebidas", quantity: 30, unit: "litros", minQuantity: 8, alertDaysBefore: 3 },
      { name: "Cerveja Long Neck", category: "Bebidas", quantity: 120, unit: "un", minQuantity: 36, alertDaysBefore: 30 },
      { name: "Energético", category: "Bebidas", quantity: 48, unit: "un", minQuantity: 12, alertDaysBefore: 30 },
      { name: "Gelo", category: "Insumos", quantity: 30, unit: "sacos", minQuantity: 8, alertDaysBefore: 1 },
      { name: "Carvão", category: "Conveniência", quantity: 20, unit: "sacos", minQuantity: 5, alertDaysBefore: 30 },
      { name: "Salgadinhos", category: "Conveniência", quantity: 40, unit: "pacotes", minQuantity: 10, alertDaysBefore: 30 },
    ],
    workflows: [
      "Abastecer as bebidas nas geladeiras 1h antes da abertura",
      "Conferir temperatura das geladeiras: manter entre 2°C e 5°C",
      "Separar pedidos por placa e conferir os itens antes da entrega",
      "Manter estoque de gelo reforçado nos horários de maior movimento",
      "Oferecer combos no atendimento para agilizar a retirada no carro",
    ],
  },
];

// ─── GET /segment-presets — lista todos os segmentos disponíveis ──────────────
router.get("/segment-presets", (_req, res) => {
  const list = SEGMENT_PRESETS.map(({ id, name, description, icon, workflows }) => ({
    id, name, description, icon, workflows,
    menuCount: SEGMENT_PRESETS.find(s => s.id === id)!.menus.length,
    stockCount: SEGMENT_PRESETS.find(s => s.id === id)!.stock.length,
  }));
  res.json(list);
});

// ─── POST /onboarding/apply-preset — injeta dados do segmento no restaurante ─
router.post("/onboarding/apply-preset", requireOwnerAuth, (req, res): void => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).owner.companyId;
  const { segmentId, replace = false } = req.body as {
    segmentId: string;
    replace?: boolean;
  };

  const preset = SEGMENT_PRESETS.find(s => s.id === segmentId);
  if (!preset) {
    res.status(404).json({ error: `Segmento '${segmentId}' não encontrado. Disponíveis: ${SEGMENT_PRESETS.map(s => s.id).join(", ")}` });
    return;
  }

  // Remover dados anteriores do restaurante se replace=true
  if (replace) {
    const miOld = menuItems.filter(m => m.restaurantId === restaurantId);
    miOld.forEach(m => {
      const idx = menuItems.indexOf(m);
      if (idx !== -1) menuItems.splice(idx, 1);
    });
    const siOld = stockItems.filter(s => s.restaurantId === restaurantId);
    siOld.forEach(s => {
      const idx = stockItems.indexOf(s);
      if (idx !== -1) stockItems.splice(idx, 1);
    });
  }

  // Multi-loja (15/08/2026): se a conta já estiver no modo cardápio-por-loja
  // quando o preset é aplicado, os pratos do preset entram vinculados à loja
  // ativa (do header x-loja-id) em vez de ficarem soltos/compartilhados —
  // mesmo critério do POST /menu-items manual, pra não ter dois
  // comportamentos diferentes pro mesmo dado.
  const settings = getSettings(restaurantId);
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(restaurantId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;

  // Injetar cardápio
  const createdMenus = preset.menus.map(m => createMenuItem({
    restaurantId,
    lojaId,
    name: m.name,
    description: m.description,
    price: m.price,
    category: m.category,
    available: m.available,
    prepTime: m.prepTime,
  }));

  // Injetar estoque
  const createdStock = preset.stock.map(s => createStockItem({
    restaurantId,
    name: s.name,
    category: s.category,
    quantity: s.quantity,
    unit: s.unit,
    minQuantity: s.minQuantity,
    alertDaysBefore: s.alertDaysBefore,
  }));

  logger.info({ segmentId, restaurantId, menus: createdMenus.length, stock: createdStock.length }, "Preset applied");

  res.json({
    success: true,
    segment: { id: preset.id, name: preset.name, icon: preset.icon },
    applied: {
      menus: createdMenus.length,
      stockItems: createdStock.length,
    },
    workflows: preset.workflows,
    message: `Preset '${preset.name}' aplicado com sucesso! ${createdMenus.length} itens de cardápio e ${createdStock.length} itens de estoque foram adicionados.`,
  });
});

export default router;

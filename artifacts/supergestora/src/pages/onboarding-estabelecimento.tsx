// artifacts/gestor/src/pages/onboarding-estabelecimento.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Save, Search, Check } from 'lucide-react';
import { SEGMENTOS, type Categoria, type Segmento } from '@/lib/segmentos';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

export { SEGMENTOS } from '@/lib/segmentos';
/*
  {
    id: 'pizzaria',
    nome: 'Pizzaria',
    descricao: 'Pizzas, calzones e massas',
    categorias: [
      {
        nome: 'Pizzas salgadas',
        itens: [
          'Mussarela',
          'Calabresa',
          'Portuguesa',
          'Frango com catupiry',
          'Quatro queijos',
          'Marguerita',
          'Bacon',
          'Toscana',
          'Vegetariana',
          'À moda da casa',
        ],
      },
      { nome: 'Pizzas doces', itens: ['Chocolate', 'Romeu e Julieta', 'Banana com canela', 'Prestígio'] },
      { nome: 'Calzones e massas', itens: ['Calzone de calabresa', 'Calzone de frango', 'Lasanha', 'Espaguete'] },
      { nome: 'Bordas e adicionais', itens: ['Borda de catupiry', 'Borda de cheddar', 'Adicional de queijo'] },
      BEBIDAS,
      SOBREMESAS,
    ],
  },
  {
    id: 'churrascaria',
    nome: 'Churrascaria',
    descricao: 'Rodízio, cortes e buffet',
    categorias: [
      {
        nome: 'Cortes bovinos',
        itens: ['Picanha', 'Maminha', 'Alcatra', 'Fraldinha', 'Costela', 'Contrafilé', 'Cupim'],
      },
      { nome: 'Suínos e aves', itens: ['Linguiça', 'Costelinha suína', 'Lombo', 'Coração de frango', 'Coxinha da asa', 'Frango com bacon'] },
      { nome: 'Acompanhamentos', itens: ['Arroz branco', 'Feijão tropeiro', 'Farofa', 'Vinagrete', 'Pão de alho', 'Mandioca frita', 'Polenta'] },
      { nome: 'Buffet e saladas', itens: ['Buffet de saladas', 'Buffet quente', 'Sushi no buffet'] },
      BEBIDAS,
      SOBREMESAS,
    ],
  },
  {
    id: 'restaurante',
    nome: 'Restaurante',
    descricao: 'À la carte, executivo e self-service',
    categorias: [
      { nome: 'Entradas', itens: ['Caldinho', 'Bolinho de bacalhau', 'Isca de peixe', 'Salada da casa'] },
      {
        nome: 'Pratos principais',
        itens: ['Prato executivo', 'Filé à parmegiana', 'Strogonoff de frango', 'Peixe grelhado', 'Feijoada', 'Parmegiana de frango', 'Prato do dia'],
      },
      { nome: 'Self-service', itens: ['Buffet por quilo', 'Marmita pequena', 'Marmita média', 'Marmita grande'] },
      { nome: 'Porções', itens: ['Batata frita', 'Frango a passarinho', 'Calabresa acebolada', 'Mandioca frita'] },
      BEBIDAS,
      SOBREMESAS,
    ],
  },
  {
    id: 'bar',
    nome: 'Bar',
    descricao: 'Petiscos, drinks e chopp',
    categorias: [
      {
        nome: 'Porções',
        itens: ['Batata frita', 'Frango a passarinho', 'Calabresa acebolada', 'Torresmo', 'Isca de tilápia', 'Mandioca com bacon', 'Tábua de frios'],
      },
      { nome: 'Drinks', itens: ['Caipirinha', 'Caipiroska', 'Gin tônica', 'Mojito', 'Whisky dose', 'Combo balde'] },
      { nome: 'Cervejas', itens: ['Chopp claro', 'Chopp escuro', 'Long neck', 'Garrafa 600ml', 'Lata'] },
      { nome: 'Lanches', itens: ['X-salada', 'Misto quente', 'Pastel'] },
      BEBIDAS,
    ],
  },
  {
    id: 'japones',
    nome: 'Japonês',
    descricao: 'Sushi, sashimi e pratos quentes',
    categorias: [
      { nome: 'Sushi e sashimi', itens: ['Sashimi salmão', 'Niguiri salmão', 'Hossomaki', 'Uramaki', 'Joe salmão', 'Combinado 20 peças', 'Combinado 40 peças'] },
      { nome: 'Temaki', itens: ['Temaki salmão', 'Temaki atum', 'Temaki skin', 'Temaki califórnia'] },
      { nome: 'Pratos quentes', itens: ['Yakisoba', 'Guioza', 'Tempurá', 'Harumaki', 'Missoshiru', 'Robata'] },
      { nome: 'Rodízio', itens: ['Rodízio completo', 'Rodízio infantil'] },
      BEBIDAS,
      SOBREMESAS,
    ],
  },
  {
    id: 'hamburgueria',
    nome: 'Hamburgueria',
    descricao: 'Smash, artesanal e combos',
    categorias: [
      { nome: 'Hambúrgueres', itens: ['Smash simples', 'Smash duplo', 'Cheddar bacon', 'Salada completo', 'Frango crispy', 'Vegetariano', 'Da casa'] },
      { nome: 'Acompanhamentos', itens: ['Batata frita', 'Batata rústica', 'Onion rings', 'Nuggets'] },
      { nome: 'Combos', itens: ['Combo individual', 'Combo casal', 'Combo família'] },
      { nome: 'Molhos', itens: ['Barbecue', 'Cheddar', 'Maionese da casa', 'Alho'] },
      BEBIDAS,
      SOBREMESAS,
    ],
  },
  {
    id: 'cafeteria',
    nome: 'Cafeteria',
    descricao: 'Cafés, doces e salgados',
    categorias: [
      { nome: 'Cafés', itens: ['Expresso', 'Expresso duplo', 'Cappuccino', 'Latte', 'Mocha', 'Café coado', 'Café gelado'] },
      { nome: 'Salgados', itens: ['Coxinha', 'Pão de queijo', 'Empada', 'Croissant', 'Misto quente'] },
      { nome: 'Doces', itens: ['Bolo fatia', 'Cookie', 'Torta doce', 'Brigadeiro'] },
      BEBIDAS,
    ],
  },
  {
    id: 'padaria',
    nome: 'Padaria',
    descricao: 'Panificação, frios e balcão',
    categorias: [
      { nome: 'Panificação', itens: ['Pão francês kg', 'Pão de forma', 'Baguete', 'Pão doce', 'Sonho', 'Bolo caseiro'] },
      { nome: 'Frios e laticínios', itens: ['Presunto kg', 'Mussarela kg', 'Requeijão', 'Manteiga'] },
      { nome: 'Lanches', itens: ['Misto quente', 'Bauru', 'Sanduíche natural'] },
      BEBIDAS,
    ],
  },
  {
    id: 'sorveteria',
    nome: 'Sorveteria e açaí',
    descricao: 'Sorvetes, açaí e milkshakes',
    categorias: [
      { nome: 'Açaí', itens: ['Açaí 300ml', 'Açaí 500ml', 'Açaí 700ml', 'Açaí no quilo'] },
      { nome: 'Sorvetes', itens: ['Casquinha', 'Copo 1 bola', 'Copo 2 bolas', 'Sundae', 'Sorvete por quilo'] },
      { nome: 'Complementos', itens: ['Granola', 'Leite condensado', 'Paçoca', 'Morango', 'Banana', 'Nutella'] },
      { nome: 'Milkshakes', itens: ['Milkshake chocolate', 'Milkshake morango', 'Milkshake ovomaltine'] },
      BEBIDAS,
    ],
  },
  {
    id: 'marmitaria',
    nome: 'Marmitaria',
    descricao: 'Marmitas, quentinhas e entrega',
    categorias: [
      { nome: 'Marmitas', itens: ['Marmita P', 'Marmita M', 'Marmita G', 'Marmita fitness', 'Marmita executiva'] },
      { nome: 'Proteínas', itens: ['Bife acebolado', 'Frango grelhado', 'Carne moída', 'Peixe', 'Linguiça'] },
      { nome: 'Guarnições', itens: ['Arroz', 'Feijão', 'Purê', 'Salada', 'Farofa', 'Macarrão'] },
      BEBIDAS,
    ],
  },
  {
    id: 'pastelaria',
    nome: 'Pastelaria',
    descricao: 'Pastéis, caldo de cana e feira',
    categorias: [
      { nome: 'Pastéis salgados', itens: ['Carne', 'Queijo', 'Pizza', 'Frango com catupiry', 'Palmito', 'Camarão'] },
      { nome: 'Pastéis doces', itens: ['Chocolate', 'Banana com canela', 'Romeu e Julieta'] },
      { nome: 'Bebidas da casa', itens: ['Caldo de cana', 'Garapa com limão'] },
      BEBIDAS,
    ],
  },
  {
    id: 'food-truck',
    nome: 'Food truck',
    descricao: 'Operação móvel e evento',
    categorias: [
      { nome: 'Cardápio', itens: ['Item 1 do cardápio', 'Item 2 do cardápio', 'Item 3 do cardápio', 'Combo'] },
      BEBIDAS,
    ],
  },
  {
    id: 'adega',
    nome: 'Adega e distribuidora',
    descricao: 'Bebidas, conveniência e entrega',
    categorias: [
      { nome: 'Cervejas', itens: ['Lata 350ml', 'Long neck', 'Garrafa 600ml', 'Fardo 12un'] },
      { nome: 'Destilados', itens: ['Vodka', 'Whisky', 'Gin', 'Cachaça', 'Rum'] },
      { nome: 'Vinhos', itens: ['Tinto seco', 'Branco suave', 'Espumante'] },
      { nome: 'Conveniência', itens: ['Gelo', 'Carvão', 'Salgadinho', 'Energético'] },
    ],
  },
  {
    id: 'drive-thru-bebidas',
    nome: 'Drive-thru de Bebidas',
    descricao: 'Bebidas geladas, combos rápidos e retirada no carro',
    categorias: [
      { nome: 'Bebidas geladas', itens: ['Refrigerante lata', 'Água sem gás', 'Água com gás', 'Suco natural', 'Chá gelado', 'Energético'] },
      { nome: 'Cervejas', itens: ['Long neck', 'Lata 350ml', 'Garrafa 600ml', 'Fardo 12un'] },
      { nome: 'Destilados', itens: ['Vodka', 'Whisky', 'Gin', 'Cachaça'] },
      { nome: 'Combos', itens: ['Combo cerveja', 'Combo refrigerante', 'Combo festa'] },
      { nome: 'Conveniência', itens: ['Gelo', 'Carvão', 'Salgadinho'] },
    ],
  },
  {
    id: 'outros',
    nome: 'Outros',
    descricao: 'Monte do zero, do seu jeito',
    categorias: [{ nome: 'Meu cardápio', itens: [] }],
  },
]; */

// ─────────────────────────────────────────────────────────────────────────────
// Recursos do estabelecimento, com valor em branco quando faz sentido
// ─────────────────────────────────────────────────────────────────────────────
type RecursoEstab = { id: string; nome: string; valorLabel?: string; unidade?: string };
type GrupoEstab = { grupo: string; recursos: RecursoEstab[] };

export const RECURSOS_ESTAB: GrupoEstab[] = [
  {
    grupo: 'Como você atende',
    recursos: [
      { id: 'mesas', nome: 'Mesas no salão', valorLabel: 'Quantidade', unidade: 'mesas' },
      { id: 'balcao', nome: 'Balcão' },
      { id: 'retirada', nome: 'Retirada no local' },
      { id: 'delivery', nome: 'Entrega própria', valorLabel: 'Taxa', unidade: 'R$' },
      { id: 'delivery-minimo', nome: 'Pedido mínimo para entrega', valorLabel: 'Valor', unidade: 'R$' },
      { id: 'drive', nome: 'Drive-thru' },
      { id: 'reserva', nome: 'Reserva antecipada' },
      { id: 'cardapio-qr', nome: 'Cardápio digital por QR' },
      { id: 'outros-atendimento', nome: 'Outros' },
    ],
  },
  {
    grupo: 'Modelo de venda',
    recursos: [
      { id: 'rodizio-completo', nome: 'Rodízio completo', valorLabel: 'Valor por pessoa', unidade: 'R$' },
      { id: 'rodizio-misto', nome: 'Rodízio misto (carnes + buffet)', valorLabel: 'Valor por pessoa', unidade: 'R$' },
      { id: 'rodizio-infantil', nome: 'Rodízio infantil', valorLabel: 'Valor por pessoa', unidade: 'R$' },
      { id: 'kg', nome: 'Self-service por quilo', valorLabel: 'Valor do quilo', unidade: 'R$' },
      { id: 'buffet-livre', nome: 'Buffet livre', valorLabel: 'Valor por pessoa', unidade: 'R$' },
      { id: 'prato-feito', nome: 'Prato feito (PF)', valorLabel: 'Valor', unidade: 'R$' },
      { id: 'couvert', nome: 'Couvert artístico', valorLabel: 'Valor', unidade: 'R$' },
      { id: 'taxa-servico', nome: 'Taxa de serviço', valorLabel: 'Percentual', unidade: '%' },
      { id: 'comanda', nome: 'Comanda individual' },
      { id: 'outros-modelo', nome: 'Outros' },
    ],
  },
  {
    grupo: 'Como você recebe',
    recursos: [
      { id: 'pix', nome: 'Pix' },
      { id: 'pagamento-app', nome: 'Pagamento pelo app' },
      { id: 'credito', nome: 'Cartão de crédito' },
      { id: 'debito', nome: 'Cartão de débito' },
      { id: 'dinheiro', nome: 'Dinheiro' },
      { id: 'vale', nome: 'Vale-refeição' },
      { id: 'fiado', nome: 'Conta do cliente' },
      { id: 'outros-pagamento', nome: 'Outros' },
    ],
  },
  {
    grupo: 'Documento fiscal',
    recursos: [
      { id: 'nfce', nome: 'NFC-e' },
      { id: 'sat', nome: 'SAT' },
      { id: 'recibo', nome: 'Somente recibo interno' },
      { id: 'outros-fiscal', nome: 'Outros' },
    ],
  },
];

type ItemMarcado = { categoria: string; nome: string; preco: string };

export default function OnboardingEstabelecimento() {
  const [, setLocation] = useLocation();
  const [segmentoId, setSegmentoId] = useState<string | null>(null);
  const [nomeOutros, setNomeOutros] = useState('');
  const [recursos, setRecursos] = useState<Record<string, boolean>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [itens, setItens] = useState<Record<string, ItemMarcado>>({});
  const [busca, setBusca] = useState('');
  const [extras, setExtras] = useState<Record<string, string[]>>({});
  const [novoItem, setNovoItem] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fidelidade, setFidelidade] = useState({
    ativo: false,
    porConsumo: false,
    pedidosParaResgate: 10,
    itemRecompensaConsumo: '',
    porIndicacao: false,
    indicacoesParaResgate: 10,
    itemRecompensaIndicacao: '',
  });
  // Multi-loja (14/08/2026): dual-mode do cardápio — compartilhado entre
  // todas as lojas da conta (padrão) ou próprio por loja.
  const [cardapioPorLoja, setCardapioPorLoja] = useState(false);
  // Multi-loja (15/08/2026): mesma lógica, aplicada ao histórico de listas
  // de compras — decisão do Robson foi chavinha configurável (opção C),
  // não fixo num jeito só.
  const [comprasPorLoja, setComprasPorLoja] = useState(false);
  // Esta tela também é usada como Configurações → Estabelecimento depois do
  // onboarding (rota /onboarding/estabelecimento fica ativa pra sempre). Sem
  // isso, o dono reabre a tela e vê o toggle desmarcado mesmo já tendo
  // ativado antes — carrega o valor real salvo assim que a tela abre.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.cardapioPorLoja === 'boolean') {
          setCardapioPorLoja(data.cardapioPorLoja);
        }
        if (data && typeof data.comprasPorLoja === 'boolean') {
          setComprasPorLoja(data.comprasPorLoja);
        }
      })
      .catch(() => {
        // Sem settings salvos ainda (primeiro acesso) — mantém o padrão false.
      });
  }, []);
  const [shows, setShows] = useState<{
    trabalhaComShows: boolean;
    areas: string[];
    todasAreas: boolean;
    recebeContatos: boolean;
  }>({
    trabalhaComShows: false,
    areas: [],
    todasAreas: false,
    recebeContatos: false,
  });

  const segmento = useMemo(
    () => {
      const base = SEGMENTOS.find((s) => s.id === segmentoId) ?? null;
      if (!base) return null;
      // Para "Outros", substitui o nome pelo que o usuário digitou
      if (base.id === 'outros' && nomeOutros.trim()) {
        return { ...base, nome: nomeOutros.trim() };
      }
      return base;
    },
    [segmentoId, nomeOutros],
  );

  const totalItens = Object.keys(itens).length;
  const totalRecursos = Object.values(recursos).filter(Boolean).length;

  const chave = (categoria: string, nome: string) => `${categoria}::${nome}`;

  const alternarItem = (categoria: string, nome: string) => {
    const k = chave(categoria, nome);
    setItens((atual) => {
      const copia = { ...atual };
      if (copia[k]) delete copia[k];
      else copia[k] = { categoria, nome, preco: '' };
      return copia;
    });
  };

  const definirPreco = (categoria: string, nome: string, preco: string) => {
    const k = chave(categoria, nome);
    setItens((atual) => ({
      ...atual,
      [k]: { categoria, nome, preco: preco.replace(/[^\d.,]/g, '') },
    }));
  };

  const adicionarExtra = (categoria: string) => {
    const nome = (novoItem[categoria] ?? '').trim();
    if (!nome) return;
    setExtras((atual) => ({
      ...atual,
      [categoria]: [...(atual[categoria] ?? []), nome],
    }));
    setItens((atual) => ({
      ...atual,
      [chave(categoria, nome)]: { categoria, nome, preco: '' },
    }));
    setNovoItem((atual) => ({ ...atual, [categoria]: '' }));
  };

  const marcarTodos = () => {
    if (!segmento) return;
    setItens((atual) => {
      const proximo = { ...atual };
      segmento.categorias.forEach((categoria) => {
        [...categoria.itens, ...(extras[categoria.nome] ?? [])].forEach((nome) => {
          proximo[chave(categoria.nome, nome)] = { categoria: categoria.nome, nome, preco: proximo[chave(categoria.nome, nome)]?.preco ?? '' };
        });
      });
      return proximo;
    });
  };

  const desmarcarTodos = () => setItens({});

  const marcarTudoDaEtapa = () => {
    setRecursos(Object.fromEntries(RECURSOS_ESTAB.flatMap((grupo) => grupo.recursos.map((recurso) => [recurso.id, true]))));
    marcarTodos();
  };

  const salvar = async () => {
    setErro(null);
    if (!segmento) return;
    setSalvando(true);
    try {
      const response = await fetch('/api/onboarding/estabelecimento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          // restaurantId NAO vai daqui — o backend deriva do dono autenticado
          // (req.owner.companyId), nunca confia em valor mandado pelo cliente.
          segmentId: segmento.id,
          features: Object.entries(recursos)
            .filter(([, ativo]) => ativo)
            .map(([id]) => ({ id, value: valores[id] ?? null })),
          items: Object.values(itens).map((i) => ({
            category: i.categoria,
            name: i.nome,
            price: i.preco === '' ? null : Number(i.preco.replace(',', '.')),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(data.error ?? 'Não foi possível salvar a configuração.');
        return;
      }
      // Salva fidelidade, cardápio-por-loja e compras-por-loja via PATCH /api/settings (igual ao cadastro)
      if (fidelidade.ativo || shows.trabalhaComShows || cardapioPorLoja || comprasPorLoja) {
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            ...(fidelidade.ativo ? { fidelidade } : {}),
            ...(shows.trabalhaComShows ? { shows } : {}),
            cardapioPorLoja,
            comprasPorLoja,
          }),
        }).catch(() => {
          // Não bloqueia o onboarding por isso — dono ajusta depois em Configurações
        });
      }
      window.localStorage.setItem('miar-onboarding-segment-id', segmento.id);
      setLocation('/onboarding/produtos');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Etapa 1: escolher o tipo de comércio ──────────────────────────────────
  if (!segmento) {
    return (
      <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
        <div className="mx-auto w-full max-w-5xl">
          <button
            type="button"
            onClick={() => setLocation('/bem-vindo')}
            className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft size={15} />
            Voltar
          </button>

          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">
              Passo 2
            </p>
            <h1 className="mt-2 text-3xl font-bold">Segmento: Qual é o seu comércio?</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              A escolha traz o cardápio e o estoque típicos do segmento. Você marca só o que já tem
              e preenche os seus valores.
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTOS.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setSegmentoId(seg.id)}
                data-testid={`button-segmento-${seg.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left transition-colors hover:border-violet-500/60 hover:bg-violet-500/[0.06]"
              >
                <p className="text-base font-semibold text-slate-100">{seg.nome}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{seg.descricao}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Etapa 2: marcar o que já tem e preencher valores ──────────────────────
  const termo = busca.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 pb-28 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => setSegmentoId(null)}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={15} />
          Trocar tipo de comércio
        </button>

        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">
            {segmento.nome}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Marque o que você já tem</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Nenhum valor vem preenchido. O preço é seu, ninguém escolhe por você.
          </p>
          {/* Campo de nome para segmento "Outros" */}
          {segmentoId === 'outros' && (
            <div className="mt-5 max-w-sm">
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Como você chama o seu negócio?
              </label>
              <input
                autoFocus
                value={nomeOutros}
                onChange={(e) => setNomeOutros(e.target.value)}
                placeholder="Ex: Bistrô, Lanchonete, Espetinho…"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          )}
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/[0.08] p-4">
          <div>
            <p className="text-sm font-semibold text-violet-200">Já tem este comércio montado?</p>
            <p className="mt-1 text-xs text-slate-400">Marque tudo de uma vez e desmarque apenas o que não oferece.</p>
          </div>
          <button type="button" onClick={marcarTudoDaEtapa} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400">
            Marcar tudo
          </button>
        </div>

        {/* Recursos */}
        <section className="mb-8 space-y-4">
          {RECURSOS_ESTAB.map((grupo) => (
            <div
              key={grupo.grupo}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{grupo.grupo}</p>
                <button
                  type="button"
                  onClick={() => setRecursos((atual) => ({ ...atual, ...Object.fromEntries(grupo.recursos.map((recurso) => [recurso.id, true])) }))}
                  className="text-xs font-medium text-violet-300 hover:text-violet-200"
                >
                  Marcar todos
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {grupo.recursos.map((recurso) => {
                  const ativo = !!recursos[recurso.id];
                  return (
                    <div
                      key={recurso.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        ativo ? 'border-violet-500/50 bg-violet-500/[0.08]' : 'border-slate-800'
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ativo}
                          onChange={() =>
                            setRecursos((a) => ({ ...a, [recurso.id]: !a[recurso.id] }))
                          }
                          data-testid={`checkbox-estab-${recurso.id}`}
                          className="h-4 w-4 shrink-0 accent-violet-500"
                        />
                        <span className="text-sm text-slate-200">{recurso.nome}</span>
                      </label>
                      {ativo && recurso.valorLabel && (
                        <div className="mt-2.5 flex items-center gap-2 pl-7">
                          <span className="text-xs text-slate-500">{recurso.valorLabel}</span>
                          <div className="flex items-center gap-1.5">
                            {recurso.unidade === 'R$' && (
                              <span className="text-xs text-slate-500">R$</span>
                            )}
                            <input
                              value={valores[recurso.id] ?? ''}
                              onChange={(e) =>
                                setValores((a) => ({
                                  ...a,
                                  [recurso.id]: e.target.value.replace(/[^\d.,]/g, ''),
                                }))
                              }
                              inputMode="decimal"
                              placeholder=""
                              data-testid={`input-valor-${recurso.id}`}
                              className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums outline-none focus:border-violet-500"
                            />
                            {recurso.unidade && recurso.unidade !== 'R$' && (
                              <span className="text-xs text-slate-500">{recurso.unidade}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Programa de fidelidade — opcional, escolhido no onboarding */}
        <section className="mb-8">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>O estabelecimento faz programa de pontos?</span>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-violet-500"
                checked={fidelidade.ativo}
                onChange={(e) => setFidelidade({ ...fidelidade, ativo: e.target.checked })}
              />
            </label>
            {fidelidade.ativo && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-500">
                  Dá pra usar as duas réguas juntas, ou só uma.
                </p>

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-violet-500"
                    checked={fidelidade.porConsumo}
                    onChange={(e) => setFidelidade({ ...fidelidade, porConsumo: e.target.checked })}
                  />
                  <span>Por consumo: a cada N pedidos do mesmo cliente, ganha um item</span>
                </label>
                {fidelidade.porConsumo && (
                  <div className="ml-6 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="A cada quantos pedidos"
                      value={fidelidade.pedidosParaResgate}
                      onChange={(e) =>
                        setFidelidade({ ...fidelidade, pedidosParaResgate: Number(e.target.value) || 1 })
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                    />
                    <input
                      type="text"
                      placeholder="Item de recompensa (ex.: pizza pequena)"
                      value={fidelidade.itemRecompensaConsumo}
                      onChange={(e) =>
                        setFidelidade({ ...fidelidade, itemRecompensaConsumo: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-violet-500"
                    checked={fidelidade.porIndicacao}
                    onChange={(e) => setFidelidade({ ...fidelidade, porIndicacao: e.target.checked })}
                  />
                  <span>Por indicação: a cada N indicados que viraram clientes, ganha um item</span>
                </label>
                {fidelidade.porIndicacao && (
                  <div className="ml-6 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="A cada quantas indicações"
                      value={fidelidade.indicacoesParaResgate}
                      onChange={(e) =>
                        setFidelidade({ ...fidelidade, indicacoesParaResgate: Number(e.target.value) || 1 })
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                    />
                    <input
                      type="text"
                      placeholder="Item de recompensa (ex.: sorvete)"
                      value={fidelidade.itemRecompensaIndicacao}
                      onChange={(e) =>
                        setFidelidade({ ...fidelidade, itemRecompensaIndicacao: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Multi-loja (14/08/2026): cardápio compartilhado ou próprio por loja */}
        <section className="mb-8">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>Cada loja tem cardápio próprio?</span>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-violet-500"
                checked={cardapioPorLoja}
                onChange={(e) => setCardapioPorLoja(e.target.checked)}
              />
            </label>
            <p className="text-xs text-slate-500">
              Desligado (padrão): todas as lojas da conta compartilham o mesmo cardápio.
              Ligado: cada loja cadastrada tem seu próprio cardápio, independente das outras.
              Só relevante pra contas com mais de uma loja.
            </p>
          </div>
        </section>

        {/* Multi-loja (15/08/2026): histórico de compras compartilhado ou próprio por loja */}
        <section className="mb-8">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>Cada loja tem lista de compras separada?</span>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-violet-500"
                checked={comprasPorLoja}
                onChange={(e) => setComprasPorLoja(e.target.checked)}
              />
            </label>
            <p className="text-xs text-slate-500">
              Desligado (padrão): uma lista de compras só, pra conta inteira.
              Ligado: cada loja mantém seu próprio histórico de listas, separado das outras.
              Vale independente do que você escolheu pro cardápio acima — cada chavinha decide
              por si. Itens de estoque individuais podem ser marcados como "compartilhados entre
              todas as lojas" direto na tela de Estoque, não importa essa configuração aqui.
            </p>
          </div>
        </section>

        {/* Cardápio */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Cardápio</h2>
              <p className="mt-1 text-xs text-slate-500">Nada vem selecionado. Marque somente o que a loja oferece.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={marcarTodos} className="rounded-xl border border-violet-500/50 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10">
                Marcar tudo
              </button>
              <button type="button" onClick={desmarcarTodos} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                Desmarcar tudo
              </button>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Procurar item"
                  data-testid="input-busca-item"
                  className="w-56 rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {segmento.categorias.map((categoria) => {
            const listaCompleta = [
              ...categoria.itens,
              ...(extras[categoria.nome] ?? []),
            ];
            const lista = termo
              ? listaCompleta.filter((i) => i.toLowerCase().includes(termo))
              : listaCompleta;
            if (termo && lista.length === 0) return null;

            return (
              <div
                key={categoria.nome}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {categoria.nome}
                </p>

                <div className="space-y-2">
                  {lista.map((nome) => {
                    const k = chave(categoria.nome, nome);
                    const marcado = !!itens[k];
                    return (
                      <div
                        key={k}
                        className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                          marcado ? 'border-violet-500/50 bg-violet-500/[0.08]' : 'border-slate-800'
                        }`}
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarItem(categoria.nome, nome)}
                            data-testid={`checkbox-item-${k}`}
                            className="h-4 w-4 shrink-0 accent-violet-500"
                          />
                          <span className="text-sm text-slate-200">{nome}</span>
                        </label>
                        {marcado && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">R$</span>
                            <input
                              value={itens[k]?.preco ?? ''}
                              onChange={(e) =>
                                definirPreco(categoria.nome, nome, e.target.value)
                              }
                              inputMode="decimal"
                              placeholder=""
                              data-testid={`input-preco-${k}`}
                              className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-violet-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={novoItem[categoria.nome] ?? ''}
                    onChange={(e) =>
                      setNovoItem((a) => ({ ...a, [categoria.nome]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') adicionarExtra(categoria.nome);
                    }}
                    placeholder="Adicionar item que não está na lista"
                    data-testid={`input-novo-item-${categoria.nome}`}
                    className="flex-1 rounded-xl border border-dashed border-slate-700 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => adicionarExtra(categoria.nome)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2.5 text-sm text-slate-300 hover:border-slate-600"
                  >
                    <Plus size={14} />
                    Incluir
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {erro && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </p>
        )}
      </div>

      {/* Barra fixa de resumo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Check size={15} className="text-violet-400" />
            <span className="tabular-nums">{totalRecursos}</span> recursos e{' '}
            <span className="tabular-nums">{totalItens}</span> itens marcados
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLocation('/painel')}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-600"
            >
              Fazer isso depois
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              data-testid="button-salvar-estabelecimento"
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
            >
              <Save size={15} />
              {salvando ? 'Salvando' : 'Concluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// artifacts/gestor/src/lib/funcoes.ts — copia local da lista mestra (fonte: lib/api-spec/src/funcoes.ts)
//
// LISTA MESTRA DE FUNÇÕES — fonte única de verdade.
// A tela de usuários, cada app da casa e o porteiro do backend leem daqui.
// Adicionar função nova = adicionar uma linha aqui. Nada mais precisa mudar.

export type Funcao = {
  id: string;
  nome: string;
  detalhe: string;
};

export type GrupoFuncao = {
  id: string;
  grupo: string;
  funcoes: Funcao[];
};

export const FUNCOES: GrupoFuncao[] = [
  {
    id: 'salao',
    grupo: 'Salão e atendimento',
    funcoes: [
      { id: 'orders', nome: 'Pedidos', detalhe: 'Abrir, lançar e acompanhar pedidos' },
      { id: 'tables', nome: 'Mesas e grupos', detalhe: 'Abrir mesa, juntar e dividir conta' },
      { id: 'waiter-calls', nome: 'Chamadas de garçom', detalhe: 'Receber e encerrar chamadas' },
      { id: 'order-history', nome: 'Histórico de pedidos', detalhe: 'Consultar pedidos anteriores' },
      { id: 'complaints', nome: 'Reclamações e feedback', detalhe: 'Ver e tratar retorno do cliente' },
    ],
  },
  {
    id: 'producao',
    grupo: 'Produção',
    funcoes: [
      { id: 'kitchen', nome: 'Cozinha', detalhe: 'Fila de produção e tempo de preparo' },
      { id: 'operational-workflow', nome: 'Fluxo operacional', detalhe: 'Etapas e transições de status' },
      { id: 'food-analysis', nome: 'Análise de prato', detalhe: 'Conferência do prato por imagem' },
      { id: 'nutri', nome: 'Nutricional', detalhe: 'Ficha técnica e informação nutricional' },
    ],
  },
  {
    id: 'financeiro',
    grupo: 'Financeiro',
    funcoes: [
      { id: 'cashier-session', nome: 'Caixa e sessão', detalhe: 'Abrir, sangrar e fechar caixa' },
      { id: 'analytics', nome: 'Relatórios e analytics', detalhe: 'Faturamento, ticket médio, curvas' },
      { id: 'dashboard', nome: 'Painel geral', detalhe: 'Visão consolidada do dia' },
    ],
  },
  {
    id: 'estoque',
    grupo: 'Estoque e compras',
    funcoes: [
      { id: 'stock', nome: 'Estoque', detalhe: 'Entrada, saída e saldo' },
      { id: 'barcode', nome: 'Código de barras', detalhe: 'Leitura e cadastro por código' },
      { id: 'vision', nome: 'Olhos do MIAR', detalhe: 'Auditoria por câmera e visão' },
    ],
  },
  {
    id: 'entrega',
    grupo: 'Entrega',
    funcoes: [
      { id: 'delivery-governance', nome: 'Governança de entrega', detalhe: 'Regras, raio e taxas' },
      { id: 'delivery-observations', nome: 'Ocorrências de entrega', detalhe: 'Registrar e resolver ocorrência' },
      { id: 'delivery-invite', nome: 'Convite de entregador', detalhe: 'Gerar e revogar convites' },
    ],
  },
  {
    id: 'gestao',
    grupo: 'Gestão',
    funcoes: [
      { id: 'employees', nome: 'Funcionários e ponto', detalhe: 'Cadastro, PIN e jornada' },
      { id: 'marketing', nome: 'Marketing', detalhe: 'Campanhas e disparos' },
      { id: 'audit', nome: 'Auditoria', detalhe: 'Log de tudo que foi feito e por quem' },
      { id: 'settings', nome: 'Configurações', detalhe: 'Parâmetros do estabelecimento' },
      { id: 'restaurants', nome: 'Unidades', detalhe: 'Dados e filiais' },
      { id: 'backup', nome: 'Backup', detalhe: 'Exportar e restaurar' },
      { id: 'lgpd', nome: 'LGPD', detalhe: 'Dados pessoais e solicitações do titular' },
    ],
  },
  {
    id: 'ia',
    grupo: 'Inteligência',
    funcoes: [
      { id: 'chat', nome: 'Ária', detalhe: 'Assistente por texto e voz' },
      { id: 'chat-history', nome: 'Histórico da Ária', detalhe: 'Consultar conversas anteriores' },
      { id: 'onboarding', nome: 'Presets de segmento', detalhe: 'Aplicar preset do tipo de comércio' },
      { id: 'miar-edita', nome: 'MIAR AI EDITA', detalhe: 'Gravar, editar e publicar conteúdo' },
    ],
  },
];

// Todos os ids em lista plana
export const TODAS_FUNCOES: string[] = FUNCOES.flatMap((g) => g.funcoes.map((f) => f.id));

// ─────────────────────────────────────────────────────────────────────────────
// A CHAVE MESTRA
// Quem tem 'manage' comanda: liga e desliga qualquer função de qualquer pessoa,
// executa tudo na casa, e (se for dono) cadastra outro gestor.
// 'manage' NÃO é uma função da lista acima — é o poder acima das funções.
// ─────────────────────────────────────────────────────────────────────────────
export const CHAVE_MESTRA = 'manage';

// Papéis. Só existem dois mundos: quem executa (funcionário) e quem comanda (gestor/dono).
// 'owner' e 'manager' recebem a chave mestra. Sócio = gestor = dono, entra pelo app do gestor.
export type Papel =
  | 'owner'      // dono, tem a chave mestra e cadastra outros donos
  | 'manager'    // gestor/sócio, tem a chave mestra
  | 'cashier'
  | 'waiter'
  | 'cook'
  | 'delivery'
  | 'custom';

export const PAPEIS_COM_CHAVE: Papel[] = ['owner', 'manager'];

// Perfis prontos de funções por papel (a tela de usuários usa como ponto de partida)
export const PERFIL_FUNCOES: Record<string, string[]> = {
  garcom: ['orders', 'tables', 'waiter-calls', 'order-history'],
  cozinha: ['kitchen', 'operational-workflow', 'food-analysis', 'nutri', 'stock'],
  caixa: ['cashier-session', 'orders', 'tables', 'order-history', 'dashboard'],
  entregador: ['delivery-governance', 'delivery-observations', 'order-history'],
  gerente: TODAS_FUNCOES.filter((id) => !['backup', 'lgpd'].includes(id)),
  total: TODAS_FUNCOES,
};

// Helper compartilhado: uma pessoa tem acesso a uma função?
// Quem tem a chave mestra tem acesso a tudo automaticamente.
export function temAcesso(
  pessoa: { role?: string; funcoes?: string[] } | null | undefined,
  funcaoId: string,
): boolean {
  if (!pessoa) return false;
  if (pessoa.role && PAPEIS_COM_CHAVE.includes(pessoa.role as Papel)) return true;
  return (pessoa.funcoes ?? []).includes(funcaoId);
}

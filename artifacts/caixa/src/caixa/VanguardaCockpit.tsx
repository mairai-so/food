import { useEffect, useMemo, useState } from 'react';
import { apiGet, getOperador, getToken } from './api';
import { addCashMovement, closeCashierSession, getCurrentCashierSession, handoffCashierSession, openCashierSession, type CashierSession, type CashierSummary } from './vanguarda-cashier';
import './vanguarda.css';

type ApiTable = {
  id: string;
  number: number;
  status: string;
  session?: { id: string; guestCount: number; pendingAmount: number; fullyPaid: boolean; createdAt?: string } | null;
};
type ApiOrder = { id: string; tableNumber?: number; tableId?: string; status: string; total?: number; createdAt?: string };
function hasRealCaixaSession() { return Boolean(getToken()); }
async function loadRealCaixaData() {
  const [tables, orders] = await Promise.all([
    apiGet<ApiTable[]>('/tables/with-sessions'),
    apiGet<ApiOrder[]>('/orders'),
  ]);
  return { tables, orders };
}

type Layout = 1 | 2 | 4;
type ModuleId = 'mesas' | 'caixa' | 'cozinha' | 'controlo';
type TableStatus = 'free' | 'service' | 'ready' | 'payment' | 'paid' | 'cleaning';

type Table = {
  number: number;
  status: TableStatus;
  amount: number;
  people: number;
  elapsed: string;
  order?: string;
};

const MODULES: Record<ModuleId, { title: string; short: string; accent: string; description: string }> = {
  mesas: { title: 'Mesas', short: 'Mapa de mesas', accent: 'mint', description: 'Estado vivo do salão e controlo directo da mesa.' },
  caixa: { title: 'Caixa', short: 'Recebimentos', accent: 'violet', description: 'Conta, métodos de pagamento e fechamento seguro.' },
  cozinha: { title: 'Cozinha', short: 'Prontos para fechar', accent: 'amber', description: 'Pedidos prontos e alertas que exigem decisão.' },
  controlo: { title: 'Controlo', short: 'Turno e segurança', accent: 'sky', description: 'Turno, sangria, operador, multicixas e auditoria.' },
};

const DENOMINATIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
const RECONCILIATION_METHODS = [
  { key: 'cash', label: 'Dinheiro', kind: 'físico' },
  { key: 'pix', label: 'Pix', kind: 'electrónico' },
  { key: 'credit', label: 'Crédito', kind: 'electrónico' },
  { key: 'debit', label: 'Débito', kind: 'electrónico' },
  { key: 'voucher', label: 'Vale', kind: 'electrónico' },
  { key: 'app', label: 'App', kind: 'electrónico' },
] as const;

const TABLES: Table[] = [
  { number: 1, status: 'free', amount: 0, people: 0, elapsed: '—' },
  { number: 2, status: 'service', amount: 86.8, people: 2, elapsed: '18 min', order: 'Pedido em preparo' },
  { number: 3, status: 'ready', amount: 124.7, people: 3, elapsed: '31 min', order: 'Pronto para fechar' },
  { number: 4, status: 'payment', amount: 72.9, people: 2, elapsed: '42 min', order: 'Aguardando pagamento' },
  { number: 5, status: 'free', amount: 0, people: 0, elapsed: '—' },
  { number: 6, status: 'service', amount: 58.5, people: 2, elapsed: '12 min', order: '2 itens em preparo' },
  { number: 7, status: 'paid', amount: 96.4, people: 4, elapsed: 'agora', order: 'Pago — liberar mesa' },
  { number: 8, status: 'cleaning', amount: 0, people: 0, elapsed: '4 min', order: 'Em limpeza' },
  { number: 9, status: 'free', amount: 0, people: 0, elapsed: '—' },
  { number: 10, status: 'ready', amount: 148.2, people: 4, elapsed: '36 min', order: 'Pronto para fechar' },
  { number: 11, status: 'service', amount: 39.9, people: 1, elapsed: '9 min', order: 'Pedido em preparo' },
  { number: 12, status: 'free', amount: 0, people: 0, elapsed: '—' },
];

const STATUS: Record<TableStatus, { label: string; className: string }> = {
  free: { label: 'Livre', className: 'status-free' },
  service: { label: 'Consumindo', className: 'status-service' },
  ready: { label: 'Pronto para fechar', className: 'status-ready' },
  payment: { label: 'Aguardando pagamento', className: 'status-payment' },
  paid: { label: 'Pago — liberar', className: 'status-paid' },
  cleaning: { label: 'Em limpeza', className: 'status-cleaning' },
};

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function elapsedFrom(date?: string) {
  if (!date) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return minutes < 1 ? 'agora' : `${minutes} min`;
}

function adaptRealTable(table: ApiTable, orders: ApiOrder[]): Table {
  const tableOrders = orders.filter((order) => order.tableNumber === table.number || order.tableId === table.id);
  const hasReadyOrder = tableOrders.some((order) => order.status === 'ready');
  const status: TableStatus = table.session?.fullyPaid
    ? 'paid'
    : table.session
      ? 'payment'
      : table.status === 'cleaning'
        ? 'cleaning'
        : hasReadyOrder
          ? 'ready'
          : table.status === 'free'
            ? 'free'
            : 'service';
  const amount = table.session?.pendingAmount ?? tableOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  return {
    number: table.number,
    status,
    amount,
    people: table.session?.guestCount ?? 0,
    elapsed: elapsedFrom(table.session?.createdAt ?? tableOrders[0]?.createdAt),
    order: hasReadyOrder ? 'Pronto para fechar' : table.session ? 'Aguardando pagamento' : tableOrders[0]?.status ?? undefined,
  };
}

export default function VanguardaCockpit({ onSair }: { onSair?: () => void }) {
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = Number(localStorage.getItem('miar-caixa-layout'));
    return saved === 1 || saved === 2 || saved === 4 ? saved : 4;
  });
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(['mesas', 'caixa', 'cozinha', 'controlo']);
  const [maximized, setMaximized] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [tables, setTables] = useState<Table[]>(TABLES);
  const [realMode, setRealMode] = useState(() => hasRealCaixaSession());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [cashierSession, setCashierSession] = useState<CashierSession | null>(null);
  const [cashierSummary, setCashierSummary] = useState<CashierSummary | null>(null);
  const [cashierAction, setCashierAction] = useState<'open' | 'sangria' | 'reforco' | 'close' | 'handoff' | null>(null);
  const [cashierAmount, setCashierAmount] = useState('');
  const [floatCounts, setFloatCounts] = useState<Record<string, number>>({});
  const [countedCashCounts, setCountedCashCounts] = useState<Record<string, number>>({});
  const [handoffWithSangria, setHandoffWithSangria] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [incomingNotes, setIncomingNotes] = useState('');
  const cashFloat = DENOMINATIONS.reduce((sum, denomination) => sum + denomination * (floatCounts[String(denomination)] ?? 0), 0);
  const countedCash = DENOMINATIONS.reduce((sum, denomination) => sum + denomination * (countedCashCounts[String(denomination)] ?? 0), 0);
  const [notice, setNotice] = useState(() => hasRealCaixaSession() ? 'A ligar aos dados reais do Caixa…' : 'Prévia visual do cockpit — sem token de Caixa.');

  useEffect(() => {
    if (!hasRealCaixaSession()) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const data = await loadRealCaixaData();
        if (cancelled) return;
        setTables(data.tables.map((table) => adaptRealTable(table, data.orders)));
        setRealMode(true);
        setSyncError(null);
        setLastSync(new Date());
        setNotice('Dados reais sincronizados — pagamentos continuam protegidos por autorização.');
      } catch (error) {
        if (cancelled) return;
        setSyncError(error instanceof Error ? error.message : 'Falha de sincronização');
        setNotice('Falha na sincronização — nenhuma confirmação financeira foi emitida.');
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 6000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!hasRealCaixaSession()) return;
    let cancelled = false;
    const syncSession = async () => {
      try {
        const data = await getCurrentCashierSession();
        if (cancelled) return;
        setCashierSession(data.session);
        setCashierSummary(data.summary ?? null);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'Falha ao ler o turno do Caixa.');
      }
    };
    void syncSession();
    const timer = window.setInterval(() => void syncSession(), 6000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const visibleModules = useMemo(() => selectedModules.slice(0, layout), [layout, selectedModules]);
  const selectedTableData = tables.find((table) => table.number === selectedTable) ?? TABLES[2];
  const readyCount = tables.filter((table) => table.status === 'ready').length;
  const paymentCount = tables.filter((table) => table.status === 'payment').length;

  const refreshCashier = async () => {
    const data = await getCurrentCashierSession();
    setCashierSession(data.session);
    setCashierSummary(data.summary ?? null);
  };

  const submitCashierAction = async (skipNotes = false) => {
    const amount = cashierAction === 'open' ? cashFloat : cashierAction === 'close' || cashierAction === 'handoff' ? countedCash : Number(cashierAmount);
    const notes = skipNotes ? 'Sem observação registada pelo operador.' : [closingNotes && `Saída: ${closingNotes}`, incomingNotes && `Entrada: ${incomingNotes}`].filter(Boolean).join(' | ') || undefined;
    if (!hasRealCaixaSession()) {
      setNotice('Prévia: nenhuma operação foi gravada porque não existe token real.');
      setCashierAction(null);
      return;
    }
    try {
      if (cashierAction === 'open') {
        const result = await openCashierSession(amount, floatCounts);
        setCashierSession(result.session);
        setCashierSummary(result.summary);
        setNotice('Turno aberto com resposta real e movimento de abertura.');
      } else if (cashierAction === 'sangria' || cashierAction === 'reforco') {
        if (!cashierSession) throw new Error('Abra um turno antes de movimentar dinheiro.');
        const result = await addCashMovement(cashierSession.id, cashierAction, amount, cashierAction === 'sangria' ? 'Sangria autorizada pelo Caixa' : 'Reforço de caixa');
        setCashierSummary(result.summary);
        setNotice(`${cashierAction === 'sangria' ? 'Sangria' : 'Reforço'} registado com resposta real.`);
      } else if (cashierAction === 'close' || cashierAction === 'handoff') {
        if (!cashierSession) throw new Error('Não existe turno aberto para fechar ou transferir.');
        const result = cashierAction === 'handoff'
          ? await handoffCashierSession(cashierSession.id, handoffWithSangria ? 'with_sangria' : 'without_sangria', amount, notes, countedCashCounts)
          : await closeCashierSession(cashierSession.id, amount, notes, countedCashCounts);
        setCashierSession(result.session);
        setCashierSummary(result.summary);
        setNotice(cashierAction === 'close' ? `Turno fechado. Diferença apurada: ${brl(result.difference)}.` : `Turno transferido ${handoffWithSangria ? 'com sangria' : 'sem sangria'}. Diferença apurada: ${brl(result.difference)}.`);
      }
      setCashierAction(null);
      setCashierAmount('');
      setClosingNotes('');
      setIncomingNotes('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Operação de Caixa recusada.');
    }
  };

  const changeLayout = (next: Layout) => {
    setLayout(next);
    localStorage.setItem('miar-caixa-layout', String(next));
    setMaximized(null);
  };

  const changeModule = (index: number, next: ModuleId) => {
    setSelectedModules((current) => {
      const result = [...current];
      const existingIndex = result.indexOf(next);
      if (existingIndex >= 0 && existingIndex !== index) {
        [result[index], result[existingIndex]] = [result[existingIndex], result[index]];
      } else {
        result[index] = next;
      }
      return result;
    });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">MIAR AI/FOOD</p>
            <h1>Caixa Vanguarda</h1>
          </div>
        </div>
        <div className="topbar-context">
          <span className={`live-dot ${realMode && !syncError ? '' : 'offline'}`} />
          <span>{realMode && !syncError ? 'Dados reais' : 'Modo prévia'}</span>
          <span className="separator" />
          <span className="muted">MIAR AI/FOOD</span>
          <span className="separator" />
          <span className="operator">{getOperador()}</span>
          {onSair && <button className="avatar-button" aria-label="Sair do Caixa" onClick={onSair}>{getOperador().slice(0, 2).toUpperCase()}</button>}
        </div>
      </header>

      <section className="commandbar">
        <div>
          <p className="section-kicker">Cockpit operacional</p>
          <h2>O que precisa de decisão agora.</h2>
        </div>
        <div className="layout-controls" aria-label="Escolher layout">
          <span className="layout-label">Visão</span>
          {[1, 2, 4].map((value) => (
            <button key={value} className={`layout-button ${layout === value ? 'active' : ''}`} onClick={() => changeLayout(value as Layout)}>
              <span className={`layout-icon layout-${value}`}><i /><i /><i /><i /></span>
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="signal-row" aria-label="Resumo operacional">
        <Signal label="Aguardando fechamento" value={String(readyCount)} tone="mint" action="Ver mesas" />
        <Signal label="Pagamentos pendentes" value={String(paymentCount)} tone="violet" action="Abrir Caixa" />
        <Signal label="Turno actual" value={brl(cashierSummary?.cashInDrawer ?? 0)} tone="sky" action="Ver turno" />
        <Signal label="Alertas" value="0" tone="amber" action="Auditoria limpa" />
      </section>

      <section className={`panel-grid layout-count-${layout} ${maximized !== null ? 'has-maximized' : ''}`}>
        {visibleModules.map((module, index) => (
          <PanelShell
            key={`${module}-${index}`}
            module={module}
            index={index}
            maximized={maximized === index}
            onMaximize={() => setMaximized(maximized === index ? null : index)}
            onChangeModule={(next) => changeModule(index, next)}
          >
            {module === 'mesas' && <TablesPanel tables={tables} selected={selectedTable} onSelect={(table) => { setSelectedTable(table); setNotice(`Mesa ${table} seleccionada. A conta e as permissões serão abertas no painel Caixa.`); }} />}
            {module === 'caixa' && <CashPanel table={selectedTableData} method={paymentMethod} onMethod={setPaymentMethod} onAction={() => setNotice(realMode ? 'Recebimento seleccionado — a confirmação exigirá turno, permissão e resposta real do endpoint.' : 'Prévia: esta acção será ligada ao endpoint real e ao Ledger.')} />}
            {module === 'cozinha' && <KitchenPanel onSelectTable={(table) => { setSelectedTable(table); setNotice(`Mesa ${table} recebeu sinal da Cozinha.`); }} />}
            {module === 'controlo' && <ControlPanel realMode={realMode} session={cashierSession} summary={cashierSummary} onOpenTurn={() => { setCashierAmount('0'); setFloatCounts({}); setCashierAction('open'); }} onSangria={() => { setCashierAmount(''); setCashierAction('sangria'); }} onReforco={() => { setCashierAmount(''); setCashierAction('reforco'); }} onCloseTurn={() => { setCashierAmount(''); setCountedCashCounts({}); setClosingNotes(''); setIncomingNotes(''); setCashierAction('close'); }} onHandoff={() => { setCashierAmount(''); setCountedCashCounts({}); setHandoffWithSangria(false); setClosingNotes(''); setIncomingNotes(''); setCashierAction('handoff'); }} onAction={(text) => setNotice(text)} />}
          </PanelShell>
        ))}
      </section>

      {cashierAction && <div className="cashier-modal-backdrop" role="presentation"><div className="cashier-modal" role="dialog" aria-modal="true" aria-labelledby="cashier-action-title"><div className="modal-kicker">Autorização de Caixa</div><h3 id="cashier-action-title">{cashierAction === 'open' ? 'Abrir turno' : cashierAction === 'close' ? 'Fechar turno' : cashierAction === 'handoff' ? 'Trocar operador' : cashierAction === 'sangria' ? 'Registar sangria' : 'Registar reforço'}</h3><p>{hasRealCaixaSession() ? 'A operação será enviada ao endpoint real e ficará no Ledger.' : 'Modo prévia: a operação não será gravada.'}</p>{cashierAction === 'handoff' && <div className="handoff-mode"><span className="micro-label">Como entregar o gaveteiro?</span><div className="handoff-options"><button className={!handoffWithSangria ? 'selected' : ''} onClick={() => setHandoffWithSangria(false)}><strong>Sem sangria</strong><small>O dinheiro permanece no gaveteiro e passa para o próximo operador.</small></button><button className={handoffWithSangria ? 'selected' : ''} onClick={() => setHandoffWithSangria(true)}><strong>Com sangria</strong><small>Regista a retirada integral e entrega o gaveteiro zerado.</small></button></div></div>}{cashierAction === 'open' || cashierAction === 'close' || cashierAction === 'handoff' ? <div className="float-editor"><span className="micro-label">{cashierAction === 'open' ? 'Fundo de troco por denominação' : 'Contagem física no gaveteiro'}</span><div className="denomination-grid">{DENOMINATIONS.map((denomination) => <label key={denomination}><span>{brl(denomination)}</span><input inputMode="numeric" min="0" type="number" value={(cashierAction === 'open' ? floatCounts[String(denomination)] : countedCashCounts[String(denomination)]) ?? 0} onChange={(event) => { const value = Number(event.target.value) || 0; if (cashierAction === 'open') setFloatCounts((current) => ({ ...current, [String(denomination)]: value })); else setCountedCashCounts((current) => ({ ...current, [String(denomination)]: value })); }} /></label>)}</div><strong className="float-total">{cashierAction === 'open' ? 'Fundo calculado' : 'Total contado'}: {brl(cashierAction === 'open' ? cashFloat : handoffWithSangria && cashierAction === 'handoff' ? countedCash : countedCash)}</strong></div> : <label>Valor (R$)<input autoFocus inputMode="decimal" value={cashierAmount} onChange={(event) => setCashierAmount(event.target.value)} /></label>}{(cashierAction === 'close' || cashierAction === 'handoff') && <div className="notes-editor">{(cashierAction === 'close' || cashierAction === 'handoff') && <label><span>{cashierAction === 'handoff' ? 'Observação de quem entrega' : 'Observação do fecho'}</span><textarea rows={3} value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Ex.: gaveteiro conferido, diferença explicada…" /></label>}{cashierAction === 'handoff' && <label><span>Observação de quem recebe</span><textarea rows={3} value={incomingNotes} onChange={(event) => setIncomingNotes(event.target.value)} placeholder="Ex.: recebi o gaveteiro e os comprovantes…" /></label>}</div>}<div className="modal-actions"><button onClick={() => setCashierAction(null)}>Cancelar</button>{(cashierAction === 'close' || cashierAction === 'handoff') && <button onClick={() => void submitCashierAction(true)}>Avançar sem observação</button>}<button className="modal-confirm" disabled={(cashierAction === 'open' && cashFloat <= 0) || ((cashierAction === 'close' || cashierAction === 'handoff') && countedCash <= 0)} onClick={() => void submitCashierAction()}>Confirmar operação</button></div></div></div>}

      <footer className="status-footer">
        <span className="footer-check"><span className="checkmark">✓</span> Segurança operacional preparada</span>
        <span>{syncError ?? notice}</span>
        <span className="footer-right">{lastSync ? `Última sincronização: ${lastSync.toLocaleTimeString('pt-BR')}` : 'Última sincronização: —'}</span>
      </footer>
    </main>
  );
}

function Signal({ label, value, tone, action }: { label: string; value: string; tone: string; action: string }) {
  return <button className="signal-card" onClick={() => undefined}>
    <span className={`signal-accent ${tone}`} />
    <span className="signal-copy"><span>{label}</span><strong>{value}</strong></span>
    <span className="signal-action">{action} <b>→</b></span>
  </button>;
}

function PanelShell({ module, index, maximized, onMaximize, onChangeModule, children }: { module: ModuleId; index: number; maximized: boolean; onMaximize: () => void; onChangeModule: (module: ModuleId) => void; children: React.ReactNode }) {
  const meta = MODULES[module];
  return <article className={`panel-card accent-${meta.accent} ${maximized ? 'panel-maximized' : ''}`}>
    <div className="panel-head">
      <div className="panel-title"><span className={`panel-dot ${meta.accent}`} /><div><span>{meta.title}</span><small>{meta.description}</small></div></div>
      <div className="panel-actions">
        <button className="icon-button" onClick={onMaximize} aria-label={maximized ? 'Restaurar painel' : 'Maximizar painel'} title={maximized ? 'Restaurar painel' : 'Maximizar painel'}>{maximized ? '⛶' : '⛶'}</button>
        <details className="module-menu"><summary>Módulos <span>⌄</span></summary><div className="module-popover"><p>Escolher painel {index + 1}</p>{(Object.keys(MODULES) as ModuleId[]).map((id) => <button key={id} className={id === module ? 'selected' : ''} onClick={() => onChangeModule(id)}>{MODULES[id].title}<span>{id === module ? 'Actual' : 'Abrir'}</span></button>)}</div></details>
      </div>
    </div>
    <div className="panel-body">{children}</div>
  </article>;
}

function TablesPanel({ tables, selected, onSelect }: { tables: Table[]; selected: number; onSelect: (table: number) => void }) {
  return <div className="tables-panel"><div className="mini-toolbar"><span>Salão principal · {tables.length} mesas</span><span className="mini-link">Filtrar ⌄</span></div><div className="table-grid">{tables.map((table) => <button key={table.number} className={`table-tile ${STATUS[table.status].className} ${selected === table.number ? 'selected' : ''}`} onClick={() => onSelect(table.number)}><span className="table-number">{table.number}</span><span className="table-status">{STATUS[table.status].label}</span>{table.amount > 0 && <span className="table-amount">{brl(table.amount)}</span>}{table.people > 0 && <span className="table-meta">{table.people} pessoas · {table.elapsed}</span>}</button>)}</div><div className="legend">{(['free','service','ready','payment'] as TableStatus[]).map((status) => <span key={status}><i className={STATUS[status].className} /> {STATUS[status].label}</span>)}</div></div>;
}

function CashPanel({ table, method, onMethod, onAction }: { table: Table; method: string; onMethod: (method: string) => void; onAction: () => void }) {
  const methods = ['Pix', 'Crédito', 'Débito', 'Vale', 'App'];
  return <div className="cash-panel"><div className="selected-account"><div><span className="micro-label">Mesa seleccionada</span><strong>Mesa {table.number}</strong><small>{table.order ?? 'Nenhuma conta pendente'}</small></div><span className={`account-state ${STATUS[table.status].className}`}>{STATUS[table.status].label}</span></div><div className="cash-total"><span>Total da conta</span><strong>{brl(table.amount || 0)}</strong></div><div className="method-grid">{methods.map((item) => <button key={item} onClick={() => onMethod(item)} className={method === item ? 'active' : ''}>{item}</button>)}</div><button className="primary-action" onClick={onAction}>Abrir recebimento <span>→</span></button><div className="cash-safe"><span>✓</span> Confirmação antes de lançar no Ledger</div></div>;
}

function KitchenPanel({ onSelectTable }: { onSelectTable: (table: number) => void }) {
  return <div className="kitchen-panel"><div className="queue-highlight" onClick={() => onSelectTable(3)}><span className="queue-pulse" /><div><strong>Mesa 3 pronta</strong><small>3 itens · finalizada há 2 min</small></div><b>R$ 124,70</b></div><div className="queue-item" onClick={() => onSelectTable(10)}><span className="queue-icon">10</span><div><strong>Mesa 10</strong><small>Pronto para fechar · 4 itens</small></div><span className="queue-time">36 min</span></div><div className="kitchen-empty"><span>✓</span><div><strong>Produção sob controlo</strong><small>Nenhum pedido atrasado na cozinha.</small></div></div></div>;
}

function ReconciliationPanel({ summary }: { summary: CashierSummary | null }) {
  return <div className="reconciliation-panel"><div className="reconciliation-heading"><div><span className="micro-label">Fecho financeiro</span><strong>Reconciliação por método</strong></div><span className="reconciliation-note">O servidor é a fonte oficial</span></div><div className="reconciliation-list">{RECONCILIATION_METHODS.map((method) => { const row = summary?.reconciliation?.[method.key]; const values = row ? method.key === 'cash' ? `Esperado ${row.expected === undefined ? '—' : brl(row.expected)} · Conferido ${row.counted === undefined ? '—' : brl(row.counted)} · Diferença ${row.difference === undefined ? '—' : brl(row.difference)}` : method.key === 'app' ? `Pendente ${row.pending === undefined ? '—' : brl(row.pending)} · Pago ${row.confirmed === undefined ? '—' : brl(row.confirmed)} · Falhou ${row.failed === undefined ? '—' : brl(row.failed)} · Estornado ${row.refunded === undefined ? '—' : brl(row.refunded)} · Em reconciliação ${row.inReconciliation === undefined ? '—' : brl(row.inReconciliation)}` : `Confirmado ${row.confirmed === undefined ? '—' : brl(row.confirmed)} · Pendente ${row.pending === undefined ? '—' : brl(row.pending)} · Estornado ${row.refunded === undefined ? '—' : brl(row.refunded)}` : 'Aguardando dados do servidor'; return <div className={`reconciliation-row ${row ? 'available' : 'waiting'}`} key={method.key}><div><strong>{method.label}</strong><small>{method.kind === 'físico' ? 'contagem no gaveteiro' : 'conferência electrónica'}</small></div><span>{values}</span></div>; })}</div></div>;
}

function ControlPanel({ realMode, session, summary, onOpenTurn, onSangria, onReforco, onCloseTurn, onHandoff, onAction }: { realMode: boolean; session: CashierSession | null; summary: CashierSummary | null; onOpenTurn: () => void; onSangria: () => void; onReforco: () => void; onCloseTurn: () => void; onHandoff: () => void; onAction: (text: string) => void }) {
  const active = session?.status === 'open';
  const operator = realMode ? (session?.operatorName ?? 'Nenhum operador em turno') : 'Prévia sem operador';
  const subtitle = realMode ? (active ? `Fundo esperado ${brl(summary?.cashInDrawer ?? 0)}` : 'Abra um turno antes de receber') : 'Prévia visual — sem gravação';
  return <div className="control-panel"><div className="shift-card"><div><span className="micro-label">{realMode ? 'Turno real' : 'Turno de prévia'}</span><strong>{operator}</strong><small>{subtitle}</small></div><button className="shift-live shift-action" onClick={active ? onCloseTurn : onOpenTurn}>{realMode ? (active ? 'FECHAR' : 'ABRIR') : 'PRÉVIA'}</button></div><ReconciliationPanel summary={summary} /><div className="control-grid"><button onClick={active ? onSangria : () => onAction('Sangria bloqueada: é necessário abrir um turno autorizado.')}><span>↓</span><strong>Sangria</strong><small>Retirar dinheiro</small></button><button onClick={active ? onHandoff : () => onAction('Troca de turno bloqueada sem sessão activa.')}><span>⇄</span><strong>Troca de turno</strong><small>Conferir e entregar</small></button><button onClick={active ? onReforco : () => onAction('Reforço bloqueado: é necessário abrir um turno autorizado.')}><span>↑</span><strong>Reforço</strong><small>Adicionar dinheiro</small></button><button onClick={() => onAction('Multicaixas: cada operador terá sessão, loja e permissões próprias.')}><span>▦</span><strong>Multicaixas</strong><small>2 caixas activos</small></button><button onClick={() => onAction('Auditoria limpa: sem divergências pendentes nesta prévia.')}><span>✓</span><strong>Auditoria</strong><small>Ver movimentos</small></button><button onClick={() => onAction('Caixa Preta aberta: cada correcção, desconto, vale e pagamento extra terá operador, motivo e aprovador.')}><span>◈</span><strong>Caixa Preta</strong><small>Registos imutáveis</small></button><button onClick={() => onAction('Pagamento extraordinário: a política do Gestor decide se exige senha mestre.')}><span>!</span><strong>Pagamentos extra</strong><small>Exige política</small></button></div></div>;
}

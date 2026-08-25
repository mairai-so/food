import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Keyboard, Mouse, RotateCcw, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

type Tipo = 'teclado' | 'mouse';

interface AtalhoAcao {
  action: string;
  label: string;
}

interface Atalho {
  id: string;
  action: string;
  key: string;
  tipo: Tipo;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const r = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers ?? {}),
    },
  });
  return r;
}

// Combinação de teclado, ex.: "ctrl+shift+p"
function keyComboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const k = e.key.toLowerCase();
  if (!['control', 'alt', 'shift', 'meta'].includes(k)) parts.push(k);
  return parts.join('+');
}

// Botão de mouse extra (lateral 1/2, central, etc.) — botões 0/1/2 são
// clique esquerdo/central/direito padrão e não viram atalho, só os extras.
const MOUSE_BUTTON_LABELS: Record<number, string> = {
  3: 'Botão Lateral 1',
  4: 'Botão Lateral 2',
  5: 'Botão Lateral 3',
  6: 'Botão Lateral 4',
};

function mouseComboFromEvent(e: MouseEvent): string | null {
  const label = MOUSE_BUTTON_LABELS[e.button];
  if (!label) return null;
  return `mouse:${e.button}`;
}

function displayCombo(key: string, tipo: Tipo): string {
  if (tipo === 'mouse') {
    const btn = Number(key.split(':')[1]);
    return MOUSE_BUTTON_LABELS[btn] ?? key;
  }
  return key.toUpperCase();
}

export default function AtalhosPage() {
  const [acoesDisponiveis, setAcoesDisponiveis] = useState<AtalhoAcao[]>([]);
  const [atalhosSalvos, setAtalhosSalvos] = useState<Atalho[]>([]);
  const [gravando, setGravando] = useState<{ action: string; tipo: Tipo } | null>(null);
  const [novaAcao, setNovaAcao] = useState('');
  const [loading, setLoading] = useState(true);
  const [conflito, setConflito] = useState<{
    action: string; key: string; tipo: Tipo; comQuem: Atalho;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/atalhos');
      if (r.ok) {
        const data = await r.json();
        setAtalhosSalvos(data.atalhos ?? []);
        setAcoesDisponiveis(data.acoesDisponiveis ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = useCallback(async (action: string, key: string, tipo: Tipo, forcar = false) => {
    const r = await apiFetch('/atalhos', {
      method: 'POST',
      body: JSON.stringify({ action, key, tipo, forcar }),
    });
    if (r.status === 409) {
      const data = await r.json();
      setConflito({ action, key, tipo, comQuem: data.conflito });
      return;
    }
    if (!r.ok) {
      toast.error('Não foi possível gravar o atalho');
      return;
    }
    toast.success('Atalho gravado');
    void carregar();
  }, [carregar]);

  // Gravação por teclado
  useEffect(() => {
    if (!gravando || gravando.tipo !== 'teclado') return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const combo = keyComboFromEvent(e);
      if (!combo || ['ctrl', 'alt', 'shift', 'meta'].includes(combo)) return;
      if (combo === 'escape') { setGravando(null); return; }
      setGravando(null);
      void salvar(gravando.action, combo, 'teclado');
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [gravando, salvar]);

  // Gravação por mouse
  useEffect(() => {
    if (!gravando || gravando.tipo !== 'mouse') return;
    const handler = (e: MouseEvent) => {
      const combo = mouseComboFromEvent(e);
      if (!combo) return; // clique esquerdo/direito/central não conta como atalho
      e.preventDefault();
      setGravando(null);
      void salvar(gravando.action, combo, 'mouse');
    };
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [gravando, salvar]);

  const limpar = useCallback(async (action: string) => {
    const r = await apiFetch(`/atalhos/${action}`, { method: 'DELETE' });
    if (r.ok) void carregar();
  }, [carregar]);

  const restaurarPadrao = useCallback(async () => {
    const r = await apiFetch('/atalhos/restaurar-padrao', { method: 'POST' });
    if (r.ok) {
      toast.success('Atalhos restaurados para o padrão');
      void carregar();
    }
  }, [carregar]);

  const acoesJaConfiguradas = new Set(atalhosSalvos.map((a) => a.action));
  const acoesSemAtalho = acoesDisponiveis.filter((a) => !acoesJaConfiguradas.has(a.action));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Keyboard className="w-4 h-4 text-primary" /> Atalhos Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Clique em um atalho e pressione a combinação de teclado desejada, ou
            clique num botão extra do mouse. Cada usuário tem seus próprios atalhos.
          </p>

          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && atalhosSalvos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum atalho configurado ainda.</p>
            )}
            {atalhosSalvos.map((a) => {
              const acao = acoesDisponiveis.find((x) => x.action === a.action);
              return (
                <div key={a.action} className="flex items-center gap-3">
                  <span className="text-sm text-foreground flex-1 min-w-0">
                    {acao?.label ?? a.action}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setGravando({ action: a.action, tipo: a.tipo })}
                      className={[
                        'min-w-[130px] px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-all text-left flex items-center gap-1.5',
                        gravando?.action === a.action
                          ? 'border-primary bg-primary/20 text-primary ring-1 ring-primary/40 animate-pulse'
                          : 'border-border bg-background text-foreground hover:border-primary/50',
                      ].join(' ')}
                    >
                      {a.tipo === 'mouse' ? <Mouse className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
                      {gravando?.action === a.action ? 'pressione...' : displayCombo(a.key, a.tipo)}
                    </button>
                    <button
                      onClick={() => void limpar(a.action)}
                      className="p-1 rounded text-muted-foreground/50 hover:text-destructive transition-colors"
                      title="Remover atalho"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {acoesSemAtalho.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Select value={novaAcao} onValueChange={setNovaAcao}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Adicionar atalho para..." />
                </SelectTrigger>
                <SelectContent>
                  {acoesSemAtalho.map((a) => (
                    <SelectItem key={a.action} value={a.action}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline" size="sm" className="gap-1 text-xs"
                disabled={!novaAcao}
                onClick={() => {
                  if (!novaAcao) return;
                  setGravando({ action: novaAcao, tipo: 'teclado' });
                  setNovaAcao('');
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Teclado
              </Button>
              <Button
                variant="outline" size="sm" className="gap-1 text-xs"
                disabled={!novaAcao}
                onClick={() => {
                  if (!novaAcao) return;
                  setGravando({ action: novaAcao, tipo: 'mouse' });
                  setNovaAcao('');
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Mouse
              </Button>
            </div>
          )}

          <div className="pt-1">
            <Button variant="outline" size="sm" className="gap-2 text-xs border-border" onClick={() => void restaurarPadrao()}>
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!conflito} onOpenChange={(open) => { if (!open) setConflito(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Combinação já em uso</AlertDialogTitle>
            <AlertDialogDescription>
              {conflito && (
                <>
                  A combinação já está atribuída a{' '}
                  <strong>{acoesDisponiveis.find((a) => a.action === conflito.comQuem.action)?.label ?? conflito.comQuem.action}</strong>.
                  Quer substituir?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflito(null)}>Escolher outra</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conflito) void salvar(conflito.action, conflito.key, conflito.tipo, true);
                setConflito(null);
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Eye, EyeOff, Trash2, Plus, Loader2, KeyRound } from 'lucide-react';

function authHeaders(): HeadersInit {
  const token = window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const PROVIDER_LABEL: Record<string, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
};

interface AiKey {
  id: string;
  provider: string;
  enabled: boolean;
  preview: string;
  createdAt: string;
}

// Minha IA — chaves de provedor (22/08/2026) — pedido do Robson: o mesmo
// conceito que já existe no MIAR AI Pessoal (múltiplos provedores,
// editar/excluir/ligar), construído aqui dentro do Gestor, escopado por
// dono — cada gestor vê só as próprias chaves, o valor nunca volta pro
// navegador depois de salvo.
export default function MinhaIa() {
  const [keys, setKeys] = useState<AiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newProvider, setNewProvider] = useState('groq');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai-keys', { headers: authHeaders() });
      if (!response.ok) throw new Error('Não foi possível carregar suas chaves.');
      setKeys(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addKey = async () => {
    if (!newKeyValue.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/ai-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ provider: newProvider, key: newKeyValue.trim() }),
      });
      if (!response.ok) throw new Error('Não foi possível salvar a chave.');
      setNewKeyValue('');
      setNewKeyVisible(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (key: AiKey) => {
    await fetch(`/api/ai-keys/${key.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ enabled: !key.enabled }),
    });
    await load();
  };

  const removeKey = async (key: AiKey) => {
    await fetch(`/api/ai-keys/${key.id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-5 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/painel" className="text-sm text-slate-400 hover:text-slate-200">← Voltar</Link>

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><KeyRound size={24} /> Minha IA</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cadastra suas próprias chaves de provedor de IA. Só você vê o que está aqui.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-300">Adicionar chave nova</div>
          <div className="flex flex-wrap gap-2">
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            >
              {Object.entries(PROVIDER_LABEL).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[180px]">
              <input
                type={newKeyVisible ? 'text' : 'password'}
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="Cole a chave aqui"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-3 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setNewKeyVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                title={newKeyVisible ? 'esconder' : 'mostrar'}
              >
                {newKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void addKey()}
              disabled={saving || !newKeyValue.trim()}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Adicionar
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {loading && <div className="text-sm text-slate-500">Carregando...</div>}
          {!loading && keys.length === 0 && (
            <div className="text-sm text-slate-500">Nenhuma chave cadastrada ainda.</div>
          )}
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-200">{PROVIDER_LABEL[key.provider] ?? key.provider}</div>
                <div className="font-mono text-xs text-slate-500">{key.preview}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleEnabled(key)}
                  className={`rounded-lg px-2 py-1 text-xs ${key.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-700 text-slate-300'}`}
                >
                  {key.enabled ? 'ligada' : 'desligada'}
                </button>
                <button
                  type="button"
                  onClick={() => void removeKey(key)}
                  className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

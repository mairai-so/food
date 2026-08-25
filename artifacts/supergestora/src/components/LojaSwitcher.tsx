import { useEffect, useState } from "react";
import { Store, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { getLojaAtivaId, setLojaAtivaId, type Loja } from "@/lib/loja";

function getToken() {
  return window.localStorage.getItem("miar-owner-token")
    ?? window.sessionStorage.getItem("miar-owner-token")
    ?? "";
}

/**
 * Seletor de loja no topo do Gestor. Só aparece de verdade (com opção de
 * trocar) quando a conta tem mais de uma loja cadastrada — pra quem usa
 * loja única, fica invisível e não muda em nada o uso normal do app.
 */
export function LojaSwitcher({ compact = false }: { compact?: boolean }) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [modoNome, setModoNome] = useState<"automatico" | "filial" | "unidade" | "personalizado">("automatico");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const token = getToken();
      if (!token) {
        setLojas([]);
        return;
      }
      const r = await fetch("/api/lojas", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({})) as { error?: string };
        setErro(data.error ?? `Não foi possível carregar as lojas (HTTP ${r.status}).`);
        return;
      }
      const data: Loja[] = await r.json();
      setLojas(data.filter((loja) => loja.ativa));
      const atual = getLojaAtivaId();
      if (!atual && data.length > 0) setLojaAtivaId(data[0].id);
    } catch {
      setErro("Não foi possível conectar ao servidor para carregar as lojas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criarLoja() {
    const nome = modoNome === "personalizado" ? novoNome.trim() : "";
    if (modoNome === "personalizado" && !nome) {
      setErro("Digite o nome da loja.");
      return;
    }
    setErro("");
    try {
      const r = await fetch("/api/lojas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ nome, modoNome }),
      });
      const data = await r.json().catch(() => ({})) as Loja & { error?: string };
      if (!r.ok) {
        setErro(data.error ?? `Não foi possível criar a loja (HTTP ${r.status}).`);
        return;
      }
      setLojas((prev) => [...prev, data]);
      setLojaAtivaId(data.id);
      setNovoNome("");
      setModoNome("automatico");
      setCriando(false);
      setAberto(false);
      window.location.reload();
    } catch {
      setErro("Não foi possível conectar ao servidor para criar a loja.");
    }
  }

  async function editarLoja(loja: Loja) {
    const nome = window.prompt("Novo nome da loja:", loja.nome)?.trim();
    if (!nome || nome === loja.nome) return;
    const senhaMestra = window.prompt("Digite a senha mestra do Registro Protegido:");
    if (!senhaMestra) return;
    const r = await fetch(`/api/lojas/${encodeURIComponent(loja.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ nome, senhaMestra }),
    });
    const data = await r.json().catch(() => ({})) as Loja & { error?: string };
    if (!r.ok) { setErro(data.error ?? "Não foi possível editar a loja."); return; }
    await carregar();
  }

  async function excluirLoja(loja: Loja) {
    if (!window.confirm(`Excluir a loja ${loja.nome}? O histórico será preservado.`)) return;
    const senhaMestra = window.prompt("Digite a senha mestra do Registro Protegido:");
    if (!senhaMestra) return;
    const r = await fetch(`/api/lojas/${encodeURIComponent(loja.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ senhaMestra }),
    });
    const data = await r.json().catch(() => ({})) as { error?: string };
    if (!r.ok) { setErro(data.error ?? "Não foi possível excluir a loja."); return; }
    if (getLojaAtivaId() === loja.id) setLojaAtivaId("");
    await carregar();
  }

  function trocar(id: string) {
    setLojaAtivaId(id);
    setAberto(false);
    window.location.reload();
  }

  if (carregando) return null;
  if (!getToken()) return null;

  const ativaId = getLojaAtivaId();
  const ativa = lojas.find((l) => l.id === ativaId) ?? lojas[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={compact
          ? "flex h-8 max-w-32 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          : "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10"}
        title="Trocar loja deste painel"
      >
        <Store size={15} />
        <span className="truncate">{ativa?.nome ?? "Loja"}</span>
        <ChevronDown size={14} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#0d1b1a] p-2 shadow-xl">
          {erro && <p className="px-3 py-2 text-xs text-rose-300">{erro}</p>}

          {lojas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => trocar(l.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${l.id === ativaId ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}
            >
              <Store size={14} />
              <span className="flex-1">{l.nome}</span>
              {l.padrao && <span className="text-xs text-white/40">principal</span>}
              {!l.padrao && (
                <span className="ml-1 flex items-center gap-1">
                  <span role="button" tabIndex={0} title="Editar loja" onClick={(event) => { event.stopPropagation(); void editarLoja(l); }} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={13} /></span>
                  <span role="button" tabIndex={0} title="Excluir loja" onClick={(event) => { event.stopPropagation(); void excluirLoja(l); }} className="rounded p-1 text-rose-300/60 hover:bg-rose-500/10 hover:text-rose-200"><Trash2 size={13} /></span>
                </span>
              )}
            </button>
          ))}

          <div className="mt-2 border-t border-white/10 pt-2">
            {criando ? (
              <div className="space-y-2 px-1">
                <select value={modoNome} onChange={(e) => setModoNome(e.target.value as typeof modoNome)} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white">
                  <option value="automatico">Nome fantasia + número</option>
                  <option value="filial">Nome fantasia + Filial</option>
                  <option value="unidade">Nome fantasia + Unidade</option>
                  <option value="personalizado">Nome personalizado</option>
                </select>
                {modoNome === "personalizado" && <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void criarLoja(); }} placeholder="Nome da loja" className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/30" />}
                <button type="button" onClick={() => void criarLoja()} className="rounded-lg bg-emerald-500/80 px-2 py-1.5 text-xs font-semibold text-white">
                  Criar loja
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setErro(""); setCriando(true); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/5"
              >
                <Plus size={14} /> Nova loja
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

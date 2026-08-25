import { useCallback, useEffect, useState } from "react";
import { Keyboard, Mouse, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MobileLayout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";

type Tipo = "teclado" | "mouse";

type Atalho = {
  id: string;
  action: string;
  key: string;
  tipo: Tipo;
};

type Acao = {
  action: string;
  label: string;
};

type Conflict = {
  action: string;
  key: string;
  tipo: Tipo;
  comQuem: Atalho;
};

const MOUSE_BUTTON_LABELS: Record<number, string> = {
  3: "Botão lateral 1",
  4: "Botão lateral 2",
  5: "Botão lateral 3",
  6: "Botão lateral 4",
};

function token() {
  return localStorage.getItem("gestor_token") ?? localStorage.getItem("miar-owner-token") ?? "";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(options.headers ?? {}),
    },
  });
}

function keyboardCombo(event: KeyboardEvent) {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  const key = event.key.toLowerCase();
  if (!["control", "alt", "shift", "meta"].includes(key)) parts.push(key);
  return parts.join("+");
}

function displayCombo(atalho: Atalho) {
  if (atalho.tipo === "mouse") {
    return MOUSE_BUTTON_LABELS[Number(atalho.key.split(":")[1])] ?? atalho.key;
  }
  return atalho.key.toUpperCase();
}

export default function AtalhosPage() {
  const [atalhos, setAtalhos] = useState<Atalho[]>([]);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<{ action: string; tipo: Tipo } | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/atalhos");
      if (!response.ok) return;
      const data = await response.json();
      setAtalhos(data.atalhos ?? []);
      setAcoes(data.acoesDisponiveis ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (action: string, key: string, tipo: Tipo, forcar = false) => {
    const response = await apiFetch("/atalhos", {
      method: "POST",
      body: JSON.stringify({ action, key, tipo, forcar }),
    });
    if (response.status === 409) {
      const data = await response.json();
      setConflict({ action, key, tipo, comQuem: data.conflito });
      return;
    }
    if (!response.ok) {
      toast({ title: "Não foi possível gravar o atalho", variant: "destructive" });
      return;
    }
    toast({ title: "Atalho gravado" });
    void load();
  }, [load, toast]);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const combo = keyboardCombo(event);
      if (!combo || ["ctrl", "alt", "shift"].includes(combo)) return;
      if (combo === "escape") {
        setRecording(null);
        return;
      }
      const current = recording;
      setRecording(null);
      void save(current.action, combo, "teclado");
    };
    const onMouseDown = (event: MouseEvent) => {
      if (recording.tipo !== "mouse" || event.button < 3) return;
      event.preventDefault();
      const current = recording;
      setRecording(null);
      void save(current.action, `mouse:${event.button}`, "mouse");
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [recording, save]);

  const remove = async (action: string) => {
    const response = await apiFetch(`/atalhos/${action}`, { method: "DELETE" });
    if (response.ok) void load();
  };

  const restore = async () => {
    const response = await apiFetch("/atalhos/restaurar-padrao", { method: "POST" });
    if (response.ok) {
      toast({ title: "Atalhos restaurados para o padrão" });
      void load();
    }
  };

  const configured = new Set(atalhos.map((atalho) => atalho.action));
  const available = acoes.filter((acao) => !configured.has(acao.action));

  return (
    <MobileLayout>
      <div className="px-5 py-6 space-y-5">
        <header>
          <p className="text-primary text-xs font-extrabold uppercase tracking-[0.18em]">Configurações</p>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Atalhos inteligentes</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Ações rápidas para comandar sua operação.
          </p>
        </header>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent p-3 text-primary">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold">Seus atalhos</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Toque em uma combinação para gravar teclado ou use um botão lateral do mouse.
                </p>
              </div>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && atalhos.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhum atalho configurado ainda.
              </p>
            )}
            <div className="space-y-2">
              {atalhos.map((atalho) => {
                const acao = acoes.find((item) => item.action === atalho.action);
                const active = recording?.action === atalho.action;
                return (
                  <div key={atalho.action} className="flex items-center gap-2 rounded-xl border border-border p-3">
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate">
                      {acao?.label ?? atalho.action}
                    </span>
                    <Button
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="min-w-[112px] text-xs"
                      onClick={() => setRecording({ action: atalho.action, tipo: atalho.tipo })}
                    >
                      {active ? "Pressione..." : atalho.tipo === "mouse" ? <Mouse className="w-3.5 h-3.5 mr-1" /> : <Keyboard className="w-3.5 h-3.5 mr-1" />}
                      {active ? "" : displayCombo(atalho)}
                    </Button>
                    <button
                      className="p-2 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${acao?.label ?? atalho.action}`}
                      onClick={() => void remove(atalho.action)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {available.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs font-bold text-muted-foreground">Adicionar ação</p>
                <div className="grid grid-cols-1 gap-2">
                  {available.slice(0, 4).map((acao) => (
                    <div key={acao.action} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{acao.label}</span>
                      <Button variant="outline" size="sm" onClick={() => setRecording({ action: acao.action, tipo: "teclado" })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Teclado
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRecording({ action: acao.action, tipo: "mouse" })}>
                        <Mouse className="w-3.5 h-3.5 mr-1" /> Mouse
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => void restore()}>
              <RotateCcw className="w-4 h-4 mr-2" /> Restaurar padrão
            </Button>
          </CardContent>
        </Card>

        {conflict && (
          <Card className="border-primary bg-accent">
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-bold">Combinação já em uso</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Essa combinação está atribuída a{" "}
                  <strong>{acoes.find((acao) => acao.action === conflict.comQuem.action)?.label ?? conflict.comQuem.action}</strong>.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConflict(null)}>Escolher outra</Button>
                <Button className="flex-1" onClick={() => {
                  const current = conflict;
                  setConflict(null);
                  void save(current.action, current.key, current.tipo, true);
                }}>Substituir</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
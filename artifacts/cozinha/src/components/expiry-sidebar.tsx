import React, { useEffect, useRef } from 'react';
import { useGetExpiringItems, useGetKitchenSettings } from '../lib/kitchen-api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Volume2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useVoice } from '../hooks/use-voice';
import { playBeep, notifyBrowser } from '../lib/notifications';

export function ExpirySidebar() {
  const { data: items } = useGetExpiringItems({
    query: { refetchInterval: 60000 }
  });
  const { data: settings } = useGetKitchenSettings();
  const s = settings as any;
  const { speak } = useVoice();

  const hasAnnouncedOnLoad = useRef(false);

  useEffect(() => {
    if (items && settings && !hasAnnouncedOnLoad.current) {
      const criticalItems = items.filter(i => i.urgency === 'critical');
      const rate = s?.voiceSpeed ?? 1.0;
      const pitch = s?.voicePitch ?? 1.0;

      if (criticalItems.length > 0) {
        if (s?.browserNotifications && s?.browserNotifyOnExpiry) {
          notifyBrowser("Vencimento Crítico", {
            body: criticalItems.map(i => `${i.name} (${i.daysUntilExpiry === 0 ? 'Hoje' : 'Amanhã'})`).join('\n')
          });
        }
        if (s?.soundOnExpiry) {
          playBeep('expiry');
        }
      }

      if (settings.announceExpiryOnOpen || settings.autoAnnounceExpiry) {
        if (criticalItems.length > 0) {
          const text = `Atenção. ${criticalItems.length} itens com vencimento crítico: ` +
            criticalItems.map(i => `${i.name}, vence ${i.daysUntilExpiry === 0 ? 'hoje' : 'amanhã'}`).join(', ');
          speak(text, rate, pitch);
        } else if (settings.announceExpiryOnOpen && items.length > 0) {
          speak(`Você tem ${items.length} itens próximos do vencimento.`, rate, pitch);
        }
      }
      hasAnnouncedOnLoad.current = true;
    }
  }, [items, settings, speak, s]);

  const handleReadAlerts = (type: 'critical' | 'all') => {
    const rate = s?.voiceSpeed ?? 1.0;
    const pitch = s?.voicePitch ?? 1.0;

    if (!items || items.length === 0) {
      speak("Não há itens próximos do vencimento.", rate, pitch);
      return;
    }

    const critical = items.filter(i => i.urgency === 'critical');
    const warning = items.filter(i => i.urgency === 'warning');

    if (type === 'critical') {
      if (critical.length === 0) {
        speak("Não há itens com vencimento crítico.", rate, pitch);
      } else {
        speak(`${critical.length} itens críticos: ` + critical.map(i => i.name).join(', ') + ".", rate, pitch);
      }
      return;
    }

    let text = "";
    if (critical.length > 0) {
      text += `${critical.length} itens críticos: ` + critical.map(i => i.name).join(', ') + ". ";
    }
    if (warning.length > 0) {
      text += `${warning.length} itens em alerta: ` + warning.map(i => i.name).join(', ') + ".";
    }

    speak(text || `Há ${items.length} itens para observação.`, rate, pitch);
  };

  if (!items) return null;

  // Sort: critical first, then warning, then notice
  const sortedItems = [...items].sort((a, b) => {
    const weights = { critical: 0, warning: 1, notice: 2 };
    return weights[a.urgency] - weights[b.urgency] || a.daysUntilExpiry - b.daysUntilExpiry;
  });

  return (
    <Card className="h-full flex flex-col border-0 rounded-none border-l bg-sidebar">
      <CardHeader className="py-4 px-4 border-b bg-sidebar shrink-0 flex flex-col justify-center space-y-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
          Vencimentos
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleReadAlerts('critical')} className="flex-1 h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-white">
            <Volume2 className="w-3 h-3 mr-1" /> Críticos
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleReadAlerts('all')} className="flex-1 h-8 text-xs">
            <Volume2 className="w-3 h-3 mr-1" /> Todos
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-3">
          {sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tudo em dia.</p>
          ) : (
            sortedItems.map(item => (
              <div key={item.id} className="bg-card border rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-sm leading-tight">{item.name}</span>
                  <Badge variant={
                    item.urgency === 'critical' ? 'destructive' :
                    item.urgency === 'warning' ? 'warning' : 'secondary'
                  } className="text-[10px] px-1.5 py-0">
                    {item.daysUntilExpiry === 0 ? 'HOJE' : `${item.daysUntilExpiry}d`}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                  <span>{item.quantity} {item.unit}</span>
                  <span>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '—'}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

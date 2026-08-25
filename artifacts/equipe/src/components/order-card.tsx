import React, { useEffect, useRef, useState } from 'react';
import { KitchenOrder } from '../lib/kitchen-api';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { AlertTriangle, Clock, Volume2, ArrowRight, Copy, Check } from 'lucide-react';
import { useElapsedTime } from '../hooks/use-local-timers';
import { useVoice } from '../hooks/use-voice';
import { useGetKitchenSettings } from '../lib/kitchen-api';

interface OrderCardProps {
  order: KitchenOrder;
  onNextStatus?: (id: string, currentStatus: string) => void;
  startTime: number | null;
}

export function OrderCard({ order, onNextStatus, startTime }: OrderCardProps) {
  const { speak } = useVoice();
  const { data: settings } = useGetKitchenSettings();
  const s = settings as any;
  const elapsedSeconds = useElapsedTime(startTime);

  const estimatedMinutes = order.estimatedMinutes ?? 0;
  const estimatedSeconds = estimatedMinutes * 60;
  const isOverdue = elapsedSeconds > estimatedSeconds;

  const burnAlertEnabled = s?.burnAlertEnabled ?? false;
  const burnAlertMinutesOver = s?.burnAlertMinutesOver ?? 5;
  const rate = s?.voiceSpeed ?? 1.0;
  const pitch = s?.voicePitch ?? 1.0;
  const showCopyButton = s?.showCopyButton ?? false;

  const isCriticalOverdue = elapsedSeconds > (estimatedSeconds + (burnAlertMinutesOver * 60));

  const announcedCritical = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (burnAlertEnabled && isCriticalOverdue && !announcedCritical.current && order.status === 'preparing') {
      const itemsText = order.items.map(i => i.name).join(', ');
      speak(`Atenção! Mesa ${order.tableNumber}, ${itemsText}, pode estar passando do ponto!`, rate, pitch);
      announcedCritical.current = true;
    }
  }, [burnAlertEnabled, isCriticalOverdue, order.status, order.tableNumber, order.items, speak, rate, pitch]);

  const handleReadOrder = () => {
    let text = `Mesa ${order.tableNumber}. `;
    text += order.items.map(item => `${item.quantity} ${item.name}${item.notes ? ` com ${item.notes}` : ''}`).join(', ');
    if (order.customerAllergies && order.customerAllergies.length > 0) {
      text += `. Alergias: ${order.customerAllergies.join(', ')}`;
    }
    speak(text, rate, pitch);
  };

  const handleCopy = () => {
    let text = `Mesa ${order.tableNumber}${order.isPriority ? ' — URGENTE' : ''}\n`;
    text += `Pedido: ${order.items.map(item => `${item.quantity}x ${item.name}${item.notes ? ` (${item.notes})` : ''}`).join(', ')}\n`;
    if (order.customerAllergies && order.customerAllergies.length > 0) {
      text += `Alergias: ${order.customerAllergies.join(', ')}\n`;
    }
    if (order.customerPreferences) {
      text += `Preferências: ${order.customerPreferences}\n`;
    }
    text += `Tempo estimado: ${order.estimatedMinutes ?? 0} min`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nextStatusLabel = order.status === 'pending' ? 'Preparar' : order.status === 'preparing' ? 'Pronto' : null;

  return (
    <Card className={`relative overflow-hidden border-l-4 transition-colors ${
      order.isPriority ? 'border-l-destructive shadow-md shadow-destructive/20' :
      isOverdue && order.status === 'preparing' ? 'border-l-destructive' : 'border-l-primary'
    }`}>
      {order.isPriority && (
        <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
          Prioridade
        </div>
      )}

      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-start justify-between space-y-0 gap-2">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Mesa</span>
          <span className="text-4xl font-black leading-none font-mono tracking-tighter">{order.tableNumber}</span>
        </div>

        <div className="flex flex-col items-end gap-2">
          {order.status === 'preparing' && (
            <Badge variant={isOverdue ? "urgent" : "secondary"} className="text-base py-1 px-2 font-mono flex gap-1 items-center">
              <Clock className="w-4 h-4" />
              {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:
              {(elapsedSeconds % 60).toString().padStart(2, '0')}
            </Badge>
          )}

          <div className="flex gap-1">
            {showCopyButton && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            )}
            {settings?.announceOnButton && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleReadOrder}>
                <Volume2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-2 space-y-3">
        {order.customerAllergies && order.customerAllergies.length > 0 && (
          <div className="bg-destructive/15 border border-destructive/30 rounded-md p-2 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-xs font-bold text-destructive uppercase tracking-wider">Alergias</p>
              <p className="text-sm font-bold text-destructive-foreground dark:text-red-400">
                {order.customerAllergies.join(', ')}
              </p>
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={item.id || idx} className="flex flex-col">
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-lg bg-secondary text-secondary-foreground rounded px-2 min-w-[2rem] text-center">
                  {item.quantity}
                </span>
                <span className="font-semibold text-lg leading-tight mt-0.5">{item.name}</span>
              </div>
              {item.notes && (
                <span className="text-sm text-muted-foreground pl-10 mt-1 font-medium italic">
                  obs: {item.notes}
                </span>
              )}
            </li>
          ))}
        </ul>

        {order.customerPreferences && (
          <div className="bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 rounded-md p-2 mt-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase tracking-wider mb-1">Preferências</p>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-400">"{order.customerPreferences}"</p>
          </div>
        )}
      </CardContent>

      {nextStatusLabel && onNextStatus && (
        <CardFooter className="p-0 mt-2">
          <Button
            className="w-full h-14 rounded-none rounded-b-lg font-bold text-lg flex items-center justify-between px-6"
            variant={order.status === 'pending' ? 'default' : 'success'}
            onClick={() => onNextStatus(order.id, order.status)}
          >
            {nextStatusLabel}
            <ArrowRight className="w-5 h-5" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

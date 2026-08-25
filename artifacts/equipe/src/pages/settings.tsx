import React from 'react';
import { useGetKitchenSettings, useUpdateKitchenSettings } from '../lib/kitchen-api';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { Input } from '../components/ui/input';
import { ArrowLeft, Settings as SettingsIcon, Volume2, AlertCircle, BellRing, Eye, Laptop, Mic, Clock, Monitor } from 'lucide-react';
import { Link } from 'wouter';
import { useVoice } from '../hooks/use-voice';

// Helper component for toggle rows
const TRow = ({ title, desc, checked, onChange, disabled = false, warning = false }: any) => (
  <div className={`flex items-center justify-between p-4 bg-muted/50 rounded-xl transition-colors ${disabled ? 'opacity-50' : 'hover:bg-muted cursor-pointer'}`} onClick={() => !disabled && onChange(!checked)}>
    <div className="space-y-1.5 pr-6">
      <Label className={`text-base font-bold cursor-pointer ${warning ? 'text-destructive' : ''}`}>{title}</Label>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="scale-125 origin-right" />
  </div>
);

export default function Settings() {
  const { data: settings, isLoading } = useGetKitchenSettings();
  const { mutate: updateSettings } = useUpdateKitchenSettings();
  const { availableVoices, speak } = useVoice();

  if (isLoading || !settings) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <span className="text-xl font-mono text-muted-foreground animate-pulse">CARREGANDO CONFIGURAÇÕES...</span>
      </div>
    );
  }

  const s = settings as any; // Allow extended fields gracefully

  const handleToggle = (key: string, value: any) => {
    updateSettings({
      data: {
        [key]: value
      }
    });

    if (key === 'browserNotifications' && value === true) {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  };

  const activeVoiceName = availableVoices.find(v =>
    v.lang === 'pt-BR' && (
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('luciana') ||
      v.name.toLowerCase().includes('maria') ||
      v.name.toLowerCase().includes('zira') ||
      v.name.toLowerCase().includes('vitoria') ||
      v.name.toLowerCase().includes('mulher')
    )
  )?.name || availableVoices.find(v => v.lang === 'pt-BR')?.name || 'Sistema Padrão';

  return (
    <div className="min-h-screen bg-muted/30 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        <header className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-primary" />
              Configurações
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Ajuste todos os aspectos do comando da cozinha</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-primary" />
                Anúncio de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TRow title="Anunciar pedidos automaticamente" desc="O assistente lê novos pedidos." checked={s.autoAnnounceOrders ?? true} onChange={(c: boolean) => handleToggle('autoAnnounceOrders', c)} />
              <TRow title="Somente pedidos com alergias" desc="Limita o anúncio automático a restrições." checked={s.announceAllergiesOnly ?? false} warning={true} onChange={(c: boolean) => handleToggle('announceAllergiesOnly', c)} />
              <TRow title="Botão de ouvir em cada pedido" desc="Exibe botão 🔊 no cartão." checked={s.announceOnButton ?? true} onChange={(c: boolean) => handleToggle('announceOnButton', c)} />
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-amber-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Alerta de Vencimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TRow title="Vencimentos críticos ao abrir" desc="Lê itens em estado crítico no início." checked={s.autoAnnounceExpiry ?? true} onChange={(c: boolean) => handleToggle('autoAnnounceExpiry', c)} />
              <TRow title="Todos os vencimentos ao abrir" desc="Lê todos os itens do painel." checked={s.announceExpiryOnOpen ?? false} onChange={(c: boolean) => handleToggle('announceExpiryOnOpen', c)} />
              <TRow title="Botões de ouvir alertas" desc="Exibe botões no topo do painel." checked={s.announceExpiryOnButton ?? true} onChange={(c: boolean) => handleToggle('announceExpiryOnButton', c)} />
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                <BellRing className="w-5 h-5 text-blue-500" />
                Notificações Sonoras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TRow title="Som ao receber pedido" desc="Toca um bip ao chegar novo pedido." checked={s.soundOnNewOrder ?? true} onChange={(c: boolean) => handleToggle('soundOnNewOrder', c)} />
              <TRow title="Som de alerta para vencimentos" desc="Toca um alerta ao encontrar item crítico." checked={s.soundOnExpiry ?? true} onChange={(c: boolean) => handleToggle('soundOnExpiry', c)} />
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                <Laptop className="w-5 h-5 text-purple-500" />
                Notificações do Navegador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TRow title="Ativar notificações do navegador" desc="Permite alertas push." checked={s.browserNotifications ?? false} onChange={(c: boolean) => handleToggle('browserNotifications', c)} />
              <TRow title="Notificação ao receber pedido" desc="Aparece pop-up com o pedido." checked={s.browserNotifyOnOrder ?? true} disabled={!(s.browserNotifications ?? false)} onChange={(c: boolean) => handleToggle('browserNotifyOnOrder', c)} />
              <TRow title="Notificação para vencimentos" desc="Aparece pop-up para críticos." checked={s.browserNotifyOnExpiry ?? true} disabled={!(s.browserNotifications ?? false)} onChange={(c: boolean) => handleToggle('browserNotifyOnExpiry', c)} />
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-pink-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                <Mic className="w-5 h-5 text-pink-500" />
                Configurações de Voz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-2">
              <div className="space-y-4">
                <Label className="text-base font-bold">Velocidade da voz ({(s.voiceSpeed ?? 1.0).toFixed(1)}x)</Label>
                <Slider min={0.5} max={2.0} step={0.1} value={[s.voiceSpeed ?? 1.0]} onValueChange={v => handleToggle('voiceSpeed', v[0])} />
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Lenta</span><span>Normal</span><span>Rápida</span>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-bold">Tom da voz ({(s.voicePitch ?? 1.0).toFixed(1)}x)</Label>
                <Slider min={0.5} max={2.0} step={0.1} value={[s.voicePitch ?? 1.0]} onValueChange={v => handleToggle('voicePitch', v[0])} />
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Grave</span><span>Normal</span><span>Agudo</span>
                </div>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => speak("Testando configurações de voz da Cozinha Miar.", s.voiceSpeed ?? 1.0, s.voicePitch ?? 1.0)}>
                <Volume2 className="w-4 h-4 mr-2" /> Testar voz
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="border-t-4 border-t-red-600 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-600" />
                  Anti-Queimada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TRow title="Alerta de queimada por voz" desc="Avisa se passar do tempo." checked={s.burnAlertEnabled ?? true} onChange={(c: boolean) => handleToggle('burnAlertEnabled', c)} />
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl transition-colors">
                  <div className="space-y-1.5 pr-6">
                    <Label className="text-base font-bold">Minutos acima do estimado para alertar</Label>
                    <p className="text-sm text-muted-foreground">Tempo extra de tolerância.</p>
                  </div>
                  <Input
                    type="number" min={1} max={15}
                    className="w-20 text-center font-bold"
                    value={s.burnAlertMinutesOver ?? 5}
                    onChange={e => handleToggle('burnAlertMinutesOver', parseInt(e.target.value) || 5)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-indigo-500 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl uppercase tracking-wider flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-500" />
                  Interface e Visuais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TRow title="Piscar tela ao receber pedido" desc="A tela pisca rapidamente para chamar atenção." checked={s.flashOnNewOrder ?? true} onChange={(c: boolean) => handleToggle('flashOnNewOrder', c)} />
                <TRow title="Botão de copiar pedido" desc="Mostra botão para copiar texto do pedido." checked={s.showCopyButton ?? false} onChange={(c: boolean) => handleToggle('showCopyButton', c)} />
                <TRow title="Relógio no rodapé" desc="Exibe hora atual no rodapé do sistema." checked={s.showClock ?? true} onChange={(c: boolean) => handleToggle('showClock', c)} />
              </CardContent>
            </Card>
          </div>

        </div>

        <div className="text-center mt-12 space-y-2 pb-12">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Voz do Sistema (TTS)</p>
          <div className="inline-flex items-center justify-center bg-card border rounded-full px-6 py-2 shadow-sm">
            <span className="font-mono text-sm font-bold text-primary">{activeVoiceName}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useAuthGuard } from "@/hooks/use-auth";
import { useGetTables, useUpdateTableStatus, getGetTablesQueryKey } from "@workspace/api-client-react";
import { MobileLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Users, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const STATUS_CONFIG = {
  free: { label: "Livre", color: "success", icon: CheckCircle2 },
  occupied: { label: "Ocupada", color: "destructive", icon: Users },
  reserved: { label: "Reservada", color: "warning", icon: Clock },
  cleaning: { label: "Limpando", color: "secondary", icon: AlertCircle },
  paid: { label: "Paga", color: "outline", icon: CheckCircle2 },
};

export default function MesasPage() {
  const { me } = useAuthGuard();
  const { data: tables, isLoading } = useGetTables({
    query: { queryKey: getGetTablesQueryKey(), enabled: !!me, refetchInterval: 5000 }
  });
  const queryClient = useQueryClient();

  const updateStatus = useUpdateTableStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTablesQueryKey() });
      }
    }
  });

  return (
    <MobileLayout>
      <div className="px-5 py-6 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Monitor de mesas</h1>
          <p className="text-muted-foreground font-medium text-sm">
            Status atualizado periodicamente e ações rápidas
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {isLoading && <div className="animate-pulse h-24 bg-muted rounded-2xl" />}

          {tables?.length === 0 && (
            <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-2xl">
              <p className="text-muted-foreground font-bold">Nenhuma mesa configurada.</p>
            </div>
          )}

          {tables?.map((table) => {
            const config = STATUS_CONFIG[table.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.free;
            const Icon = config.icon;

            return (
              <Card key={table.id} className="overflow-hidden">
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-black text-xl text-foreground">
                        {table.number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">Mesa {table.number}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold">
                          {table.seats ?? 4} lugares
                        </p>
                      </div>
                    </div>
                    <Badge variant={config.color as any} className="px-3 py-1">
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>

                  {/* Actions based on status */}
                  <div className="flex gap-2">
                    {table.status === "free" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => updateStatus.mutate({ id: table.id, data: { status: "occupied" } })}
                          disabled={updateStatus.isPending}
                        >
                          Ocupar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => updateStatus.mutate({ id: table.id, data: { status: "reserved" } })}
                          disabled={updateStatus.isPending}
                        >
                          Reservar
                        </Button>
                      </>
                    )}
                    {table.status === "occupied" && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => updateStatus.mutate({ id: table.id, data: { status: "paid" } })}
                        disabled={updateStatus.isPending}
                      >
                        Marcar como Pago
                      </Button>
                    )}
                    {(table.status === "paid" || table.status === "reserved") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => updateStatus.mutate({ id: table.id, data: { status: "cleaning" } })}
                        disabled={updateStatus.isPending}
                      >
                        Limpar
                      </Button>
                    )}
                    {table.status === "cleaning" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        onClick={() => updateStatus.mutate({ id: table.id, data: { status: "free" } })}
                        disabled={updateStatus.isPending}
                      >
                        Liberar Mesa
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}

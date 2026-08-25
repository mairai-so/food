import { useAuthGuard } from "@/hooks/use-auth";
import { useGetDashboardStats, getDashboardStatsQueryKey } from "@workspace/api-client-react";
import { MobileLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, TrendingUp, Users, DollarSign, ChevronRight, UtensilsCrossed, Package, Star } from "lucide-react";
import { Link } from "wouter";
import { formatBRL } from "@/lib/currency";

export default function DashboardPage() {
  const { me, isLoading: meLoading } = useAuthGuard();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: {
      queryKey: getDashboardStatsQueryKey(),
      enabled: !!me,
      refetchInterval: 10000 // refresh every 10s for dense live feel
    }
  });

  if (meLoading) {
    return (
      <MobileLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-5 py-6 flex flex-col gap-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Olá, {me?.name?.split(' ')[0] || 'Gestor'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm">
              {me?.restaurantName || 'Seu Restaurante'}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
            <span className="text-primary font-bold text-lg">
              {me?.name?.charAt(0) || 'G'}
            </span>
          </div>
        </header>

        {/* Live Stats Board */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard
            title="Receita Hoje"
            value={statsLoading ? "..." : formatBRL(stats?.revenue || 0)}
            icon={<DollarSign className="w-5 h-5 text-green-500" />}
            trend={stats?.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}%` : '+0%'}
            highlight
          />
          <StatCard
            title="Mesas Ocupadas"
            value={statsLoading ? "..." : `${stats?.tablesOccupied || 0}/${(stats?.tablesOccupied || 0) + (stats?.tablesFree || 0)}`}
            icon={<Users className="w-5 h-5 text-blue-500" />}
          />
          <StatCard
            title="Pedidos Hoje"
            value={statsLoading ? "..." : stats?.ordersToday || 0}
            icon={<UtensilsCrossed className="w-5 h-5 text-orange-500" />}
          />
          <StatCard
            title="Ticket Médio"
            value={statsLoading ? "..." : formatBRL(stats?.avgTicket || 0)}
            icon={<Clock className="w-5 h-5 text-purple-500" />}
          />
        </section>

        {/* Quick Access */}
        <section className="mt-2">
          <h2 className="text-lg font-bold mb-4">Acesso Rápido</h2>
          <div className="flex flex-col gap-3">
            <QuickLink href="/mesas" icon={<Users />} label="Monitorar Mesas" subtitle="Status atualizado periodicamente" color="bg-blue-500/10 text-blue-600" />
            <QuickLink href="/pedidos" icon={<UtensilsCrossed />} label="Fila de Pedidos" subtitle="Cozinha e entregas" color="bg-orange-500/10 text-orange-600" />
            <QuickLink href="/estoque" icon={<Package />} label="Gestão de Estoque" subtitle="Itens baixos e inventário" color="bg-purple-500/10 text-purple-600" />
            <QuickLink href="/atalhos" icon={<Star />} label="Atalhos rápidos" subtitle="Personalize sua operação" color="bg-green-500/10 text-green-600" />
          </div>
        </section>
      </div>
    </MobileLayout>
  );
}

function StatCard({ title, value, icon, trend, highlight }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, highlight?: boolean }) {
  return (
    <Card className={`overflow-hidden ${highlight ? 'bg-primary text-primary-foreground border-primary' : ''}`}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className={`p-2 rounded-xl ${highlight ? 'bg-white/20' : 'bg-muted'}`}>
            {icon}
          </div>
          {trend && (
            <span className={`text-xs font-bold ${highlight ? 'text-primary-foreground/90' : 'text-green-600 flex items-center'}`}>
              <TrendingUp className="w-3 h-3 mr-1" />
              {trend}
            </span>
          )}
        </div>
        <div>
          <p className={`text-xs font-semibold ${highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{title}</p>
          <p className="text-2xl font-black mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, icon, label, subtitle, color }: { href: string, icon: React.ReactNode, label: string, subtitle: string, color: string }) {
  return (
    <Link href={href} className="block active:scale-[0.98] transition-transform">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

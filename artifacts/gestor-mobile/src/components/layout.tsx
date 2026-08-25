import { Link, useLocation } from "wouter";
import { Home, Grid2X2, ClipboardList, Package, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dash", icon: Home },
  { path: "/mesas", label: "Mesas", icon: Grid2X2 },
  { path: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { path: "/estoque", label: "Estoque", icon: Package },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 border-border pb-safe">
      <div className="flex h-16 items-center justify-around px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path} className="flex-1 flex flex-col items-center justify-center gap-1 h-full">
              <item.icon className={cn("w-6 h-6", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-semibold", isActive ? "text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link href="/configuracoes" className="flex-1 flex flex-col items-center justify-center gap-1 h-full">
          <Settings className={cn("w-6 h-6", location === "/configuracoes" || location === "/equipe" ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-semibold", location === "/configuracoes" || location === "/equipe" ? "text-primary" : "text-muted-foreground")}>
            Mais
          </span>
        </Link>
      </div>
    </div>
  );
}

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background flex flex-col relative shadow-2xl sm:border-x-2 border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] custom-scrollbar">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

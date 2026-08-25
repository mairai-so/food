import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  BrainCircuit,
  Sparkles,
  TrendingUp,
  QrCode,
  TabletSmartphone,
  ArrowRight,
  CheckCircle2,
  PackageSearch,
  Coins,
  Pizza,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

// Landing de apresentacao do MIAR AI/FOOD.
// Autossuficiente: nao depende de imagens externas nem de variantes de botao
// que nao existem no gestor. Todo o visual vem de Tailwind + estilos inline.

const GRADIENT = 'linear-gradient(135deg, #0f766e 0%, #16a34a 35%, #f59e0b 100%)';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Miar Food</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#plataforma" className="hover:text-foreground transition-colors">Plataforma</a>
            <a href="#ia" className="hover:text-foreground transition-colors">Inteligência MIAR</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/painel" className="text-sm font-medium hover:text-primary transition-colors">
              Entrar
            </Link>
            <Link href="/painel">
              <Button size="sm" className="text-white border-0" style={{ background: GRADIENT }}>
                Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(60% 60% at 50% 0%, rgba(109,40,217,0.35), transparent 70%)' }}
        />
        <div className="container mx-auto px-4 relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="mr-2 h-4 w-4" />
              Gestão inteligente para restaurantes, delivery e food service
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              O sistema que faz o
              <span
                className="block bg-clip-text text-transparent"
                style={{ backgroundImage: GRADIENT }}
              >
                food work melhor
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Para quem quer vender mais, organizar melhor e dar ao cliente uma experiência rápida, bonita e inteligente.
              O MIAR Food une operação, IA e um painel pensado para computador, com foco em restaurante, balcão e delivery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/painel">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base text-white border-0" style={{ background: GRADIENT }}>
                  Ver painel de gestão
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/cliente">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-primary/30 hover:bg-primary/10">
                  Ver demo do cliente
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div
              className="rounded-[2rem] border border-white/10 shadow-2xl w-full aspect-[4/3] flex items-center justify-center p-6"
              style={{ background: GRADIENT }}
            >
              <div className="w-full max-w-xl rounded-[1.5rem] border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-white/80">Painel gestor</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">MIAR Food</h3>
                  </div>
                  <div className="rounded-2xl bg-white/20 p-3 text-white">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/20 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/70">Ticket médio</p>
                    <p className="mt-2 text-2xl font-semibold">R$ 84</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/20 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/70">Pedidos hoje</p>
                    <p className="mt-2 text-2xl font-semibold">+128</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 bg-card/90 backdrop-blur border border-border rounded-xl p-4 flex items-center gap-4 w-72 shadow-xl">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Crédito teste</p>
                <p className="text-xl font-bold text-foreground">R$ 250,00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="plataforma" className="py-24 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Poder de nível Enterprise, interface feita para o Brasil</h2>
            <p className="text-muted-foreground">
              Tudo o que você precisa para operar com excelência, vender mais e impressionar o cliente sem complicação.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group">
              <QrCode className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Cardápio digital para o cliente</h3>
              <p className="text-muted-foreground">Pedidos rápidos, pedidos claros, pagamentos simples e uma jornada que faz o cliente voltar.</p>
            </div>
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group">
              <TabletSmartphone className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Operação em tempo real</h3>
              <p className="text-muted-foreground">Cozinha, caixa e entregas conectados, com visão do que está acontecendo agora mesmo.</p>
            </div>
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group">
              <PackageSearch className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Gestão de crédito e estoque</h3>
              <p className="text-muted-foreground">O sistema simula crédito de teste e ajuda a controlar estoque, consumo e margem sem complicação.</p>
            </div>
          </div>
        </div>
      </section>

      {/* IA */}
      <section id="ia" className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div
                className="rounded-2xl border border-white/10 shadow-2xl h-[420px] w-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #6d28d9 100%)' }}
              >
                <div className="bg-card/90 backdrop-blur p-6 rounded-xl w-72 border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <BrainCircuit className="h-6 w-6 text-primary" />
                    <h4 className="font-bold">Insight MIAR</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    A demanda por "Mule de Frutas Vermelhas" subirá 40% esta noite devido à temperatura de 28°C.
                  </p>
                  <div className="bg-primary/10 border border-primary/30 rounded p-3">
                    <p className="text-xs text-primary font-medium">Ação recomendada:</p>
                    <p className="text-sm text-foreground">Aumentar estoque de vodka e gelo.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <BrainCircuit className="mr-2 h-4 w-4" />
                Exclusividade: MIAR AI
              </div>
              <h2 className="text-4xl font-bold">Mais inteligência, menos improviso.</h2>
              <p className="text-lg text-muted-foreground">
                A MIAR Food não apenas mostra números. Ela entende o contexto do seu negócio e sugere ações precisas para vender melhor.
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block text-foreground">Previsão de Demanda</strong>
                    <span className="text-muted-foreground">Saiba o que vai vender antes mesmo de abrir as portas.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block text-foreground">Sugestão de Combos</strong>
                    <span className="text-muted-foreground">IA analisa o padrão de consumo e cria combos que aumentam o ticket médio.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block text-foreground">Análise de Ruído</strong>
                    <span className="text-muted-foreground">Identifica gargalos na operação que atrasam a entrega.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Comece com um plano pensado para o seu modelo</h2>
            <p className="text-muted-foreground">Seu teste pode começar com crédito fictício, operação simples e expansão para delivery, balcão e cozinha — tudo pensado para validar a ideia com um cliente real.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-background rounded-3xl p-8 border border-border flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Essencial</h3>
              <p className="text-muted-foreground mb-6">Operação base organizada</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">R$ 100</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Cardápio Digital & QR Code</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Pedidos pelo Celular</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Organização KDS Base</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Cadastro de Produtos</span></li>
              </ul>
              <Link href="/painel" className="w-full">
                <Button variant="outline" className="w-full">Escolher Essencial</Button>
              </Link>
            </div>

            <div className="bg-background rounded-3xl p-8 border-2 border-primary flex flex-col relative transform md:-translate-y-4 shadow-xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold tracking-wide">
                MAIS ESCOLHIDO
              </div>
              <h3 className="text-2xl font-bold mb-2">Inteligente IA</h3>
              <p className="text-muted-foreground mb-6">O poder do MIAR IA</p>
              <div className="mb-2">
                <span className="text-4xl font-bold">R$ 200</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <div className="inline-flex mb-6 items-center px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                1º MÊS GRÁTIS
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> <span className="text-sm font-medium">Tudo do Essencial</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> <span className="text-sm">Inteligência MIAR (Sugestões)</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> <span className="text-sm">Previsão de Demanda Base</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> <span className="text-sm">Análise do Cardápio</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> <span className="text-sm">Estoque Inteligente</span></li>
              </ul>
              <Link href="/painel" className="w-full">
                <Button className="w-full text-white border-0" style={{ background: GRADIENT }}>Começar Trial Grátis</Button>
              </Link>
            </div>

            <div className="bg-background rounded-3xl p-8 border border-border flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Premium</h3>
              <p className="text-muted-foreground mb-6">Controle absoluto e KPIs</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">R$ 300</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm font-medium">Tudo do Inteligente IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Recursos Avançados de IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Análise Operacional Completa</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Gestão Avançada de KPIs</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /> <span className="text-sm">Automações Personalizadas</span></li>
              </ul>
              <Link href="/painel" className="w-full">
                <Button variant="outline" className="w-full">Escolher Premium</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-background py-12 border-t border-border">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight text-muted-foreground">Miar Food</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 MIAR. Uma experiência de food service mais inteligente para o Brasil.</p>
        </div>
      </footer>
    </div>
  );
}

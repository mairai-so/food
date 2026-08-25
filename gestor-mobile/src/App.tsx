import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { IdiomaProvider } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';

import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import MesasPage from '@/pages/mesas';
import AtalhosPage from '@/pages/atalhos';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/mesas" component={MesasPage} />
      <Route path="/atalhos" component={AtalhosPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
          <ConfigFlutuante />
        </TooltipProvider>
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;

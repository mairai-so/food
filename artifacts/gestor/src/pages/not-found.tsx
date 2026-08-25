import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      <Card className="w-full max-w-md mx-4 bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <h1 className="text-2xl font-bold text-slate-100">
              404 — Página não encontrada
            </h1>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Esta página não existe. Verifique o endereço ou volte ao painel.
          </p>
          {/* Corrigido (20/08/2026): o texto acima já prometia "volte ao
              painel" mas não existia link nenhum pra clicar — usuário
              ficava preso na tela 404 sem saída. */}
          <Link href="/painel" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300">
            ← Voltar ao painel
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

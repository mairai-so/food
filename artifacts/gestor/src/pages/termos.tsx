import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"><ArrowLeft size={16} /> Voltar</Link>
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Rascunho para revisão jurídica</p>
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-slate-400">Última atualização: 22 de agosto de 2026</p>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Este texto é um modelo básico e não constitui aconselhamento jurídico. Deve ser revisado e aprovado por advogado antes do lançamento comercial.</p>
        </header>
        <section className="space-y-5 text-sm leading-7 text-slate-300">
          <div><h2 className="text-lg font-semibold text-slate-100">1. Objeto</h2><p>O MIAR AI/FOOD oferece ferramentas para gestão de estabelecimentos de alimentação, incluindo cadastro, catálogo, pedidos, operação de caixa, cozinha, atendimento e entrega.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">2. Cadastro e responsabilidade</h2><p>O responsável deve fornecer informações verdadeiras, manter seus dados atualizados e proteger suas credenciais. Cada estabelecimento responde pelo uso da plataforma por sua equipe e pelos dados inseridos.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">3. Uso aceitável</h2><p>É proibido usar o serviço para atividades ilícitas, fraude, tentativa de acesso não autorizado, envio de conteúdo malicioso ou violação de direitos de terceiros.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">4. Disponibilidade e pagamentos</h2><p>O serviço pode passar por manutenção ou indisponibilidade. Funcionalidades e meios de pagamento disponíveis são os informados no produto e no estabelecimento, sem promessa de processamento quando o recurso não estiver habilitado.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">5. Dados pessoais</h2><p>O tratamento de dados pessoais segue a <Link href="/privacidade" className="text-emerald-400 hover:underline">Política de Privacidade</Link>. O estabelecimento deve ter base legal e orientar seus clientes quando inserir dados na plataforma.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">6. Encerramento e contato</h2><p>O acesso pode ser suspenso em caso de uso indevido ou risco à segurança. Solicitações e dúvidas devem ser encaminhadas pelos canais oficiais informados no contrato ou no painel.</p></div>
        </section>
      </article>
    </main>
  );
}
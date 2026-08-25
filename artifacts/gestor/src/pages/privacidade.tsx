import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"><ArrowLeft size={16} /> Voltar</Link>
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Rascunho para revisão jurídica</p>
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-slate-400">Última atualização: 22 de agosto de 2026</p>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Este texto é um modelo básico de referência à LGPD e não constitui aconselhamento jurídico. Deve ser revisado e aprovado por advogado antes do lançamento comercial.</p>
        </header>
        <section className="space-y-5 text-sm leading-7 text-slate-300">
          <div><h2 className="text-lg font-semibold text-slate-100">1. Dados tratados</h2><p>Podemos tratar nome, CPF, telefone, e-mail, endereço, placa de veículo, dados do estabelecimento, registros de pedidos e informações de acesso necessárias à operação.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">2. Finalidades e bases legais</h2><p>Os dados são usados para criar e proteger contas, operar pedidos e entregas, prestar suporte, cumprir obrigações legais e melhorar o serviço, conforme a finalidade e a base legal aplicável previstas na LGPD.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">3. Compartilhamento</h2><p>Os dados podem ser compartilhados com fornecedores necessários à hospedagem, comunicação, pagamentos e suporte, sempre dentro da finalidade do serviço e com medidas de segurança adequadas.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">4. Retenção e segurança</h2><p>Conservamos os dados pelo tempo necessário às finalidades informadas e às obrigações legais. Adotamos controles técnicos e administrativos, mas nenhum sistema conectado à internet elimina todos os riscos.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">5. Direitos do titular</h2><p>O titular pode solicitar confirmação, acesso, correção, anonimização, eliminação quando cabível, informação sobre compartilhamentos e demais direitos previstos no art. 18 da LGPD, mediante solicitação ao canal oficial de privacidade.</p></div>
          <div><h2 className="text-lg font-semibold text-slate-100">6. Controlador e contato</h2><p>A identificação do controlador, o canal oficial de privacidade e o encarregado devem ser preenchidos antes da publicação definitiva desta política.</p></div>
        </section>
      </article>
    </main>
  );
}
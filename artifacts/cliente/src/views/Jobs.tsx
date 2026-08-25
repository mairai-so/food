import { BriefcaseBusiness, ChevronLeft } from 'lucide-react';

export default function Jobs({ onBack }: { onBack: () => void }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-24 text-slate-100">
      <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label="Voltar">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <BriefcaseBusiness className="h-5 w-5 text-amber-400" />
        <h1 className="font-semibold">Mural de empregos</h1>
      </header>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <BriefcaseBusiness className="mx-auto mb-3 h-8 w-8 text-amber-400" />
        <h2 className="font-semibold">O mural está sendo preparado</h2>
        <p className="mt-2 text-sm text-slate-400">Ainda não há oportunidades publicadas para o ramo alimentício.</p>
      </section>
    </main>
  );
}

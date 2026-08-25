import { useEffect, useState } from 'react';
import { ChevronLeft, Flag, Loader2, Newspaper, X } from 'lucide-react';
import type { FeedPost, UserProfile } from '../types';
import { getColors } from './Home';
import { getClientToken } from '../lib/storage';

export default function Feed({ user, onRequireLogin, onBack }: {
  user: UserProfile | null;
  onRequireLogin: () => void;
  onBack: () => void;
}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingPost, setReportingPost] = useState<FeedPost | null>(null);
  const [reason, setReason] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSent, setReportSent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/feed')
      .then(response => response.ok ? response.json() : [])
      .then(data => setPosts(data as FeedPost[]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-24 text-slate-100">
      <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label="Voltar">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Newspaper className="h-5 w-5 text-emerald-400" />
        <h1 className="font-semibold">Feed</h1>
      </header>
      {loading && <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {!loading && posts.length === 0 && <p className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">Nenhuma publicação no momento.</p>}
      <div className="space-y-3">
        {posts.map(post => {
          const colors = getColors(post.segment);
          return (
            <article key={post.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${colors.light}`}>{post.emoji}</div>
                <div>
                  <p className={`text-xs font-semibold ${colors.accent}`}>{post.restaurantName}</p>
                  <h2 className="mt-1 text-sm font-semibold">{post.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{post.content}</p>
                  {post.mediaType === 'imagem' && post.mediaUrl && (
                    <img src={post.mediaUrl} alt={post.title} className="mt-2 w-full rounded-xl object-cover" style={{ maxHeight: 260 }} />
                  )}
                  {post.mediaType === 'video' && post.mediaUrl && (
                    <video src={post.mediaUrl} controls className="mt-2 w-full rounded-xl" style={{ maxHeight: 260 }} />
                  )}
                  {post.mediaType === 'publicidade' && (
                    <span className="mt-2 inline-block rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Publicidade</span>
                  )}
                  <p className="mt-2 text-xs text-slate-600">{new Date(post.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end border-t border-slate-800 pt-3">
                <button
                  onClick={() => {
                    if (user?.isGuest) { onRequireLogin(); return; }
                    setReportingPost(post); setReason(''); setReportError(''); setReportSent('');
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-300"
                  aria-label={`Denunciar publicação: ${post.title}`}
                >
                  <Flag className="h-3.5 w-3.5" /> Denunciar
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {reportingPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Denunciar publicação</h2>
              <button onClick={() => setReportingPost(null)} className="rounded-lg bg-slate-800 p-2" aria-label="Fechar denúncia">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-400">Informe o motivo para encaminhar esta publicação à análise.</p>
            <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4}
              placeholder="Descreva o motivo da denúncia..."
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
            {reportError && <p className="mt-2 text-sm text-red-400">{reportError}</p>}
            {reportSent && <p className="mt-2 text-sm text-emerald-400">{reportSent}</p>}
            <button disabled={!reason.trim() || sending || Boolean(reportSent)} onClick={async () => {
              const token = getClientToken();
              if (!token || !reportingPost) { onRequireLogin(); return; }
              setSending(true); setReportError('');
              try {
                const response = await fetch(`/api/feed/${reportingPost.id}/report`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ reason: reason.trim() }),
                });
                const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
                if (!response.ok) throw new Error(data.error ?? 'Não foi possível registrar a denúncia.');
                setReportSent(data.message ?? 'Denúncia registrada e encaminhada para análise.');
              } catch (error) {
                setReportError(error instanceof Error ? error.message : 'Não foi possível registrar a denúncia.');
              } finally { setSending(false); }
            }} className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {sending ? 'Enviando...' : 'Enviar denúncia'}
            </button>
          </div>
        </div>
      )}
      {user?.isGuest && <button onClick={onRequireLogin} className="mt-5 w-full rounded-xl border border-emerald-500/40 py-3 text-sm text-emerald-300">Entre para personalizar sua experiência</button>}
    </main>
  );
}

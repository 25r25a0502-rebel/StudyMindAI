import { create } from 'zustand';
import { useEffect } from 'react';

// ---- Toasts (replaces alert()) ----
export const useToast = create((set) => ({
  toasts: [],
  push: (msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  }
}));
export function Toaster() {
  const toasts = useToast(s => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`glass rounded-2xl px-4 py-3 text-sm shadow-xl border-l-4 ${t.kind === 'error' ? 'border-red-400' : t.kind === 'success' ? 'border-emerald-400' : 'border-cyan-400'}`}>
          {t.kind === 'error' ? '⛔ ' : t.kind === 'success' ? '✅ ' : 'ℹ️ '}{t.msg}
        </div>
      ))}
    </div>
  );
}

// ---- Consistent page header ----
export function PageHeader({ icon, title, sub, right }) {
  return (
    <div className="flex flex-wrap items-center gap-4 justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div><h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {sub && <p className="text-sm opacity-60 mt-0.5">{sub}</p>}</div>
      </div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}

// ---- Status pill (one style everywhere) ----
export function StatusPill({ status }) {
  const map = {
    ready: 'bg-emerald-500/15 text-emerald-300',
    failed: 'bg-red-500/15 text-red-300',
    uploading: 'bg-sky-500/15 text-sky-300',
    extracting: 'bg-amber-500/15 text-amber-300',
    embedding: 'bg-violet-500/15 text-violet-300'
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${map[status] || 'bg-white/10'}`}>{status}</span>;
}

// ---- Loading skeleton ----
export function Skeleton({ rows = 3 }) {
  return <div className="space-y-3" aria-label="loading">{Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="glass rounded-2xl p-5 shimmer"><div className="h-4 bg-white/10 rounded w-2/3" /><div className="h-3 bg-white/10 rounded w-1/3 mt-2" /></div>
  ))}</div>;
}

// ---- Empty state ----
export function EmptyState({ icon = '📭', title, hint, action }) {
  return <div className="glass rounded-3xl p-10 text-center">
    <p className="text-5xl">{icon}</p>
    <p className="font-bold mt-3">{title}</p>
    {hint && <p className="text-sm opacity-60 mt-1">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

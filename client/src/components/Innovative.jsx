import { useEffect, useRef, useState } from 'react';

// Lightweight neural-network particle canvas (no deps). Nodes drift, link when close, react to mouse.
export function NeuralCanvas({ density = 70 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, pts = [], raf, mouse = { x: -999, y: -999 };
    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      w = canvas.width = r.width; h = canvas.height = r.height;
      pts = Array.from({ length: density }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5
      }));
    };
    const move = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const step = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.hypot(dx, dy);
          if (d < 130) {
            ctx.strokeStyle = `rgba(139,92,246,${(1 - d / 130) * .35})`;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
        const md = Math.hypot(pts[i].x - mouse.x, pts[i].y - mouse.y);
        ctx.fillStyle = md < 120 ? '#22d3ee' : '#a78bfa';
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, md < 120 ? 2.6 : 1.6, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(step);
    };
    resize(); step();
    window.addEventListener('resize', resize);
    canvas.parentElement.addEventListener('mousemove', move);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [density]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60" aria-hidden="true" />;
}

// Mouse-parallax 3D tilt wrapper
export function MouseTilt({ children, max = 12, className = '' }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - .5) * -max;
    const ry = ((e.clientX - r.left) / r.width - .5) * max;
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = 'rotateX(0deg) rotateY(0deg)'; };
  return (
    <div className={`tilt-scene ${className}`} onMouseMove={onMove} onMouseLeave={reset}>
      <div ref={ref} className="tilt" style={{ transition: 'transform .15s ease-out' }}>{children}</div>
    </div>
  );
}

// Animated RAG pipeline visualizer — seminar-friendly
const STEPS = [
  ['📤 Upload', 'PDF/PPT/DOC/image → Storage'],
  ['🔍 Extract+OCR', 'pdf-parse · mammoth · tesseract'],
  ['🧩 Chunk+Embed', '~600 tokens · 1536-dim vectors'],
  ['🎯 Retrieve', 'pgvector cosine top-6 + rerank'],
  ['✨ Answer', 'Grounded + cited [pX] streaming']
];
export function Pipeline() {
  const [active, setActive] = useState(0);
  useEffect(() => { const t = setInterval(() => setActive(a => (a + 1) % STEPS.length), 1600); return () => clearInterval(t); }, []);
  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs tracking-widest uppercase opacity-60 mb-4">Live RAG pipeline — how your doc becomes answers</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STEPS.map(([t, d], i) => (
          <div key={t} className={`rounded-2xl p-4 border transition-all duration-500 ${i === active ? 'bg-violet-600/30 border-violet-400 shadow-[0_0_30px_-5px_rgba(139,92,246,.8)] scale-105' : i < active ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-white/5 border-white/10 opacity-70'}`}>
            <p className="font-bold text-sm">{t}</p><p className="text-[11px] opacity-70 mt-1">{d}</p>
            <p className="text-[11px] mt-2">{i < active ? '✅ done' : i === active ? '⚡ working…' : '· queued'}</p>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-pink-400 transition-all duration-500" style={{ width: `${((active + 1) / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}

// Animated count-up number
export function Counter({ to, suffix = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t0 = performance.now(), dur = 1200;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{n}{suffix}</span>;
}

// SVG progress ring (weekly goal / accuracy)
export function Ring({ pct, label }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} stroke="rgba(255,255,255,.12)" strokeWidth="8" fill="none" />
        <circle cx="38" cy="38" r={r} stroke="url(#g)" strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset 1s' }} />
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient></defs>
        <text x="38" y="43" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">{pct}%</text>
      </svg>
      <p className="text-sm opacity-70">{label}</p>
    </div>
  );
}

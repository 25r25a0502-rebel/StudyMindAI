import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, api } from './services/api.js';
import { Toaster, useToast, PageHeader, StatusPill, EmptyState } from './components/ui.jsx';
import { NeuralCanvas, MouseTilt, Counter, Ring } from './components/Innovative.jsx';
import { useTheme, THEMES } from './store/theme.js';
import Workspace from './pages/Workspace.jsx';
import Progress from './pages/Progress.jsx';

function useSession() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
const Guard = ({ session, children }) => session ? children : <Navigate to="/login" />;

function ThemePicker() {
  const theme = useTheme(s => s.theme);
  const setTheme = useTheme(s => s.setTheme);
  const [open, setOpen] = useState(false);
  const cur = THEMES.find(t => t.id === theme);
  return (
    <span className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="change background theme"
        className="glass flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold hover:scale-105 transition">
        <span className="w-4 h-4 rounded-full inline-block" style={{ background: cur.dot }} />🎨 {cur.name} ▾
      </button>
      {open && (
        <span className="absolute right-0 mt-2 w-64 glass rounded-2xl p-2 grid gap-1 z-30 bg-[#0b1026]/95">
          {THEMES.map(t => (
            <button key={t.id} onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs hover:bg-white/10 ${t.id === theme ? 'ring-1 ring-cyan-400' : ''}`}>
              <span className="w-6 h-6 rounded-full shrink-0" style={{ background: t.dot }} />
              <span><strong className="block text-sm">{t.id === theme ? '✓ ' : ''}{t.name}</strong><span className="opacity-60">{t.desc}</span></span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

export default function App() {
  const session = useSession();
  const theme = useTheme(s => s.theme);
  useEffect(() => { try { document.body.dataset.theme = theme; } catch {} }, [theme]);
  const light = theme === 'paper';
  return (
    <div className={`min-h-screen ${light ? 'text-slate-900' : 'text-slate-100'}`}>
      <div className="aurora"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /><div className="grid-overlay absolute inset-0" /></div>
      <nav className="sticky top-0 z-20 glass flex items-center gap-4 md:gap-6 px-4 md:px-6 py-3" aria-label="main">
        <Link to="/" className="font-black text-lg tracking-tight">🧠 StudyMind <span className="grad-text">AI</span></Link>
        <Link className="opacity-80 hover:opacity-100 hidden sm:inline" to="/dashboard">Dashboard</Link>
        <Link className="opacity-80 hover:opacity-100 hidden sm:inline" to="/library">Library</Link>
        <Link className="opacity-80 hover:opacity-100 hidden sm:inline" to="/progress">Progress</Link>
        <span className="ml-auto"><ThemePicker /></span>
        {session?.user?.email && <span className="text-xs px-2 py-1 rounded glass hidden md:inline">{session.user.email}</span>}
        {session ? <button onClick={() => supabase.auth.signOut()}>Logout</button> : <Link to="/login" className="btn-glow bg-violet-600 px-4 py-1.5 rounded-full text-sm">Login</Link>}
      </nav>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/dashboard" element={<Guard session={session}><Shell><Dashboard /></Shell></Guard>} />
        <Route path="/library" element={<Guard session={session}><Shell><Library /></Shell></Guard>} />
        <Route path="/doc/:id/*" element={<Guard session={session}><Shell><Workspace /></Shell></Guard>} />
        <Route path="/progress" element={<Guard session={session}><Shell><Progress /></Shell></Guard>} />
      </Routes>
      <Toaster />
      <footer className="text-center text-xs opacity-50 py-8">StudyMind AI · RAG-grounded learning · your docs never train models</footer>
    </div>
  );
}

function Shell({ children }) {
  const loc = useLocation();
  const links = [['/dashboard', '🏠', 'Dashboard'], ['/library', '📚', 'Library'], ['/progress', '📈', 'Progress']];
  const active = (p) => loc.pathname.startsWith(p) || (p === '/dashboard' && loc.pathname.startsWith('/doc'));
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex gap-6">
      <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0 glass rounded-3xl p-3 h-fit sticky top-20" aria-label="section">
        {links.map(([to, icon, label]) => (
          <Link key={to} to={to} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${active(to) ? 'bg-violet-600 btn-glow' : 'opacity-70 hover:opacity-100 hover:bg-white/5'}`}>
            <span>{icon}</span>{label}</Link>
        ))}
        <div className="mt-3 text-[11px] opacity-50 px-4">RAG-grounded · cited answers</div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Landing() {
  const features = [
    ['📄 Any document', 'PDF, PPT, DOC, TXT, scanned images with OCR → chunks → embeddings.'],
    ['💬 Grounded chat', 'Answers only from your doc, with page citations. No hallucinations.'],
    ['📝 Quizzes + Exams', 'MCQ, true/false, multi-answer, coding. 2, 6, 10-mark model answers.'],
    ['⚡ Flashcards 3D', 'Flip cards, known/review marking, spaced repetition.'],
    ['💻 Code in 6 langs', 'C, C++, Java, Python, JS, SQL with explanations + complexity.'],
    ['📊 Analytics', 'Accuracy trend, topic strength, weak-topic auto quizzes, streaks.']
  ];
  return (
    <main className="max-w-6xl mx-auto px-6">
      {/* HERO with neural canvas + mouse parallax */}
      <section className="relative rounded-3xl overflow-hidden mt-8 glass">
        <NeuralCanvas />
        <div className="relative grid lg:grid-cols-2 gap-10 items-center p-8 md:p-12">
          <div className="reveal">
            <p className="text-xs tracking-widest uppercase opacity-70">🧠 AI-Powered Document Understanding</p>
            <h1 className="text-5xl font-black leading-tight mt-3">Your notes,<br /><span className="grad-text">superhuman.</span></h1>
            <p className="mt-5 opacity-80 text-lg">Upload any study material. Watch it become citable chat, quizzes, flashcards and analytics — in seconds.</p>
            <div className="flex gap-3 mt-7 flex-wrap">
              <Link to="/dashboard" className="btn-glow shimmer bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 rounded-full font-semibold">Start learning free →</Link>
              <Link to="/library" className="glass px-6 py-3 rounded-full">▶ Watch demo library</Link>
            </div>
            <div className="flex gap-6 mt-8 text-2xl font-black">
              <span><Counter to={12} suffix="k+" /><small className="block text-xs font-normal opacity-60">chunks embedded</small></span>
              <span><Counter to={98} suffix="%" /><small className="block text-xs font-normal opacity-60">cited answers</small></span>
              <span><Counter to={6} suffix="" /><small className="block text-xs font-normal opacity-60">code languages</small></span>
            </div>
          </div>
          <MouseTilt max={14}>
            <div className="doc3d relative w-72 h-96 mx-auto">
              <div className="absolute inset-0 glass rounded-2xl float-slow p-6 doc-layer">
                <p className="text-xs opacity-60">📄 DBMS Notes.pdf</p>
                <p className="mt-3 text-lg font-bold leading-snug">Test your knowledge by writing quizzes</p>
                <div className="mt-4 text-xs bg-emerald-500/20 text-emerald-300 rounded px-2 py-1 inline-block">✓ Quiz 8/10</div>
                <div className="mt-2 text-xs bg-violet-500/20 text-violet-300 rounded px-2 py-1 inline-block">🔥 4-day streak</div>
              </div>
              <div className="absolute inset-0 glass rounded-2xl float-slower p-6 doc-layer-2 ml-8 mt-8">
                <p className="text-xs opacity-60">💻 Code practice</p>
                <p className="mt-3 text-lg font-bold leading-snug">Write code to improve tech skills</p>
                <div className="mt-4 text-xs bg-cyan-500/20 text-cyan-300 rounded px-2 py-1 inline-block">✓ Checked 9/10</div>
              </div>
            </div>
          </MouseTilt>
        </div>
        {/* trust marquee */}
        <div className="relative border-t border-white/10 py-3 overflow-hidden opacity-60 text-sm">
          <div className="marquee px-6"><span>🔒 RLS-secured per user</span><span>⚡ SSE streaming chat</span><span>🎯 pgvector cosine top-6</span><span>🧩 600-token chunks</span><span>📸 OCR fallback</span><span>✅ Zod-validated JSON</span><span>🔒 RLS-secured per user</span><span>⚡ SSE streaming chat</span><span>🎯 pgvector cosine top-6</span><span>🧩 600-token chunks</span><span>📸 OCR fallback</span><span>✅ Zod-validated JSON</span></div>
        </div>
      </section>

      {/* features */}
      <section className="grid md:grid-cols-3 gap-4 mt-6">
        {features.map(([t, d]) => (
          <MouseTilt key={t} max={8}><div className="glass rounded-2xl p-5 h-full">
            <p className="font-bold">{t}</p><p className="text-sm opacity-70 mt-1">{d}</p>
          </div></MouseTilt>
        ))}
      </section>

      {/* how it works */}
      <section className="glass rounded-3xl p-8 mt-6 grid md:grid-cols-3 gap-6 text-center">
        {[['1️⃣', 'Upload anything', 'Drop a PDF, slides, or a photo of handwritten notes.'], ['2️⃣', 'AI understands', 'Text extracted, chunked, embedded into your private vector space.'], ['3️⃣', 'Master it', 'Chat, quiz, revise — every answer traced to a page.']].map(([e, t, d]) => (
          <div key={t}><p className="text-4xl">{e}</p><p className="font-bold mt-2">{t}</p><p className="text-sm opacity-70">{d}</p></div>
        ))}
      </section>
    </main>
  );
}

function Auth({ mode }) {
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) nav('/dashboard');
        else setInfo('Account created! It needs email confirmation before first login — check your inbox, or turn OFF "Confirm email" in Supabase → Authentication → Providers → Email (recommended for local dev).');
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <main className="relative flex justify-center py-16 px-6 overflow-hidden">
      <div className="absolute inset-0"><NeuralCanvas density={40} /></div>
      <form onSubmit={submit} className="relative glass rounded-3xl p-8 w-full max-w-sm flex flex-col gap-3 reveal">
        <h2 className="text-2xl font-black">{mode === 'login' ? 'Welcome back 👋' : 'Join StudyMind 🚀'}</h2>
        <p className="text-sm opacity-60">Secure Supabase Auth with RLS.</p>
        {error && <p role="alert" className="text-sm bg-red-500/15 text-red-300 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="text-sm bg-emerald-500/15 text-emerald-300 rounded-xl px-3 py-2">{info}</p>}
        <input aria-label="email" className="bg-white/10 border border-white/10 p-2.5 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input aria-label="password" type="password" className="bg-white/10 border border-white/10 p-2.5 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        <button disabled={busy} className="btn-glow shimmer bg-gradient-to-r from-violet-600 to-cyan-500 p-2.5 rounded-xl font-semibold disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</button>
        <p className="text-sm text-center opacity-70">
          {mode === 'login'
            ? <>New here? <Link className="underline text-cyan-300" to="/signup">Create an account</Link></>
            : <>Already registered? <Link className="underline text-cyan-300" to="/login">Log in</Link></>}
        </p>
      </form>
    </main>
  );
}

function Dashboard() {
  const [docs, setDocs] = useState([]);
  useEffect(() => { api('/api/documents').then(r => setDocs(r.data)).catch(() => {}); }, []);
  return (
    <main className="max-w-6xl mx-auto p-6">
      <PageHeader icon="🏠" title="Good evening, Scholar" sub="One more quiz to beat your record — keep the streak alive."
        right={<div className="glass rounded-2xl p-3"><Ring pct={76} label="weekly goal" /></div>} />
      <div className="grid md:grid-cols-4 gap-4 mt-6">
        {[['📚 Documents', docs.length], ['🧪 Quizzes', <Counter key="q" to={5} />], ['🔥 Streak', '4d'], ['🎯 Avg score', <Counter key="s" to={76} suffix="%" />]].map(([k, v]) => (
          <div key={k} className="tilt glass rounded-2xl p-5 shimmer"><p className="text-sm opacity-60">{k}</p><p className="text-3xl font-black mt-1">{v}</p></div>
        ))}
      </div>
      <div className="glass rounded-3xl p-6 mt-6"><UploadBox onDone={(d) => setDocs([d, ...docs])} /></div>
      <h3 className="font-bold mt-6 mb-3">Continue learning →</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {docs.slice(0, 3).map(d => (
          <Link key={d.id} to={`/doc/${d.id}`} className="tilt glass rounded-2xl p-5 block">
            <p className="font-bold text-sm">{d.title}</p>
            <div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-full w-2/3 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full" /></div>
            <p className="text-xs opacity-60 mt-2">65% mastered · {d.status}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

const FORMATS = [['PDF', '.pdf'], ['PPT', '.pptx'], ['DOC', '.docx'], ['TXT', '.txt'], ['IMG', '.png']];
const STAGES = ['uploading', 'extracting', 'embedding', 'ready'];

export function UploadBox({ onDone }) {
  const [file, setFile] = useState(null); const [phase, setPhase] = useState('idle');
  const [pct, setPct] = useState(0); const [stage, setStage] = useState('uploading');
  const [drag, setDrag] = useState(false); const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState(''); const [title, setTitle] = useState('');
  const toast = (m, k) => useToast.getState().push(m, k);

  const pollUntilReady = async (id) => {
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const r = await api(`/api/documents/${id}`);
        setStage(r.data.status);
        if (r.data.status === 'ready') { onDone(r.data); toast('Document ready — start learning!', 'success'); setPhase('idle'); setFile(null); setPct(0); return; }
        if (r.data.status === 'failed') { onDone(r.data); toast(`Processing failed: ${r.data.error_message || 'unknown'}`, 'error'); setPhase('idle'); setFile(null); return; }
      } catch { /* keep polling */ }
    }
    setPhase('idle'); toast('Still processing — check Library in a bit', 'info');
  };

  const upload = async () => {
    if (!file || phase !== 'idle') return;
    setPhase('uploading'); setPct(0); setStage('uploading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData(); fd.append('file', file);
      const doc = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/documents/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round(100 * e.loaded / e.total)); };
        xhr.onload = () => { try { const j = JSON.parse(xhr.responseText); j.ok ? resolve(j.data) : reject(new Error(j.error)); } catch (e) { reject(e); } };
        xhr.onerror = () => reject(new Error('Upload failed — is the server running?'));
        xhr.send(fd);
      });
      setPhase('processing'); setStage('extracting');
      pollUntilReady(doc.id);
    } catch (e) { setPhase('idle'); toast(e.message, 'error'); }
  };

  const pasteText = async () => {
    if (paste.trim().length < 50 || phase !== 'idle') return;
    setPhase('processing'); setStage('extracting');
    try {
      const r = await api('/api/documents/text', { method: 'POST', body: JSON.stringify({ title: title || 'Pasted notes', text: paste }) });
      setPaste(''); setTitle(''); setShowPaste(false);
      pollUntilReady(r.data.id);
    } catch (e) { setPhase('idle'); toast(e.message, 'error'); }
  };

  const busy = phase !== 'idle';
  const fmt = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
  return (
    <div className={`rounded-3xl p-6 md:p-8 transition ${drag ? 'ring-2 ring-cyan-400 bg-cyan-400/5' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
      <div className="flex items-start gap-5 flex-wrap">
        <div className="w-16 h-20 rounded-xl bg-gradient-to-b from-white/15 to-white/5 border border-white/15 flex flex-col items-center justify-center shrink-0 float-slow" aria-hidden="true">
          <span className="text-2xl">📄</span><span className="text-[10px] font-black opacity-70 mt-1">{file ? file.name.split('.').pop().toUpperCase().slice(0, 4) : 'DOC'}</span>
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="font-black text-lg">Drop your study material here</p>
          <p className="text-xs opacity-60 mt-0.5">PDF · PPT · DOC · TXT · scanned images — max 20MB · OCR auto-fallback</p>
          <div className="flex gap-1.5 mt-2 flex-wrap">{FORMATS.map(([l]) => <span key={l} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 opacity-70">{l}</span>)}</div>
          <div className="flex gap-2 mt-4 flex-wrap items-center">
            <label className="glass px-4 py-2 rounded-full text-sm font-semibold cursor-pointer hover:scale-105 transition">
              📎 {file ? 'Change file' : 'Choose file'}
              <input type="file" className="hidden" aria-label="upload file" accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} />
            </label>
            <button onClick={() => setShowPaste(s => !s)} className="text-xs opacity-70 underline">or paste text instead</button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {file && <div className="flex items-center gap-2 text-sm bg-white/5 rounded-full pl-3 pr-1.5 py-1">
            <span className="max-w-[180px] truncate">{file.name}</span><span className="opacity-50 text-xs">{fmt(file.size)}</span>
            {!busy && <button onClick={() => setFile(null)} aria-label="remove file" className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/40">✕</button>}
          </div>}
          <button disabled={!file || busy} onClick={upload} className="btn-primary px-6 py-2.5 rounded-full text-sm font-bold">
            {phase === 'uploading' ? `Uploading ${pct}%` : phase === 'processing' ? 'Processing…' : file ? 'Start learning →' : 'Upload'}
          </button>
        </div>
      </div>
      {showPaste && (
        <div className="mt-4 space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="pasted notes title" className="bg-white/10 border border-white/10 p-2.5 rounded-xl w-full text-sm" />
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} placeholder="Paste your notes here (min 50 characters)…" aria-label="pasted notes" className="bg-white/10 border border-white/10 p-2.5 rounded-xl w-full text-sm" />
          <button disabled={paste.trim().length < 50 || busy} onClick={pasteText} className="btn-glow px-5 py-2 rounded-full text-sm font-bold disabled:opacity-40">Process text →</button>
        </div>
      )}
      {busy && (
        <div className="mt-5">
          {phase === 'uploading' && <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${pct}%` }} /></div>}
          {phase === 'processing' && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {STAGES.map((s, i) => {
                const cur = STAGES.indexOf(stage);
                const done = i < cur || stage === 'ready';
                const now = s === stage;
                return <span key={s} className="flex items-center gap-2 text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-semibold ${done ? 'bg-emerald-500/20 text-emerald-300' : now ? 'bg-violet-500/25 text-violet-200 animate-pulse' : 'bg-white/5 opacity-50'}`}>
                    {done ? '✓ ' : now ? '⚡ ' : ''}{s}</span>
                  {i < STAGES.length - 1 && <span className="opacity-30">→</span>}
                </span>;
              })}
            </div>)}
        </div>)}
    </div>
  );
}

function Library() {
  const [docs, setDocs] = useState([]); const [q, setQ] = useState('');
  useEffect(() => {
    api('/api/documents').then(r => setDocs(r.data)).catch(() => {});
    const t = setInterval(() => api('/api/documents').then(r => setDocs(r.data)).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, []);
  const filtered = docs.filter(d => d.title.toLowerCase().includes(q.toLowerCase()));
  const removeDoc = async (e, id, title) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm(`Delete "${title}" and all its quizzes, flashcards, chats and progress?`)) return;
    try { await api(`/api/documents/${id}`, { method: 'DELETE' }); setDocs(ds => ds.filter(x => x.id !== id)); }
    catch (err) { useToast.getState().push(err.message, 'error'); }
  };
  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <h2 className="text-2xl font-black">Library 📚</h2>
        <input aria-label="search library" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search documents…" className="bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm w-64" />
      </div>
      {!filtered.length ? <EmptyState icon="📭" title="No documents yet" hint="Upload a PDF, slides or scanned notes to start learning." /> :
      <div className="grid md:grid-cols-3 gap-4 mt-4">{filtered.map(d => (
        <Link key={d.id} to={`/doc/${d.id}`} className="tilt glass rounded-2xl p-5 block">
          <p className="text-3xl">{d.file_type?.includes('image') ? '🖼️' : d.file_type?.includes('presentation') ? '📊' : '📄'}</p>
          <p className="font-bold mt-2">{d.title}</p>
          <span className="mt-2 inline-flex items-center gap-1.5"><StatusPill status={d.status} />
            {d.status !== 'ready' && d.status !== 'failed' && <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-amber-300" />}</span>
          {d.status === 'failed' && d.error_message && <p className="text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2 mt-2 break-words">{d.error_message}</p>}
          <button onClick={(e) => removeDoc(e, d.id, d.title)} aria-label={`delete ${d.title}`}
            className="mt-3 text-xs px-3 py-1.5 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/30 transition">🗑 Delete</button>
        </Link>))}</div>}
    </main>
  );
}

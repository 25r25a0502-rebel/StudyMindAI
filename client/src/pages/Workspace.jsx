import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import ReactMarkdown from 'react-markdown';
import { useToast, StatusPill } from '../components/ui.jsx';

const TABS = [
  ['chat', '💬 Chat'], ['quiz', '🧪 Quiz'],
  ['summary', '📌 Summary'], ['flashcards', '⚡ Flashcards'], ['code', '💻 Code']
];
export default function Workspace() {
  const { id } = useParams();
  const [tab, setTab] = useState('chat');
  const [doc, setDoc] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState('');
  useEffect(() => {
    api(`/api/documents/${id}`).then(r => setDoc(r.data)).catch(e => setStatsErr(e.message));
    api(`/api/documents/${id}/stats`).then(r => setStats(r.data)).catch(e => setStatsErr(e.message));
  }, [id]);
  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-3xl">📄</span>
        <div><h2 className="font-black text-lg">{doc?.title || 'Loading…'}</h2>
        <span className="mt-1 inline-block">{doc?.status && <StatusPill status={doc.status} />}</span></div>
        <div className="ml-auto text-xs opacity-80" aria-label="backend wiring">
          {statsErr && <span className="text-red-300">⚠️ API unreachable: {statsErr} (is the server running?)</span>}
          {stats && <span>🔌 {stats.provider}/{stats.model} · 🧩 {stats.chunks} chunks · 🔑 groq:{stats.keys.groq ? '✓' : '✗'} gemini:{stats.keys.gemini ? '✓' : '✗'}</span>}
        </div>
      </div>
      <div role="tablist" className="flex gap-2 my-4 flex-wrap">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === k ? 'btn-glow bg-violet-600' : 'glass opacity-80 hover:opacity-100'}`}>{label}</button>)}
      </div>
      <div className="glass rounded-3xl p-6 tilt-scene">
        {tab === 'chat' && <Chat docId={id} />}
        {tab === 'quiz' && <QuizGen docId={id} />}
        {tab === 'summary' && <SummaryView docId={id} />}
        {tab === 'flashcards' && <Flashcards docId={id} />}
        {tab === 'code' && <CodeView docId={id} />}
      </div>
    </main>
  );
}
function Chat({ docId }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'Hi! Ask me anything from this document — I answer with page citations. 👋', sources: [] }]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  const send = async () => {
    if (!q.trim() || busy) return;
    setMsgs(m => [...m, { role: 'user', content: q }]); setQ(''); setBusy(true);
    try {
      const r = await api(`/api/documents/${docId}/chat`, { method: 'POST', body: JSON.stringify({ message: q }) });
      setMsgs(m => [...m, { role: 'assistant', content: r.data.answer, sources: r.data.sources }]);
    } catch (err) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ Chat failed: ${err.message}`, sources: [] }]);
    } finally { setBusy(false); }
  };
  return <div>
    <div className="chat-flow space-y-8 max-h-[55vh] overflow-auto pr-2 py-1">{msgs.map((m, i) => {
      const ai = m.role !== 'user';
      return (
      <div key={i} className="reveal">
        <div className={`flex items-center gap-2.5 ${ai ? '' : 'flex-row-reverse'}`}>
          <span aria-hidden="true" className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${ai ? 'bg-gradient-to-br from-violet-500 to-cyan-400 text-white' : 'bg-white/15'}`}>{ai ? 'SM' : 'YOU'}</span>
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-50">{ai ? 'StudyMind AI' : 'You'}</p>
          {ai && m.sources?.length > 0 && <span className="text-[11px] opacity-50">· {m.sources.length} source{m.sources.length > 1 ? 's' : ''}</span>}
        </div>
        <div className={`mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap ${ai ? 'ml-[38px] text-left' : 'mr-[38px] text-right opacity-90'}`}><ReactMarkdown>{m.content}</ReactMarkdown></div>
        {ai && m.sources?.length > 0 && (
          <div className="mt-2 ml-[38px] space-y-1.5">
            {m.sources.map((s, j) => (
              <p key={j} className="text-xs opacity-70 border-l-2 border-cyan-400/60 pl-2.5 leading-relaxed">
                <span className="font-bold text-cyan-300">[p{s.page}]</span> {s.snippet}{s.snippet?.length >= 220 ? '…' : ''}
              </p>))}
          </div>)}
      </div>);
    })}
      {busy && <p className="ml-[38px] text-sm opacity-50 animate-pulse">StudyMind is thinking…</p>}
      <div ref={bottomRef} />
    </div>
    <div className="flex gap-2 mt-5 pt-4 border-t border-white/10"><input aria-label="chat input" className="bg-white/10 border border-white/10 p-3 rounded-full px-5 flex-1" placeholder="Ask anything from this document…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
    <button onClick={send} disabled={busy} className="btn-glow px-6 rounded-full font-bold disabled:opacity-50">{busy ? '…' : '↑'}</button></div>
  </div>;
}
function SummaryView({ docId }) {
  const toast = useToast(s => s.push);
  const [out, setOut] = useState(''); const [busy, setBusy] = useState(false); const [type, setType] = useState('concise');
  const gen = async () => {
    setBusy(true);
    try { const r = await api(`/api/documents/${docId}/summary`, { method: 'POST', body: JSON.stringify({ type }) }); setOut(typeof r.data === 'string' ? r.data : JSON.stringify(r.data)); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const download = () => {
    const blob = new Blob([out], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `summary-${type}.md`; a.click();
  };
  return <div>
    <div className="flex gap-2 flex-wrap items-center">
      {[['concise', '📌 Concise notes'], ['keypoints', '• Key points'], ['revision', '📄 Revision sheet']].map(([v, l]) => (
        <button key={v} onClick={() => setType(v)} className={`px-4 py-2 rounded-full text-sm font-semibold ${type === v ? 'btn-glow bg-violet-600' : 'glass opacity-80'}`}>{l}</button>
      ))}
      <button disabled={busy} onClick={gen} className="btn-glow bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 rounded-full text-sm font-bold">{busy ? 'Writing…' : '✨ Generate'}</button>
      {out && <button onClick={() => navigator.clipboard.writeText(out)} className="glass px-4 py-2 rounded-full text-xs">📋 Copy</button>}
      {out && <button onClick={download} className="glass px-4 py-2 rounded-full text-xs">⬇ .md</button>}
    </div>
    <article className="prose prose-invert prose-sm max-w-none bg-black/30 rounded-2xl p-5 mt-4 min-h-[200px] whitespace-pre-wrap">
      {out ? <ReactMarkdown>{out}</ReactMarkdown> : <p className="opacity-50">Pick a style and generate — headings, bold terms, bullets and short paragraphs, ready to revise.</p>}
    </article>
  </div>;
}
function CodeView({ docId }) {
  const toast = useToast(s => s.push);
  const [q, setQ] = useState(''); const [examples, setExamples] = useState([]); const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({}); const [revealed, setRevealed] = useState({}); const [solved, setSolved] = useState({});
  const [reviews, setReviews] = useState({}); const [checking, setChecking] = useState({});
  const checkCode = async (i) => {
    const code = (drafts[i] || '').trim();
    if (!code || checking[i]) { if (!code) toast('Write your code first, then check it', 'info'); return; }
    setChecking(c => ({ ...c, [i]: true }));
    try {
      const r = await api(`/api/documents/${docId}/code-review`, { method: 'POST', body: JSON.stringify({ language: examples[i].language, question: examples[i].title, code }) });
      setReviews(rv => ({ ...rv, [i]: r.data }));
    } catch (e) { toast(e.message, 'error'); } finally { setChecking(c => ({ ...c, [i]: false })); }
  };
  const ask = async (question) => {
    const query = (question ?? q).trim();
    if (busy || (question === undefined && !query)) return;
    setBusy(true);
    try {
      const r = await api(`/api/documents/${docId}/code-examples`, { method: 'POST', body: JSON.stringify({ question: query }) });
      setExamples(r.data || []); setDrafts({}); setRevealed({}); setSolved({});
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const related = ['Give me query-writing tasks from this doc', 'Give me Python practice problems from this doc', 'Give me table-design tasks from this doc'];
  const doneCount = Object.values(solved).filter(Boolean).length;
  return <div>
    <div className="flex gap-2">
      <input aria-label="code question" className="bg-white/10 border border-white/10 p-3 rounded-2xl flex-1" placeholder="Ask e.g. give me 5 query tasks…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} />
      <button disabled={busy} onClick={() => ask()} className="btn-glow bg-gradient-to-r from-cyan-500 to-violet-600 px-5 rounded-2xl font-bold">{busy ? '…' : 'Ask'}</button>
      <button disabled={busy} onClick={() => { setQ(''); ask(' '); }} className="glass px-4 rounded-2xl text-xs">✨ All tasks</button>
    </div>
    <div className="flex gap-2 flex-wrap mt-2">{related.map(r => <button key={r} onClick={() => { setQ(r); ask(r); }} className="glass px-3 py-1 rounded-full text-xs opacity-80 hover:opacity-100">{r}</button>)}</div>
    {examples.length > 0 && <p className="text-xs opacity-60 mt-3">📝 {doneCount}/{examples.length} solved — AI asks, you code, then reveal the model answer.</p>}
    {examples.map((ex, i) => <div key={i} className="bg-black/40 rounded-2xl p-4 mt-3">
      <p className="font-bold text-sm">Q{i + 1}. {ex.title} <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 ml-1">{ex.language}</span>
        {ex.complexity && <span className="text-xs opacity-60 ml-2">{ex.complexity}</span>}
        {solved[i] && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ml-2">✓ solved</span>}</p>
      <label className="text-xs opacity-60 mt-3 block">✍️ Your solution:</label>
      <textarea value={drafts[i] || ''} onChange={e => setDrafts(d => ({ ...d, [i]: e.target.value }))} rows={6}
        spellCheck={false} placeholder={`Write your ${ex.language} code here…`}
        aria-label={`your solution for task ${i + 1}`}
        className="w-full mt-1 font-mono text-[13px] bg-black/60 border border-white/10 rounded-xl p-3 focus:border-cyan-400/60 outline-none whitespace-pre" />
      <div className="flex gap-2 mt-2 flex-wrap">
        <button onClick={() => checkCode(i)} disabled={checking[i]} className="btn-primary px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50">
          {checking[i] ? 'Checking…' : '🔍 Check my code'}</button>
        <button onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))} className="glass px-3 py-1.5 rounded-full text-xs font-semibold">
          {revealed[i] ? '🙈 Hide model answer' : '👁 Show model answer'}</button>
        <button onClick={() => setSolved(s => ({ ...s, [i]: !s[i] }))} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${solved[i] ? 'bg-emerald-500/25 text-emerald-300' : 'glass'}`}>
          {solved[i] ? '✓ Solved' : 'Mark solved'}</button>
        {revealed[i] && <button onClick={() => navigator.clipboard.writeText(ex.code)} className="glass px-3 py-1.5 rounded-full text-xs">📋 Copy</button>}
      </div>
      {reviews[i] && <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${reviews[i].rating >= 7 ? 'text-emerald-300' : reviews[i].rating >= 4 ? 'text-amber-300' : 'text-red-300'}`}>{reviews[i].rating}<small className="text-xs opacity-60">/10</small></span>
          <p className="text-sm font-semibold">{reviews[i].verdict}</p>
        </div>
        {reviews[i].issues?.length > 0 && <ul className="mt-2 space-y-1 text-xs">
          {reviews[i].issues.map((it, k) => <li key={k}>{it.severity === 'error' ? '🔴' : it.severity === 'warning' ? '🟡' : '🔵'} {it.message}</li>)}
        </ul>}
        {reviews[i].test_cases?.length > 0 && <div className="mt-2 overflow-auto">
          <p className="text-xs font-bold opacity-70 mb-1">🧪 Test cases</p>
          {reviews[i].test_cases.map((t, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs bg-black/30 rounded-lg px-2.5 py-1.5 mt-1 items-center">
              <span className="truncate">in: <code>{t.input}</code></span>
              <span className="truncate">exp: <code>{t.expected}</code></span>
              <span className={`font-bold ${t.result === 'pass' ? 'text-emerald-300' : t.result === 'fail' ? 'text-red-300' : 'text-amber-300'}`}>
                {t.result === 'pass' ? '✓' : t.result === 'fail' ? '✗' : '?'} {t.result}</span>
            </div>))}
        </div>}
        {reviews[i].suggestion && <pre className="whitespace-pre-wrap text-xs bg-black/40 rounded-lg p-2.5 mt-2 overflow-auto">💡 {reviews[i].suggestion}</pre>}
      </div>}
      {revealed[i] && <div className="mt-2">
        <pre className="whitespace-pre-wrap text-[13px] bg-black/50 rounded-xl p-3 overflow-auto border border-emerald-400/30">{ex.code}</pre>
        <p className="text-sm opacity-80 mt-2 whitespace-pre-wrap">💡 {ex.explanation}</p>
      </div>}
    </div>)}
  </div>;
}
function GenButton({ docId, path, label }) {
  const toast = useToast(s => s.push);
  const [out, setOut] = useState(null); const [busy, setBusy] = useState(false);
  return <div><button disabled={busy} onClick={async () => {
    setBusy(true);
    try { const r = await api(`/api/documents/${docId}/${path}`, { method: 'POST', body: JSON.stringify({}) }); setOut(r.data); }
    catch (e) { toast(e.message, 'error'); } setBusy(false);
  }} className="btn-glow bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 rounded-full font-semibold">{busy ? 'Generating…' : label}</button>
  <pre className="whitespace-pre-wrap mt-4 text-sm bg-black/30 p-4 rounded-2xl max-h-[50vh] overflow-auto">{out ? JSON.stringify(out, null, 2).slice(0, 8000) : 'Output will appear here…'}</pre></div>;
}
function QuizGen({ docId }) {
  const [quiz, setQuiz] = useState(null); const [answers, setAnswers] = useState({}); const [result, setResult] = useState(null);
  const reviewed = !!result;
  const gen = async () => { const r = await api(`/api/documents/${docId}/quiz`, { method: 'POST', body: JSON.stringify({ count: 10, difficulty: 'medium' }) }); setQuiz(r.data); setResult(null); setAnswers({}); };
  const submit = async () => {
    const payload = quiz.questions.map(q => ({ questionId: q.id, answer: answers[q.id] || '' }));
    const r = await api(`/api/quizzes/${quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ answers: payload }) });
    setResult(r.data);
  };
  const retake = () => { setResult(null); setAnswers({}); };
  return <div><button onClick={gen} className="btn-glow bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 rounded-full font-semibold">✨ Generate 10-question quiz</button>
    {quiz?.questions?.map((q, i) => {
      const mine = answers[q.id] || '';
      const correct = String(q.answer || '').trim().toLowerCase() === String(mine).trim().toLowerCase() && mine !== '';
      return <div key={q.id} className="bg-black/30 p-4 mt-3 rounded-2xl">
        <p className="font-semibold">Q{i + 1}. {q.question} <small className="opacity-60">({q.topic} · {q.difficulty})</small>
          {reviewed && <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{correct ? '✓ Correct' : '✗ Wrong'}</span>}</p>
        {q.options?.map(o => {
          const isAnswer = String(o).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
          const isMine = String(o).trim().toLowerCase() === String(mine).trim().toLowerCase();
          const cls = reviewed
            ? isAnswer ? 'bg-emerald-500/25 border border-emerald-400'
              : isMine ? 'bg-red-500/25 border border-red-400'
              : 'bg-white/5'
            : 'bg-white/5 hover:bg-white/10 cursor-pointer';
          return <label key={o} className={`block mt-1 text-sm rounded-xl px-3 py-2 ${cls} ${reviewed ? '' : 'cursor-pointer'}`}>
            {!reviewed && <input type="radio" name={q.id} className="mr-2" checked={mine === o} onChange={() => setAnswers(a => ({ ...a, [q.id]: o }))} />}
            {reviewed && isAnswer && '✅ '}{reviewed && !isAnswer && isMine && '❌ '}{reviewed && !isAnswer && !isMine && '· '}
            {o}{reviewed && isMine && !isAnswer && <small className="opacity-70"> (your pick)</small>}{reviewed && isAnswer && <small className="opacity-70"> (correct)</small>}
          </label>;
        })}
        {(!q.options) && !reviewed && <input className="bg-white/10 border border-white/10 p-2 w-full rounded-xl mt-2" placeholder="Type answer / code…" value={mine} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />}
        {reviewed && <div className="mt-2 text-sm bg-white/5 rounded-xl p-3">
          {!q.options && <p>Your answer: <strong>{mine || '—'}</strong></p>}
          <p>Correct answer: <strong className="text-emerald-300">{q.answer}</strong></p>
          <p className="opacity-80 mt-1">💡 {q.explanation}</p>
        </div>}
      </div>;
    })}
    {quiz && !reviewed && <button onClick={submit} className="mt-4 btn-glow bg-emerald-500 px-5 py-2.5 rounded-full font-bold">Submit & score</button>}
    {result && <div className="mt-4 flex items-center gap-3 flex-wrap">
      <p className="text-xl font-black">🎉 Score: <span className="grad-text">{result.score}/{result.total}</span></p>
      <button onClick={retake} className="glass px-4 py-2 rounded-full text-sm font-semibold">🔁 Retake</button>
      <button onClick={gen} className="glass px-4 py-2 rounded-full text-sm font-semibold">✨ New quiz</button>
    </div>}</div>;
}
function Flashcards({ docId }) {
  const [cards, setCards] = useState([]); const [flip, setFlip] = useState({});
  return <div><button onClick={async () => {
    const r = await api(`/api/documents/${docId}/flashcards`, { method: 'POST', body: '{}' }); setCards(r.data.cards || []);
  }} className="btn-glow bg-gradient-to-r from-amber-500 to-pink-500 px-5 py-2.5 rounded-full font-semibold">⚡ Generate flashcards</button>
  <div className="grid md:grid-cols-3 gap-4 mt-4">{cards.map((c, i) =>
    <div key={i} tabIndex={0} role="button" aria-label="flashcard" onClick={() => setFlip(f => ({ ...f, [i]: !f[i] }))}
      onKeyDown={e => e.key === 'Enter' && setFlip(f => ({ ...f, [i]: !f[i] }))}
      className={`flip cursor-pointer tilt glass rounded-2xl p-5 ${flip[i] ? 'flipped' : ''}`}>
      <div className="flip-inner"><p className="flip-face">{flip[i] ? '' : '❓ ' + c.front}</p><p className="flip-face flip-back text-emerald-300">✅ {c.back}</p></div>
      <p className="text-[11px] opacity-50 mt-2">click to flip</p></div>)}</div></div>;
}

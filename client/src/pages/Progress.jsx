import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { PageHeader, Skeleton } from '../components/ui.jsx';
export default function Progress() {
  const [ov, setOv] = useState(null); const [topics, setTopics] = useState(null);
  useEffect(() => {
    api('/api/progress/overview').then(r => setOv(r.data)).catch(() => {});
    api('/api/progress/topics').then(r => setTopics(r.data)).catch(() => {});
  }, []);
  if (!ov) return <main className="max-w-6xl mx-auto p-6"><Skeleton rows={4} /></main>;
  return (
    <main className="max-w-6xl mx-auto p-6">
      <PageHeader icon="📈" title="Your Progress" sub="Accuracy, topic strength and study streaks." />
      <div className="grid md:grid-cols-4 gap-4 mt-6">
        {[['🧪 Quizzes', ov.attempts], ['📚 Docs', ov.documents], ['🔥 Streak', `${ov.streak}d`], ['🎯 Best', `${Math.max(0, ...ov.accuracyTrend.map(a => a.pct))}%`]].map(([k, v]) => (
          <div key={k} className="tilt glass rounded-2xl p-5"><p className="text-sm opacity-60">{k}</p><p className="text-3xl font-black">{v}</p></div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="glass rounded-3xl p-5"><h3 className="font-bold mb-2">Accuracy trend</h3>
          <ResponsiveContainer width="100%" height={240}><LineChart data={ov.accuracyTrend}><XAxis dataKey="date" stroke="#888" /><YAxis stroke="#888" /><Tooltip contentStyle={{ background: '#111' }} /><Line dataKey="pct" stroke="#22d3ee" strokeWidth={3} type="monotone" dot={false} /></LineChart></ResponsiveContainer></div>
        <div className="glass rounded-3xl p-5"><h3 className="font-bold mb-2">Topic strength</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={topics?.topics || []}><XAxis dataKey="topic" stroke="#888" /><YAxis stroke="#888" /><Tooltip contentStyle={{ background: '#111' }} /><Bar dataKey="accuracy" fill="#8b5cf6" radius={8} /></BarChart></ResponsiveContainer>
          {topics?.weak?.length > 0 && <p className="mt-3 text-sm bg-red-500/15 text-red-300 rounded-xl px-3 py-2">⚠️ Weak: {topics.weak.join(', ')} — generate a practice quiz from Library.</p>}</div>
      </div>
    </main>
  );
}

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — fill the root .env file (see .env.example).');
}
export const supabase = createClient(url, key);

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function headers() {
  const { data } = await supabase.auth.getSession();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` };
}

export async function api(path, opts = {}) {
  const h = await headers();
  const r = await fetch(`${API}${path}`, { ...opts, headers: { ...h, ...(opts.headers || {}) } });
  if (!r.ok) {
    if (r.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  }
  return r.json();
}

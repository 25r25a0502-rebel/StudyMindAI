import jwt from 'jsonwebtoken';
// Supabase Auth: verify JWT (HS256 with JWT secret) or decode for supabase-hosted verification.
// Assumption: SUPABASE_JWT_SECRET set when self-hosting; otherwise we trust supabase-js user client.
// Simpler robust approach: extract user id from verified Supabase JWT via anon client getUser.
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ ok: false, error: 'Invalid session' });
    req.user = { id: data.user.id, email: data.user.email };
    req.token = token;
    next();
  } catch (e) { next(e); }
}

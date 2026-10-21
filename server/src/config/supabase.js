import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
// Service-role client for server-side DB/storage (RLS bypassed; enforce user_id in code)
export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceKey);
export function supabaseForUser(jwt) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
}

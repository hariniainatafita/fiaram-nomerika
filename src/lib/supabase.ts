import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// URL du proxy de bascule multi-cloud (fonction functions/api/db/[[path]].js).
// Quand elle est définie, seules les requêtes de DONNÉES (app_state) passent
// par le proxy ; Auth, Realtime et Storage restent en direct pour ne pas
// dépendre d'un relais WebSocket.
const supabaseProxyUrl = import.meta.env.VITE_SUPABASE_PROXY_URL as string | undefined;

export { supabaseUrl, supabaseAnonKey, supabaseProxyUrl };

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Client direct : Auth, Realtime, Storage, et les diagnostics.
export const supabaseDirect: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Client données : passe par le proxy avec bascule si configuré, sinon direct.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseProxyUrl || supabaseUrl!, supabaseAnonKey!)
  : null;

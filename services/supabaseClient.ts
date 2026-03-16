import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zmhgtwgjgjyybapwyfib.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wq3OhEB1NUkuESrA30CZjQ_HkEs7ne0';

if (!supabaseAnonKey) {
  console.warn('Supabase Anon Key não encontrada. Verifique o arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

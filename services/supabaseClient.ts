import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zmhgtwgjgjyybapwyfib.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaGd0d2dqZ2p5eWJhcHd5ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTY4OTMsImV4cCI6MjA4OTI3Mjg5M30.rKNZZk5bw4cWrIMxum8m2Ac62DkNt0dyFez3KZE0Jic';

if (!supabaseAnonKey) {
  console.warn('Supabase Anon Key não encontrada. Verifique o arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

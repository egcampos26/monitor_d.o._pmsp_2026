import { supabase } from './supabaseClient';

export type LogSeverity = 'info' | 'success' | 'warning' | 'error';

export interface SystemLog {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  message: string;
  details?: string;
}

/**
 * Adiciona um novo registro ao log do sistema no Supabase
 */
export const addSystemLog = async (severity: LogSeverity, message: string, details?: any) => {
  try {
    let detailsString = undefined;
    if (details) {
      if (details instanceof Error) {
        detailsString = details.message + (details.stack ? `\n${details.stack}` : '');
      } else if (typeof details === 'object') {
        detailsString = JSON.stringify(details, null, 2);
      } else {
        detailsString = String(details);
      }
    }

    // Pegar sessão atual para o user_id
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Persiste no Supabase
    const { error } = await supabase
      .from('system_logs')
      .insert([{
        type: severity,
        message: message,
        detail: detailsString ? { content: detailsString } : null,
        user_id: userId
      }]);

    if (error) console.error('Erro ao salvar log no Supabase:', error);

    // Dispara evento para atualização da UI local
    window.dispatchEvent(new CustomEvent('dosp_syslog_updated'));
    
    // Console mirroring
    if (severity === 'error') console.error(`[D.O. PMSP Monitor Log]: ${message}`, details);
    else if (severity === 'warning') console.warn(`[D.O. PMSP Monitor Log]: ${message}`, details);
    else console.log(`[D.O. PMSP Monitor Log]: ${message}`);
    
  } catch (e) {
    console.error('Falha crítica ao gravar log do sistema', e);
  }
};

/**
 * Limpa os logs no Supabase
 */
export const clearSystemLogs = async () => {
  try {
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('dosp_syslog_updated'));
  } catch (e) {
    console.error('Falha ao limpar logs no Supabase', e);
  }
};

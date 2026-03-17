
import React, { useState, useEffect } from 'react';
import { User, ServerMonitor, AnalysisHistory, DospFormat, DospOccurrence, ScheduledAnalysis } from './types';
import { MOCK_MONITORS } from './constants';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import MonitorList from './components/MonitorList';
import Analysis from './components/Analysis';
import TargetedAnalysis from './components/TargetedAnalysis';
import HistoryView from './components/HistoryView';
import Scheduler from './components/Scheduler';
import LogView from './components/LogView';
import { supabase } from './services/supabaseClient';
import { addSystemLog } from './services/logService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [monitors, setMonitors] = useState<ServerMonitor[]>([]);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [schedules, setSchedules] = useState<ScheduledAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulation of auth state check
  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email || '',
          name: session.user.user_metadata?.name || 'Usuário'
        });
        loadInitialData();
      } else {
        setUser(null);
        setMonitors([]);
        setHistory([]);
        setSchedules([]);
      }
      setIsLoading(false);
    });

    // Initial session check
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          email: session.user.email || '',
          name: session.user.user_metadata?.name || 'Usuário'
        });
        loadInitialData();
      } else {
        setIsLoading(false);
      }
    };
    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Carregar Monitores
      const { data: monitorsData, error: monitorsError } = await supabase
        .from('monitors')
        .select('*')
        .order('name');
      
      if (monitorsError) throw monitorsError;
      setMonitors(monitorsData || []);

      // 2. Carregar Histórico com Ocorrências incluídas
      const { data: historyData, error: historyError } = await supabase
        .from('analysis_history')
        .select('*, results:occurrences(*)')
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      if (historyData) {
        setHistory(historyData.map(h => ({
          ...h,
          totalOccurrences: h.total_occurrences,
          monitorsFound: h.monitors_found
        })));
      }

      // Carregar Agendamentos do Supabase (agora com RLS)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('scheduled_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!scheduleError && scheduleData) {
        setSchedules(scheduleData);
      }

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Erro ao carregar dados do Supabase:', e);
      addSystemLog('error', 'Falha ao sincronizar dados com o banco', errorMessage);
      
      // Fallback para mock apenas se for erro de conexão e não houver dados
      if (monitors.length === 0) {
        const savedMonitors = loadFromLocalStorage('dosp_monitors', []);
        if (savedMonitors.length > 0) {
          setMonitors(savedMonitors);
        } else {
          setMonitors(MOCK_MONITORS);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (e.target as any)[0].value;
    const password = (e.target as any)[1].value;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert('Falha no login: ' + error.message);
        throw error;
      }
      addSystemLog('success', 'Usuário logado com sucesso', email);
    } catch (e) {
      console.error(e);
      addSystemLog('error', 'Falha no login', String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Monitor Actions
  const saveToLocalStorage = (key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error(`Erro ao salvar '${key}' no localStorage:`, e); }
  };

  const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.error(`Erro ao carregar '${key}' do localStorage:`, e);
      return defaultValue;
    }
  };

  const addMonitor = async (newM: Omit<ServerMonitor, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('monitors')
        .insert([{
          name: newM.name,
          rf: newM.rf,
          role: newM.role,
          notes: newM.notes,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMonitors(prev => [...prev, data]);
        addSystemLog('success', 'Monitor adicionado com sucesso', `Servidor: ${data.name}`);
      }
    } catch (e) {
      console.error('Erro ao adicionar monitor:', e);
      addSystemLog('error', 'Falha ao salvar monitor no banco de dados', e instanceof Error ? e.message : String(e));
      alert('Erro ao salvar monitor. Verifique se você está logado.');
    }
  };

  const deleteMonitor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMonitors(prev => prev.filter(m => m.id !== id));
      addSystemLog('info', 'Monitor removido do Supabase', `ID: ${id}`);
    } catch (e) {
      console.error('Erro ao deletar monitor:', e);
      // Fallback local
      setMonitors(monitors.filter(m => m.id !== id));
      saveToLocalStorage('dosp_monitors', monitors.filter(m => m.id !== id));
    }
  };

  const clearAllMonitors = () => {
    setMonitors([]);
    saveToLocalStorage('dosp_monitors', []);
  };

  const toggleMonitor = (id: string) => {
    const updated = monitors.map(m => m.id === id ? { ...m, active: !m.active } : m);
    setMonitors(updated);
    saveToLocalStorage('dosp_monitors', updated);
  };

  const importMonitors = async (imported: Omit<ServerMonitor, 'id' | 'createdAt'>[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      addSystemLog('info', 'Iniciando importação...', `Processando ${imported.length} registros.`);

      // Removendo user_id explícito para deixar o default (auth.uid()) do Supabase agir,
      // assim como funciona no addMonitor manual.
      const { data, error } = await supabase
        .from('monitors')
        .insert(imported.map(m => ({
          name: m.name,
          rf: m.rf,
          role: m.role,
          notes: m.notes,
          active: true
        })))
        .select();

      if (error) {
        console.error('Erro na importação Supabase:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // Atualizar estado local com os novos dados vindos do banco
        setMonitors(prev => {
          // Evitar duplicatas visuais se loadInitialData rodar em paralelo
          const existingIds = new Set(prev.map(p => p.id));
          const onlyNew = data.filter(d => !existingIds.has(d.id));
          return [...prev, ...onlyNew];
        });
        
        addSystemLog('success', 'Importação concluída', `${data.length} servidores salvos.`);
        alert(`${data.length} servidores importados e salvos com sucesso!`);
      }
    } catch (e) {
      console.error('Erro fatal:', e);
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      addSystemLog('error', 'Falha na importação', msg);
      
      // Fallback local se falhar
      const newOnes = imported.map(m => ({
        ...m,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        active: true
      }));
      setMonitors(prev => [...prev, ...newOnes]);
      alert(`Os dados foram carregados apenas temporariamente.\nMotivo: ${msg}`);
    }
  };

  // Scheduling Actions
  const addSchedule = async (newS: Omit<ScheduledAnalysis, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('scheduled_analyses')
        .insert([{
          name: newS.name,
          frequency: newS.frequency,
          time: newS.time,
          active: true,
          format: newS.format || 'JSON'
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setSchedules(prev => [data, ...prev]);
        addSystemLog('success', 'Agendamento criado no Supabase', `Nome: ${newS.name}`);
      }
    } catch (e) {
      console.error('Erro ao adicionar agendamento:', e);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_analyses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== id));
      addSystemLog('info', 'Agendamento removido do Supabase', `ID: ${id}`);
    } catch (e) {
      console.error('Erro ao deletar agendamento:', e);
    }
  };

  const toggleSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;

    try {
      const { error } = await supabase
        .from('scheduled_analyses')
        .update({ active: !schedule.active })
        .eq('id', id);

      if (error) throw error;
      setSchedules(prev => prev.map(s => 
        s.id === id ? { ...s, active: !s.active } : s
      ));
    } catch (e) {
      console.error('Erro ao toggle agendamento:', e);
    }
  };

  const clearHistory = async (ids?: string[]) => {
    try {
      if (!ids || ids.length === 0) {
        // Limpar tudo
        const { error } = await supabase.from('analysis_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        setHistory([]);
      } else {
        // Limpar selecionados
        const { error } = await supabase.from('analysis_history').delete().in('id', ids);
        if (error) throw error;
        setHistory(prev => prev.filter(h => !ids.includes(h.id)));
      }
      addSystemLog('info', 'Histórico removido do Supabase', ids ? `${ids.length} itens` : 'Todos');
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
    }
  };

  const updateOccurrenceStatus = async (historyId: string, occurrenceId: string, status: 'verified' | 'dismissed' | 'pending') => {
    try {
      const { error } = await supabase
        .from('occurrences')
        .update({ status })
        .eq('id', occurrenceId);

      if (error) throw error;

      setHistory(prev => prev.map(h => {
        if (h.id === historyId) {
          return {
            ...h,
            results: h.results.map(occ => 
              occ.id === occurrenceId ? { ...occ, status } : occ
            )
          };
        }
        return h;
      }));
    } catch (e) {
      console.error('Erro ao atualizar status no Supabase:', e);
    }
  };

  const sortHistory = (list: AnalysisHistory[]) => {
    return [...list].sort((a, b) => {
      // Tentar split por / (novo) ou - (velho)
      const parseDate = (dStr: string) => {
        if (dStr.includes('/')) {
          const [d, m, y] = dStr.split('/').map(Number);
          return new Date(y, m - 1, d).getTime();
        } else if (dStr.includes('-')) {
          return new Date(dStr).getTime();
        }
        return 0;
      };
      return parseDate(b.date) - parseDate(a.date);
    });
  };

  const handleAnalysisFinish = async (date: string, format: DospFormat, results: DospOccurrence[]) => {
    try {
      const uniqueMonitors = new Set(results.map(r => r.monitorId)).size;
      const [y, m, d] = date.split('-');
      const formattedDate = `${d}/${m}/${y}`;

      // 1. Salvar Cabeçalho do Histórico
      const { data: historyData, error: historyError } = await supabase
        .from('analysis_history')
        .insert([{
          date: formattedDate,
          format,
          total_occurrences: results.length,
          monitors_found: uniqueMonitors
        }])
        .select()
        .single();

      if (historyError) throw historyError;

      // 2. Salvar Ocorrências Individuais
      if (results.length > 0 && historyData) {
        const occurrencesBatch = results.map(r => ({
          history_id: historyData.id,
          monitor_id: r.monitorId.startsWith('temp-') ? null : r.monitorId,
          monitor_name: r.monitorName,
          monitor_rf: r.monitorRf,
          title: r.title,
          content: r.content,
          page: r.page,
          url: r.url,
          confidence: r.confidence,
          match_type: r.matchType,
          status: 'pending'
        }));

        const { error: occError } = await supabase
          .from('occurrences')
          .insert(occurrencesBatch);

        if (occError) throw occError;
      }

      addSystemLog('success', 'Análise salva no Supabase', `${results.length} ocorrências persistidas.`);
      
      // Recarregar histórico para refletir mudanças
      const { data: updatedHistory, error: loadError } = await supabase
        .from('analysis_history')
        .select('*, results:occurrences(*)')
        .order('created_at', { ascending: false });

      if (!loadError && updatedHistory) {
        setHistory(updatedHistory.map(h => ({
          ...h,
          totalOccurrences: h.total_occurrences,
          monitorsFound: h.monitors_found
        })));
      }

    } catch (e) {
      console.error('Erro ao salvar análise no Supabase:', e);
      addSystemLog('error', 'Falha ao salvar análise na nuvem', e instanceof Error ? e.message : String(e));
      
      // Fallback local para não perder o trabalho atual
      const uniqueMonitors = new Set(results.map(r => r.monitorId)).size;
      const [y, m, d] = date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const newEntry: AnalysisHistory = {
        id: crypto.randomUUID(),
        date: formattedDate,
        format,
        totalOccurrences: results.length,
        monitorsFound: uniqueMonitors,
        timestamp: Date.now(),
        results: results.map(r => ({ ...r, status: 'pending' }))
      };
      setHistory(prev => sortHistory([newEntry, ...prev]));
    }
    setActiveTab('history');
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex bg-slate-100">
        <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-blue-600 p-12 text-white relative">
          <div className="absolute top-12 left-12 flex items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold text-2xl tracking-tight">D.O. PMSP Monitor</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-5xl font-extrabold mb-6 leading-tight">Monitoramento Inteligente do Diário Oficial.</h1>
            <p className="text-xl text-blue-100">Automatize a busca por atos funcionais de servidores da Prefeitura de São Paulo em segundos.</p>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
          <div className="max-w-md w-full">
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Entrar no sistema</h2>
              <p className="text-slate-500">Use suas credenciais institucionais.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="seu@email.com.br"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">Senha</label>
                  <a href="#" className="text-sm text-blue-600 font-bold hover:underline">Esqueci a senha</a>
                </div>
                <input 
                  type="password" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all"
              >
                Acessar Painel
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
    >
      {activeTab === 'dashboard' && (
        <Dashboard monitors={monitors} history={history} />
      )}
      {activeTab === 'targeted-analysis' && (
        <TargetedAnalysis monitors={monitors} onFinish={handleAnalysisFinish} />
      )}
      {activeTab === 'scheduler' && (
        <Scheduler 
          schedules={schedules} 
          onAdd={addSchedule} 
          onDelete={deleteSchedule} 
          onToggle={toggleSchedule}
        />
      )}
      {activeTab === 'monitors' && (
        <MonitorList 
          monitors={monitors} 
          onAdd={addMonitor} 
          onDelete={deleteMonitor} 
          onDeleteAll={clearAllMonitors}
          onToggle={toggleMonitor}
          onImport={importMonitors}
        />
      )}
      {activeTab === 'history' && (
        <HistoryView 
          history={history} 
          onClearHistory={clearHistory} 
          onUpdateOccurrence={updateOccurrenceStatus} 
        />
      )}
      {activeTab === 'logs' && (
        <LogView />
      )}
    </Layout>
  );
};

export default App;

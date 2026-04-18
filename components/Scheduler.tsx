
import React, { useState } from 'react';
import { ScheduledAnalysis, Frequency, DospFormat, ServerMonitor } from '../types';

interface SchedulerProps {
  schedules: ScheduledAnalysis[];
  monitors: ServerMonitor[];
  onAdd: (schedule: Omit<ScheduledAnalysis, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

const Scheduler: React.FC<SchedulerProps> = ({ schedules, monitors, onAdd, onDelete, onToggle }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [format, setFormat] = useState<DospFormat>('JSON');
  const [time, setTime] = useState('08:00');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<Set<string>>(new Set());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    onAdd({
      name,
      frequency,
      format,
      time,
      nextRun: new Date(`${startDate}T${time}`).toISOString(),
      active: true,
      monitor_ids: selectedMonitorIds.size > 0 ? Array.from(selectedMonitorIds) : undefined
    });
    
    setName('');
    setSelectedMonitorIds(new Set());
    setShowAdd(false);
  };

  const toggleSelectAll = () => {
    if (selectedMonitorIds.size === monitors.length) {
      setSelectedMonitorIds(new Set());
    } else {
      setSelectedMonitorIds(new Set(monitors.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedMonitorIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMonitorIds(next);
  };

  const getFrequencyLabel = (f: Frequency) => {
    switch (f) {
      case 'once': return 'Uma vez';
      case 'daily': return 'Diariamente';
      case 'every_2_days': return 'A cada 2 dias';
      case 'weekly': return 'Semanalmente';
      default: return f;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agendamento de Análises</h2>
          <p className="text-slate-500">Programe varreduras automáticas periódicas no Diário Oficial.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Agendamento
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Configurar Nova Automação</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Tarefa</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Monitoramento Semanal RH"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequência</label>
                <select 
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as Frequency)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="once">Uma vez</option>
                  <option value="daily">Diariamente</option>
                  <option value="every_2_days">A cada 2 dias</option>
                  <option value="weekly">Semanalmente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Execução</label>
                <input 
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Formato de Dados</label>
                <select 
                  value={format}
                  onChange={e => setFormat(e.target.value as DospFormat)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="JSON">JSON (API)</option>
                  <option value="CSV">CSV</option>
                  <option value="HTML">HTML</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 uppercase">Monitorados para esta Tarefa</label>
                <button 
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  {selectedMonitorIds.size === monitors.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
              <div className="max-h-[150px] overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 bg-slate-50/50">
                {monitors.map(m => (
                  <label key={m.id} className="p-2.5 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors">
                    <input 
                      type="checkbox"
                      checked={selectedMonitorIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800 leading-none">{m.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{m.role} {m.rf ? `• ${m.rf}` : ''}</p>
                    </div>
                  </label>
                ))}
                {monitors.length === 0 && (
                  <p className="p-4 text-center text-gray-400 text-xs italic">Nenhum monitorado salvo no sistema.</p>
                )}
              </div>
              <p className="text-[10px] text-slate-400 italic">
                * Se nenhum for selecionado, a análise utilizará <strong>todos os monitores ativos</strong> no momento da execução.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Salvar Agendamento
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {schedules.length > 0 ? schedules.map(s => (
          <div key={s.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${s.active ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className={`font-bold ${s.active ? 'text-slate-900' : 'text-slate-400'}`}>{s.name}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {getFrequencyLabel(s.frequency)}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Próxima: {new Date(s.nextRun).toLocaleDateString()} às {s.time}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase">{s.format}</span>
                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                    {s.monitor_ids ? `${s.monitor_ids.length} selecionados` : 'Todos ativos'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 self-end md:self-center">
              <button 
                onClick={() => onToggle(s.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                  s.active 
                    ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {s.active ? 'Ativo' : 'Pausado'}
              </button>
              <button 
                onClick={() => onDelete(s.id)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )) : (
          <div className="bg-white p-12 text-center border border-dashed border-gray-200 rounded-xl">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-slate-900 font-bold mb-1">Nenhum agendamento ativo</h4>
            <p className="text-slate-500 text-sm mb-6">Programe análises recorrentes para não precisar fazer manualmente todos os dias.</p>
            <button 
              onClick={() => setShowAdd(true)}
              className="text-blue-600 font-bold text-sm hover:underline"
            >
              Criar meu primeiro agendamento
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <div className="flex gap-4">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-full h-fit">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h5 className="font-bold text-blue-900 mb-1">Como funciona o agendamento?</h5>
            <p className="text-sm text-blue-800 leading-relaxed">
              O sistema utiliza processamento em nuvem para baixar as edições do Diário Oficial nos horários programados. 
              As ocorrências encontradas serão enviadas por e-mail (se configurado) e aparecerão automaticamente na aba de Análises.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scheduler;

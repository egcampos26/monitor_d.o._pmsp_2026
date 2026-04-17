
import React, { useState } from 'react';
import { DospFormat, ServerMonitor, DospOccurrence } from '../types';
import { fetchDospEdition, analyzeEdition } from '../services/dospService';

interface TargetedAnalysisProps {
  monitors: ServerMonitor[];
  onFinish: (date: string, format: DospFormat, results: DospOccurrence[]) => void;
}

const TargetedAnalysis: React.FC<TargetedAnalysisProps> = ({ monitors, onFinish }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tempMonitors, setTempMonitors] = useState<Omit<ServerMonitor, 'id' | 'createdAt' | 'active'>[]>([]);
  
  const [analysisMode, setAnalysisMode] = useState<'single' | 'period'>('single');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<DospFormat>('JSON');
  const [status, setStatus] = useState<'idle' | 'loading' | 'analyzing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentDayInfo, setCurrentDayInfo] = useState('');

  const [tempName, setTempName] = useState('');
  const [tempRf, setTempRf] = useState('');
  const [tempRole, setTempRole] = useState('');

  const toggleSelectAll = () => {
    if (selectedIds.size === monitors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(monitors.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const addTempMonitor = () => {
    if (!tempName && !tempRf) return;
    setTempMonitors([...tempMonitors, { 
      name: tempName.trim().toUpperCase(), 
      rf: tempRf.trim(), 
      role: tempRole.trim() || 'Temporário' 
    }]);
    setTempName('');
    setTempRf('');
    setTempRole('');
  };

  const removeTempMonitor = (index: number) => {
    setTempMonitors(tempMonitors.filter((_, i) => i !== index));
  };

  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    let current = new Date(start + 'T12:00:00');
    const last = new Date(end + 'T12:00:00');
    
    // Proteção contra loop infinito e limite de 5 dias
    let count = 0;
    while (current <= last && count < 5) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  };

  const handleStartAnalysis = async () => {
    const selectedMonitors = monitors.filter(m => selectedIds.has(m.id));
    const combinedMonitors: ServerMonitor[] = [
      ...selectedMonitors,
      ...tempMonitors.map(tm => ({
        ...tm,
        id: `temp-${Math.random().toString(36).substr(2, 9)}`,
        active: true,
        createdAt: Date.now()
      }))
    ];

    if (combinedMonitors.length === 0) {
      alert("Por favor, selecione ao menos um monitorado ou adicione um temporário.");
      return;
    }

    const targetDates = analysisMode === 'single' ? [date] : getDatesInRange(date, endDate);
    
    if (analysisMode === 'period') {
      const diff = (new Date(endDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 0) {
        alert("A data final deve ser posterior à data inicial.");
        return;
      }
      if (diff >= 5) {
        alert("O período máximo permitido é de 5 dias. O sistema analisará apenas os primeiros 5 dias do intervalo.");
      }
    }

    setStatus('loading');
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < targetDates.length; i++) {
      const currentDay = targetDates[i];
      const displayDate = currentDay.split('-').reverse().join('/');
      setCurrentDayInfo(`Dia ${i + 1} de ${targetDates.length}: ${displayDate}`);
      setProgress(Math.round(((i) / targetDates.length) * 100));

      try {
        // 1. Fetch
        setStatus('loading');
        const edition = await fetchDospEdition(currentDay, format, combinedMonitors);
        
        if (edition && edition.length > 0) {
          // 2. Analyze
          setStatus('analyzing');
          const results = await analyzeEdition(edition, combinedMonitors, currentDay);
          
          // 3. Save (but don't redirect yet)
          const isLast = i === targetDates.length - 1;
          await (onFinish as any)(currentDay, format, results, false);
          successCount++;
        } else {
          errors.push(`${displayDate}: Nenhuma matéria encontrada (Edição não disponível).`);
        }
      } catch (error) {
        console.error(`Erro no dia ${currentDay}:`, error);
        errors.push(`${displayDate}: ${error instanceof Error ? error.message : 'Falha na conexão'}`);
      }
    }

    setProgress(100);
    setStatus('done');
    
    setTimeout(() => {
      setStatus('idle');
      setProgress(0);
      setCurrentDayInfo('');

      if (errors.length > 0) {
        alert(
          `Análise Concluída!\n\n` +
          `✅ Sucessos: ${successCount} dia(s)\n` +
          `⚠️ Problemas em ${errors.length} dia(s):\n\n` +
          errors.join('\n')
        );
      } else {
        alert(`Sucesso! Foram analisados ${successCount} dia(s) corretamente.`);
      }

      // Final redirect
      (onFinish as any)(targetDates[targetDates.length - 1], format, [], true);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Analisar Monitorados</h2>
          <p className="text-slate-500">Escolha especificamente quem você deseja rastrear nesta edição.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Monitorados Salvos
              </h3>
              <button 
                onClick={toggleSelectAll}
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                {selectedIds.size === monitors.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
              {monitors.map(m => (
                <div key={m.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggleSelect(m.id)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.role} {m.rf ? `• ${m.rf}` : ''}</p>
                  </div>
                </div>
              ))}
              {monitors.length === 0 && (
                <p className="p-8 text-center text-gray-400 text-sm italic">Nenhum monitorado salvo.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Adicionar Temporário
            </h3>
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="Nome ou Unidade"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input 
                  type="text" 
                  placeholder="RF ou CIE"
                  value={tempRf}
                  onChange={e => setTempRf(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Cargo ou Tipo (Opcional)"
                  value={tempRole}
                  onChange={e => setTempRole(e.target.value)}
                  className="flex-1 text-sm p-2.5 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={addTempMonitor}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
                >
                  Adicionar
                </button>
              </div>

              {tempMonitors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Lista para esta análise:</p>
                  <div className="max-h-[150px] overflow-y-auto space-y-2">
                    {tempMonitors.map((tm, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
                        <div className="text-xs">
                          <span className="font-bold text-indigo-900">{tm.name}</span>
                          {tm.rf && <span className="ml-2 text-indigo-400">{tm.rf}</span>}
                        </div>
                        <button onClick={() => removeTempMonitor(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <hr className="my-8 border-gray-100" />

        <div className="space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
            <button 
              onClick={() => setAnalysisMode('single')}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${analysisMode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Dia Único
            </button>
            <button 
              onClick={() => setAnalysisMode('period')}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${analysisMode === 'period' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Busca por Período
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                {analysisMode === 'single' ? 'Data da Edição' : 'Data Inicial'}
              </label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            {analysisMode === 'period' ? (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Data Final</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={new Date(new Date(date).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Máximo de 5 dias</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Formato</label>
                <select 
                  value={format}
                  onChange={(e) => setFormat(e.target.value as DospFormat)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                >
                  <option value="JSON">JSON (Recomendado)</option>
                  <option value="CSV">CSV</option>
                  <option value="HTML">HTML</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {status === 'idle' ? (
          <button 
            onClick={handleStartAnalysis}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {analysisMode === 'single' ? 'Iniciar Análise Selecionada' : 'Iniciar Busca por Período'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <div className="flex flex-col">
                <span className="text-slate-600 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {status === 'loading' ? 'Conectando ao Diário Oficial...' : 'IA analisando ocorrências...'}
                </span>
                {currentDayInfo && <span className="text-[10px] text-blue-400 font-bold ml-6 uppercase mt-1">{currentDayInfo}</span>}
              </div>
              <span className="text-blue-600 font-black">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetedAnalysis;

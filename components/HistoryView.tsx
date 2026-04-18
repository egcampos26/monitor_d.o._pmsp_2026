
import React, { useState } from 'react';
import { AnalysisHistory } from '../types';
import * as XLSX from 'xlsx';

import HighlightText from './HighlightText';

interface HistoryViewProps {
  history: AnalysisHistory[];
  onClearHistory: (ids?: string[]) => void;
  onUpdateOccurrence: (historyId: string, occurrenceId: string, status: 'verified' | 'dismissed' | 'pending') => void;
  activeSubTab: 'data' | 'monitors';
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory, onUpdateOccurrence, activeSubTab }) => {
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletionMode, setIsDeletionMode] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [monitorSearch, setMonitorSearch] = useState('');

  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(h => h.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpandRow = (id: string) => {
    const next = new Set(expandedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRowIds(next);
  };

  const handleClearAction = () => {
    if (!isDeletionMode) {
      setIsDeletionMode(true);
      return;
    }

    if (selectedIds.size === 0) {
      setIsDeletionMode(false);
      return;
    }

    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000);
      return;
    }

    onClearHistory(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsDeletionMode(false);
    setIsConfirmingClear(false);
  };

  const handleExportXlsx = (entry: AnalysisHistory) => {
    const rows = entry.results.map(occ => ({
      'Nome do Servidor': occ.monitorName,
      'RF': occ.monitorRf,
      'Título da Matéria': occ.title,
      'Conteúdo': occ.content,
      'Página': occ.page || 'N/D',
      'Confiança': occ.confidence,
      'Tipo de Match': occ.matchType,
      'Link': occ.url,
      'Status': occ.status === 'verified' ? 'Verificado' : occ.status === 'dismissed' ? 'Ignorado' : 'Pendente'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ocorrências');
    XLSX.writeFile(wb, `DOSP_${entry.date}.xlsx`);
  };

  // Lógica para aba MONITORADOS
  const groupOccurrencesByMonitor = () => {
    const allOccs = history.flatMap(h => 
      h.results.map(occ => ({ ...occ, date: h.date, historyId: h.id }))
    );
    
    const groups: Record<string, { 
      name: string, 
      rf: string, 
      occurrences: any[] 
    }> = {};

    allOccs.forEach(occ => {
      const key = occ.monitorId || occ.monitorRf;
      if (!groups[key]) {
        groups[key] = {
          name: occ.monitorName,
          rf: occ.monitorRf,
          occurrences: []
        };
      }
      groups[key].occurrences.push(occ);
    });

    // Ordenar por monitor e filtrar por busca
    return Object.entries(groups)
      .filter(([_, data]) => 
        data.name.toLowerCase().includes(monitorSearch.toLowerCase()) || 
        data.rf.includes(monitorSearch)
      )
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
  };

  const groupedMonitors = groupOccurrencesByMonitor();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Análise do Diário Oficial</h2>
          <p className="text-slate-500 text-sm">Visualize ocorrências filtradas por data ou por monitorado.</p>
        </div>
      </div>

      {activeSubTab === 'data' ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Histórico por Edição</h3>
            <div className="flex items-center gap-2">
              {isDeletionMode && (
                <button 
                  onClick={() => {
                    setIsDeletionMode(false);
                    setSelectedIds(new Set());
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
              )}
              {history.length > 0 && (
                <button 
                  onClick={handleClearAction}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                    isConfirmingClear
                      ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-lg'
                      : selectedIds.size > 0 
                        ? 'bg-red-600 text-white hover:bg-red-700 border-red-600 shadow-md' 
                        : isDeletionMode 
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100'
                  }`}
                >
                  <svg className={`w-4 h-4 ${isConfirmingClear ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isConfirmingClear 
                    ? 'Certeza?' 
                    : isDeletionMode 
                      ? (selectedIds.size > 0 ? `Apagar (${selectedIds.size})` : 'Selecione')
                      : 'Limpar Tudo'
                  }
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-100 text-[11px] text-slate-500 uppercase font-black tracking-widest">
                <tr>
                  {isDeletionMode && <th className="px-6 py-4 w-10">
                    <input type="checkbox" checked={selectedIds.size === history.length && history.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                  </th>}
                  <th className="px-6 py-4">Data da Edição</th>
                  <th className="px-6 py-4">Servidores</th>
                  <th className="px-6 py-4">Ocorrências</th>
                  <th className="px-6 py-4">Formato</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {history.map(h => {
                  const isExpanded = expandedRowIds.has(h.id);
                  const isSelected = selectedIds.has(h.id);
                  
                  return (
                    <React.Fragment key={h.id}>
                      <tr className={`group transition-all duration-200 ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'} ${isExpanded ? 'bg-slate-50/30' : ''}`}>
                        {isDeletionMode && (
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectOne(h.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-base">{h.date}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                              Análise às {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-xs">
                            {h.monitorsFound} encontrados
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md font-bold text-xs ${h.totalOccurrences > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                            {h.totalOccurrences} totais
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[10px] uppercase font-black tracking-tight border border-indigo-100">
                            {h.format}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleExportXlsx(h)}
                              title="Exportar XLSX"
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => toggleExpandRow(h.id)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                                isExpanded 
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                                  : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'
                              }`}
                            >
                              {isExpanded ? 'Recolher' : 'Ver Detalhes'}
                              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr>
                          <td colSpan={isDeletionMode ? 6 : 5} className="p-0 border-b border-gray-100 bg-slate-50/50">
                            <div className="px-8 py-4 animate-in slide-in-from-top-4 duration-300">
                              <div className="space-y-3">
                                {h.results.map((occ) => (
                                  <OccurrenceAccordionItem 
                                    key={occ.id} 
                                    occ={occ} 
                                    onUpdateStatus={(status) => onUpdateOccurrence(h.id, occ.id, status)}
                                  />
                                ))}
                                {h.totalOccurrences === 0 && (
                                  <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                                    Nenhuma ocorrência relevante foi encontrada nesta análise.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-slate-400 font-medium">Nenhuma análise realizada ainda.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Citações por Monitorado</h3>
            <div className="relative w-72">
              <input 
                type="text" 
                placeholder="Buscar por nome ou RF..."
                value={monitorSearch}
                onChange={(e) => setMonitorSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="space-y-4">
            {groupedMonitors.map(([monitorId, data]) => (
              <div key={monitorId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                <div 
                  className="p-6 cursor-pointer hover:bg-slate-50/50 transition-all flex items-center justify-between"
                  onClick={() => toggleExpandRow(monitorId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {data.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 border-b border-transparent group-hover:border-blue-500 transition-all">{data.name}</h4>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">RF: {data.rf}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900 leading-tight">{data.occurrences.length}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Publicações</p>
                    </div>
                    <div className={`p-2 rounded-lg transition-transform duration-300 ${expandedRowIds.has(monitorId) ? 'rotate-180 bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {expandedRowIds.has(monitorId) && (
                  <div className="pl-6 md:pl-16 pr-6 pb-6 animate-in slide-in-from-top-2 duration-300 space-y-6">
                    <div className="border-t border-slate-50 pt-4">
                      {/* Agrupar ocorrências deste monitor por data */}
                      {Object.entries(
                        data.occurrences.reduce((acc: any, occ: any) => {
                          if (!acc[occ.date]) acc[occ.date] = [];
                          acc[occ.date].push(occ);
                          return acc;
                        }, {})
                      ).sort((a, b) => {
                         const parse = (d: string) => {
                           const [day, month, year] = d.split('/').map(Number);
                           return new Date(year, month - 1, day).getTime();
                         };
                         return parse(b[0]) - parse(a[0]);
                      }).map(([date, dateOccs]: [string, any]) => (
                        <div key={date} className="group/date flex items-center mb-6 last:mb-0">
                          {/* Coluna da Data com efeito 3D e Sobreposição */}
                          <div className="shrink-0 w-28 relative z-20 flex justify-end pr-0">
                            <span className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/40 transform translate-x-3 -rotate-1 border border-slate-800">
                              {date}
                            </span>
                          </div>
                          
                          {/* Espaçador/Linha vertical decorativa (opcional, ocultado para o efeito solicitado) */}
                          <div className="flex-1 space-y-2 relative z-10 pl-3 border-l-2 border-slate-50 py-1">
                            {dateOccs.map((occ: any) => (
                              <OccurrenceAccordionItem 
                                key={occ.id} 
                                occ={occ} 
                                compact={true}
                                onUpdateStatus={(status) => onUpdateOccurrence(occ.history_id || occ.historyId, occ.id, status)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {groupedMonitors.length === 0 && (
              <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Nenhum monitorado com publicações encontradas.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const OccurrenceAccordionItem: React.FC<{ 
  occ: any, 
  onUpdateStatus: (status: 'verified' | 'dismissed' | 'pending') => void,
  compact?: boolean 
}> = ({ occ, onUpdateStatus, compact }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSearchLink = occ.url.includes('ep_busca_materia');

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
      occ.status === 'verified' ? 'border-green-200 ring-1 ring-green-100' : 
      occ.status === 'dismissed' ? 'border-red-100 opacity-60 grayscale-[0.5]' : 
      'border-gray-100 hover:border-blue-200'
    }`}>
      <div 
        className={`${compact ? 'p-2.5' : 'p-4'} cursor-pointer flex items-start justify-between ${occ.status === 'verified' ? 'bg-green-50/30' : 'bg-white hover:bg-gray-50/50'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 p-1 rounded transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-600 bg-blue-50' : 'text-slate-300'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {!compact && (
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-black text-blue-600 uppercase tracking-tight">{occ.monitorName}</span>
                <span className="text-[10px] text-slate-400 font-mono">RF: {occ.monitorRf}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-0.5">
              {occ.status === 'verified' && (
                <span className="text-[8px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">VERIFICADO</span>
              )}
              {occ.status === 'dismissed' && (
                <span className="text-[8px] bg-slate-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">DESCARTADO</span>
              )}
              <h4 className={`font-bold ${compact ? 'text-[11px]' : 'text-xs'} line-clamp-1 ${occ.status === 'verified' ? 'text-green-800' : 'text-slate-700'}`}>{occ.title}</h4>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className={`flex items-center bg-slate-50 rounded-lg ${compact ? 'p-0.5' : 'p-1'} border border-slate-100 gap-1`}>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(occ.status === 'verified' ? 'pending' : 'verified'); }}
              className={`p-1.5 rounded-md transition-all ${
                occ.status === 'verified' 
                  ? 'bg-green-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(occ.status === 'dismissed' ? 'pending' : 'dismissed'); }}
              className={`p-1.5 rounded-md transition-all ${
                occ.status === 'dismissed' 
                  ? 'bg-red-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter ${
              occ.confidence === 'high' ? 'bg-green-100 text-green-700' : 
              occ.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 
              'bg-red-100 text-red-700'
            }`}>
              {occ.confidence === 'high' ? 'Alta' : occ.confidence === 'medium' ? 'Média' : 'Baixa'}
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">PG {occ.page}</span>
          </div>
        </div>
      </div>


      {isExpanded && (
        <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`p-3 rounded-lg border mb-3 italic text-[13px] leading-relaxed whitespace-pre-wrap border-l-4 ${
            occ.status === 'verified' ? 'bg-green-50/50 border-green-100 border-l-green-500 text-green-800' : 'bg-slate-50 border-slate-100 border-l-blue-400 text-slate-600'
          }`}>
            "<HighlightText text={occ.content} terms={[occ.monitorName, occ.monitorRf]} />"
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{occ.matchType}</span>
            <div className="flex items-center gap-2">
              {isSearchLink && (
                <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-2 py-1 rounded uppercase tracking-tighter">
                  Link de Busca
                </span>
              )}
              <a 
                href={occ.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-md shadow-blue-100 hover:scale-105"
              >
                {isSearchLink ? 'Buscar PMSP' : 'Abrir Matéria'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryView;

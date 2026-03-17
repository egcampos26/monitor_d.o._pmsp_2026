
import React, { useState } from 'react';
import { AnalysisHistory } from '../types';
import * as XLSX from 'xlsx';

import HighlightText from './HighlightText';

interface HistoryViewProps {
  history: AnalysisHistory[];
  onClearHistory: (ids?: string[]) => void;
  onUpdateOccurrence: (historyId: string, occurrenceId: string, status: 'verified' | 'dismissed' | 'pending') => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory, onUpdateOccurrence }) => {
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletionMode, setIsDeletionMode] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Análises</h2>
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
                ? 'Certeza? Clique denovo para Apagar' 
                : isDeletionMode 
                  ? (selectedIds.size > 0 ? `Apagar Selecionados (${selectedIds.size})` : 'Selecione os itens')
                  : 'Limpar Análises'
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
                        <span className="text-[10px] text-slate-400 font-mono">{h.id.slice(0, 8)}</span>
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
            {/* ... (empty state remains same) */}
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
    </div>
  );
};

const OccurrenceAccordionItem: React.FC<{ occ: any, onUpdateStatus: (status: 'verified' | 'dismissed' | 'pending') => void }> = ({ occ, onUpdateStatus }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSearchLink = occ.url.includes('ep_busca_materia');

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
      occ.status === 'verified' ? 'border-green-200 ring-1 ring-green-100' : 
      occ.status === 'dismissed' ? 'border-red-100 opacity-60 grayscale-[0.5]' : 
      'border-gray-100 hover:border-blue-200'
    }`}>
      <div 
        className={`p-4 cursor-pointer flex items-start justify-between ${occ.status === 'verified' ? 'bg-green-50/30' : 'bg-white hover:bg-gray-50/50'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4 flex-1">
          <div className={`mt-0.5 p-1 rounded transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-600 bg-blue-50' : 'text-slate-300'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-black text-blue-600 uppercase tracking-tight">{occ.monitorName}</span>
              <span className="text-[10px] text-slate-400 font-mono">RF: {occ.monitorRf}</span>
              {occ.status === 'verified' && (
                <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold animate-in zoom-in duration-300">VERIFICADO</span>
              )}
              {occ.status === 'dismissed' && (
                <span className="text-[9px] bg-slate-500 text-white px-1.5 py-0.5 rounded-full font-bold">DESCARTADO</span>
              )}
            </div>
            <h4 className={`font-bold text-xs line-clamp-1 ${occ.status === 'verified' ? 'text-green-800' : 'text-slate-700'}`}>{occ.title}</h4>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100 gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(occ.status === 'verified' ? 'pending' : 'verified'); }}
              title={occ.status === 'verified' ? "Desmarcar verificado" : "Marcar como verificado"}
              className={`p-1.5 rounded-md transition-all ${
                occ.status === 'verified' 
                  ? 'bg-green-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(occ.status === 'dismissed' ? 'pending' : 'dismissed'); }}
              title={occ.status === 'dismissed' ? "Remover do descarte" : "Indicar que não corresponde"}
              className={`p-1.5 rounded-md transition-all ${
                occ.status === 'dismissed' 
                  ? 'bg-red-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0 min-w-[60px]">
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
              occ.confidence === 'high' ? 'bg-green-100 text-green-700' : 
              occ.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 
              'bg-red-100 text-red-700'
            }`}>
              {occ.confidence === 'high' ? 'Alta' : occ.confidence === 'medium' ? 'Média' : 'Baixa'}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">PG {occ.page}</span>
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

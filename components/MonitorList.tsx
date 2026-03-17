
import React, { useState } from 'react';
import { ServerMonitor } from '../types';
import * as XLSX from 'xlsx';
import { normalizeString } from '../services/utils';

interface MonitorListProps {
  monitors: ServerMonitor[];
  onAdd: (monitor: Omit<ServerMonitor, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onToggle: (id: string) => void;
  onImport: (monitors: Omit<ServerMonitor, 'id' | 'createdAt'>[]) => void;
}

const MonitorList: React.FC<MonitorListProps> = ({ monitors, onAdd, onDelete, onDeleteAll, onToggle, onImport }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRf, setNewRf] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newRf || !newRole) return;
    onAdd({ name: newName, rf: newRf, role: newRole, notes: newNotes, active: true });
    setNewName('');
    setNewRf('');
    setNewRole('');
    setNewNotes('');
    setShowAdd(false);
  };

  const findHeaderIndex = (headers: string[], aliases: string[]): number => {
    return headers.findIndex(h => {
      const normalizedH = normalizeString(String(h || ''));
      return aliases.some(alias => normalizedH.includes(normalizeString(alias)));
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Obter dados como matriz (rows e columns)
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length < 2) {
          alert("O arquivo parece estar vazio ou não contém cabeçalhos.");
          return;
        }

        const headers = data[0].map(h => String(h || ''));
        
        // Mapeamento inteligente de colunas
        const colMap = {
          name: findHeaderIndex(headers, ['nome', 'servidor', 'completo', 'name']),
          rf: findHeaderIndex(headers, ['rf', 'registro', 'funcional', 'matricula']),
          role: findHeaderIndex(headers, ['cargo', 'funcao', 'função', 'role', 'atribuicao']),
          notes: findHeaderIndex(headers, ['obs', 'observacao', 'observação', 'notas', 'notes'])
        };

        // Validação mínima: Precisa ter pelo menos Nome ou RF
        if (colMap.name === -1 && colMap.rf === -1) {
          alert("Não foi possível identificar as colunas de 'Nome' ou 'RF'. Certifique-se de que a primeira linha contém os nomes das colunas.");
          return;
        }

        const imported: Omit<ServerMonitor, 'id' | 'createdAt'>[] = [];
        
        // Processar linhas (pulando o cabeçalho)
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const name = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
          const rf = colMap.rf !== -1 ? String(row[colMap.rf] || '').trim() : '';
          const role = colMap.role !== -1 ? String(row[colMap.role] || '').trim() : 'Não informado';
          const notes = colMap.notes !== -1 ? String(row[colMap.notes] || '').trim() : '';

          // Só importa se tiver dados mínimos
          if (name || rf) {
            imported.push({ 
              name: name.toUpperCase(), 
              rf: rf, 
              role: role,
              notes: notes, 
              active: true 
            });
          }
        }

        if (imported.length > 0) {
          onImport(imported);
        } else {
          alert("Nenhum dado válido encontrado nas linhas abaixo do cabeçalho.");
        }
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        alert("Erro ao ler o arquivo. Verifique se é um arquivo Excel (.xlsx, .xls) ou CSV válido.");
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleClearAll = () => {
    if (window.confirm("ATENÇÃO: Você tem certeza que deseja apagar TODOS os servidores da sua lista de monitoramento? Esta ação não pode ser desfeita.")) {
      onDeleteAll();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lista de Monitorados</h2>
          <p className="text-slate-500">Gerencie os servidores que o sistema deve rastrear no DOSP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {monitors.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Apagar Tudo
            </button>
          )}
          <label className={`cursor-pointer bg-white border border-gray-200 hover:border-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
            {isImporting ? (
              <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Importar Lista (CSV/Excel)
            <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Servidor
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-top duration-300">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input 
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RF</label>
              <input 
                required
                value={newRf}
                onChange={e => setNewRf(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 123.456.7"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
              <input 
                required
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Assessor II"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                <input 
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>
              <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-600 p-2.5 rounded-lg hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs text-slate-500 uppercase font-bold">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">RF</th>
              <th className="px-6 py-4">Cargo</th>
              <th className="px-6 py-4">Observações</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {monitors.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 group">
                <td className="px-6 py-4 font-semibold text-slate-900">{m.name}</td>
                <td className="px-6 py-4 font-mono text-slate-500">{m.rf}</td>
                <td className="px-6 py-4 text-slate-600">{m.role}</td>
                <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{m.notes || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => onToggle(m.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      m.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {m.active ? 'Ativo' : 'Pausado'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onDelete(m.id)}
                    className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {monitors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <p>Sua lista está vazia. Comece adicionando servidores para monitorar.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonitorList;

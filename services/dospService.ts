
import { DospFormat, DospOccurrence, ServerMonitor } from '../types';
import { normalizeString, normalizeRf, isNear } from './utils';
import { analyzeTextWithGemini } from './geminiService';
import { getPmspToken } from './pmspAuthService';
import { addSystemLog } from './logService';

/**
 * Converte HTML bruto em texto limpo decodificando entidades e removendo tags
 */
const extractTextFromHtml = (html: string): string => {
  if (!html) return '';
  // Usa o DOM do navegador para decodificar entidades HTML automaticamente
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || doc.body.innerText || '';
};

const PORTAL_API_URL = '/api/dosp-portal/md_epubli_controlador.php?acao=edicao_download';

/**
 * Retorna o link oficial da publicação ou a pesquisa direta no portal legado
 */
const generateDospLink = (date: string, term?: string, id?: string) => {
  const formattedDate = date.replace(/-/g, '');
  if (id && !id.startsWith('sim-') && !id.startsWith('m-default')) {
    // Note: No JSON do portal, o link já vem pronto no campo 'link'
    return id.startsWith('http') ? id : `https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=ep_materia_ver&id_materia=${id}`;
  }
  if (term) {
    const encodedTerm = encodeURIComponent(term);
    return `https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=ep_busca_materia&txt_termo_busca=${encodedTerm}`;
  }
  return `https://diariooficial.prefeitura.sp.gov.br/home/index.php?data=${formattedDate}`;
};

export const fetchDospEdition = async (date: string, format: DospFormat, monitors?: ServerMonitor[]): Promise<any[]> => {
  // Converter 2026-03-12 para 12/03/2026
  const parts = date.split('-');
  const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  
  addSystemLog('info', `Consultando Diário Aberto PMSP (Oficial)...`, `Data: ${formattedDate}`);
  
  try {
    const params = new URLSearchParams();
    params.append('hdnDtaEdicao', formattedDate);
    params.append('hdnTipoEdicao', 'C');
    params.append('hdnBolEdicaoGerada', 'false');
    params.append('hdnIdEdicao', '');
    params.append('hdnInicio', '0');
    params.append('hdnFormato', 'json');

    const response = await fetch(PORTAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      if (response.status === 500) {
        throw new Error(`O servidor da Prefeitura (Portal PMSP) está instável ou em manutenção no momento (Erro 500).`);
      }
      throw new Error(`O Portal DOSP retornou um erro inesperado: ${response.status}`);
    }

    const responseText = await response.text();
    
    // O servidor da PMSP às vezes anexa lixo após o JSON legítimo (e.g. scripts ou zeros)
    // Vamos limpar a string para pegar apenas o conteúdo entre as chaves/colchetes
    const cleanJsonResponse = (str: string) => {
      const firstChar = str.trim().charAt(0);
      let lastChar = '';
      if (firstChar === '{') lastChar = '}';
      else if (firstChar === '[') lastChar = ']';
      else return str;

      const lastIndex = str.lastIndexOf(lastChar);
      if (lastIndex !== -1) {
        return str.substring(0, lastIndex + 1);
      }
      return str;
    };

    const cleanedText = cleanJsonResponse(responseText);
    const data = JSON.parse(cleanedText);
    
    if (data && data.edicao && Array.isArray(data.edicao)) {
      addSystemLog('success', `Edição carregada com sucesso do Portal PMSP`, `${data.edicao.length} matérias encontradas.`);
      return data.edicao;
    }

    addSystemLog('warning', 'Portal PMSP não retornou matérias para esta data.', 'Verifique se o Diário Oficial já foi publicado.');
    return [];
  } catch (error) {
    addSystemLog('error', 'Falha ao processar dados do Portal PMSP', error);
    throw new Error('Não foi possível processar o Diário Aberto da Prefeitura devido a dados corrompidos no servidor deles.');
  }
};

export const analyzeEdition = async (editionData: any[], monitors: ServerMonitor[], analysisDate: string): Promise<DospOccurrence[]> => {
  const results: DospOccurrence[] = [];
  const activeMonitors = monitors.filter(m => m.active || m.id.startsWith('temp-'));

  addSystemLog('info', `Analisando matérias da edição...`, `${editionData.length} matérias | ${activeMonitors.length} monitores.`);

  for (const materia of editionData) {
    // O portal chama o texto de 'conteudo' (HTML) ou 'texto'
    const rawText = materia.conteudo || materia.texto || '';
    if (!rawText) continue;

    // Limpa HTML e decodifica entidades (e.g. &Ccedil; -> Ç) antes da normalização
    const text = extractTextFromHtml(rawText);
    const normText = normalizeString(text);
    
    for (const monitor of activeMonitors) {
      const normName = monitor.name ? normalizeString(monitor.name) : '';
      const normRf = monitor.rf ? normalizeRf(monitor.rf) : '';
      
      const hasName = normName !== '' && normText.includes(normName);
      const hasRf = normRf !== '' && normText.includes(normRf);
      
      if (hasName || hasRf) {
        addSystemLog('info', `Match encontrado: ${monitor.name || monitor.rf}`, `Matéria: ${materia.unidade || 'N/A'}`);

        // Validação via IA se possível e se o texto for relevante
        if (text.length > 100 && import.meta.env.VITE_GEMINI_API_KEY) {
          try {
            const aiResults = await analyzeTextWithGemini(text, [{ name: monitor.name, rf: monitor.rf }]);
            if (aiResults && aiResults.length > 0) {
              const filteredAi = aiResults.filter((r: any) => 
                (normName && normalizeString(r.monitorName).includes(normName)) || 
                (normRf && normalizeRf(r.monitorRf) === normRf)
              );
              
              if (filteredAi.length > 0) {
                results.push(...filteredAi.map((r: any) => ({
                  ...r,
                  id: crypto.randomUUID(),
                  monitorId: monitor.id,
                  // O link do portal já é absoluto
                  url: materia.link || generateDospLink(analysisDate, monitor.name, materia.documento)
                })));
                continue; 
              }
            }
          } catch (e) {
            // IA falhou ou quota excedida, segue para heurística
          }
        }

        let confidence: 'high' | 'medium' | 'low' = 'low';
        let matchType: 'exact' | 'flexible' | 'proximity' = 'exact';
        
        if (hasName && hasRf) {
          confidence = isNear(text, monitor.name, monitor.rf) ? 'high' : 'medium';
          matchType = 'proximity';
        } else if (hasRf) {
          confidence = 'medium';
          matchType = 'exact';
        } else if (hasName) {
          confidence = 'low';
          matchType = 'flexible';
        }
        
        results.push({
          id: crypto.randomUUID(),
          monitorId: monitor.id,
          monitorName: monitor.name,
          monitorRf: monitor.rf,
          title: materia.unidade || materia.orgao || 'Matéria DO',
          content: text.replace(/<[^>]*>/g, ' ').trim(), // Limpa HTML para o card
          page: materia.pagina || 'Diário Aberto',
          url: materia.link || generateDospLink(analysisDate, monitor.name, materia.documento),
          confidence,
          matchType
        });
      }
    }
  }
  
  return results;
};

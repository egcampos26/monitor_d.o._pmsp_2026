
import { GoogleGenAI, Type } from "@google/genai";

const getAi = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export const analyzeTextWithGemini = async (text: string, monitors: { name: string, rf: string }[]) => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn("API Key do Gemini não configurada. Usando heurística simples.");
    return [];
  }

  const ai = getAi();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Você é um especialista em análise do Diário Oficial da Prefeitura de São Paulo (PMSP).
    Sua tarefa é encontrar ocorrências dos servidores listados no texto abaixo.
    
    REGRAS DE OURO:
    1. Identifique o TÍTULO da matéria onde o nome foi encontrado (ex: ATOS DO PREFEITO, SECRETARIA DA SAÚDE).
    2. Extraia o contexto exato do parágrafo onde o nome aparece.
    3. Determine a confiança: 'high' se Nome e RF aparecem juntos; 'medium' se apenas RF exato aparece; 'low' se apenas nome similar aparece.
    4. Normalize o RF para o formato sem pontos.
    
    Servidores a procurar: ${JSON.stringify(monitors)}
    
    Texto da Edição:
    ${text.substring(0, 15000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              monitorRf: { type: Type.STRING },
              monitorName: { type: Type.STRING },
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              page: { type: Type.STRING },
              confidence: { 
                type: Type.STRING, 
                description: 'Deve ser: high, medium ou low' 
              }
            },
            required: ["monitorRf", "monitorName", "title", "content", "confidence"]
          }
        }
      }
    });

    const textOutput = response.text || "[]";
    return JSON.parse(textOutput);
  } catch (e) {
    console.error("Erro ao chamar ou analisar resposta do Gemini", e);
    return [];
  }
};

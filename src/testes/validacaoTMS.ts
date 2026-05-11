/**
 * Teste de Validação TMS - Validação ponta a ponta
 * Execute no console do navegador ou noDevTesteTMS
 */

import { supabase } from "@/lib/supabase";
import { getMapboxToken } from "@/services/maps/mapboxProvider";
import { validateEvolutionConfig, checkEvolutionStatus } from "@/services/integracoes/evolutionApiService";
import { validateN8nConfig, testN8nConnection } from "@/services/integracoes/n8nService";
import { validateAIConfig, testarGroq, testarGemini } from "@/services/integracoes/iaService";

interface ResultadoTeste {
  nome: string;
  status: "OK" | "FALHOU" | "NAO_CONFIGURADO";
  detalhes: string;
  tempoMs?: number;
}

const resultados: ResultadoTeste[] = [];

async function testarSupabase(): Promise<ResultadoTeste> {
  const t0 = Date.now();
  try {
    const { data, error } = await supabase.from("clientes").select("id").limit(1);
    const tempo = Date.now() - t0;
    
    if (error) throw error;
    return { nome: "Supabase", status: "OK", detalhes: `Conexão OK (${tempo}ms)`, tempoMs: tempo };
  } catch (e: any) {
    return { nome: "Supabase", status: "FALHOU", detalhes: e.message };
  }
}

async function testarMapbox(): Promise<ResultadoTeste> {
  const token = getMapboxToken();
  if (!token) {
    return { nome: "Mapbox", status: "NAO_CONFIGURADO", detalhes: "Token não encontrado no .env" };
  }
  return { nome: "Mapbox", status: "OK", detalhes: `Token: ${token.substring(0, 10)}...` };
}

async function testarEvolution(): Promise<ResultadoTeste> {
  const config = validateEvolutionConfig();
  if (!config.ok) {
    return { nome: "Evolution API", status: "NAO_CONFIGURADO", detalhes: config.error || "Não configurado" };
  }
  
  try {
    const result = await checkEvolutionStatus();
    if (result.ok) {
      return { nome: "Evolution API", status: "OK", detalhes: "Conectado e funcionando" };
    } else {
      return { nome: "Evolution API", status: "FALHOU", detalhes: result.error || "Erro na conexão" };
    }
  } catch (e: any) {
    return { nome: "Evolution API", status: "FALHOU", detalhes: e.message };
  }
}

async function testarN8n(): Promise<ResultadoTeste> {
  const config = validateN8nConfig();
  if (!config.ok) {
    return { nome: "n8n", status: "NAO_CONFIGURADO", detalhes: config.error || "Não configurado" };
  }
  
  try {
    const result = await testN8nConnection();
    if (result.ok) {
      return { nome: "n8n", status: "OK", detalhes: "Webhook Respondendo" };
    } else {
      return { nome: "n8n", status: "FALHOU", detalhes: result.error || "Erro na conexão" };
    }
  } catch (e: any) {
    return { nome: "n8n", status: "FALHOU", detalhes: e.message };
  }
}

async function testarIA(): Promise<ResultadoTeste> {
  const config = validateAIConfig();
  if (!config.ok) {
    return { nome: "IA (Groq/Gemini)", status: "NAO_CONFIGURADO", detalhes: config.error || "Não configurado" };
  }
  
  try {
    if (config.provider === 'groq') {
      const result = await testarGroq(import.meta.env.VITE_GROQ_API_KEY);
      return result.ok 
        ? { nome: "IA (Groq)", status: "OK", detalhes: `Conexão OK (${result.latencyMs}ms)`, tempoMs: result.latencyMs }
        : { nome: "IA (Groq)", status: "FALHOU", detalhes: result.error || "Erro" };
    } else {
      const result = await testarGemini(import.meta.env.VITE_GEMINI_API_KEY);
      return result.ok 
        ? { nome: "IA (Gemini)", status: "OK", detalhes: `Conexão OK (${result.latencyMs}ms)`, tempoMs: result.latencyMs }
        : { nome: "IA (Gemini)", status: "FALHOU", detalhes: result.error || "Erro" };
    }
  } catch (e: any) {
    return { nome: "IA", status: "FALHOU", detalhes: e.message };
  }
}

export async function executarValidacaoCompleta(): Promise<ResultadoTeste[]> {
  console.log("=== VALIDAÇÃO TMS ===");
  
  resultados.push(await testarSupabase());
  resultados.push(await testarMapbox());
  resultados.push(await testarEvolution());
  resultados.push(await testarN8n());
  resultados.push(await testarIA());
  
  console.table(resultados);
  
  const ok = resultados.filter(r => r.status === "OK").length;
  const nao = resultados.filter(r => r.status === "NAO_CONFIGURADO").length;
  const falha = resultados.filter(r => r.status === "FALHOU").length;
  
  console.log(`\nRESUMO: ${ok} OK | ${nao} Não Configurado | ${falha} Falhou`);
  
  return resultados;
}

executarValidacaoCompleta().then(console.log).catch(console.error);
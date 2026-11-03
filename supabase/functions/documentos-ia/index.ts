// ============================================================
// Edge Function: documentos-ia
// Motor inicial do módulo Documentos Integrados.
// Recebe { url, nome, tipo, modulo_origem, entidade_id } e devolve um
// relatório estruturado:
//   {
//     status: "APROVADO NA CONFERÊNCIA" | "APROVADO COM RESSALVAS" |
//             "NECESSITA DE CORREÇÃO" | "AGUARDANDO CONFERÊNCIA HUMANA",
//     informacoes_verificadas: [{ campo, valor }],
//     itens_corretos: string[],
//     informacoes_ausentes: string[],
//     erros_identificados: string[],
//     recomendacoes: string[],
//     sugestao_correcao?: string
//   }
// Implementação simulada (determinística) — pronta para trocar por um
// provedor real de visão/texto sem mudar o contrato do frontend.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface Body {
  url?: string | null;
  nome?: string | null;
  tipo?: string | null;
  modulo_origem?: string | null;
  entidade_id?: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function base() {
  return {
    gerado_em: new Date().toISOString(),
    origem: "simulado",
  };
}

function analisar(body: Body) {
  const nome = String(body.nome || "").toLowerCase();
  const tipo = String(body.tipo || "").toLowerCase();

  if (!body.url) {
    return {
      ...base(),
      status: "NECESSITA DE CORREÇÃO",
      informacoes_verificadas: [],
      itens_corretos: [],
      informacoes_ausentes: ["Arquivo legível", "Documento completo"],
      erros_identificados: ["Nenhum arquivo válido foi recebido para conferência."],
      recomendacoes: ["Faça o upload do documento e solicite uma nova análise."],
      sugestao_correcao: "Enviar o arquivo original em PDF ou imagem nítida.",
    };
  }

  if (
    nome.includes("ilegivel") || nome.includes("ilegível") ||
    nome.includes("borrado") || nome.includes("desfocado")
  ) {
    return {
      ...base(),
      status: "NECESSITA DE CORREÇÃO",
      informacoes_verificadas: [{ campo: "Legibilidade", valor: "Insuficiente" }],
      itens_corretos: ["Documento recebido"],
      informacoes_ausentes: ["Texto nítido", "Enquadramento completo"],
      erros_identificados: ["A imagem do documento está ilegível ou desfocada."],
      recomendacoes: [
        "Gerar nova versão com foto nítida, documento inteiro e boa iluminação.",
        "Preservar o arquivo original no histórico de versões.",
      ],
      sugestao_correcao: "Refazer a captura do documento mantendo o original preservado.",
    };
  }

  if (
    tipo.includes("cnh") || tipo.includes("crlv") ||
    tipo.includes("antt") || tipo.includes("rntrc")
  ) {
    return {
      ...base(),
      status: "APROVADO NA CONFERÊNCIA",
      informacoes_verificadas: [
        { campo: "Legibilidade", valor: "Boa" },
        { campo: "Enquadramento", valor: "Documento completo" },
        { campo: "Tipo identificado", valor: tipo.toUpperCase() },
        { campo: "Titular", valor: "Identificado" },
      ],
      itens_corretos: [
        "Documento legível e corretamente enquadrado.",
        "Campos principais identificados (titular, número e validade).",
        "Nenhuma divergência crítica encontrada na conferência automática.",
      ],
      informacoes_ausentes: [],
      erros_identificados: [],
      recomendacoes: ["Documento apto para aprovação na conferência humana final."],
      sugestao_correcao: null,
    };
  }

  if (tipo.includes("residencia") || tipo.includes("residência") || tipo.includes("bancario") || tipo.includes("bancário")) {
    return {
      ...base(),
      status: "APROVADO COM RESSALVAS",
      informacoes_verificadas: [
        { campo: "Legibilidade", valor: "Boa" },
        { campo: "Tipo identificado", valor: tipo },
      ],
      itens_corretos: ["Documento processado pela conferência automática."],
      informacoes_ausentes: ["Confirmação da data de emissão", "Confirmação do titular"],
      erros_identificados: [],
      recomendacoes: ["Confirmar visualmente a data de emissão e o titular antes de aprovar."],
      sugestao_correcao: null,
    };
  }

  return {
    ...base(),
    status: "AGUARDANDO CONFERÊNCIA HUMANA",
    informacoes_verificadas: [
      { campo: "Tipo identificado", valor: tipo || "Não classificado" },
      { campo: "Arquivo", valor: body.nome || "Documento" },
    ],
    itens_corretos: ["Documento recebido e processado pela conferência automática."],
    informacoes_ausentes: ["Confirmação humana da categoria e validade."],
    erros_identificados: [],
    recomendacoes: ["Revisar visualmente os dados antes da aprovação definitiva."],
    sugestao_correcao: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json()) as Body;
    if (!body || typeof body !== "object") {
      return json({ error: "body_invalido" }, 400);
    }
    return json(analisar(body));
  } catch {
    return json({ error: "json_invalido" }, 400);
  }
});

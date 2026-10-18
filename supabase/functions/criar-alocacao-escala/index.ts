import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tms-internal-token",
  "Content-Type": "application/json",
};

interface CriarAlocacaoPayload {
  prestador_id: string;
  data_escala: string;
  status?: string;
  tipo_veiculo?: string;
  turno?: string;
  placa?: string;
  origem?: string;
  destino?: string;
  rota?: string;
  regiao?: string;
  cliente_id?: string;
  cliente_nome?: string;
  ordem_servico_id?: string;
  valor_repasse?: number;
  valor_frete?: number;
  valor_pedagio?: number;
  valor_combustivel?: number;
  valor_ajudante?: number;
  valor_adicional?: number;
  valor_desconto?: number;
  valor_fixo?: number;
  km_realizados?: number;
  km_previstos?: number;
  horario_saida?: string;
  horario_retorno_previsto?: string;
  observacoes?: string;
  instrucoes_operacionais?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Corrige caracteres corrompidos conhecidos sem destruir acentos válidos.
 * Aplica apenas substituições pontuais para casos mapeados.
 */
function sanitizarTexto(valor: string | null | undefined): string | null {
  if (!valor) return valor ?? null;
  return valor
    .replace(/CONEX\?O/g, "CONEXÃO")
    .replace(/CONEX�O/g, "CONEXÃO")
    .replace(/CONEX\uFFFD\uFFFD?O/g, "CONEXÃO")
    .replace(/CONEX\uFFFD?O/g, "CONEXÃO");
}

interface RespostaPadrao {
  ok: boolean;
  id?: string;
  dados?: Record<string, unknown>;
  error?: string;
  detalhes?: string;
}

function responder(
  status: number,
  body: RespostaPadrao
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder(405, { ok: false, error: "Método não permitido. Use POST." });
  }

  try {
    // ============================================================
    // VALIDAR TOKEN INTERNO (proteção temporária)
    // ============================================================
    const tmsToken = Deno.env.get("TMS_EDGE_INTERNAL_TOKEN");
    const requestToken = req.headers.get("x-tms-internal-token");

    if (tmsToken && requestToken !== tmsToken) {
      console.warn("[criar-alocacao] Token inválido ou ausente");
      return responder(401, { ok: false, error: "Token de acesso inválido. Forneça x-tms-internal-token." });
    }

    // ============================================================
    // CLIENTE SUPABASE COM SERVICE_ROLE
    // ============================================================
    const supabaseUrl = Deno.env.get("EDGE_SUPABASE_URL");
    const supabaseKey = Deno.env.get("EDGE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[criar-alocacao] EDGE_SUPABASE_URL ou EDGE_SERVICE_ROLE_KEY não configurados");
      return responder(500, { ok: false, error: "Erro de configuração do servidor." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // VALIDAR PAYLOAD
    // ============================================================
    const body: CriarAlocacaoPayload = await req.json();
    console.log("[criar-alocacao] Payload recebido:", JSON.stringify(body));

    if (!body.prestador_id) {
      return responder(400, { ok: false, error: "Campo obrigatório: prestador_id" });
    }
    if (!body.data_escala) {
      return responder(400, { ok: false, error: "Campo obrigatório: data_escala" });
    }

    // ============================================================
    // MONTAR REGISTRO PARA INSERT
    // ============================================================
    const statusFinal = body.status || "aguardando_aceite";

    // Validar status permitido
    const statusValidos = [
      "planejada", "aguardando_aceite", "aceita", "recusada",
      "em_rota", "concluida", "cancelada", "ocorrencia",
    ];
    if (!statusValidos.includes(statusFinal)) {
      return responder(400, {
        ok: false,
        error: `Status inválido: "${statusFinal}". Use um dos: ${statusValidos.join(", ")}`,
      });
    }

    // Determinar tipo de operação
    const temRota = !!(body.origem || body.destino || body.rota);
    const tipoOperacao = temRota ? "escala" : "controle_diario";

    const registro = {
      prestador_id: body.prestador_id,
      data_escala: body.data_escala,
      status: statusFinal,
      status_pagamento: "pendente",

      // Dados operacionais (com sanitização de encoding)
      tipo_veiculo: body.tipo_veiculo || "vuc",
      turno: body.turno || "diurno",
      placa: body.placa || null,
      origem: sanitizarTexto(body.origem),
      destino: sanitizarTexto(body.destino),
      rota: body.rota || null,
      regiao: body.regiao || null,

      // Relacionamentos
      cliente_id: body.cliente_id || null,
      ordem_servico_id: body.ordem_servico_id || null,

      // Financeiro
      valor_repasse: body.valor_repasse || 0,
      valor_frete: body.valor_frete || 0,
      valor_pedagio: body.valor_pedagio || 0,
      valor_combustivel: body.valor_combustivel || 0,
      valor_ajudante: body.valor_ajudante || 0,
      valor_adicional: body.valor_adicional || 0,
      valor_desconto: body.valor_desconto || 0,
      valor_fixo: body.valor_fixo || 0,
      km_realizados: body.km_realizados || 0,
      km_previstos: body.km_previstos || 0,

      // Tempos
      horario_saida: body.horario_saida || null,
      horario_retorno_previsto: body.horario_retorno_previsto || null,

      // Observações (com sanitização de encoding)
      observacoes: sanitizarTexto(body.observacoes),
      instrucoes_operacionais: sanitizarTexto(body.instrucoes_operacionais),

      // Metadados (fundir com os obrigatórios)
      metadata: {
        origem_tms: true,
        precisa_aceite_app: true,
        tipo_operacao: tipoOperacao,
        criado_em: new Date().toISOString(),
        fonte: "tms_escala",
        cliente_nome: body.cliente_nome || null,
        ...(body.metadata || {}),
      },

      tags: body.tags || null,
    };

    console.log("[criar-alocacao] Registro para inserir:", JSON.stringify(registro));

    // ============================================================
    // EXECUTAR INSERT
    // ============================================================
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .insert([registro])
      .select()
      .single();

    if (error) {
      console.error("[criar-alocacao] Erro ao inserir:", JSON.stringify({
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      }, null, 2));
      return responder(500, {
        ok: false,
        error: "Erro ao criar alocação no banco de dados",
        detalhes: error.message,
        detalhes_completos: error.details || "",
        erro_code: error.code || "",
        erro_hint: error.hint || "",
      });
    }

    if (!data) {
      return responder(500, { ok: false, error: "Nenhum dado retornado após inserção" });
    }

    console.log("[criar-alocacao] Alocação criada com sucesso:", data.id);

    return responder(201, {
      ok: true,
      id: data.id,
      dados: data as unknown as Record<string, unknown>,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[criar-alocacao] Exceção:", msg);
    return responder(500, { ok: false, error: "Erro interno do servidor", detalhes: msg });
  }
});

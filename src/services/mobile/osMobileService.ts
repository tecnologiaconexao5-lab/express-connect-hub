// ============================================================
// OS MOBILE — camada de dados de campo.
//   • lista OS em aberto (com cliente/prestador)
//   • conclui a OS com recebedor, local, horário e comprovantes
//   • lista/baixa repasses de prestadores (financeiro_pagar)
//   • cria o contas a pagar do prestador avulso
// Nenhuma migration: usa as colunas já existentes da produção.
// ============================================================

import { supabase } from "@/lib/supabase";
import { uploadFotoPOD } from "@/services/podService";
import {
  buscarDadosEmpresaParaFatura,
  type DadosEmpresaFatura,
} from "@/services/financeiro/faturaService";

export interface OSMobileLista {
  id: string;
  numero: string | null;
  status: string;
  data: string | null;
  createdAt: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  prestadorId: string | null;
  prestadorNome: string | null;
  veiculoTipo: string | null;
  valorCliente: number;
  statusFaturamento?: string | null;
  custoPrestador: number;
  distanciaKm: number;
  origem: string | null;
  destino: string | null;
  peso: number;
  volumes: number;
  observacoesGerais: string | null;
  recebedorNome: string | null;
  recebedorDocumento: string | null;
  enderecos: Record<string, unknown>[];
  fechamento: FechamentoOSMobile | null;
  isMobile: boolean;
}

export interface FechamentoOSMobile {
  recebedor: string;
  documento: string;
  local: string;
  dataHoraEntrega: string;
  observacao: string;
  fotos: string[];
}

export interface RepasseMobile {
  id: string;
  descricao: string | null;
  valor: number;
  vencimento: string | null;
  data_vencimento: string | null;
  status: string | null;
  osId: string | null;
  osNumero: string | null;
  prestador: string | null;
  fornecedorNome: string | null;
  fornecedorDocumento: string | null;
  chavePix: string | null;
  observacoes: string | null;
  dataPagamento: string | null;
  isMobile: boolean;
}

interface OSRow {
  id: string;
  numero: string | null;
  status: string | null;
  data: string | null;
  created_at: string | null;
  cliente: string | null;
  cliente_id: string | null;
  prestador: string | null;
  prestador_id: string | null;
  veiculo_tipo: string | null;
  valor_cliente: number | string | null;
  status_faturamento: string | null;
  custo_prestador: number | string | null;
  distancia_km: number | string | null;
  origem: string | null;
  destino: string | null;
  peso: number | string | null;
  volumes: number | string | null;
  observacoes_gerais: string | null;
  recebedor_nome: string | null;
  recebedor_documento: string | null;
  enderecos: unknown;
  localizacao_entrega_json: unknown;
  carga: unknown;
  historico: unknown;
  anexos: unknown;
}

interface FinanceiroRow {
  id: string;
  descricao: string | null;
  valor: number | string | null;
  vencimento: string | null;
  data_vencimento: string | null;
  status: string | null;
  os_id: string | null;
  prestador: string | null;
  fornecedor_nome: string | null;
  fornecedor_documento: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  data_pagamento: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function osEhMobile(row: {
  carga?: unknown;
  observacoes_gerais?: string | null;
  observacoes?: string | null;
}): boolean {
  const carga = isObject(row.carga) ? row.carga : {};
  if (carga.origem === "os-mobile" || carga.mobile === true) return true;
  const textoOs = `${row.observacoes_gerais || ""} ${row.observacoes || ""}`;
  return textoOs.includes("[OS MOBILE]") || textoOs.toLowerCase().includes("os mobile");
}

function mapFechamento(valor: unknown): FechamentoOSMobile | null {
  if (!isObject(valor)) return null;
  const fotos = Array.isArray(valor.fotos) ? valor.fotos.filter((f): f is string => typeof f === "string") : [];
  const recebedor = texto(valor.recebedor);
  if (!recebedor && fotos.length === 0) return null;
  return {
    recebedor,
    documento: texto(valor.documento),
    local: texto(valor.local),
    dataHoraEntrega: texto(valor.data_hora_entrega) || texto(valor.dataHoraEntrega),
    observacao: texto(valor.observacao),
    fotos,
  };
}

function normalizarEnderecos(valor: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(isObject);
}

export async function listarOSAbertas(params: {
  status: string[];
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
}): Promise<OSMobileLista[]> {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(
        "id, numero, status, data, created_at, cliente, cliente_id, prestador, prestador_id, veiculo_tipo, valor_cliente, status_faturamento, custo_prestador, distancia_km, origem, destino, peso, volumes, observacoes_gerais, recebedor_nome, recebedor_documento, enderecos, localizacao_entrega_json, carga, historico, anexos",
      )
      .in("status", params.status)
      .order("created_at", { ascending: false })
      .limit(params.limite || 200);

    if (params.dataInicio) query = query.gte("data", params.dataInicio);
    if (params.dataFim) query = query.lte("data", params.dataFim);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as unknown as OSRow[];
    if (rows.length === 0) return [];

    const clienteIds = [...new Set(rows.map((r) => r.cliente || r.cliente_id).filter((v): v is string => Boolean(v)))];
    const prestadorIds = [...new Set(rows.map((r) => r.prestador || r.prestador_id).filter((v): v is string => Boolean(v)))];

    const [clientesRes, prestadoresRes] = await Promise.all([
      clienteIds.length
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      prestadorIds.length
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const clientesMap = new Map<string, string>();
    (clientesRes.data || []).forEach((c) => {
      const row = c as Record<string, unknown>;
      const nome = texto(row.nome_fantasia) || texto(row.razao_social);
      if (row.id && nome) clientesMap.set(String(row.id), nome);
    });

    const prestadoresMap = new Map<string, string>();
    (prestadoresRes.data || []).forEach((p) => {
      const row = p as Record<string, unknown>;
      if (row.id && row.nome_completo) prestadoresMap.set(String(row.id), String(row.nome_completo));
    });

    return rows.map((row) => {
      const clienteId = row.cliente || row.cliente_id || null;
      const prestadorId = row.prestador || row.prestador_id || null;
      return {
        id: row.id,
        numero: row.numero,
        status: row.status || "pendente",
        data: row.data,
        createdAt: row.created_at,
        clienteId,
        clienteNome: clienteId ? clientesMap.get(clienteId) || null : null,
        prestadorId,
        prestadorNome: prestadorId ? prestadoresMap.get(prestadorId) || null : null,
        veiculoTipo: row.veiculo_tipo,
        valorCliente: num(row.valor_cliente),
        statusFaturamento: row.status_faturamento,
        custoPrestador: num(row.custo_prestador),
        distanciaKm: num(row.distancia_km),
        origem: row.origem,
        destino: row.destino,
        peso: num(row.peso),
        volumes: num(row.volumes),
        observacoesGerais: row.observacoes_gerais,
        recebedorNome: row.recebedor_nome,
        recebedorDocumento: row.recebedor_documento,
        enderecos: normalizarEnderecos(row.enderecos),
        fechamento: mapFechamento(row.localizacao_entrega_json),
        isMobile: osEhMobile({ carga: row.carga, observacoes_gerais: row.observacoes_gerais }),
      };
    });
  } catch (error) {
    console.error("[osMobileService] Erro ao listar OS em aberto:", error);
    return [];
  }
}

export async function uploadComprovanteMobile(osId: string, file: File): Promise<string | null> {
  return uploadFotoPOD(file, `os-mobile/${osId}`);
}

export async function concluirOSMobile(
  osId: string,
  dados: FechamentoOSMobile,
  usuario?: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { data: atual, error: buscaError } = await supabase
      .from("ordens_servico")
      .select("historico, anexos, localizacao_entrega_json")
      .eq("id", osId)
      .single();

    if (buscaError) throw buscaError;

    const historicoAtual = Array.isArray((atual as { historico?: unknown })?.historico)
      ? ((atual as { historico?: unknown[] }).historico as unknown[])
      : [];
    const anexosAtual = Array.isArray((atual as { anexos?: unknown })?.anexos)
      ? ((atual as { anexos?: unknown[] }).anexos as unknown[])
      : [];

    const fechamento = {
      origem: "os-mobile",
      recebedor: dados.recebedor.trim(),
      documento: dados.documento.trim(),
      local: dados.local.trim(),
      data_hora_entrega: dados.dataHoraEntrega,
      observacao: dados.observacao.trim(),
      fotos: dados.fotos,
      registrado_em: new Date().toISOString(),
      registrado_por: usuario || null,
    };

    const historicoNovo = [
      ...historicoAtual,
      {
        data: new Date().toISOString(),
        acao: "baixa_campo_mobile",
        descricao: `Baixa de campo · recebedor: ${dados.recebedor.trim()} · local: ${dados.local.trim()}`,
        usuario: usuario || "os-mobile",
      },
    ];

    const anexosNovos = dados.fotos.length
      ? [
          ...anexosAtual,
          {
            tipo: "comprovante_entrega_mobile",
            criado_em: new Date().toISOString(),
            arquivos: dados.fotos,
          },
        ]
      : anexosAtual;

    const { error } = await supabase
      .from("ordens_servico")
      .update({
        status: "finalizada",
        recebedor_nome: dados.recebedor.trim(),
        recebedor_documento: dados.documento.trim() || null,
        localizacao_entrega_json: fechamento,
        historico: historicoNovo,
        anexos: anexosNovos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", osId);

    if (error) throw error;

    // Se a OS tiver alocação com prestador, alimenta também o POD oficial.
    try {
      const { data: alocacao } = await supabase
        .from("alocacoes_escala")
        .select("id, prestador_id")
        .eq("ordem_servico_id", osId)
        .limit(1)
        .maybeSingle();

      if (alocacao?.id && alocacao?.prestador_id) {
        const podPayload = {
          alocacao_id: alocacao.id,
          prestador_id: alocacao.prestador_id,
          ordem_servico_id: osId,
          nome_recebedor: dados.recebedor.trim(),
          documento_recebedor: dados.documento.trim() || null,
          receiver_relationship: dados.local.trim() || null,
          observacao: dados.observacao.trim() || null,
          foto_entrega_url: dados.fotos[0] || null,
          data_hora_entrega: dados.dataHoraEntrega,
          status: "entregue",
        };

        const { data: podExistente } = await supabase
          .from("entregas_protocolo")
          .select("id")
          .eq("alocacao_id", alocacao.id)
          .maybeSingle();

        if (podExistente?.id) {
          await supabase.from("entregas_protocolo").update(podPayload).eq("id", podExistente.id);
        } else {
          await supabase.from("entregas_protocolo").insert([podPayload]);
        }
      }
    } catch (podError) {
      console.warn("[osMobileService] POD opcional não gravado:", podError);
    }

    return { ok: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error("[osMobileService] Erro ao concluir OS:", mensagem);
    return { ok: false, erro: mensagem };
  }
}

export async function listarRepassesPendentes(): Promise<RepasseMobile[]> {
  try {
    const { data, error } = await supabase
      .from("financeiro_pagar")
      .select(
        "id, descricao, valor, vencimento, data_vencimento, status, os_id, prestador, fornecedor_nome, fornecedor_documento, chave_pix, observacoes, data_pagamento",
      )
      .in("status", ["pendente", "aberto", "parcial"])
      .order("vencimento", { ascending: true })
      .limit(300);

    if (error) throw error;

    const rows = ((data || []) as unknown as FinanceiroRow[]).filter(
      (r) => Boolean(r.os_id || r.prestador || r.fornecedor_nome),
    );
    if (rows.length === 0) return [];

    const osIds = [...new Set(rows.map((r) => r.os_id).filter((v): v is string => Boolean(v)))];
    const osMap = new Map<string, { numero: string | null; isMobile: boolean }>();

    if (osIds.length) {
      const { data: oss } = await supabase
        .from("ordens_servico")
        .select("id, numero, carga, observacoes_gerais")
        .in("id", osIds);

      (oss || []).forEach((o) => {
        const row = o as Record<string, unknown>;
        osMap.set(String(row.id), {
          numero: typeof row.numero === "string" ? row.numero : null,
          isMobile: osEhMobile({
            carga: row.carga,
            observacoes_gerais: typeof row.observacoes_gerais === "string" ? row.observacoes_gerais : null,
          }),
        });
      });
    }

    const prestadorIds = [
      ...new Set(
        rows
          .map((r) => r.prestador)
          .filter((v): v is string => Boolean(v) && /^[0-9a-f-]{36}$/i.test(String(v))),
      ),
    ];
    const pixPrestador = new Map<string, string>();

    if (prestadorIds.length) {
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("id, chave_pix")
        .in("id", prestadorIds);

      (prestadoresData || []).forEach((p) => {
        const row = p as Record<string, unknown>;
        const chave = typeof row.chave_pix === "string" ? row.chave_pix.trim() : "";
        if (row.id && chave) pixPrestador.set(String(row.id), chave);
      });
    }

    return rows.map((row) => {
      const os = row.os_id ? osMap.get(row.os_id) : undefined;
      const obsLower = (row.observacoes || "").toLowerCase();
      const marcadorMobile = obsLower.includes("os mobile") || obsLower.includes("os-mobile");
      return {
        id: row.id,
        descricao: row.descricao,
        valor: num(row.valor),
        vencimento: row.vencimento || row.data_vencimento,
        data_vencimento: row.data_vencimento,
        status: row.status,
        osId: row.os_id,
        osNumero: os?.numero || null,
        prestador: row.prestador,
        fornecedorNome: row.fornecedor_nome,
        fornecedorDocumento: row.fornecedor_documento,
        chavePix: row.chave_pix || (row.prestador ? pixPrestador.get(row.prestador) || null : null),
        observacoes: row.observacoes,
        dataPagamento: row.data_pagamento,
        isMobile: Boolean(os?.isMobile || marcadorMobile),
      };
    });
  } catch (error) {
    console.error("[osMobileService] Erro ao listar repasses:", error);
    return [];
  }
}

export async function marcarRepassePago(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("financeiro_pagar")
      .update({
        status: "pago",
        data_pagamento: hoje,
        data_efetiva_pgto: hoje,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    return { ok: false, erro: mensagem };
  }
}

export async function criarFinanceiroPrestadorAvulso(params: {
  osId: string;
  osNumero: string | null;
  valor: number;
  nome: string;
  documento: string;
  telefone: string;
  origem: string;
  pixTipo: string;
  pixChave: string;
}): Promise<{ ok: boolean; erro?: string }> {
  try {
    const hoje = new Date();
    const vencimento = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { error } = await supabase.from("financeiro_pagar").insert([
      {
        descricao: `Repasse OS Mobile · ${params.osNumero || params.osId}`,
        valor: Math.round(params.valor * 100) / 100,
        vencimento,
        data_vencimento: vencimento,
        data_emissao: hoje.toISOString().split("T")[0],
        status: "pendente",
        os_id: params.osId,
        fornecedor_nome: params.nome || "Prestador avulso",
        fornecedor_documento: params.documento || null,
        chave_pix: params.pixChave.trim() || null,
        observacoes:
          `Prestador avulso cadastrado via /os-mobile · OS ${params.osNumero || params.osId}` +
          ` · WhatsApp: ${params.telefone.trim()}` +
          ` · Origem: ${params.origem.trim()}` +
          ` · PIX ${params.pixTipo}: ${params.pixChave.trim()}`,
      },
    ]);

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    return { ok: false, erro: mensagem };
  }
}

export async function buscarEmpresaMobile(): Promise<DadosEmpresaFatura | null> {
  try {
    return await buscarDadosEmpresaParaFatura();
  } catch {
    return null;
  }
}

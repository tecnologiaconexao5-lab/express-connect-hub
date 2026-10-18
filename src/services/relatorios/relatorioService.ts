import { supabase } from "@/lib/supabase";
import { calcularRepassePrestador } from "@/helpers/calculoRepassePrestador";

export interface FiltrosFaturamento {
  dataInicial?: string;
  dataFinal?: string;
  cliente?: string;
  status?: string;
  tipoOperacao?: string;
  filial?: string;
  buscaNome?: string;
  buscaCNPJ?: string;
  buscaOS?: string;
}

export interface FiltrosPagamento {
  dataInicial?: string;
  dataFinal?: string;
  prestador?: string;
  prestadorId?: string;
  cliente?: string;
  tipoOperacao?: string;
  statusPagamento?: string;
  filial?: string;
}

export interface FiltrosPrestador {
  nome?: string;
  cpfCnpj?: string;
  clienteVinculado?: string;
  periodo?: string;
  statusOperacional?: string;
  tipoPrestador?: string;
  scoreMinimo?: number;
  cidade?: string;
  uf?: string;
  veiculo?: string;
  categoria?: string;
}

const fmtData = (d: string) => d ? new Date(d + "T12:00:00") : null;

/** Detecta se o texto parece um UUID (id técnico). */
function pareceUuid(valor?: string | null): boolean {
  if (!valor) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor).trim());
}

interface ClienteResolvido {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  uf: string;
}

/**
 * Resolve referências de cliente (UUID de `ordens_servico.cliente` OU nome
 * legado em texto) para os dados reais de `clientes`. Retorna um mapa chaveado
 * pelo id e pelos nomes, para que `o.cliente` (UUID ou nome) resolva sempre.
 */
async function resolverClientesPorReferencias(refs: string[]): Promise<Map<string, ClienteResolvido>> {
  const mapa = new Map<string, ClienteResolvido>();
  const unicos = [...new Set((refs || []).filter(Boolean))];
  if (unicos.length === 0) return mapa;

  const uuids = unicos.filter((r) => pareceUuid(r));
  const nomes = unicos.filter((r) => !pareceUuid(r));

  const adicionar = (c: ClienteResolvido) => {
    if (!c) return;
    mapa.set(c.id, c);
    if (c.nome_fantasia) mapa.set(c.nome_fantasia, c);
    if (c.razao_social) mapa.set(c.razao_social, c);
  };

  if (uuids.length > 0) {
    const { data } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social, cnpj, cidade, uf")
      .in("id", uuids);
    ((data || []) as ClienteResolvido[]).forEach(adicionar);
  }
  if (nomes.length > 0) {
    const orFilters = nomes.map((n) => `nome_fantasia.ilike.%${n}%,razao_social.ilike.%${n}%`).join(",");
    const { data } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social, cnpj, cidade, uf")
      .or(orFilters);
    ((data || []) as ClienteResolvido[]).forEach(adicionar);
  }
  return mapa;
}

export const buscarDadosFaturamento = async (filtros: FiltrosFaturamento) => {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data,
        cliente, status, valor_cliente,
        custo_prestador,
        veiculo_tipo, enderecos, adicionais, descontos, pedagio
      `)
      .neq("status", "cancelada");

    if (filtros.dataInicial) {
      query = query.gte("created_at", filtros.dataInicial + "T00:00:00-03:00");
    }
    if (filtros.dataFinal) {
      query = query.lte("created_at", filtros.dataFinal + "T23:59:59-03:00");
    }
    if (filtros.status && filtros.status !== "todos") {
      query = query.eq("status", filtros.status);
    }
    if (filtros.buscaOS) {
      query = query.ilike("numero", `%${filtros.buscaOS}%`);
    }

    const { data: osData, error } = await query;
    if (error) throw error;

    let osList = osData || [];

    if (filtros.buscaNome) {
      const term = filtros.buscaNome.toLowerCase();
      osList = osList.filter((o: any) =>
        (o.cliente || "").toLowerCase().includes(term)
      );
    }

    const clienteNomesUnicos = [...new Set(osList.map((o: any) => o.cliente).filter(Boolean))];

    // TMS-S04C — resolve o cliente REAL (nome/razão social + CNPJ) a partir do
    // UUID oficial de ordens_servico.cliente (ou nome legado). Nunca UUID.
    const clientesMap = await resolverClientesPorReferencias(clienteNomesUnicos);
    const clientesData = [...new Map([...clientesMap.entries()].filter(([k]) => pareceUuid(k)).map(([, v]) => [v.id, v])).values()];

    const osPorCliente = new Map<string, any[]>();
    for (const os of osList) {
      const key = os.cliente || "avulso";
      if (!osPorCliente.has(key)) osPorCliente.set(key, []);
      osPorCliente.get(key)!.push(os);
    }

    const receberStatus = await supabase
      .from("financeiro_receber")
      .select("cliente, os_id, valor, status");

    const clienteIdPorNome = new Map<string, string>();
    for (const c of clientesData) {
      if (c.nome_fantasia) clienteIdPorNome.set(c.nome_fantasia, c.id);
      if (c.razao_social) clienteIdPorNome.set(c.razao_social, c.id);
    }

    const financeiroPorCliente = new Map<string, { pago: number; pendente: number }>();
    for (const r of (receberStatus.data || [])) {
      const clienteId = clienteIdPorNome.get(r.cliente) || r.cliente || "avulso";
      if (!financeiroPorCliente.has(clienteId)) {
        financeiroPorCliente.set(clienteId, { pago: 0, pendente: 0 });
      }
      const entry = financeiroPorCliente.get(clienteId)!;
      if (r.status === "paga") {
        entry.pago += Number(r.valor) || 0;
      } else {
        entry.pendente += Number(r.valor) || 0;
      }
    }

    const resultado: any[] = [];
    for (const [clienteNome, operacoes] of osPorCliente) {
      const clienteInfo = clientesMap.get(clienteNome);
      const fin = financeiroPorCliente.get(clienteInfo?.id || clienteNome) || { pago: 0, pendente: 0 };
      const totalFaturado = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0), 0);
      const qtd = operacoes.length;
      const margemTotal = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0) - (Number(o.custo_prestador) || 0), 0);

      resultado.push({
        cliente_id: clienteInfo?.id || clienteNome,
        cliente_nome: clienteInfo?.nome_fantasia || clienteInfo?.razao_social || (pareceUuid(clienteNome) ? "Avulso" : clienteNome),
        cliente_cnpj: clienteInfo?.cnpj || "-",
        quantidade_os: qtd,
        valor_faturado: totalFaturado,
        valor_pago: fin.pago,
        valor_pendente: fin.pendente,
        ticket_medio: qtd > 0 ? totalFaturado / qtd : 0,
        ultima_operacao: operacoes.reduce((latest, o) => {
          return o.data > latest ? o.data : latest;
        }, ""),
        margem_total: margemTotal,
        operacoes: operacoes,
      });
    }

    if (filtros.buscaCNPJ) {
      const term = filtros.buscaCNPJ.replace(/\D/g, "");
      return resultado.filter((r) =>
        r.cliente_cnpj.replace(/\D/g, "").includes(term)
      );
    }

    return resultado.sort((a, b) => b.valor_faturado - a.valor_faturado);
  } catch (err) {
    console.error("[RelatorioService] Erro faturamento:", err);
    throw err;
  }
};

export const buscarDadosFaturamentoDetalhado = async (filtros: FiltrosFaturamento) => {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data,
        cliente, status, valor_cliente,
        custo_prestador,
        veiculo_tipo, enderecos, adicionais, descontos, pedagio
      `)
      .neq("status", "cancelada");

    if (filtros.dataInicial) query = query.gte("created_at", filtros.dataInicial + "T00:00:00-03:00");
    if (filtros.dataFinal) query = query.lte("created_at", filtros.dataFinal + "T23:59:59-03:00");
    if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);
    if (filtros.cliente) query = query.ilike("cliente", `%${filtros.cliente}%`);
    if (filtros.buscaOS) query = query.ilike("numero", `%${filtros.buscaOS}%`);

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];

    // TMS-S04C — resolve o cliente REAL (nome/razão social + CNPJ) a partir do
    // UUID oficial de ordens_servico.cliente (ou nome legado). Nunca UUID.
    const clienteRefs = [...new Set(result.map((o) => String(o?.cliente || "")).filter(Boolean))];
    const cmap = await resolverClientesPorReferencias(clienteRefs);
    result = result.map((o) => {
      const ref = String(o?.cliente || "");
      const c = cmap.get(ref);
      return {
        ...o,
        cliente_nome: c?.nome_fantasia || c?.razao_social || (pareceUuid(ref) ? "Avulso" : ref || "Avulso"),
        cliente_cnpj: c?.cnpj || "-",
      };
    });

    return result;
  } catch (err) {
    console.error("[RelatorioService] Erro faturamento detalhado:", err);
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TMS-S04C — RELATÓRIO INDIVIDUAL DE FATURAMENTO DO CLIENTE
// Documento profissional enviado ao cliente para conferência de faturamento.
// Fonte: ordens_servico do cliente (UUID oficial `cliente`) no período.
// ═══════════════════════════════════════════════════════════════════════════

export interface OperacaoFaturamentoIndividual {
  id: string;
  numero: string;
  data: string;
  romaneio: string;
  veiculo: string;          // "Tipo · Placa" (real)
  trajeto: string;          // "Origem › Destino" (natural)
  origem: "os" | "manual";  // identificação interna (não exibida ao cliente)
  valorBase: number;        // OS: derivado p/ exibição; Manual: fatura_itens.valor_base
  kmAdicional: number;      // OS: adicionais.jsonb.km_excedente; Manual: fatura_itens.km_excedente
  pedagio: number;          // OS: ordens_servico.pedagio (cobrado do cliente); Manual: fatura_itens.pedagio_cliente
  reembolso: number;        // 0 — sem campo estruturado (documentado)
  descontos: number;        // OS: ordens_servico.descontos; Manual: fatura_itens.valor_descontos
  valorTotal: number;       // oficial = valor_cliente (OS) / fatura_itens.valor_total (Manual)
}

export interface FaturamentoIndividualCliente {
  cliente: { id: string; nome: string; cnpj: string };
  periodoInicio: string;
  periodoFim: string;
  operacoes: OperacaoFaturamentoIndividual[];
  resumo: {
    quantidade: number;
    valorBase: number;
    kmAdicional: number;
    pedagio: number;
    reembolso: number;
    descontos: number;
    totalFaturado: number;
  };
}

/** Extrai valor numérico de um campo jsonb (número puro ou objeto {valor} / soma). */
export function extrairValorJsonb(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === "string") {
    const n = Number(String(valor).replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    if ("valor" in obj) return extrairValorJsonb(obj.valor);
    return Object.values(obj).reduce((s, v) => s + extrairValorJsonb(v), 0);
  }
  return 0;
}

/**
 * Busca as operações de UM cliente no período para o relatório individual.
 * `clienteId` é obrigatório (UUID de clientes.id). Retorna cliente resolvido +
 * operações com os campos financeiros reais da OS.
 */
export const buscarDadosFaturamentoIndividual = async (
  params: { clienteId: string; dataInicial?: string; dataFinal?: string }
): Promise<FaturamentoIndividualCliente | null> => {
  const { clienteId, dataInicial, dataFinal } = params || {};
  if (!clienteId) throw new Error("clienteId é obrigatório");

  const cmap = await resolverClientesPorReferencias([clienteId]);
  const clienteInfo = cmap.get(clienteId);
  if (!clienteInfo) {
    throw new Error("Cliente não encontrado");
  }

  let query = supabase
    .from("ordens_servico")
    .select(`
      id, numero, data, data_servico, created_at,
      cliente, status, valor_cliente,
      romaneio, veiculo_tipo, tipo_veiculo, placa_alocada,
      pedagio, adicionais, descontos, desconto,
      origem, destino, enderecos
    `)
    .eq("cliente", clienteId)
    .neq("status", "cancelada");

  if (dataInicial) query = query.gte("data", dataInicial);
  if (dataFinal) query = query.lte("data", dataFinal);

  const { data, error } = await query.order("data", { ascending: true });
  if (error) throw error;
  const oss = (data || []) as Record<string, unknown>[];
  const osIdsPresentes = new Set(oss.map((o) => String(o.id || "")).filter(Boolean));

  // ══ 1) ORDEM DE SERVIÇO (fonte oficial do faturamento por OS/romaneio) ═══
  // A Escala que originou a OS NÃO é somada à parte — a OS já a representa.
  const operacoes: OperacaoFaturamentoIndividual[] = oss.map((o) => {
    const valorTotal = Number(o.valor_cliente) || 0;
    const pedagio = Number(o.pedagio) || 0;
    const descontos = Number(o.descontos ?? o.desconto) || 0;
    const adicionaisValor = extrairValorJsonb(o.adicionais);
    const adicionaisObj = o.adicionais && typeof o.adicionais === "object" ? (o.adicionais as Record<string, unknown>) : null;
    const kmAdicional = adicionaisObj ? extrairValorJsonb(adicionaisObj.km_excedente) : 0;
    // Valor Base = total oficial − adicionais − pedágio + descontos (exibição).
    const valorBase = valorTotal - adicionaisValor - pedagio + descontos;

    const tipo = String(o.veiculo_tipo || o.tipo_veiculo || "").trim();
    const placa = String(o.placa_alocada || "").trim();
    const veiculo = [tipo, placa].filter(Boolean).join(" · ") || "—";

    const trajeto = montarTrajetoIndividual(o);

    return {
      id: String(o.id || ""),
      numero: String(o.numero || ""),
      data: String(o.data_servico || o.data || o.created_at || ""),
      romaneio: String(o.romaneio || ""),
      veiculo,
      trajeto,
      origem: "os" as const,
      valorBase,
      kmAdicional,
      pedagio,
      reembolso: 0,
      descontos,
      valorTotal,
    };
  });

  // ══ 2) LANÇAMENTOS MANUAIS DE FATURAMENTO (faturas manuais oficiais) ══════
  // Fonte: faturas.metadata.origem='manual' + fatura_itens do cliente.
  // Regra de deduplicação: item com os_id já presente nas OS → NÃO soma de novo.
  try {
    let mq = supabase
      .from("faturas")
      .select(`
        id, numero, data_emissao, status, metadata,
        fatura_itens(
          id, os_id, romaneio, descricao, data_servico,
          valor_base, valor_adicionais, valor_descontos, valor_total,
          km_excedente, pedagio_cliente
        )
      `)
      .eq("cliente_id", clienteId)
      .eq("metadata->>origem", "manual")
      .neq("status", "cancelada");
    if (dataInicial) mq = mq.gte("data_emissao", dataInicial);
    if (dataFinal) mq = mq.lte("data_emissao", dataFinal);
    const { data: faturasManual } = await mq;
    const manualItens: OperacaoFaturamentoIndividual[] = [];
    for (const fatura of (faturasManual || []) as Record<string, unknown>[]) {
      const faturaData = String(fatura.data_emissao || "");
      const faturaNumero = String(fatura.numero || "");
      const itens = Array.isArray(fatura.fatura_itens) ? (fatura.fatura_itens as Record<string, unknown>[]) : [];
      for (const item of itens) {
        const osId = String(item.os_id || "");
        if (osId && osIdsPresentes.has(osId)) continue; // já representado pela OS
        const dataServico = String(item.data_servico || faturaData || "");
        if (dataInicial && dataServico && dataServico < dataInicial) continue;
        if (dataFinal && dataServico && dataServico > dataFinal) continue;
        manualItens.push({
          id: `man-${String(item.id || "")}`,
          numero: faturaNumero,
          data: dataServico || faturaData,
          romaneio: String(item.romaneio || ""),
          veiculo: "—",
          trajeto: String(item.descricao || "").trim(),
          origem: "manual" as const,
          valorBase: Number(item.valor_base) || 0,
          kmAdicional: Number(item.km_excedente) || 0,
          pedagio: Number(item.pedagio_cliente) || 0,
          reembolso: 0,
          descontos: Number(item.valor_descontos) || 0,
          valorTotal: Number(item.valor_total) || 0,
        });
      }
    }
    operacoes.push(...manualItens);
  } catch (e) {
    console.warn("[FaturamentoIndividual] lançamentos manuais não carregados:", e);
  }

  // Ordenação cronológica (OS + lançamentos manuais) para tela e PDF.
  operacoes.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));

  const resumo = operacoes.reduce(
    (acc, o) => {
      acc.quantidade += 1;
      acc.valorBase += o.valorBase;
      acc.kmAdicional += o.kmAdicional;
      acc.pedagio += o.pedagio;
      acc.reembolso += o.reembolso;
      acc.descontos += o.descontos;
      acc.totalFaturado += o.valorTotal;
      return acc;
    },
    { quantidade: 0, valorBase: 0, kmAdicional: 0, pedagio: 0, reembolso: 0, descontos: 0, totalFaturado: 0 }
  );

  return {
    cliente: {
      id: clienteInfo.id,
      nome: clienteInfo.nome_fantasia || clienteInfo.razao_social || "Cliente",
      cnpj: clienteInfo.cnpj || "",
    },
    periodoInicio: dataInicial || "",
    periodoFim: dataFinal || "",
    operacoes,
    resumo,
  };
};

/** Monta o trajeto natural ("Origem › Destino") a partir dos endereços/OS. */
function montarTrajetoIndividual(o: Record<string, unknown>): string {
  const origem = String(o.origem || "").trim();
  const destino = String(o.destino || "").trim();
  if (origem || destino) {
    const partes = [origem, destino].filter(Boolean);
    if (partes.length > 0) return partes.join(" › ");
  }
  const enderecos = Array.isArray(o.enderecos) ? (o.enderecos as Record<string, unknown>[]) : [];
  if (enderecos.length > 0) {
    const prim = enderecos[0];
    const ult = enderecos[enderecos.length - 1];
    const cid = (e: Record<string, unknown>) => String(e?.cidade || e?.estado || "").trim();
    const partes = [cid(prim), cid(ult)].filter(Boolean);
    if (partes.length > 0) return partes.join(" › ");
  }
  return "";
}

export const buscarDadosPagamentoPrestador = async (filtros: FiltrosPagamento) => {
  try {
    let prestadorNomeFiltro = "";
    let prestadorIdFiltro = filtros.prestadorId || "todos";
    if (prestadorIdFiltro !== "todos") {
      const { data: prest } = await supabase
        .from("prestadores")
        .select("id, nome_completo")
        .eq("id", prestadorIdFiltro)
        .single();
      if (prest?.nome_completo) {
        prestadorNomeFiltro = prest.nome_completo;
      }
    }

    // --- 1. Buscar de ordens_servico ---
    let queryOS = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data,
        prestador, cliente, cliente_id, prestador_id,
        status, veiculo_tipo,
        valor_cliente, custo_prestador,
        pedagio, adicionais, descontos,
        enderecos
      `);

    if (prestadorNomeFiltro) queryOS = queryOS.ilike("prestador", `%${prestadorNomeFiltro}%`);
    if (filtros.dataInicial) queryOS = queryOS.gte("created_at", filtros.dataInicial + "T00:00:00-03:00");
    if (filtros.dataFinal) queryOS = queryOS.lte("created_at", filtros.dataFinal + "T23:59:59-03:00");

    const { data: dataOS, error: errOS } = await queryOS;
    if (errOS) throw errOS;

    // --- 2. Buscar de alocacoes_escala (sem prestador_nome/cliente_nome - nao existem) ---
    let queryEsc = supabase
      .from("alocacoes_escala")
      .select(`
        id, created_at, data_escala,
        prestador_id, cliente_id,
        status, tipo_veiculo,
        valor_repasse, valor_fixo, valor_frete,
        metadata
      `);
    if (prestadorIdFiltro !== "todos") {
      queryEsc = queryEsc.eq("prestador_id", prestadorIdFiltro);
    }
    if (filtros.dataInicial) queryEsc = queryEsc.gte("data_escala", filtros.dataInicial);
    if (filtros.dataFinal) queryEsc = queryEsc.lte("data_escala", filtros.dataFinal);
    const { data: dataEsc, error: errEsc } = await queryEsc;
    if (errEsc) throw errEsc;

    // --- 3. Mapear e combinar os dados ---
    const mappedOS = (dataOS || []).map((o: any) => ({
      id: o.id,
      origem_tabela: "os",
      numero: o.numero || `OS-${o.id}`,
      created_at: o.created_at,
      data_finalizacao: o.data,
      prestador: o.prestador,
      prestador_id: o.prestador_id,
      cliente: o.cliente,
      cliente_id: o.cliente_id,
      status: o.status,
      veiculo_tipo: o.veiculo_tipo,
      valor_cliente: Number(o.valor_cliente) || 0,
      custo_prestador: Number(o.custo_prestador) || 0,
      pedagio: Number(o.pedagio) || 0,
      adicionais: o.adicionais || [],
      descontos: Number(o.descontos) || 0,
      enderecos: o.enderecos || [],
      origem_endereco: o.enderecos?.[0]?.cidade || "N/A",
      destino_endereco: o.enderecos?.[o.enderecos.length - 1]?.cidade || "N/A"
    }));

    const mappedEsc = (dataEsc || []).map((e: any) => {
      const valorFrete = Number(e.valor_frete || e.metadata?.totals?.cliente?.total || e.valor_fixo || 0);
      const valorRepasse = Number(e.valor_repasse || e.metadata?.totals?.prestador?.total || e.valor_fixo || 0);
      return {
        id: e.id,
        origem_tabela: "escala",
        numero: `ESC-${e.id}`,
        created_at: e.created_at || e.data_escala,
        data_finalizacao: e.data_escala,
        prestador: null,
        prestador_id: e.prestador_id,
        cliente: null,
        cliente_id: e.cliente_id,
        status: e.status,
        veiculo_tipo: e.tipo_veiculo,
        valor_cliente: valorFrete,
        custo_prestador: valorRepasse,
        pedagio: 0,
        adicionais: e.metadata?.adicionais || [],
        descontos: e.metadata?.descontos || 0,
        enderecos: [],
        origem_endereco: "Base",
        destino_endereco: "Rota"
      };
    });

    let result = [...mappedOS, ...mappedEsc].sort((a, b) => {
      const da = new Date(b.created_at).getTime();
      const db = new Date(a.created_at).getTime();
      return da - db;
    });

    // --- 4. Enriquecer dados (Prestador/Cliente por ID) ---
    const allPrestadorIds = [
      ...new Set([
        ...(dataOS || []).map((o: any) => o.prestador_id).filter(Boolean),
        ...(dataEsc || []).map((e: any) => e.prestador_id).filter(Boolean),
      ]),
    ];
    const allClienteIds = [
      ...new Set([
        ...(dataOS || []).map((o: any) => o.cliente_id).filter(Boolean),
        ...(dataEsc || []).map((e: any) => e.cliente_id).filter(Boolean),
      ]),
    ];

    const [prestadoresRes, clientesRes] = await Promise.all([
      allPrestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo, cpf_cnpj, tipo_parceiro, score_interno").in("id", allPrestadorIds)
        : { data: [] },
      allClienteIds.length > 0
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", allClienteIds)
        : { data: [] },
    ]);

    const prestadoresMap = new Map((prestadoresRes.data || []).map((p: any) => [p.id, p]));
    const clientesMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

    result = result.map((o: any) => {
      const prestadorData = o.prestador_id ? prestadoresMap.get(o.prestador_id) : null;
      const clienteData = o.cliente_id ? clientesMap.get(o.cliente_id) : null;
      const clienteNome = clienteData?.nome_fantasia || clienteData?.razao_social || o.cliente || "Avulso";
      return {
        ...o,
        prestador: prestadorData?.nome_completo || o.prestador || "Nao identificado",
        prestador_nome: prestadorData?.nome_completo || o.prestador || "Nao identificado",
        prestador_cpf_cnpj: prestadorData?.cpf_cnpj || "-",
        prestador_tipo: prestadorData?.tipo_parceiro || "-",
        prestador_score: prestadorData?.score_interno || 0,
        cliente_nome: clienteNome,
        cliente_id: o.cliente_id || clienteData?.id,
        valor_final_repasse: calcularRepassePrestador({ custo_prestador: o.custo_prestador, pedagio: o.pedagio, adicionais: o.adicionais, descontos: o.descontos }).totalLiquido,
      };
    });

    // --- 5. Status Pagamento Prestador ---
    const prestadorIdsResult = [...new Set((result as any[]).map((o: any) => o.prestador_id).filter(Boolean))];
    let pgtoMap = new Map<string, string>();

    if (prestadorIdsResult.length > 0) {
      const pagamentoStatus = await supabase
        .from("pagamentos_prestadores")
        .select("prestador_id, prestador_nome, status")
        .in("prestador_id", prestadorIdsResult);

      (pagamentoStatus.data || []).forEach((p: any) => {
        if (p.prestador_id) pgtoMap.set(p.prestador_id, p.status || "pendente");
        if (p.prestador_nome) pgtoMap.set(p.prestador_nome, p.status || "pendente");
      });
    }

    result = result.map((o: any) => ({
      ...o,
      status_pagamento: o.prestador_id
        ? (pgtoMap.get(o.prestador_id) || "pendente")
        : (pgtoMap.get(o.prestador) || "pendente"),
    }));

    return result;
  } catch (err) {
    console.error("[RelatorioService] Erro pagamento prestador:", err);
    throw err;
  }
};

export const buscarDadosPrestadores = async (filtros: FiltrosPrestador) => {
  try {
    let query = supabase
      .from("prestadores")
      .select(`
        id, nome_completo, cpf_cnpj,
        tipo_parceiro, status, score_interno,
        endereco, created_at
      `);

    const { data: prestadores, error } = await query;
    if (error) throw error;

    let result = (prestadores || []).map((p: any) => ({
      ...p,
      nome: p.nome_completo || "Nao identificado",
    }));

    if (filtros.nome) {
      const term = filtros.nome.toLowerCase();
      result = result.filter((p: any) => p.nome.toLowerCase().includes(term));
    }
    if (filtros.cpfCnpj) {
      const term = filtros.cpfCnpj.replace(/\D/g, "");
      result = result.filter((p: any) => (p.cpf_cnpj || "").replace(/\D/g, "").includes(term));
    }
    if (filtros.statusOperacional && filtros.statusOperacional !== "todos") {
      result = result.filter((p: any) => p.status === filtros.statusOperacional);
    }
    if (filtros.tipoPrestador && filtros.tipoPrestador !== "todos") {
      result = result.filter((p: any) => p.tipo_parceiro === filtros.tipoPrestador);
    }
    if (filtros.scoreMinimo) {
      result = result.filter((p: any) => (p.score_interno || 0) >= filtros.scoreMinimo!);
    }
    if (filtros.cidade) {
      const term = filtros.cidade.toLowerCase();
      result = result.filter((p: any) => {
        const end = typeof p.endereco === "string" ? (() => { try { return JSON.parse(p.endereco); } catch { return {}; } })() : (p.endereco || {});
        return (end.cidade || p.regiao_principal || "").toLowerCase().includes(term);
      });
    }
    if (filtros.uf) {
      result = result.filter((p: any) => {
        const end = typeof p.endereco === "string" ? (() => { try { return JSON.parse(p.endereco); } catch { return {}; } })() : (p.endereco || {});
        return (end.uf || "").toLowerCase() === filtros.uf!.toLowerCase();
      });
    }

    const prestadorIds = result.map((p: any) => p.id);

    const [veiculosRes, osRes, pagamentosRes] = await Promise.all([
      prestadorIds.length > 0
        ? supabase.from("veiculos").select("prestador_id, placa, tipo").in("prestador_id", prestadorIds)
        : { data: [] },
      prestadorIds.length > 0
        ? supabase.from("ordens_servico").select("prestador_id, custo_prestador, data, status, cliente_id").in("prestador_id", prestadorIds)
        : { data: [] },
      prestadorIds.length > 0
        ? supabase.from("pagamentos_prestadores").select("prestador_id, valor_servicos, status_pagamento").in("prestador_id", prestadorIds)
        : { data: [] },
    ]);

    const veiculosPorPrestador = new Map<string, any[]>();
    for (const v of (veiculosRes.data || [])) {
      if (!veiculosPorPrestador.has(v.prestador_id)) veiculosPorPrestador.set(v.prestador_id, []);
      veiculosPorPrestador.get(v.prestador_id)!.push(v);
    }

    const osPorPrestador = new Map<string, any[]>();
    for (const o of (osRes.data || [])) {
      if (!osPorPrestador.has(o.prestador_id)) osPorPrestador.set(o.prestador_id, []);
      osPorPrestador.get(o.prestador_id)!.push(o);
    }

    const pagamentosPorPrestador = new Map<string, { total: number; pago: number }>();
    for (const p of (pagamentosRes.data || [])) {
      if (!p.prestador_id) continue;
      if (!pagamentosPorPrestador.has(p.prestador_id)) {
        pagamentosPorPrestador.set(p.prestador_id, { total: 0, pago: 0 });
      }
      const entry = pagamentosPorPrestador.get(p.prestador_id)!;
      entry.total += Number(p.valor_servicos) || 0;
      if (p.status_pagamento === "pago") entry.pago += Number(p.valor_servicos) || 0;
    }

    result = result.map((p: any) => {
      const veiculos = veiculosPorPrestador.get(p.id) || [];
      const operacoes = osPorPrestador.get(p.id) || [];
      const pagamentos = pagamentosPorPrestador.get(p.id) || { total: 0, pago: 0 };
      const finalizadas = operacoes.filter((o: any) => o.status === "finalizada");
      const end = typeof p.endereco === "string" ? (() => { try { return JSON.parse(p.endereco); } catch { return {}; } })() : (p.endereco || {});

      return {
        ...p,
        cidade: end.cidade || p.regiao_principal || "-",
        uf: end.uf || "",
        veiculos,
        veiculo_principal: veiculos[0]?.placa || "-",
        veiculo_tipo: veiculos[0]?.tipo || "-",
        total_operacoes: operacoes.length,
        operacoes_finalizadas: finalizadas.length,
        valor_recebido: finalizadas.reduce((s: number, o: any) => s + (Number(o.custo_prestador) || 0), 0),
        valor_pago: pagamentos.pago,
        ultima_operacao: finalizadas.reduce((latest: string, o: any) => o.data > latest ? o.data : latest, ""),
      };
    });

    if (filtros.veiculo) {
      const term = filtros.veiculo.toLowerCase();
      result = result.filter((p: any) => (p.veiculo_principal || "").toLowerCase().includes(term) || (p.veiculo_tipo || "").toLowerCase().includes(term));
    }

    return result;
  } catch (err) {
    console.error("[RelatorioService] Erro prestadores:", err);
    throw err;
  }
};

export const buscarDadosEvolucaoFaturamento = async (filtros: FiltrosFaturamento) => {
  try {
    let query = supabase
      .from("ordens_servico")
      .select("created_at, valor_cliente, custo_prestador, margem_liquida, status")
      .neq("status", "cancelada");

    if (filtros.dataInicial) query = query.gte("created_at", filtros.dataInicial + "T00:00:00-03:00");
    if (filtros.dataFinal) query = query.lte("created_at", filtros.dataFinal + "T23:59:59-03:00");

    const { data, error } = await query;
    if (error) throw error;

    const meses = new Map<string, { receita: number; custo: number; margem: number }>();

    for (const o of (data || [])) {
      const date = new Date(o.created_at + "T12:00:00");
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!meses.has(key)) meses.set(key, { receita: 0, custo: 0, margem: 0 });
      const m = meses.get(key)!;
      m.receita += Number(o.valor_cliente) || 0;
      m.custo += Number(o.custo_prestador) || 0;
      m.margem += Number(o.margem_liquida) || 0;
    }

    return Array.from(meses.entries())
      .map(([mes, vals]) => ({ mes, ...vals }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  } catch (err) {
    console.error("[RelatorioService] Erro evolução:", err);
    throw err;
  }
};

export const buscarClientesAtivos = async () => {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social, cnpj, cidade, uf, status")
      .eq("status", "ativo");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[RelatorioService] Erro clientes ativos:", err);
    return [];
  }
};

export const buscarStatusOptions = async () => {
  try {
    const { data } = await supabase.from("ordens_servico").select("status");
    return [...new Set((data || []).map((o: any) => o.status).filter(Boolean))];
  } catch {
    return [];
  }
};

// ===================================================================
// Tipos para Extrato Operacional
// ===================================================================

export interface ExtratoOS {
  numero: string;
  data: string;
  prestador: string;
  cliente: string;
  status: string;
  valorCliente: number;
  custoPrestador: number;
  margem: number;
  origem: string;
  destino: string;
  tipoVeiculo: string;
  basePrestador: number;
  margemPct: number;
  metadata?: any;
}

export interface ExtratoCliente {
  id: string;
  nome: string;
  cnpj: string;
  totalFaturado: number;
  operacoes: ExtratoOS[];
}

export interface ExtratoPrestador {
  id: string;
  nome: string;
}

// ===================================================================
// buscarDadosExtratoOperacional
// ===================================================================

export const buscarDadosExtratoOperacional = async (filtros?: {
  dataInicial?: string;
  dataFinal?: string;
}) => {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data,
        prestador, cliente, prestador_id, cliente_id,
        status, veiculo_tipo,
        valor_cliente, custo_prestador,
        pedagio, adicionais, descontos, enderecos
      `)
      .neq("status", "cancelada");

    if (filtros?.dataInicial) {
      query = query.gte("created_at", filtros.dataInicial + "T00:00:00-03:00");
    }
    if (filtros?.dataFinal) {
      query = query.lte("created_at", filtros.dataFinal + "T23:59:59-03:00");
    }

    const { data: osData, error } = await query;
    if (error) throw error;

    const osList = (osData || []).map((o: any) => {
      const valorCliente = Number(o.valor_cliente) || 0;
      const custoPrestador = Number(o.custo_prestador) || 0;
      return {
        numero: o.numero || `OS-${o.id}`,
        data: o.data || o.created_at || "",
        prestador: o.prestador || "Nao identificado",
        cliente: o.cliente || "Avulso",
        status: o.status || "pendente",
        valorCliente,
        custoPrestador,
        margem: valorCliente - custoPrestador,
        origem: o.enderecos?.[0]?.cidade || "N/A",
        destino: o.enderecos?.[o.enderecos?.length - 1]?.cidade || "N/A",
        tipoVeiculo: o.veiculo_tipo || "-",
        basePrestador: custoPrestador,
        margemPct: valorCliente > 0 ? ((valorCliente - custoPrestador) / valorCliente) * 100 : 0,
      } as ExtratoOS;
    });

    // Agrupar por cliente
    const clienteMap = new Map<string, ExtratoOS[]>();
    for (const os of osList) {
      const key = os.cliente;
      if (!clienteMap.has(key)) clienteMap.set(key, []);
      clienteMap.get(key)!.push(os);
    }

    // Buscar dados de clientes enriquecidos
    const clienteNomesUnicos = [...new Set(osList.map((o) => o.cliente).filter(Boolean))];
    let clientesData: any[] = [];
    if (clienteNomesUnicos.length > 0) {
      const orFilters = clienteNomesUnicos
        .map((n: string) => `nome_fantasia.ilike.%${n}%,razao_social.ilike.%${n}%`)
        .join(",");
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj")
        .or(orFilters);
      clientesData = cData || [];
    }

    const clientes: ExtratoCliente[] = [];
    const clientesOptions: { value: string; label: string }[] = [];
    const clientesSet = new Set<string>();

    for (const [nome, ops] of clienteMap) {
      const cInfo = clientesData.find(
        (c: any) => c.nome_fantasia === nome || c.razao_social === nome
      );
      const id = cInfo?.id || nome;
      const totalFaturado = ops.reduce((s, o) => s + o.valorCliente, 0);

      clientes.push({
        id,
        nome,
        cnpj: cInfo?.cnpj || "-",
        totalFaturado,
        operacoes: ops,
      });

      if (!clientesSet.has(nome)) {
        clientesSet.add(nome);
        clientesOptions.push({ value: nome, label: nome });
      }
    }

    // Prestadores
    const prestadorNomesUnicos = [...new Set(osList.map((o) => o.prestador).filter(Boolean))];
    let prestadoresData: any[] = [];
    if (prestadorNomesUnicos.length > 0) {
      const orFilters = prestadorNomesUnicos
        .map((n: string) => `nome_completo.ilike.%${n}%,nome_fantasia.ilike.%${n}%`)
        .join(",");
      const { data: pData } = await supabase
        .from("prestadores")
        .select("id, nome_completo, nome_fantasia")
        .or(orFilters);
      prestadoresData = pData || [];
    }

    const prestadores: ExtratoPrestador[] = [];
    const prestadoresOptions: { value: string; label: string }[] = [];
    const prestadorNomeMap: Record<string, string> = {};
    const prestadoresSet = new Set<string>();

    for (const nome of prestadorNomesUnicos) {
      const pInfo = prestadoresData.find(
        (p: any) =>
          p.nome_completo === nome || p.nome_fantasia === nome
      );
      const id = pInfo?.id || nome;
      prestadores.push({ id, nome });
      prestadorNomeMap[id] = nome;

      if (!prestadoresSet.has(nome)) {
        prestadoresSet.add(nome);
        prestadoresOptions.push({ value: id, label: nome });
      }
    }

    return {
      os: osList,
      clientes,
      prestadores,
      clientesOptions,
      prestadoresOptions,
      prestadorNomeMap,
    };
  } catch (err) {
    console.error("[RelatorioService] Erro extrato operacional:", err);
    throw err;
  }
};

// ===================================================================
// gerarRelatorioBuffer — gera buffers de PDF/Excel para automação
// ===================================================================

export interface RelatorioBufferArquivo {
  tipo: "pdf" | "excel";
  buffer: Uint8Array | Buffer;
  tamanho: number;
  nome: string;
}


export interface RelatorioArmazenado {
  nome: string;
  path: string;
  tipo: "pdf" | "excel";
  tamanho: number;
  url: string;
}

export interface RelatorioBufferResultado {
  tipo: string;
  formatosGerados: string[];
  arquivos: RelatorioBufferArquivo[];
  totalArquivos: number;
}


export const salvarRelatorioBufferStorage = async (
  resultado: RelatorioBufferResultado,
  pasta?: string
): Promise<RelatorioArmazenado[]> => {
  const arquivosArmazenados: RelatorioArmazenado[] = [];
  const today = new Date();
  const datePath = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  for (const arquivo of resultado.arquivos) {
    const storagePath = `relatorios/${datePath}/${pasta || resultado.tipo}/${arquivo.nome}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('relatorios')
        .upload(storagePath, arquivo.buffer, {
          contentType: arquivo.tipo === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true, // Overwrite if file exists
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl }, error: urlError } = supabase.storage
        .from('relatorios')
        .getPublicUrl(storagePath);
      
      if (urlError) throw urlError;

      arquivosArmazenados.push({
        nome: arquivo.nome,
        path: storagePath,
        tipo: arquivo.tipo,
        tamanho: arquivo.tamanho,
        url: publicUrl,
      });
    } catch (e) {
      console.error(`[RelatorioService] Erro ao salvar arquivo ${arquivo.nome} no Storage:`, e);
      // Optionally, rethrow or handle specific errors if needed
    }
  }

  return arquivosArmazenados;
};

export const gerarRelatorioBuffer = async (
  tipo: "faturamento" | "pagamento_prestador" | "prestadores" | "extrato_operacional",
  filtros: any,
  formato: "pdf" | "excel" | "Ambos"
): Promise<RelatorioBufferResultado> => {
  const arquivos: RelatorioBufferArquivo[] = [];
  const formatosGerados: string[] = [];

  const gerarPDF = async () => {
    if (tipo === "faturamento") {
      const { gerarPDFRelatorioOperacionalBuffer } = await import("@/utils/pdfRelatorioOperacional");
      const dados = await buscarDadosFaturamento(filtros);
      const periodoLabel = `${filtros.dataInicial || "inicio"}_a_${filtros.dataFinal || "fim"}`;
      const buffer = await gerarPDFRelatorioOperacionalBuffer({
        titulo: "Relatório de Faturamento por Cliente",
        subtitulo: `Período: ${periodoLabel}`,
        colunas: ["Cliente", "CNPJ", "Qtd OS", "Valor Faturado", "Valor Pago", "Pendência", "Ticket Médio", "Margem"],
        linhas: dados.map((d: any) => [
          d.cliente_nome || "-",
          d.cliente_cnpj || "-",
          String(d.quantidade_os || 0),
          String(d.valor_faturado || 0),
          String(d.valor_pago || 0),
          String(d.valor_pendente || 0),
          String(d.ticket_medio || 0),
          String(d.margem_total || 0),
        ]),
      });
      arquivos.push({ tipo: "pdf", buffer, tamanho: buffer.length, nome: `faturamento_${periodoLabel}.pdf` });
    } else if (tipo === "pagamento_prestador") {
      const { gerarPDFRepassePrestadorBuffer } = await import("@/utils/pdfRelatorioOperacional");
      const dados = await buscarDadosPagamentoPrestador(filtros);
      const resumo = {
        totalRepasses: dados.reduce((s: number, d: any) => s + (d.valor_final_repasse || 0), 0),
        qtdOperacoes: dados.length,
        mediaOperacional: dados.length > 0 ? dados.reduce((s: number, d: any) => s + (d.valor_final_repasse || 0), 0) / dados.length : 0,
        pendencias: dados.filter((d: any) => d.status_pagamento !== "pago").length,
        valorAprovado: dados.filter((d: any) => d.status_pagamento === "pago").reduce((s: number, d: any) => s + (d.valor_final_repasse || 0), 0),
      };
      const buffer = await gerarPDFRepassePrestadorBuffer(dados, filtros, resumo);
      arquivos.push({ tipo: "pdf", buffer, tamanho: buffer.length, nome: `pagamento_prestador_${filtros.prestador || "todos"}.pdf` });
    } else if (tipo === "prestadores") {
      const { gerarPDFRelatorioOperacionalBuffer } = await import("@/utils/pdfRelatorioOperacional");
      const dados = await buscarDadosPrestadores(filtros);
      const buffer = await gerarPDFRelatorioOperacionalBuffer({
        titulo: "Relatório de Prestadores",
        colunas: ["Prestador", "CPF/CNPJ", "Tipo", "Cidade", "UF", "Operações", "Valor Recebido"],
        linhas: dados.map((d: any) => [
          d.nome || "-",
          d.cpf_cnpj || "-",
          d.tipo_parceiro || "-",
          d.cidade || "-",
          d.uf || "-",
          String(d.operacoes_finalizadas || 0),
          String(d.valor_recebido || 0),
        ]),
      });
      arquivos.push({ tipo: "pdf", buffer, tamanho: buffer.length, nome: `prestadores.pdf` });
    } else if (tipo === "extrato_operacional") {
      const { gerarPDFRelatorioOperacionalBuffer } = await import("@/utils/pdfRelatorioOperacional");
      const dados = await buscarDadosExtratoOperacional(filtros);
      const buffer = await gerarPDFRelatorioOperacionalBuffer({
        titulo: "Extrato Operacional",
        colunas: ["Nº OS", "Data", "Cliente", "Prestador", "Origem", "Destino", "Status", "Valor", "Custo", "Margem"],
        linhas: dados.os.map((o: ExtratoOS) => [
          o.numero,
          o.data ? new Date(o.data + "T12:00:00").toLocaleDateString("pt-BR") : "-",
          o.cliente,
          o.prestador,
          o.origem,
          o.destino,
          o.status,
          String(o.valorCliente),
          String(o.custoPrestador),
          String(o.margem),
        ]),
      });
      arquivos.push({ tipo: "pdf", buffer, tamanho: buffer.length, nome: `extrato_operacional.pdf` });
    }
    formatosGerados.push("pdf");
  };

  const gerarExcel = async () => {
    if (tipo === "faturamento") {
      const { exportFaturamentoToExcelBuffer } = await import("@/utils/excelExport");
      const dados = await buscarDadosFaturamento(filtros);
      const periodoLabel = `${filtros.dataInicial || "inicio"}_a_${filtros.dataFinal || "fim"}`;
      const buffer = exportFaturamentoToExcelBuffer(dados, periodoLabel);
      arquivos.push({ tipo: "excel", buffer, tamanho: buffer.length, nome: `faturamento_${periodoLabel}.xlsx` });
    } else if (tipo === "pagamento_prestador") {
      const { exportPagamentoToExcelBuffer } = await import("@/utils/excelExport");
      const dados = await buscarDadosPagamentoPrestador(filtros);
      const periodoLabel = `${filtros.dataInicial || "inicio"}_a_${filtros.dataFinal || "fim"}`;
      const buffer = exportPagamentoToExcelBuffer(dados, periodoLabel);
      arquivos.push({ tipo: "excel", buffer, tamanho: buffer.length, nome: `pagamento_prestador_${filtros.prestador || "todos"}.xlsx` });
    } else if (tipo === "prestadores") {
      const { exportPrestadoresToExcelBuffer } = await import("@/utils/excelExport");
      const dados = await buscarDadosPrestadores(filtros);
      const buffer = exportPrestadoresToExcelBuffer(dados, "relatorio");
      arquivos.push({ tipo: "excel", buffer, tamanho: buffer.length, nome: `prestadores.xlsx` });
    } else if (tipo === "extrato_operacional") {
      const { exportToExcelBuffer } = await import("@/utils/excelExport");
      const dados = await buscarDadosExtratoOperacional(filtros);
      const columns = [
        { header: "Nº OS", key: "numero", width: 14 },
        { header: "Data", key: "data_formatada", width: 12 },
        { header: "Cliente", key: "cliente", width: 25 },
        { header: "Prestador", key: "prestador", width: 25 },
        { header: "Origem", key: "origem", width: 15 },
        { header: "Destino", key: "destino", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Valor Cliente", key: "valorCliente", width: 16 },
        { header: "Custo", key: "custoPrestador", width: 16 },
        { header: "Margem", key: "margem", width: 16 },
      ];
      const enrichedData = dados.os.map((o: ExtratoOS) => ({
        ...o,
        data_formatada: o.data ? new Date(o.data + "T12:00:00").toLocaleDateString("pt-BR") : "-",
      }));
      const buffer = exportToExcelBuffer(enrichedData, columns, `extrato_operacional`, "Extrato Operacional");
      arquivos.push({ tipo: "excel", buffer, tamanho: buffer.length, nome: `extrato_operacional.xlsx` });
    }
    formatosGerados.push("excel");
  };

  const promises: Promise<void>[] = [];
  if (formato === "pdf" || formato === "Ambos") promises.push(gerarPDF());
  if (formato === "excel" || formato === "Ambos") promises.push(gerarExcel());
  await Promise.all(promises);

  return {
    tipo,
    formatosGerados,
    arquivos,
    totalArquivos: arquivos.length,
  };
};

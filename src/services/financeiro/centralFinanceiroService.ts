// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — CENTRAL DE CONTROLE FINANCEIRO-OPERACIONAL
// centralFinanceiroService.ts
// Serviço de consulta da Central Financeira (evolução de Financeiro > Conferência).
// Reaproveita estruturas existentes SEM migration:
//   - alocacoes_escala (operacional + financeiro)
//   - ordens_servico (OS interna + romaneio)
//   - entregas_protocolo (POD oficial)
//   - financeiro_receber / financeiro_pagar / pagamentos_prestadores (por os_id)
//   - composicao_financeira_os (margens)
//   - fiscal_documentos_vinculados (NFs transportadas)
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import { criarOrdemServico } from "@/services/ordemServicoService";

export type SituacaoSemafaro = "verde" | "amarelo" | "vermelho";

export interface CentralItemFinanceiro {
  id: string;
  alocacaoId: string;
  osId: string | null;
  osNumero: string;
  romaneio: string | null;
  romaneioOC: string | null;
  data: string;
  dataFinalizacao: string;
  clienteId: string | null;
  clienteNome: string;
  prestadorId: string | null;
  prestadorNome: string;
  tipoVeiculo: string;
  placa: string;
  origem: string;
  destino: string;
  statusOperacional: string;
  finalizada: boolean;
  // Financeiro Cliente
  valorClienteBase: number;
  valorClienteAdicionais: number;
  valorClienteDescontos: number;
  valorClienteTotal: number;
  // Financeiro Prestador
  valorPrestadorBase: number;
  valorPrestadorAdicionais: number;
  valorPrestadorDescontos: number;
  valorPrestadorTotal: number;
  // Detalhamento financeiro completo (Modo 2) — campos diretos de alocacoes_escala
  detalhe: {
    // Cliente
    kmRealizados: number;
    kmExcedenteCliente: number;
    valorKmExcedenteCliente: number;
    pedagioCliente: number;
    ajudanteCliente: number;
    diariasCliente: number;
    saidasCliente: number;
    outrosCliente: number;
    // Prestador
    kmExcedentePrestador: number;
    valorKmExcedentePrestador: number;
    pedagioPrestador: number;
    combustivelPrestador: number;
    ajudantePrestador: number;
    diariasPrestador: number;
    saidasPrestador: number;
    reembolsoOutrosPrestador: number;
    outrosPrestador: number;
  };
  // POD
  pod: {
    situacao: string;
    temFoto: boolean;
    temCanhoto: boolean;
    temAssinatura: boolean;
    recebedor: string | null;
    podId: string | null;
  } | null;
  // Financeiro cruzado (por os_id)
  receber: { status: string; valor: number; fatura: string | null } | null;
  pagar: { status: string; valor: number } | null;
  pagamentoPrestador: { status: string; valor_liquido: number; status_pagamento: string } | null;
  composicao: {
    margem_bruta: number;
    margem_liquida: number;
    valor_cliente: number;
    valor_prestador: number;
  } | null;
  // Faturamento (fonte oficial: faturas + fatura_itens)
  faturamento: {
    status: "nao_faturado" | "rascunho" | "faturado";
    numero: string | null;
    faturaId: string | null;
  };
  // Notas fiscais transportadas (números p/ pesquisa A31)
  nfs: string[];
  // Semáforo derivado
  semaforo: SituacaoSemafaro;
  semaforoMotivos: string[];
}

export interface CentralFiltros {
  dataInicio?: string;
  dataFim?: string;
  cliente?: string;
  os?: string;
  romaneio?: string;
  prestador?: string;
  placa?: string;
  statusOperacional?: string;
  pod?: string;
  faturado?: string;
  recebimento?: string;
  pagamentoPrestador?: string;
  busca?: string;
}

function num(v: any): number {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

// ── TMS-FIN-CONF-UX-ORD-01 — ordenação operacional: MAIS RECENTE → MAIS ANTIGO ──
// Campo escolhido: data_finalizacao (data operacional de conclusão), com FALLBACK
// para data_escala quando data_finalizacao é NULL (evita "NULLS FIRST" implícito do
// ORDER BY DESC, que jogava registros antigos sem finalização para o topo).
// Desempate estável: id DESC.
export interface CentralItemOrdenavel {
  id: string;
  dataFinalizacao?: string;
  data?: string;
}

export function compararCentralFinanceiro(a: CentralItemOrdenavel, b: CentralItemOrdenavel): number {
  const da = a.dataFinalizacao || a.data || "";
  const db = b.dataFinalizacao || b.data || "";
  const porData = db.localeCompare(da); // DESC
  return porData !== 0 ? porData : String(b.id).localeCompare(String(a.id)); // id DESC
}

export function ordenarCentralFinanceiro<T extends CentralItemOrdenavel>(lista: T[]): T[] {
  return [...lista].sort(compararCentralFinanceiro);
}

/** Deriva o semáforo e os motivos a partir de dados reais. */
export function derivarSemaforoCentral(item: {
  romaneio: string | null;
  valorClienteTotal: number;
  valorPrestadorTotal: number;
  podSituacao: string | null;
  receberStatus: string | null;
  pagamentoStatus: string | null;
}): { semaforo: SituacaoSemafaro; motivos: string[] } {
  const motivos: string[] = [];
  let bloqueios = 0;
  let avisos = 0;

  if (!item.romaneio) {
    motivos.push("Romaneio/OC pendente");
    avisos += 1;
  }
  if (!item.podSituacao || item.podSituacao === "pendente") {
    motivos.push("POD pendente");
    avisos += 1;
  } else if (item.podSituacao === "nao_entregue") {
    motivos.push("Não entregue");
    bloqueios += 1;
  } else if (item.podSituacao === "entregue_ressalva") {
    motivos.push("Entregue com ressalva");
    avisos += 1;
  }
  if (item.valorClienteTotal <= 0) {
    motivos.push("Valor do cliente ausente");
    bloqueios += 1;
  }
  if (item.valorPrestadorTotal <= 0) {
    motivos.push("Prestador sem valor");
    avisos += 1;
  }
  if (item.receberStatus && ["pago", "baixado"].includes(item.receberStatus)) {
    motivos.push("Já recebido");
  } else if (item.receberStatus && item.receberStatus !== "cancelado") {
    motivos.push(`Receber: ${item.receberStatus}`);
  }
  if (item.pagamentoStatus && item.pagamentoStatus !== "pendente") {
    motivos.push(`Pagto prestador: ${item.pagamentoStatus}`);
  }

  if (motivos.length === 0) motivos.push("Pronto para conferência");

  const semaforo: SituacaoSemafaro = bloqueios > 0 ? "vermelho" : avisos > 0 ? "amarelo" : "verde";
  return { semaforo, motivos };
}

/** Busca tudo da Central em lote (mínimo de queries, sem N+1 por linha). */
export async function buscarCentralFinanceiro(filtros: CentralFiltros = {}): Promise<CentralItemFinanceiro[]> {
  // 1. Alocações finalizadas com joins
  let query = supabase
    .from("alocacoes_escala")
    .select(`
      *,
      clientes:cliente_id(id, nome_fantasia, razao_social, cnpj),
      prestadores:prestador_id(id, nome_completo, cpf_cnpj),
      ordens_servico:ordem_servico_id(id, numero, romaneio)
    `)
    .eq("status", "concluida")
    .eq("finalizada", true);

  if (filtros.dataInicio) query = query.gte("data_escala", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data_escala", filtros.dataFim);

  // FIN-UX-02A — removido o LIMIT 300 silencioso. A Conferência aplica a paginação
  // real (PaginationBar) sobre o conjunto COMPLETO filtrado.
  // TMS-FIN-CONF-UX-ORD-01 — ORDER BY operacional: data_finalizacao DESC com
  // NULLS LAST (sem "NULLS FIRST" implícito) + data_escala DESC + id DESC. A
  // ordenação AUTORITATIVA é reforçada em memória (ordenarCentralFinanceiro) sobre
  // o conjunto completo, antes da paginação.
  const { data, error } = await query
    .order("data_finalizacao", { ascending: false, nullsFirst: false })
    .order("data_escala", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(`Erro ao carregar alocações: ${error.message}`);
  if (!data || data.length === 0) return [];

  const alocacoes = data as any[];
  const alocacaoIds = alocacoes.map((a) => a.id as string).filter(Boolean);
  const osIds = alocacoes
    .map((a) => (a.ordem_servico_id as string) || null)
    .filter(Boolean) as string[];
  const osIdSet = new Set(osIds);

  // 2. POD (entregas_protocolo) — fonte oficial
  let podMap = new Map<string, any>();
  if (alocacaoIds.length) {
    const { data: pods, error: podErr } = await supabase
      .from("entregas_protocolo")
      .select("id, alocacao_id, status, foto_entrega_url, foto_canhoto_url, assinatura_url, nome_recebedor")
      .in("alocacao_id", alocacaoIds);
    if (!podErr) {
      podMap = new Map((pods || []).map((p: any) => [p.alocacao_id, p]));
    }
  }

  // 3. financeiro_receber por os_id (TEXT)
  let receberMap = new Map<string, any>();
  if (osIdSet.size) {
    const { data: receber, error: recErr } = await supabase
      .from("financeiro_receber")
      .select("id, os_id, status, valor, fatura, data_vencimento")
      .in("os_id", Array.from(osIdSet));
    if (!recErr) {
      receberMap = new Map((receber || []).map((r: any) => [r.os_id, r]));
    }
  }

  // 4. financeiro_pagar por os_id (TEXT)
  let pagarMap = new Map<string, any>();
  if (osIdSet.size) {
    const { data: pagar, error: pagErr } = await supabase
      .from("financeiro_pagar")
      .select("id, os_id, status, valor, data_vencimento")
      .in("os_id", Array.from(osIdSet));
    if (!pagErr) {
      pagarMap = new Map((pagar || []).map((p: any) => [p.os_id, p]));
    }
  }

  // 5. pagamentos_prestadores por os_id (UUID)
  let pagtoMap = new Map<string, any>();
  if (osIdSet.size) {
    const { data: pagtos, error: pagtoErr } = await supabase
      .from("pagamentos_prestadores")
      .select("id, os_id, status, status_pagamento, valor_liquido")
      .in("os_id", Array.from(osIdSet));
    if (!pagtoErr) {
      pagtoMap = new Map((pagtos || []).map((p: any) => [p.os_id, p]));
    }
  }

  // 6. composicao_financeira_os por os_id (UUID)
  let compMap = new Map<string, any>();
  if (osIdSet.size) {
    const { data: comps, error: compErr } = await supabase
      .from("composicao_financeira_os")
      .select("os_id, margem_bruta, margem_liquida, valor_cliente, valor_prestador")
      .in("os_id", Array.from(osIdSet));
    if (!compErr) {
      compMap = new Map((comps || []).map((c: any) => [c.os_id, c]));
    }
  }

  // 7. fiscal_documentos_vinculados por ordem_servico_id (UUID)
  let fiscaisMap = new Map<string, any[]>();
  if (osIdSet.size) {
    const { data: fiscais, error: fiscErr } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("id, ordem_servico_id, numero, serie, chave_acesso, valor_total, peso_total, volumes, emitente_nome, status")
      .in("ordem_servico_id", Array.from(osIdSet));
    if (!fiscErr) {
      fiscaisMap = new Map<string, any[]>();
      (fiscais || []).forEach((f: any) => {
        const key = f.ordem_servico_id as string;
        const arr = fiscaisMap.get(key) || [];
        arr.push(f);
        fiscaisMap.set(key, arr);
      });
    }
  }

  // 7b. Faturamento oficial: fatura_itens → faturas (status/número por os_id)
  let faturamentoMap = new Map<string, { status: "nao_faturado" | "rascunho" | "faturado"; numero: string | null; faturaId: string | null }>();
  if (osIdSet.size) {
    const { data: fatItens, error: fatItErr } = await supabase
      .from("fatura_itens")
      .select("os_id, fatura_id, faturas!inner(id, numero, status)")
      .in("os_id", Array.from(osIdSet))
      .in("status", ["ativo"]);
    if (!fatItErr && fatItens) {
      faturamentoMap = new Map();
      (fatItens as any[]).forEach((fi: any) => {
        const osId = fi.os_id as string;
        if (!osId) return;
        const fat = fi.faturas;
        if (!fat) return;
        let status: "nao_faturado" | "rascunho" | "faturado" = "nao_faturado";
        if (fat.status === "emitida") status = "faturado";
        else if (["rascunho", "aguardando_aprovacao", "aprovada"].includes(fat.status)) status = "rascunho";
        // Se já existe entrada "faturado", não sobrescrever; senão guarda a melhor
        const existente = faturamentoMap.get(osId);
        if (!existente || (existente.status !== "faturado" && status === "faturado")) {
          faturamentoMap.set(osId, { status, numero: fat.numero || null, faturaId: fat.id || null });
        }
      });
    }
  }

  // 8. Montagem final
  const itens: CentralItemFinanceiro[] = alocacoes.map((a) => {
    const os = a.ordens_servico || {};
    const clienteNome = a.clientes?.nome_fantasia || a.clientes?.razao_social || "NÃO INFORMADO";
    const prestadorNome = a.prestadores?.nome_completo || "NÃO INFORMADO";
    const osId = (a.ordem_servico_id as string) || null;

    // KM excedente — duas pernas (mesma lógica da Escala; A31-J1.6):
    //   CLIENTE: franquia/preço de metadata.faturamento.
    //   PRESTADOR: franquia/preço de metadata.repasse (fallback para faturamento).
    //   Não assume que as duas franquias/preços são iguais.
    const kmRealizados = num(a.km_realizados) || num(a.km_rodados);
    const franquiaKm = num(a.metadata?.faturamento?.franquia_km);
    const kmExcedente = franquiaKm > 0 ? Math.max(kmRealizados - franquiaKm, 0) : 0;
    const valorKmExcedente = num(a.metadata?.faturamento?.valor_km_excedente);
    const valorKmExcedenteCliente = kmExcedente * valorKmExcedente;
    const franquiaKmPrestador = num(a.metadata?.repasse?.franquia_km_prestador ?? a.metadata?.faturamento?.franquia_km);
    const kmExcedentePrestador = franquiaKmPrestador > 0 ? Math.max(kmRealizados - franquiaKmPrestador, 0) : 0;
    const valorKmExcedentePrestador = num(a.metadata?.repasse?.valor_km_prestador);
    const kmExcedentePrestadorValor = kmExcedentePrestador * valorKmExcedentePrestador;

    // Cliente (perna receita)
    const valorClienteBase = num(a.valor_frete) + num(a.reversa_valor_cliente);
    const pedagioCliente = num(a.pedagio_cobrar_excedente) ? num(a.valor_pedagio) : 0;
    const ajudanteCliente = num(a.valor_ajudante);
    const diariasCliente = num(a.diarias_adicionais) * num(a.valor_diaria);
    const saidasCliente = num(a.valor_segunda_saida) + num(a.valor_terceira_saida) + num(a.valor_saida_adicional);
    const outrosCliente = num(a.valor_adicional);
    const adicionaisCliente = pedagioCliente + ajudanteCliente + diariasCliente + saidasCliente + outrosCliente;
    const descontosCliente = num(a.valor_desconto);
    const valorClienteTotal = valorClienteBase + adicionaisCliente + valorKmExcedenteCliente - descontosCliente;

    // Prestador (perna custo)
    const valorPrestadorBase = num(a.valor_repasse) + num(a.reversa_valor_prestador);
    const pedagioPrestador = num(a.valor_pedagio);
    const combustivelPrestador = num(a.valor_combustivel);
    const ajudantePrestador = num(a.valor_ajudante);
    const diariasPrestador = num(a.diarias_adicionais) * num(a.valor_diaria);
    const saidasPrestador = num(a.valor_segunda_saida) + num(a.valor_terceira_saida) + num(a.valor_saida_adicional);
    const reembolsoOutrosPrestador = num(a.valor_reembolso_outros);
    // A31-J1.9 — pernas separadas sem duplicidade: "outros cobrados" (cliente) usa
    // valor_adicional; "outros reembolsos" (prestador) usa valor_reembolso_outros.
    // valor_adicional NÃO alimenta a perna prestador (elimina a duplicidade 66,43 +
    // 66,43 quando o pedágio era lançado também em "Outros adicionais").
    const outrosPrestador = 0;
    const adicionaisPrestador =
      pedagioPrestador + combustivelPrestador + ajudantePrestador +
      diariasPrestador + saidasPrestador + reembolsoOutrosPrestador + outrosPrestador;
    const descontosPrestador = num(a.valor_desconto_prestador);
    const valorPrestadorTotal = valorPrestadorBase + adicionaisPrestador + kmExcedentePrestadorValor - descontosPrestador;

    const podRaw = podMap.get(a.id) || null;
    const pod = podRaw
      ? {
          situacao: podRaw.status === "entregue_ressalva" || podRaw.status === "entregue_com_ressalva"
            ? "entregue_ressalva"
            : podRaw.status === "nao_entregue" ? "nao_entregue"
            : (podRaw.foto_entrega_url || podRaw.foto_canhoto_url) && podRaw.assinatura_url && podRaw.nome_recebedor
              ? "completo"
              : podRaw.foto_entrega_url || podRaw.foto_canhoto_url ? "parcial" : "pendente",
          temFoto: !!(podRaw.foto_entrega_url || podRaw.foto_canhoto_url),
          temCanhoto: !!podRaw.foto_canhoto_url,
          temAssinatura: !!podRaw.assinatura_url,
          recebedor: podRaw.nome_recebedor || null,
          podId: podRaw.id || null,
        }
      : { situacao: "pendente", temFoto: false, temCanhoto: false, temAssinatura: false, recebedor: null, podId: null };

    const receber = osId ? (receberMap.get(osId) || null) : null;
    const pagar = osId ? (pagarMap.get(osId) || null) : null;
    const pagto = osId ? (pagtoMap.get(osId) || null) : null;
    const comp = osId ? (compMap.get(osId) || null) : null;

    const romaneio = os.romaneio || a.metadata?.numeroOC || a.metadata?.app_motorista?.romaneio || null;
    const faturamento = osId ? (faturamentoMap.get(osId) || { status: "nao_faturado" as const, numero: null, faturaId: null }) : { status: "nao_faturado" as const, numero: null, faturaId: null };
    // Notas fiscais transportadas (números p/ pesquisa A31)
    const nfs = osId ? ((fiscaisMap.get(osId) || []).map((f: any) => String(f.numero || "")).filter(Boolean)) : [];

    const semaforo = derivarSemaforoCentral({
      romaneio,
      valorClienteTotal,
      valorPrestadorTotal,
      podSituacao: pod.situacao,
      receberStatus: receber?.status || null,
      pagamentoStatus: pagto?.status_pagamento || pagto?.status || null,
    });

    return {
      id: a.id,
      alocacaoId: a.id,
      osId,
      osNumero: os.numero || "",
      romaneio: romaneio,
      romaneioOC: romaneio,
      data: a.data_escala || "",
      dataFinalizacao: a.data_finalizacao || "",
      clienteId: a.cliente_id || null,
      clienteNome,
      prestadorId: a.prestador_id || null,
      prestadorNome,
      tipoVeiculo: a.tipo_veiculo || "",
      placa: a.placa || "",
      origem: a.origem || "",
      destino: a.destino || "",
      statusOperacional: a.status || "concluida",
      finalizada: !!a.finalizada,
      valorClienteBase,
      valorClienteAdicionais: adicionaisCliente,
      valorClienteDescontos: descontosCliente,
      valorClienteTotal,
      valorPrestadorBase,
      valorPrestadorAdicionais: adicionaisPrestador,
      valorPrestadorDescontos: descontosPrestador,
      valorPrestadorTotal,
      detalhe: {
        kmRealizados,
        kmExcedenteCliente: kmExcedente,
        valorKmExcedenteCliente: valorKmExcedenteCliente,
        pedagioCliente,
        ajudanteCliente,
        diariasCliente,
        saidasCliente,
        outrosCliente,
        kmExcedentePrestador: kmExcedente,
        valorKmExcedentePrestador: kmExcedentePrestadorValor,
        pedagioPrestador,
        combustivelPrestador,
        ajudantePrestador,
        diariasPrestador,
        saidasPrestador,
        reembolsoOutrosPrestador,
        outrosPrestador,
      },
      pod,
      receber,
      pagar,
      pagamentoPrestador: pagto,
      composicao: comp,
      faturamento,
      nfs,
      semaforo: semaforo.semaforo,
      semaforoMotivos: semaforo.motivos,
    };
  });

  // Filtros combinados (em memória sobre o dataset já carregado)
  let resultado = itens;
  const q = (filtros.busca || "").trim().toLowerCase();
  if (q) {
    resultado = resultado.filter((i) =>
      i.osNumero.toLowerCase().includes(q) ||
      (i.romaneioOC || "").toLowerCase().includes(q) ||
      i.clienteNome.toLowerCase().includes(q) ||
      i.prestadorNome.toLowerCase().includes(q) ||
      i.placa.toLowerCase().includes(q) ||
      i.origem.toLowerCase().includes(q) ||
      i.destino.toLowerCase().includes(q) ||
      // A31 — pesquisa por número de NF transportada
      i.nfs.some((nf) => nf.toLowerCase().includes(q))
    );
  }
  if (filtros.cliente) resultado = resultado.filter((i) => i.clienteNome.toLowerCase().includes(filtros.cliente!.toLowerCase()));
  if (filtros.os) resultado = resultado.filter((i) => i.osNumero.toLowerCase().includes(filtros.os!.toLowerCase()));
  if (filtros.romaneio) resultado = resultado.filter((i) => (i.romaneioOC || "").toLowerCase().includes(filtros.romaneio!.toLowerCase()));
  if (filtros.prestador) resultado = resultado.filter((i) => i.prestadorNome.toLowerCase().includes(filtros.prestador!.toLowerCase()));
  if (filtros.placa) resultado = resultado.filter((i) => i.placa.toLowerCase().includes(filtros.placa!.toLowerCase()));
  if (filtros.statusOperacional) resultado = resultado.filter((i) => i.statusOperacional === filtros.statusOperacional);
  if (filtros.pod) {
    resultado = filtros.pod === "com_pod"
      ? resultado.filter((i) => i.pod && i.pod.situacao !== "pendente")
      : filtros.pod === "pendente"
        ? resultado.filter((i) => !i.pod || i.pod.situacao === "pendente")
        : resultado;
  }
  // TMS-FAT-URG-04 — Fila operacional padrão = SOMENTE itens ainda NÃO faturados.
  // Itens já vinculados a fatura ATIVA (rascunho/aguardando/aprovada) ou já
  // emitidos ('faturado') SAEM da fila default. O histórico permanece consultável
  // via "Todos (histórico)" / "Faturado". Nada é apagado.
  if (filtros.faturado) {
    if (filtros.faturado === "nao_faturado") {
      resultado = resultado.filter((i) => i.faturamento.status === "nao_faturado");
    } else if (filtros.faturado === "faturado") {
      resultado = resultado.filter((i) => i.faturamento.status === "faturado");
    } else if (filtros.faturado === "em_processo") {
      resultado = resultado.filter((i) => i.faturamento.status === "rascunho");
    } else if (filtros.faturado === "todos") {
      // sem filtro (histórico completo)
    }
  }
  if (filtros.recebimento) {
    resultado = filtros.recebimento === "recebido"
      ? resultado.filter((i) => i.receber?.status === "pago")
      : filtros.recebimento === "nao_recebido"
        ? resultado.filter((i) => !i.receber || i.receber.status !== "pago")
        : resultado;
  }
  if (filtros.pagamentoPrestador) {
    resultado = filtros.pagamentoPrestador === "pago"
      ? resultado.filter((i) => i.pagamentoPrestador?.status_pagamento === "pago")
      : filtros.pagamentoPrestador === "nao_pago"
        ? resultado.filter((i) => !i.pagamentoPrestador || i.pagamentoPrestador.status_pagamento !== "pago")
        : resultado;
  }

  // TMS-FIN-CONF-UX-ORD-01 — ordenação GLOBAL (mais recente → mais antigo) sobre o
  // conjunto COMPLETO já filtrado, ANTES da paginação feita na tela.
  return ordenarCentralFinanceiro(resultado);
}

/** Busca NFs vinculadas a uma OS (fiscal_documentos_vinculados). */
export async function buscarDocumentosFiscaisDaOS(osId: string): Promise<any[]> {
  if (!osId) return [];
  try {
    const { data, error } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("id, tipo_documento, numero, serie, chave_acesso, valor_total, peso_total, volumes, emitente_nome, status")
      .eq("ordem_servico_id", osId);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** Salva o romaneio/OC diretamente em ordens_servico.romaneio (mesmo registro da OS). */
export async function salvarRomaneioOS(osId: string, romaneio: string): Promise<{ success: boolean; error?: string }> {
  if (!osId) return { success: false, error: "OS não informada" };
  try {
    const { error } = await supabase
      .from("ordens_servico")
      .update({ romaneio: romaneio.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", osId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erro ao salvar romaneio" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// A31B — COMPLEMENTAÇÃO MANUAL VIA CENTRAL ("Completar Serviço" / "Editar informações")
// Escreve EXCLUSIVAMENTE em alocacoes_escala (mesma fonte da Escala/TMS).
// Whitelist de colunas oficiais — a Central NÃO cria base paralela.
// O trigger trg_propagar_financeiro_alocacao propaga para financeiro_receber/pagar.
// ═══════════════════════════════════════════════════════════════════════════════

export type CamposComplementoAlocacao = {
  km_realizados?: number;
  valor_frete?: number;
  valor_repasse?: number;
  valor_pedagio?: number;
  valor_combustivel?: number;
  valor_ajudante?: number;
  diarias_adicionais?: number;
  valor_diaria?: number;
  segunda_saida?: boolean;
  valor_segunda_saida?: number;
  terceira_saida?: boolean;
  valor_terceira_saida?: number;
  saidas_adicionais?: number;
  valor_saida_adicional?: number;
  ajudantes?: number;
  valor_ajudante_unit?: number;
  valor_reembolso_outros?: number;
  valor_adicional?: number;
  valor_desconto?: number;
  // A31-J1.11 — desconto/ajuste EXCLUSIVO do prestador.
  valor_desconto_prestador?: number;
};

/** Colunas financeiras oficiais de alocacoes_escala (fonte única — não é base paralela). */
const CAMPOS_COMPLEMENTO_ALOCACAO: Record<keyof CamposComplementoAlocacao, string> = {
  km_realizados: "km_realizados",
  valor_frete: "valor_frete",
  valor_repasse: "valor_repasse",
  valor_pedagio: "valor_pedagio",
  valor_combustivel: "valor_combustivel",
  valor_ajudante: "valor_ajudante",
  diarias_adicionais: "diarias_adicionais",
  valor_diaria: "valor_diaria",
  segunda_saida: "segunda_saida",
  valor_segunda_saida: "valor_segunda_saida",
  terceira_saida: "terceira_saida",
  valor_terceira_saida: "valor_terceira_saida",
  saidas_adicionais: "saidas_adicionais",
  valor_saida_adicional: "valor_saida_adicional",
  ajudantes: "ajudantes",
  valor_ajudante_unit: "valor_ajudante_unit",
  valor_reembolso_outros: "valor_reembolso_outros",
  valor_adicional: "valor_adicional",
  valor_desconto: "valor_desconto",
  valor_desconto_prestador: "valor_desconto_prestador",
};

/** Complementa/edita campos financeiros da alocação diretamente em alocacoes_escala. */
export async function salvarComplementoFinanceiroAlocacao(
  alocacaoId: string,
  campos: CamposComplementoAlocacao
): Promise<{ success: boolean; error?: string }> {
  if (!alocacaoId) return { success: false, error: "Alocação não informada" };
  const update: Record<string, unknown> = {};
  let algum = false;
  for (const [key, coluna] of Object.entries(CAMPOS_COMPLEMENTO_ALOCACAO)) {
    if (key in campos) {
      const v = (campos as Record<string, unknown>)[key];
      update[coluna] = v ?? null;
      algum = true;
    }
  }
  if (!algum) return { success: false, error: "Nenhum campo para atualizar" };
  update.updated_at = new Date().toISOString();
  try {
    const { error } = await supabase
      .from("alocacoes_escala")
      .update(update)
      .eq("id", alocacaoId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao complementar alocação";
    return { success: false, error: msg };
  }
}

/** Busca os campos financeiros atuais de uma alocação (para pré-preencher o formulário de complemento). */
export async function buscarCamposFinanceirosAlocacao(alocacaoId: string): Promise<Record<string, unknown> | null> {
  if (!alocacaoId) return null;
  try {
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .select("km_realizados, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, diarias_adicionais, valor_diaria, segunda_saida, valor_segunda_saida, terceira_saida, valor_terceira_saida, saidas_adicionais, valor_saida_adicional, ajudantes, valor_ajudante_unit, valor_reembolso_outros, valor_adicional, valor_desconto, valor_desconto_prestador")
      .eq("id", alocacaoId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// A31C — LANÇAMENTO MANUAL VIA CENTRAL ("+ Lançar Serviço")
// Escreve EXCLUSIVAMENTE em alocacoes_escala (fonte única — mesmo modelo da Escala).
// NÃO cria base paralela (não existe financeiro_servicos_manuais) e NÃO cria OS falsa.
// O trigger trg_propagar_financeiro_alocacao propaga para financeiro_receber/pagar.
// ═══════════════════════════════════════════════════════════════════════════════

export interface LancamentoManualServicoInput {
  data_escala: string;
  // TMS-FAT-URG-02 — tenant explícito do contexto oficial (não hardcodar).
  tenant_id?: string | null;
  cliente_id?: string | null;
  prestador_id?: string | null;
  romaneio?: string | null;
  origem?: string | null;
  destino?: string | null;
  tipo_veiculo: string;
  placa?: string | null;
  km_realizados?: number | null;
  valor_frete?: number | null;
  valor_repasse?: number | null;
  valor_pedagio?: number | null;
  valor_combustivel?: number | null;
  valor_ajudante?: number | null;
  diarias_adicionais?: number | null;
  valor_diaria?: number | null;
  ajudantes?: number | null;
  valor_ajudante_unit?: number | null;
  valor_reembolso_outros?: number | null;
  valor_adicional?: number | null;
  valor_desconto?: number | null;
  // A31-J1.11 — desconto/ajuste EXCLUSIVO do prestador (não afeta o cliente).
  valor_desconto_prestador?: number | null;
  observacoes?: string | null;
  // A31-J1.6 — KM excedente (franquia/preço) e pedágio cobrado do cliente.
  // Reutiliza estruturas OFICIAIS: metadata.faturamento, metadata.repasse e a
  // flag pedagio_cobrar_excedente (mesma regra da Escala — pedágio é campo único).
  pedagio_cobrar_excedente?: boolean;
  franquia_km_cliente?: number | null;
  valor_km_excedente_cliente?: number | null;
  franquia_km_prestador?: number | null;
  valor_km_prestador?: number | null;
}

/**
 * Cria um serviço lançado manualmente pela Central Financeira.
 * Insere em alocacoes_escala com status "concluida" + finalizada=true e
 * grava o romaneio em metadata.numeroOC (para a Central ler sem OS vinculada).
 */
export async function lancarServicoManual(
  input: LancamentoManualServicoInput
): Promise<{ success: boolean; alocacaoId?: string; osId?: string; osNumero?: string; error?: string }> {
  if (!input.data_escala) return { success: false, error: "Data do serviço é obrigatória" };
  if (!input.tipo_veiculo) return { success: false, error: "Tipo de veículo é obrigatório" };
  try {
    const romaneio = (input.romaneio || "").trim();

    // A31-J1.7 — criar a OS Interna oficial ANTES da alocação, somente quando há cliente real.
    // Cliente não é obrigatório no lançamento manual — sem cliente, mantém fluxo atual (romaneio-only).
    let osId: string | null = null;
    let osNumero: string | null = null;
    if (input.cliente_id) {
      const osRes = await criarOrdemServico({
        cliente_id: input.cliente_id,
        cliente: input.cliente_id,
        origem: input.origem || "",
        destino: input.destino || "",
        status: "finalizada",
        data_coleta: input.data_escala,
        valor_cliente: input.valor_frete ?? 0,
        observacoes: input.observacoes || undefined,
        metadata: { origem: "central_financeira_manual", tipo_operacao: "fracionado" },
      });
      if (!osRes.sucesso || !osRes.os_id) {
        return { success: false, error: osRes.erro || "Falha ao criar a OS interna" };
      }
      osId = osRes.os_id;
      osNumero = osRes.os_numero || null;
    }

    // TMS-FAT-URG-02 — tenant EXPLÍCITO a partir do contexto oficial. Não
    // hardcoda tenant e não depende exclusivamente do DEFAULT da coluna.
    // Fallback: resolve pelo tenant_usuarios do usuário autenticado.
    let tenantId: string | null = input.tenant_id || null;
    if (!tenantId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          const { data: tu } = await supabase
            .from("tenant_usuarios")
            .select("tenant_id")
            .eq("user_id", uid)
            .eq("status", "ativo")
            .limit(1)
            .maybeSingle();
          tenantId = (tu?.tenant_id as string) || null;
        }
      } catch { /* sem contexto de sessão: mantém null (não sobrescreve) */ }
    }

    const insert: Record<string, unknown> = {
      data_escala: input.data_escala,
      ordem_servico_id: osId,
      // Envia tenant_id APENAS quando resolvido (evita sobrescrever com NULL).
      ...(tenantId ? { tenant_id: tenantId } : {}),
      cliente_id: input.cliente_id || null,
      prestador_id: input.prestador_id || null,
      tipo_veiculo: input.tipo_veiculo,
      placa: input.placa || null,
      origem: input.origem || null,
      destino: input.destino || null,
      status: "concluida",
      status_pagamento: "pendente",
      finalizada: true,
      data_finalizacao: new Date().toISOString(),
      km_realizados: input.km_realizados ?? 0,
      valor_frete: input.valor_frete ?? 0,
      valor_repasse: input.valor_repasse ?? 0,
      valor_pedagio: input.valor_pedagio ?? 0,
      valor_combustivel: input.valor_combustivel ?? 0,
      valor_ajudante: input.valor_ajudante ?? 0,
      diarias_adicionais: input.diarias_adicionais ?? 0,
      valor_diaria: input.valor_diaria ?? 0,
      ajudantes: input.ajudantes ?? 0,
      valor_ajudante_unit: input.valor_ajudante_unit ?? 0,
      valor_reembolso_outros: input.valor_reembolso_outros ?? 0,
      valor_adicional: input.valor_adicional ?? 0,
      valor_desconto: input.valor_desconto ?? 0,
      valor_desconto_prestador: input.valor_desconto_prestador ?? 0,
      pedagio_cobrar_excedente: input.pedagio_cobrar_excedente ?? false,
      observacoes: input.observacoes || null,
      metadata: {
        numeroOC: romaneio || null,
        origem: "central_financeira_manual",
        ...(input.franquia_km_cliente || input.valor_km_excedente_cliente
          ? {
              faturamento: {
                franquia_km: input.franquia_km_cliente ?? null,
                valor_km_excedente: input.valor_km_excedente_cliente ?? null,
              },
            }
          : {}),
        ...(input.valor_km_prestador || input.franquia_km_prestador
          ? {
              repasse: {
                valor_km_prestador: input.valor_km_prestador ?? null,
                franquia_km_prestador: input.franquia_km_prestador ?? null,
              },
            }
          : {}),
      },
    };
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .insert([insert])
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, alocacaoId: data?.id, osId: osId || undefined, osNumero: osNumero || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao lançar serviço";
    return { success: false, error: msg };
  }
}

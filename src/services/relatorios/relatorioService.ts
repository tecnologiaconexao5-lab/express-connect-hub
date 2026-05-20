import { supabase } from "@/lib/supabase";

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

export const buscarDadosFaturamento = async (filtros: FiltrosFaturamento) => {
  try {
    const clientesMap = new Map<string, any>();

    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data_finalizacao,
        cliente_id, cliente, status, valor_cliente,
        custo_prestador, margem_liquida,
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

    const clienteIds = [...new Set(osList.map((o: any) => o.cliente_id).filter(Boolean))];

    let clientesData: any[] = [];
    if (clienteIds.length > 0) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj, cidade, uf")
        .in("id", clienteIds);
      clientesData = cData || [];
    }

    for (const c of clientesData) {
      clientesMap.set(c.id, c);
    }

    const osPorCliente = new Map<string, any[]>();
    for (const os of osList) {
      const key = os.cliente_id || "avulso";
      if (!osPorCliente.has(key)) osPorCliente.set(key, []);
      osPorCliente.get(key)!.push(os);
    }

    const receberStatus = await supabase
      .from("financeiro_receber")
      .select("cliente_id, valor, status");

    const financeiroPorCliente = new Map<string, { pago: number; pendente: number }>();
    for (const r of (receberStatus.data || [])) {
      if (!r.cliente_id) continue;
      if (!financeiroPorCliente.has(r.cliente_id)) {
        financeiroPorCliente.set(r.cliente_id, { pago: 0, pendente: 0 });
      }
      const entry = financeiroPorCliente.get(r.cliente_id)!;
      if (r.status === "paga") {
        entry.pago += Number(r.valor) || 0;
      } else {
        entry.pendente += Number(r.valor) || 0;
      }
    }

    const resultado: any[] = [];
    for (const [clienteId, operacoes] of osPorCliente) {
      const clienteInfo = clientesMap.get(clienteId);
      const fin = financeiroPorCliente.get(clienteId) || { pago: 0, pendente: 0 };
      const totalFaturado = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0), 0);
      const qtd = operacoes.length;

      resultado.push({
        cliente_id: clienteId,
        cliente_nome: clienteInfo?.nome_fantasia || clienteInfo?.razao_social || operacoes[0]?.cliente || "Avulso",
        cliente_cnpj: clienteInfo?.cnpj || "-",
        quantidade_os: qtd,
        valor_faturado: totalFaturado,
        valor_pago: fin.pago,
        valor_pendente: fin.pendente,
        ticket_medio: qtd > 0 ? totalFaturado / qtd : 0,
        ultima_operacao: operacoes.reduce((latest, o) => {
          return o.data_finalizacao > latest ? o.data_finalizacao : latest;
        }, ""),
        margem_total: operacoes.reduce((s, o) => s + (Number(o.margem_liquida) || 0), 0),
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
        id, numero, created_at, data_finalizacao,
        cliente_id, cliente, status, valor_cliente,
        custo_prestador, margem_liquida,
        veiculo_tipo, enderecos, adicionais, descontos, pedagio,
        origem_endereco, destino_endereco
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

    const clienteIds = [...new Set(result.map((o: any) => o.cliente_id).filter(Boolean))];
    if (clienteIds.length > 0) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj")
        .in("id", clienteIds);
      const cmap = new Map((cData || []).map((c: any) => [c.id, c]));
      result = result.map((o: any) => ({
        ...o,
        cliente_nome: cmap.get(o.cliente_id)?.nome_fantasia || cmap.get(o.cliente_id)?.razao_social || o.cliente || "Avulso",
        cliente_cnpj: cmap.get(o.cliente_id)?.cnpj || "-",
      }));
    } else {
      result = result.map((o: any) => ({
        ...o,
        cliente_nome: o.cliente || "Avulso",
        cliente_cnpj: "-",
      }));
    }

    return result;
  } catch (err) {
    console.error("[RelatorioService] Erro faturamento detalhado:", err);
    throw err;
  }
};

export const buscarDadosPagamentoPrestador = async (filtros: FiltrosPagamento) => {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data_finalizacao,
        prestador_id, prestador, cliente, cliente_id,
        status, veiculo_tipo,
        valor_cliente, custo_prestador,
        pedagio, adicionais, descontos,
        enderecos
      `)
      .eq("status", "finalizada");

    if (filtros.dataInicial) query = query.gte("data_finalizacao", filtros.dataInicial + "T00:00:00-03:00");
    if (filtros.dataFinal) query = query.lte("data_finalizacao", filtros.dataFinal + "T23:59:59-03:00");
    if (filtros.prestador) query = query.ilike("prestador", `%${filtros.prestador}%`);

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];

    const prestadorIds = [...new Set(result.map((o: any) => o.prestador_id).filter(Boolean))];
    const clienteIds = [...new Set(result.map((o: any) => o.cliente_id).filter(Boolean))];

    const [prestadoresRes, clientesRes] = await Promise.all([
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo, cpf_cnpj, tipo_parceiro, score_interno").in("id", prestadorIds)
        : { data: [] },
      clienteIds.length > 0
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
        : { data: [] },
    ]);

    const pMap = new Map((prestadoresRes.data || []).map((p: any) => [p.id, p]));
    const cMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

    result = result.map((o: any) => ({
      ...o,
      prestador_nome: pMap.get(o.prestador_id)?.nome_completo || o.prestador || "Não identificado",
      prestador_cpf_cnpj: pMap.get(o.prestador_id)?.cpf_cnpj || "-",
      prestador_tipo: pMap.get(o.prestador_id)?.tipo_parceiro || "-",
      prestador_score: pMap.get(o.prestador_id)?.score_interno || 0,
      cliente_nome: cMap.get(o.cliente_id)?.nome_fantasia || cMap.get(o.cliente_id)?.razao_social || o.cliente || "Avulso",
      valor_final_repasse: (Number(o.custo_prestador) || 0) + (Number(o.adicionais) || 0) - (Number(o.descontos) || 0),
    }));

    const pagamentoStatus = await supabase
      .from("pagamentos_prestadores")
      .select("os_id, status_pagamento");

    const pgtoMap = new Map((pagamentoStatus.data || []).map((p: any) => [p.os_id, p.status_pagamento]));
    result = result.map((o: any) => ({
      ...o,
      status_pagamento: pgtoMap.get(o.id) || "pendente",
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
        id, nome_completo, nome_razao, cpf_cnpj,
        tipo_parceiro, status, score_interno,
        cidade, uf, created_at
      `);

    const { data: prestadores, error } = await query;
    if (error) throw error;

    let result = (prestadores || []).map((p: any) => ({
      ...p,
      nome: p.nome_completo || p.nome_razao || "Não identificado",
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
      result = result.filter((p: any) => (p.cidade || "").toLowerCase().includes(term));
    }
    if (filtros.uf) {
      result = result.filter((p: any) => (p.uf || "").toLowerCase() === filtros.uf.toLowerCase());
    }

    const prestadorIds = result.map((p: any) => p.id);

    const [veiculosRes, osRes, pagamentosRes] = await Promise.all([
      prestadorIds.length > 0
        ? supabase.from("veiculos").select("prestador_id, placa, tipo").in("prestador_id", prestadorIds)
        : { data: [] },
      prestadorIds.length > 0
        ? supabase.from("ordens_servico").select("prestador_id, custo_prestador, data_finalizacao, status, cliente_id").in("prestador_id", prestadorIds)
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

      return {
        ...p,
        veiculos,
        veiculo_principal: veiculos[0]?.placa || "-",
        veiculo_tipo: veiculos[0]?.tipo || "-",
        total_operacoes: operacoes.length,
        operacoes_finalizadas: finalizadas.length,
        valor_recebido: finalizadas.reduce((s: number, o: any) => s + (Number(o.custo_prestador) || 0), 0),
        valor_pago: pagamentos.pago,
        ultima_operacao: finalizadas.reduce((latest: string, o: any) => o.data_finalizacao > latest ? o.data_finalizacao : latest, ""),
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

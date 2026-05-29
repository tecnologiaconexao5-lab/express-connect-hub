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

export const buscarDadosFaturamento = async (filtros: FiltrosFaturamento) => {
  try {
    const clientesMap = new Map<string, any>();

    let query = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data_finalizacao,
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

    let clientesData: any[] = [];
    if (clienteNomesUnicos.length > 0) {
      const orFilters = clienteNomesUnicos
        .map((n: string) => `nome_fantasia.ilike.%${n}%,razao_social.ilike.%${n}%`)
        .join(",");
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj, cidade, uf")
        .or(orFilters);
      clientesData = cData || [];
    }

    for (const c of clientesData) {
      clientesMap.set(c.id, c);
    }

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
      const clienteInfo = clientesData.find(
        (c: any) => c.nome_fantasia === clienteNome || c.razao_social === clienteNome
      );
      const fin = financeiroPorCliente.get(clienteInfo?.id || clienteNome) || { pago: 0, pendente: 0 };
      const totalFaturado = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0), 0);
      const qtd = operacoes.length;
      const margemTotal = operacoes.reduce((s, o) => s + (Number(o.valor_cliente) || 0) - (Number(o.custo_prestador) || 0), 0);

      resultado.push({
        cliente_id: clienteInfo?.id || clienteNome,
        cliente_nome: clienteInfo?.nome_fantasia || clienteInfo?.razao_social || clienteNome || "Avulso",
        cliente_cnpj: clienteInfo?.cnpj || "-",
        quantidade_os: qtd,
        valor_faturado: totalFaturado,
        valor_pago: fin.pago,
        valor_pendente: fin.pendente,
        ticket_medio: qtd > 0 ? totalFaturado / qtd : 0,
        ultima_operacao: operacoes.reduce((latest, o) => {
          return o.data_finalizacao > latest ? o.data_finalizacao : latest;
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
        id, numero, created_at, data_finalizacao,
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

    const clienteNomes = [...new Set(result.map((o: any) => o.cliente).filter(Boolean))];
    if (clienteNomes.length > 0) {
      const orFilters = clienteNomes
        .map((n: string) => `nome_fantasia.ilike.%${n}%,razao_social.ilike.%${n}%`)
        .join(",");
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj")
        .or(orFilters);
      const cmap = new Map<string, any>();
      (cData || []).forEach((c: any) => {
        if (c.nome_fantasia) cmap.set(c.nome_fantasia, c);
        if (c.razao_social) cmap.set(c.razao_social, c);
      });
      result = result.map((o: any) => ({
        ...o,
        cliente_nome: cmap.get(o.cliente)?.nome_fantasia || cmap.get(o.cliente)?.razao_social || o.cliente || "Avulso",
        cliente_cnpj: cmap.get(o.cliente)?.cnpj || "-",
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
    let prestadorNomeFiltro = "";
    if (filtros.prestadorId && filtros.prestadorId !== "todos") {
      const { data: prest } = await supabase
        .from("prestadores")
        .select("nome_completo")
        .eq("id", filtros.prestadorId)
        .single();
      if (prest?.nome_completo) {
        prestadorNomeFiltro = prest.nome_completo;
      }
    }

    // --- 1. Buscar de ordens_servico ---
    let queryOS = supabase
      .from("ordens_servico")
      .select(`
        id, numero, created_at, data_finalizacao,
        prestador, cliente, cliente_id,
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

    // --- 2. Buscar de alocacoes_escala ---
    let queryEsc = supabase
      .from("alocacoes_escala")
      .select(`
        id, created_at, data_escala,
        prestador_id, prestador_nome,
        cliente_id, cliente_nome,
        status, tipo_veiculo,
        valor_repasse, valor_fixo, valor_frete,
        metadata
      `);
    if (prestadorNomeFiltro) {
      if (filtros.prestadorId && filtros.prestadorId !== "todos") {
        queryEsc = queryEsc.or(`prestador_id.eq.${filtros.prestadorId},prestador_nome.ilike.%${prestadorNomeFiltro}%`);
      } else {
        queryEsc = queryEsc.ilike("prestador_nome", `%${prestadorNomeFiltro}%`);
      }
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
      data_finalizacao: o.data_finalizacao,
      prestador: o.prestador,
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
        prestador: e.prestador_nome,
        cliente: e.cliente_nome,
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

    // --- 4. Enriquecer dados (Prestador/Cliente nomes) ---
    const prestadorNomes = [...new Set(result.map((o: any) => o.prestador).filter(Boolean))];
    const clienteNomes = [...new Set(result.map((o: any) => o.cliente).filter(Boolean))];

    const [prestadoresRes, clientesRes] = await Promise.all([
      prestadorNomes.length > 0
        ? supabase.from("prestadores").select("id, nome_completo, cpf_cnpj, tipo_parceiro, score_interno").in("nome_completo", prestadorNomes as string[])
        : { data: [] },
      clienteNomes.length > 0
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").or(
            clienteNomes.map((n: string) => `nome_fantasia.ilike.%${n}%,razao_social.ilike.%${n}%`).join(",")
          )
        : { data: [] },
    ]);

    const pMap = new Map((prestadoresRes.data || []).map((p: any) => [p.nome_completo, p]));
    const cMap = new Map<string, any>();
    (clientesRes.data || []).forEach((c: any) => {
      if (c.nome_fantasia) cMap.set(c.nome_fantasia, c);
      if (c.razao_social) cMap.set(c.razao_social, c);
    });

    result = result.map((o: any) => ({
      ...o,
      prestador_nome: o.prestador || "Nao identificado",
      prestador_cpf_cnpj: pMap.get(o.prestador)?.cpf_cnpj || "-",
      prestador_tipo: pMap.get(o.prestador)?.tipo_parceiro || "-",
      prestador_score: pMap.get(o.prestador)?.score_interno || 0,
      cliente_nome: o.cliente || "Avulso",
      cliente_id: o.cliente_id || cMap.get(o.cliente)?.id,
      valor_final_repasse: calcularRepassePrestador({ custo_prestador: o.custo_prestador, pedagio: o.pedagio, adicionais: o.adicionais, descontos: o.descontos }).totalLiquido,
    }));

    // --- 5. Status Pagamento Prestador ---
    const prestadorIds = [...new Set((prestadoresRes.data || []).map((p: any) => p.id))];
    let pgtoMap = new Map<string, string>();

    if (prestadorIds.length > 0) {
      const pagamentoStatus = await supabase
        .from("pagamentos_prestadores")
        .select("prestador_id, prestador_nome, status")
        .in("prestador_id", prestadorIds);

      (pagamentoStatus.data || []).forEach((p: any) => {
        if (p.prestador_nome) pgtoMap.set(p.prestador_nome, p.status || "pendente");
      });
    }

    result = result.map((o: any) => ({
      ...o,
      status_pagamento: pgtoMap.get(o.prestador) || "pendente",
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
        id, nome_completo, nome_fantasia, cpf_cnpj,
        tipo_parceiro, status, score_interno,
        cidade, uf, created_at
      `);

    const { data: prestadores, error } = await query;
    if (error) throw error;

    let result = (prestadores || []).map((p: any) => ({
      ...p,
      nome: p.nome_completo || p.nome_fantasia || "Nao identificado",
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

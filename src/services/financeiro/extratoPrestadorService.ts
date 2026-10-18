import { supabase } from '@/lib/supabase';

// Interfaces principais
export interface ExtratoFechamentoPrestador {
  id?: string;
  prestador: {
    id: string;
    nome_completo: string;
    cpf_cnpj?: string;
    telefone?: string;
    veiculo_tipo?: string;
    veiculo_placa?: string;
  };
  periodo_inicio: string;
  periodo_fim: string;
  data_geracao: string;
  numero: string;
  status: 'em_conferencia' | 'conferido' | 'aprovado' | 'pago' | 'cancelado';
  status_pagamento?: 'pendente' | 'programado' | 'em_lote' | 'pago' | 'cancelado';
  status_aprovacao?: 'pendente' | 'aprovado' | 'reprovado';
  valor_total_creditos: number;
  valor_total_debitos: number;
  valor_liquido: number;
  valor_servicos: number;
  valor_pedagio: number;
  valor_adicionais: number;
  valor_reembolsos: number;
  valor_descontos: number;
  valor_adiantamentos: number;
  valor_combustivel: number;
  valor_bonus: number;
  operacoes: OperacaoFinanceira[];
  movimentos: MovimentoContaCorrente[];
  observacoes?: string;
  data_pagamento?: string;
  valor_pago?: number;
  created_at?: string;
  updated_at?: string;
  clienteLabel?: string;
  origemLabel?: string;
}

export interface OperacaoFinanceira {
  id: string;
  tipo: 'credito' | 'debito';
  data_operacao: string;
  ordem_servico_numero?: string;
  origem?: string;
  destino?: string;
  km_total?: number;
  cliente_nome?: string;
  valor_base: number;
  valor_pedagio?: number;
  valor_ajudante?: number;
  valor_adicionais?: number;
  valor_descontos?: number;
  valor_combustivel?: number;
  valor_reembolso_outros?: number;
  valor?: number;
  romaneio?: string;
  jaFechada?: boolean;
  referenciaFechamento?: string;
  tipoOrigem?: string;
  origemEscala?: boolean;
  descricao?: string;
}

export interface MovimentoContaCorrente {
  id: string;
  tipo_movimento: string;
  natureza: 'credito' | 'debito';
  valor: number;
  descricao?: string;
  data_movimento: string;
}

interface FiltrosExtrato {
  prestador_id?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  status?: string;
  status_pagamento?: string;
}

// Serviço principal
const ExtratoPrestadorService = {
  // ─────────────────────────────────────────────────────────────────────────────
  // FIN-MOT-1H2: montar extrato diretamente do fechamento REAL da tela
  // (fonte: pagamentos_prestadores + itens vinculados + OS + cliente).
  // Reusa o mesmo shape/extrato do FIN-MOT-1, porém lê a MESMA fonte que o
  // usuário já vê em 'Fechamentos e Pagamentos'. Nenhum dado criado.
  // ─────────────────────────────────────────────────────────────────────────────
  async construirExtratoDeFechamento(
    pagamento: any
  ): Promise<ExtratoFechamentoPrestador> {
    if (!pagamento) {
      throw new Error('Fechamento não informado');
    }

    // 1. Prestador real (nome, documento, telefone, veículo)
    let prestador: ExtratoFechamentoPrestador['prestador'] = {
      id: pagamento.prestador_id || '',
      nome_completo: pagamento.prestador_nome || 'Não informado',
      cpf_cnpj: pagamento.prestador_documento || undefined,
      telefone: undefined,
      veiculo_tipo: undefined,
      veiculo_placa: undefined,
    };
    if (pagamento.prestador_id) {
      try {
        const p = await this.buscarDadosPrestador(pagamento.prestador_id);
        prestador = { ...prestador, ...p };
      } catch {
        // mantém dados vindos do fechamento
      }
    }

    // 2. Itens do fechamento (OS vinculadas) — fonte real pagamentos_prestadores_itens
    const itens = await this.buscarItensDeFechamento(pagamento.id);
    const operacoes: OperacaoFinanceira[] = Array.isArray(itens)
      ? itens.map((item) => ({
          id: item.os_id || item.id || String(item.os_numero || ''),
          tipo: 'credito' as const,
          data_operacao: pagamento.periodo_fim || pagamento.data_competencia || '',
          ordem_servico_numero: item.os_numero || (pagamento.os_numero as string) || undefined,
          valor_base: item.valor_servico ?? 0,
          valor_pedagio: item.pedagio ?? 0,
          valor_adicionais: item.adicional ?? item.valor_adicional ?? 0,
          valor_descontos: item.valor_desconto ?? 0,
          valor: item.valor_servico ?? 0,
          descricao: item.os_numero ? `OS ${item.os_numero}` : 'Serviço do fechamento',
        }))
      : [];

    // Se não houver itens, tenta via os_numero do fechamento
    if (operacoes.length === 0 && pagamento.os_numero) {
      operacoes.push({
        id: pagamento.os_id || pagamento.os_numero,
        tipo: 'credito',
        data_operacao: pagamento.data_competencia || pagamento.periodo_fim || '',
        ordem_servico_numero: pagamento.os_numero,
        valor_base: pagamento.valor_servicos ?? 0,
        valor_pedagio: pagamento.pedagio ?? 0,
        valor_adicionais: pagamento.adicionais ?? 0,
        valor_descontos: pagamento.valor_descontos ?? 0,
        valor: pagamento.valor_servicos ?? 0,
        descricao: `OS ${pagamento.os_numero}`,
      });
    }

    // 3. Cliente / romaneio a partir das OS (quando disponível)
    await this.enriquecerOperacoesComOS(operacoes);

    // 4. Valores — SEMPRE a mesma fonte da tela (colunas do fechamento)
    const valor_servicos = Number(pagamento.valor_servicos ?? 0) || 0;
    const valor_pedagio = Number(pagamento.pedagio ?? 0) || 0;
    const valor_adicionais = Number(pagamento.adicionais ?? (pagamento.valor_adicionais ?? 0)) || 0;
    const valor_reembolsos = Number(pagamento.valor_reembolsos ?? 0) || 0;
    const valor_descontos = Number(pagamento.valor_descontos ?? 0) || 0;
    const valor_adiantamentos = Number(pagamento.valor_adiantamentos ?? 0) || 0;
    const valor_combustivel = Number(pagamento.valor_combustivel ?? 0) || 0;
    const valor_bonus = Number(pagamento.valor_bonus ?? 0) || 0;

    const valor_total_creditos =
      valor_servicos + valor_pedagio + valor_adicionais + valor_reembolsos + valor_bonus;
    const valor_total_debitos = valor_descontos + valor_adiantamentos + valor_combustivel;
    const valor_liquido =
      pagamento.valor_liquido !== undefined && pagamento.valor_liquido !== null
        ? Number(pagamento.valor_liquido) || 0
        : valor_total_creditos - valor_total_debitos;

    const statusPag: ExtratoFechamentoPrestador['status_pagamento'] =
      pagamento.status_pagamento === 'pago'
        ? 'pago'
        : pagamento.status_pagamento === 'em_lote'
        ? 'em_lote'
        : pagamento.status_pagamento === 'programado'
        ? 'programado'
        : pagamento.status_pagamento === 'cancelado'
        ? 'cancelado'
        : 'pendente';

    const numero =
      pagamento.numero ||
      `FP-${String(pagamento.periodo_inicio || '').slice(0, 7).replace('-', '')}-${String(
        pagamento.id || ''
      ).slice(0, 8).toUpperCase()}`;

    return {
      id: pagamento.id,
      prestador,
      periodo_inicio: pagamento.periodo_inicio || pagamento.data_competencia || '',
      periodo_fim: pagamento.periodo_fim || pagamento.data_competencia || '',
      data_geracao: pagamento.created_at
        ? String(pagamento.created_at).slice(0, 10)
        : new Date().toISOString().split('T')[0],
      numero,
      status:
        pagamento.status === 'pago'
          ? 'pago'
          : pagamento.status === 'cancelado'
          ? 'cancelado'
          : pagamento.status_aprovacao === 'aprovado'
          ? 'aprovado'
          : pagamento.status_conferencia === 'conferido'
          ? 'conferido'
          : 'em_conferencia',
      status_pagamento: statusPag,
      status_aprovacao:
        pagamento.status_aprovacao === 'aprovado'
          ? 'aprovado'
          : pagamento.status_aprovacao === 'rejeitado' || pagamento.status_aprovacao === 'reprovado'
          ? 'reprovado'
          : 'pendente',
      valor_total_creditos,
      valor_total_debitos,
      valor_liquido,
      valor_servicos,
      valor_pedagio,
      valor_adicionais,
      valor_reembolsos,
      valor_descontos,
      valor_adiantamentos,
      valor_combustivel,
      valor_bonus,
      operacoes,
      movimentos: [],
      observacoes: pagamento.observacao || undefined,
      data_pagamento: pagamento.data_pagamento || undefined,
      valor_pago: pagamento.valor_pago !== undefined ? Number(pagamento.valor_pago) : undefined,
      created_at: pagamento.created_at,
      updated_at: pagamento.updated_at,
    };
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FIN-MOT-2: EXTRATO CONSULTIVO POR PERÍODO (sem exigir fechamento prévio).
  // Monta o ExtratoFechamentoPrestador A PARTIR da produção real do prestador
  // no intervalo (fonte: ordens_servico + pagamentos_prestadores de débitos).
  // NÃO cria registro em `pagamentos_prestadores`. Nada inventado.
  // Chave de deduplicação: `ordens_servico.id` (existe uma única vez por operação).
  // ─────────────────────────────────────────────────────────────────────────────
  async construirExtratoPorPeriodo(params: {
    prestadorId: string;
    dataInicio: string;
    dataFim: string;
    clienteId?: string;
    origem?: string; // 'todos' | 'ordem_servico' | 'escala' | 'manual'
  }): Promise<ExtratoFechamentoPrestador> {
    const { prestadorId, dataInicio, dataFim, clienteId, origem } = params || {};
    if (!prestadorId) throw new Error('prestadorId é obrigatório');
    if (!dataInicio || !dataFim) throw new Error('dataInicio e dataFim são obrigatórios');
    const tipoFiltro = (origem || 'todos').toLowerCase();

    // 1. Prestador real
    const prestador = await this.buscarDadosPrestador(prestadorId);

    // 2. OS do prestador no período (produção OS) — fonte real ordens_servico
    let q = supabase
      .from('ordens_servico')
      .select(
          'id, numero, prestador_id, cliente, cliente_id, romaneio, origem, destino, distancia_km, ' +
          'custo_prestador, pedagio, adicionais, descontos, data, status'
      )
      .eq('prestador_id', prestadorId)
      .in('status', ['finalizada', 'concluida'])
      .gte('data', dataInicio)
      .lte('data', dataFim);
    // A relação UUID oficial da OS é `cliente`; `cliente_id` é texto legado.
    if (clienteId) q = q.eq('cliente', clienteId);
    const { data: ossData, error: ossError } = await q.order('data', { ascending: true });
    if (ossError) throw new Error(`Falha ao consultar ordens_servico: ${ossError.message}`);
    const oss: any[] = ossData || [];

    // 3. Escalas do prestador no período (produção Escala) — fonte real alocacoes_escala
    let escalas: any[] = [];
    if (tipoFiltro === 'todos' || tipoFiltro === 'escala') {
      try {
        let eq = supabase
          .from('alocacoes_escala')
          .select(
            'id, ordem_servico_id, prestador_id, cliente_id, data_escala, ' +
              'origem, destino, km_previstos, km_realizados, valor_repasse, valor_pedagio, ' +
              'valor_adicional, valor_desconto, valor_reembolso_outros, status, finalizada'
          )
          .eq('prestador_id', prestadorId)
          .in('status', ['finalizada', 'concluida', 'executada'])
          .gte('data_escala', dataInicio)
          .lte('data_escala', dataFim);
        if (clienteId) eq = eq.eq('cliente_id', clienteId);
        const { data, error } = await eq.order('data_escala', { ascending: true });
        if (error) throw new Error(`Falha ao consultar alocacoes_escala: ${error.message}`);
        escalas = (data || []) as any[];
      } catch (e) {
        throw e instanceof Error ? e : new Error('Falha ao consultar alocacoes_escala');
      }
    }

    // 4. Chave canônica de deduplicação Escala ↔ OS:
    //    escala.ordem_servico_id === ordens_servico.id  (mesmo serviço = UM crédito).
    const osIdSet = new Set(oss.map((o) => o.id).filter(Boolean));
    const escalaOsVinculados = new Set(
      (escalas || []).map((e) => e.ordem_servico_id).filter((v) => v && osIdSet.has(v))
    );
    // Escalas SEM OS vinculada (ordem_servico_id nulo ou aponta p/ OS fora do filtro) → contam como produção própria.
    const escalasSemOS = (escalas || []).filter(
      (e) => !e.ordem_servico_id || !osIdSet.has(e.ordem_servico_id)
    );

    // 5. Mapa de OS já fechadas (em pagamentos_prestadores_itens) — p/ flag e NÃO duplicar crédito
    const idsOS = oss.map((o) => o.id).filter(Boolean);
    const fechadasSet = new Set<string>();
    const fechamentoPorOS = new Map<string, string>();
    if (idsOS.length > 0) {
      try {
        const { data: itens } = await supabase
          .from('pagamentos_prestadores_itens')
          .select('os_id, pagamento_id')
          .in('os_id', idsOS);
        if (itens && itens.length > 0) {
          const pagIds = [...new Set(itens.map((i) => i.pagamento_id).filter(Boolean))] as string[];
          if (pagIds.length > 0) {
            const { data: fechs } = await supabase
              .from('pagamentos_prestadores')
              .select('id')
              .in('id', pagIds);
            const fechPagIds = new Set((fechs || []).map((f) => f.id));
            itens.forEach((i) => {
              if (i.os_id && fechPagIds.has(i.pagamento_id)) {
                fechadasSet.add(i.os_id);
                fechamentoPorOS.set(i.os_id, `FP-${String(i.pagamento_id).slice(0, 8).toUpperCase()}`);
              }
            });
          }
        }
      } catch (e) {
        console.warn('[extrato-periodo] erro ao mapear fechados:', e);
      }
    }

    // 6. Montar linhas de produção (OS = referência principal; Escala sem OS = produção própria)
    const operacoes: OperacaoFinanceira[] = [];

    // 6a. OS (principal) — tipoOrigem sempre 'ordem_servico'; se houver Escala vinculada,
    //     marca origemEscala=true (rastreabilidade) e NÃO gera linha extra da escala.
    if (tipoFiltro === 'todos' || tipoFiltro === 'ordem_servico' || tipoFiltro === 'escala') {
      for (const os of oss || []) {
        const teveEscala = escalaOsVinculados.has(os.id);
        operacoes.push({
          id: `os-${os.id}`,
          tipo: 'credito',
          data_operacao: os.data || dataInicio,
          tipoOrigem: 'ordem_servico',
          origemEscala: teveEscala,
          ordem_servico_numero: os.numero,
          romaneio: os.romaneio || undefined,
          cliente_nome: os.cliente || os.cliente_id || undefined,
          origem: os.origem || undefined,
          destino: os.destino || undefined,
            km_total: os.distancia_km ?? undefined,
          valor_base: Number(os.custo_prestador ?? 0) || 0,
          valor_pedagio: Number(os.pedagio ?? 0) || 0,
          valor_adicionais: Number(os.adicionais ?? 0) || 0,
          valor_descontos: Number(os.descontos ?? 0) || 0,
          valor: Number(os.custo_prestador ?? 0) || 0,
          jaFechada: fechadasSet.has(os.id),
          referenciaFechamento: fechamentoPorOS.get(os.id),
          descricao: os.numero ? `OS ${os.numero}` : 'Serviço do período',
        });
      }

      // 6b. Escalas SEM OS vinculada — produção própria (origem "escala")
      if (tipoFiltro === 'todos' || tipoFiltro === 'escala') {
        for (const esc of escalasSemOS || []) {
          operacoes.push({
            id: `esc-${esc.id}`,
            tipo: 'credito',
            data_operacao: esc.data_escala || dataInicio,
            tipoOrigem: 'escala',
            origemEscala: true,
            ordem_servico_numero: undefined,
            cliente_nome: esc.cliente_id || undefined,
            origem: esc.origem || undefined,
            destino: esc.destino || undefined,
            km_total: esc.km_realizados ?? esc.km_previstos ?? undefined,
            valor_base: Number(esc.valor_repasse ?? esc.valor_base ?? 0) || 0,
            valor_pedagio: Number(esc.valor_pedagio ?? 0) || 0,
            valor_adicionais: Number(esc.valor_adicional ?? esc.valor_adicionais ?? 0) || 0,
            valor_descontos: Number(esc.valor_desconto ?? esc.valor_descontos ?? 0) || 0,
            valor: Number(esc.valor_repasse ?? esc.valor_base ?? 0) || 0,
            jaFechada: false,
            descricao: esc.os_numero ? `Programação ${esc.os_numero}` : 'Programação do período',
          });
        }
      }
    }

    // Manter apenas linhas cuja origem corresponde ao filtro selecionado.
    // "escala" inclui OS que vieram de escala (origemEscala) sem duplicar.
    const filtrarPorOrigem = (linha: OperacaoFinanceira): boolean => {
      if (tipoFiltro === 'todos') return true;
      if (tipoFiltro === 'manual') return linha.tipoOrigem === 'manual';
      if (tipoFiltro === 'escala')
        return linha.tipoOrigem === 'escala' || linha.origemEscala === true;
      if (tipoFiltro === 'ordem_servico') return linha.tipoOrigem === 'ordem_servico';
      return true;
    };

    // 7. Movimentos financeiros manuais do prestador (crédito e débito) — origem "manual"
    const movimentos: OperacaoFinanceira[] = [];
    if (tipoFiltro === 'todos' || tipoFiltro === 'manual') {
      try {
        let mq: any = supabase
          .from('pagamentos_prestadores')
          .select('id, os_id, os_numero, tipo_lancamento, natureza, valor_liquido, valor_servicos, data_competencia, periodo_inicio, periodo_fim, observacao')
          .eq('prestador_id', prestadorId)
          .eq('origem_lancamento', 'manual');
        const { data, error } = await mq.order('data_competencia', { ascending: true });
        if (error) throw new Error(`Falha ao consultar pagamentos_prestadores: ${error.message}`);
        if (data) {
          for (const mv of data.filter((item) => {
            const dataMovimento = item.data_competencia || item.periodo_inicio || item.periodo_fim;
            const noPeriodo = Boolean(dataMovimento && dataMovimento >= dataInicio && dataMovimento <= dataFim);
            const clientePermitido = !clienteId || (item.os_id && osIdSet.has(item.os_id));
            return noPeriodo && clientePermitido;
          })) {
            const isCred = String(mv.natureza).toLowerCase() !== 'debito';
            const v = Number(mv.valor_liquido ?? (mv.valor_servicos ?? 0)) || 0;
            const desc = mv.observacao || mv.tipo_lancamento || (isCred ? 'Crédito manual' : 'Débito manual');
            movimentos.push({
              id: `man-${mv.id}`,
              tipo: isCred ? 'credito' : 'debito',
              data_operacao: mv.data_competencia || dataInicio,
              tipoOrigem: 'manual',
              ordem_servico_numero: mv.os_numero || undefined,
              cliente_nome: undefined,
              valor_base: isCred ? v : 0,
              valor: isCred ? v : -v,
              jaFechada: false,
              descricao: desc,
            });
          }
        }
      } catch (e) {
        console.warn('[extrato-periodo] erro ao buscar movimentos manuais:', e);
      }
    }

    // 8. Consolidar: linhas de produção + manuais, aplicando o filtro de origem
    const todasLinhas = [...operacoes, ...movimentos].filter(filtrarPorOrigem);

    // 9. Valores consolidados a partir das operações(+manuais) montadas
    let valor_servicos = 0;
    let valor_pedagio = 0;
    let valor_adicionais = 0;
    let valor_descontos = 0;
    let valor_adiantamentos = 0;
    let valor_combustivel = 0;
    let valor_reembolsos = 0;
    let valor_bonus = 0;
    let valor_outros_creditos = 0;

    for (const linha of todasLinhas) {
      const lc = String(linha.tipoOrigem || '').toLowerCase();
      const isCredLinha = linha.tipo === 'credito';
      const v = Number(linha.valor ?? 0) || 0;
      const vbase = Number(linha.valor_base ?? 0) || 0;
      const desc = String(linha.descricao || '').toLowerCase();

      if (lc === 'manual') {
        // movimentos manuais: crédito vai para outros créditos; débito para débitos
        if (isCredLinha) {
          if (desc.includes('reembolso') || desc.includes('bônus') || desc.includes('bonus')) {
            if (desc.includes('reembolso')) valor_reembolsos += Math.abs(v);
            else valor_bonus += Math.abs(v);
          } else {
            valor_outros_creditos += Math.abs(v);
          }
        } else {
          if (desc.includes('adiantamento') || desc.includes('vale')) valor_adiantamentos += Math.abs(v);
          else if (desc.includes('combust') || desc.includes('abaste')) valor_combustivel += Math.abs(v);
          else valor_descontos += Math.abs(v);
        }
      } else {
        // produção (OS / escala)
        valor_servicos += vbase;
        valor_pedagio += Number(linha.valor_pedagio ?? 0) || 0;
        valor_adicionais += Number(linha.valor_adicionais ?? 0) || 0;
        valor_descontos += Number(linha.valor_descontos ?? 0) || 0;
      }
    }

    const valor_total_creditos = valor_servicos + valor_pedagio + valor_adicionais + valor_reembolsos + valor_bonus + valor_outros_creditos;
    const valor_total_debitos = valor_descontos + valor_adiantamentos + valor_combustivel;
    const valor_liquido = valor_total_creditos - valor_total_debitos;

    const origemLabel =
      tipoFiltro === 'ordem_servico'
        ? 'Ordem de Serviço'
        : tipoFiltro === 'escala'
        ? 'Programação'
        : tipoFiltro === 'manual'
        ? 'Lançamento Manual'
        : 'Todos';

    return {
      prestador,
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      data_geracao: new Date().toISOString().split('T')[0],
      numero: `EP-${String(dataInicio).replace(/[^0-9]/g, '')}-${String(prestadorId).slice(0, 8).toUpperCase()}`,
      status: 'em_conferencia',
      status_pagamento: 'pendente',
      status_aprovacao: 'pendente',
      valor_total_creditos,
      valor_total_debitos,
      valor_liquido,
      valor_servicos,
      valor_pedagio,
      valor_adicionais,
      valor_reembolsos,
      valor_descontos,
      valor_adiantamentos,
      valor_combustivel,
      valor_bonus,
      operacoes: todasLinhas,
      movimentos: [],
      clienteLabel: clienteId ? (clienteId) : 'Todos',
      origemLabel,
      observacoes: `Extrato consultivo do período — produção de ${dataInicio} a ${dataFim}. ` +
        `Origem: ${origemLabel}. Cliente: ${clienteId ? 'específico' : 'Todos'}.`,
    };
  },

  // Buscar itens (OS) vinculados a um fechamento — fonte real
  async buscarItensDeFechamento(fechamentoId: string): Promise<any[]> {
    if (!fechamentoId) return [];
    try {
      const { data, error } = await supabase
        .from('pagamentos_prestadores_itens')
        .select('*')
        .eq('pagamento_id', fechamentoId);
      if (error) {
        console.warn('[extrato] sem itens_pagamentos (fonte alternativa):', error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  // Enriquecer operações com cliente/romaneio/origem/destino/km via ordens_servico
  async enriquecerOperacoesComOS(operacoes: OperacaoFinanceira[]): Promise<void> {
    const numsArr = operacoes.map((o) => o.ordem_servico_numero).filter(Boolean) as string[];
    const osNums = Array.from(new Set(numsArr));
    if (osNums.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, numero, cliente, romaneio, origem, destino, km_total, adicionais')
        .in('numero', osNums);
      if (error || !data) return;
      const map = new Map<string, any>(data.map((o) => [o.numero, o]));
      for (const op of operacoes) {
        const os = map.get(op.ordem_servico_numero || '');
        if (!os) continue;
        op.romaneio = os.romaneio || op.romaneio;
        op.origem = os.origem || op.origem;
        op.destino = os.destino || op.destino;
        op.km_total = os.km_total ?? op.km_total;
        if (!op.cliente_nome) op.cliente_nome = os.cliente || undefined;
      }
    } catch {
      // silencioso — dados já vêm do fechamento
    }
  },

  // Criar extrato a partir de dados reais (alocações do período)
  async criarExtrato(
    prestadorId: string,
    periodo_inicio: string,
    periodo_fim: string,
    options?: {
      observacoes?: string;
    }
  ): Promise<ExtratoFechamentoPrestador> {
    if (!prestadorId) {
      throw new Error('prestadorId é obrigatório');
    }

    if (new Date(periodo_inicio) > new Date(periodo_fim)) {
      throw new Error('período_inicio não pode ser maior que período_fim');
    }

    // 1. Buscar dados do prestador
    const prestador = await this.buscarDadosPrestador(prestadorId);

    // 2. Buscar operações do período
    const operacoes = await this.buscarOperacoesPeriodo(prestadorId, periodo_inicio, periodo_fim);

    // 3. Buscar movimentos de conta corrente
    const movimentos = await this.buscarMovimentosPeriodo(prestadorId, periodo_inicio, periodo_fim);

    // 4. Calcular resumo financeiro
    const resumo = this.calcularResumoFinanceiro(operacoes, movimentos);

    // 5. Gerar número do extrato
    const numero = await this.gerarNumeroExtrato();

    // 6. Montar extrato completo
    const extrato: ExtratoFechamentoPrestador = {
      prestador,
      periodo_inicio,
      periodo_fim,
      data_geracao: new Date().toISOString().split('T')[0],
      numero,
      status: 'em_conferencia',
      status_pagamento: 'pendente',
      status_aprovacao: 'pendente',
      ...resumo,
      operacoes,
      movimentos,
      observacoes: options?.observacoes
    };

    return extrato;
  },

  // Buscar dados do prestador
  async buscarDadosPrestador(prestadorId: string): Promise<ExtratoFechamentoPrestador['prestador']> {
    const { data, error } = await supabase
      .from('prestadores')
      .select('id, nome_completo, cpf_cnpj, telefone, veiculos(tipo, placa)')
      .eq('id', prestadorId)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar prestador: ${error.message}`);
    }

    if (!data) {
      throw new Error('Prestador não encontrado');
    }

    const veiculos = (data.veiculos as any[]) || [];
    const veiculoPrincipal = veiculos[0];

    return {
      id: data.id,
      nome_completo: data.nome_completo,
      cpf_cnpj: data.cpf_cnpj,
      telefone: data.telefone,
      veiculo_tipo: veiculoPrincipal?.tipo,
      veiculo_placa: veiculoPrincipal?.placa
    };
  },

  // Buscar operações do período
  async buscarOperacoesPeriodo(
    prestadorId: string,
    periodo_inicio: string,
    periodo_fim: string
  ): Promise<OperacaoFinanceira[]> {
    try {
      // Consulta para buscar alocações do prestador no período
      const { data, error } = await supabase
        .from('alocacoes_escala')
        .select(`
          id,
          data_inicio_real,
          ordem_servico_numero,
          origem,
          destino,
          km_total,
          cliente_nome,
          valor_base,
          valor_pedagio,
          valor_ajudante,
          valor_adicionais,
          valor_descontos,
          valor_combustivel,
          valor_reembolso_outros
        `)
        .eq('prestador_id', prestadorId)
        .gte('data_inicio_real', `${periodo_inicio}T00:00:00`)
        .lte('data_inicio_real', `${periodo_fim}T23:59:59`)
        .order('data_inicio_real', { ascending: true });

      if (error) {
        console.error('Erro ao buscar operações:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Mapear para interface OperacaoFinanceira
      return data.map(alocacao => ({
        id: alocacao.id,
        tipo: 'credito', // Assumindo que alocações são créditos
        data_operacao: alocacao.data_inicio_real?.split('T')[0] || periodo_inicio,
        ordem_servico_numero: alocacao.ordem_servico_numero,
        origem: alocacao.origem,
        destino: alocacao.destino,
        km_total: alocacao.km_total,
        cliente_nome: alocacao.cliente_nome,
        valor_base: alocacao.valor_base || 0,
        valor_pedagio: alocacao.valor_pedagio,
        valor_ajudante: alocacao.valor_ajudante,
        valor_adicionais: alocacao.valor_adicionais,
        valor_descontos: alocacao.valor_descontos,
        valor_combustivel: alocacao.valor_combustivel,
        valor_reembolso_outros: alocacao.valor_reembolso_outros,
        descricao: `Serviço ${alocacao.origem} → ${alocacao.destino}`
      }));
    } catch (error) {
      console.error('Erro ao buscar operações:', error);
      return [];
    }
  },

  // Buscar movimentos de conta corrente
  async buscarMovimentosPeriodo(
    prestadorId: string,
    periodo_inicio: string,
    periodo_fim: string
  ): Promise<MovimentoContaCorrente[]> {
    try {
      const { data, error } = await supabase
        .from('movimentos_conta_corrente_prestador')
        .select('*')
        .eq('prestador_id', prestadorId)
        .gte('data_movimento', `${periodo_inicio}T00:00:00`)
        .lte('data_movimento', `${periodo_fim}T23:59:59`)
        .order('data_movimento', { ascending: true });

      if (error) {
        console.error('Erro ao buscar movimentos:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(mov => ({
        id: mov.id,
        tipo_movimento: mov.tipo_movimento,
        natureza: mov.natureza,
        valor: mov.valor,
        descricao: mov.descricao,
        data_movimento: mov.data_movimento?.split('T')[0] || periodo_inicio
      }));
    } catch (error) {
      console.error('Erro ao buscar movimentos:', error);
      return [];
    }
  },

  // Calcular resumo financeiro
  calcularResumoFinanceiro(
    operacoes: OperacaoFinanceira[],
    movimentos: MovimentoContaCorrente[]
  ): {
    valor_total_creditos: number;
    valor_total_debitos: number;
    valor_liquido: number;
    valor_servicos: number;
    valor_pedagio: number;
    valor_adicionais: number;
    valor_reembolsos: number;
    valor_descontos: number;
    valor_adiantamentos: number;
    valor_combustivel: number;
    valor_bonus: number;
  } {
    // Créditos das operações
    const valor_servicos = operacoes.reduce((sum, op) => sum + (op.valor_base || 0), 0);
    const valor_pedagio = operacoes.reduce((sum, op) => sum + (op.valor_pedagio || 0), 0);
    const valor_adicionais = operacoes.reduce((sum, op) => sum + (op.valor_adicionais || 0), 0);
    const valor_reembolsos = operacoes.reduce((sum, op) => sum + (op.valor_reembolso_outros || 0), 0);
    let valor_descontos = operacoes.reduce((sum, op) => sum + (op.valor_descontos || 0), 0);
    
    // Débitos dos movimentos
    let valor_adiantamentos = 0;
    let valor_combustivel = 0;
    let valor_bonus = 0;

    for (const mov of movimentos) {
      if (mov.tipo_movimento === 'adiantamento' || mov.tipo_movimento === 'vale') {
        valor_adiantamentos += mov.natureza === 'debito' ? mov.valor : 0;
      } else if (mov.tipo_movimento === 'combustivel') {
        valor_combustivel += mov.natureza === 'debito' ? mov.valor : 0;
      } else if (mov.tipo_movimento === 'convenio') {
        valor_descontos += mov.natureza === 'debito' ? mov.valor : 0;
      } else if (mov.tipo_movimento === 'bonus') {
        valor_bonus += mov.natureza === 'credito' ? mov.valor : 0;
      }
    }

    // Totais
    const valor_total_creditos = valor_servicos + valor_pedagio + valor_adicionais + valor_reembolsos + valor_bonus;
    const valor_total_debitos = valor_descontos + valor_adiantamentos + valor_combustivel;
    const valor_liquido = valor_total_creditos - valor_total_debitos;

    return {
      valor_total_creditos,
      valor_total_debitos,
      valor_liquido,
      valor_servicos,
      valor_pedagio,
      valor_adicionais,
      valor_reembolsos,
      valor_descontos,
      valor_adiantamentos,
      valor_combustivel,
      valor_bonus
    };
  },

  // Gerar número do extrato
  async gerarNumeroExtrato(): Promise<string> {
    // Chamar função SQL para gerar número
    const { data, error } = await supabase
      .rpc('gerar_numero_fechamento_prestador');

    if (error || !data) {
      // Fallback: gerar número localmente
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const sequencial = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      return `FP-${ano}${mes}-${sequencial}`;
    }

    return data;
  },

  // Salvar extrato no banco
  async salvarExtrato(extrato: ExtratoFechamentoPrestador): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('fechamentos_prestador')
        .upsert({
          prestador_id: extrato.prestador.id,
          periodo_inicio: extrato.periodo_inicio,
          periodo_fim: extrato.periodo_fim,
          data_geracao: extrato.data_geracao,
          numero: extrato.numero,
          status: extrato.status,
          status_pagamento: extrato.status_pagamento,
          status_aprovacao: extrato.status_aprovacao,
          valor_total_creditos: extrato.valor_total_creditos,
          valor_total_debitos: extrato.valor_total_debitos,
          valor_liquido: extrato.valor_liquido,
          valor_servicos: extrato.valor_servicos,
          valor_pedagio: extrato.valor_pedagio,
          valor_adicionais: extrato.valor_adicionais,
          valor_reembolsos: extrato.valor_reembolsos,
          valor_descontos: extrato.valor_descontos,
          valor_adiantamentos: extrato.valor_adiantamentos,
          valor_combustivel: extrato.valor_combustivel,
          valor_bonus: extrato.valor_bonus,
          observacoes: extrato.observacoes
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao salvar extrato:', error);
        return null;
      }

      // Salvar operações
      if (data.id && extrato.operacoes.length > 0) {
        await this.salvarOperacoesExtrato(data.id, extrato.operacoes);
      }

      // Salvar movimentos
      if (data.id && extrato.movimentos.length > 0) {
        await this.salvarMovimentosExtrato(data.id, extrato.movimentos);
      }

      return data.id;
    } catch (error) {
      console.error('Erro ao salvar extrato:', error);
      return null;
    }
  },

  // Salvar operações do extrato
  async salvarOperacoesExtrato(extratoId: string, operacoes: OperacaoFinanceira[]): Promise<void> {
    const operacoesParaSalvar = operacoes.map(op => ({
      fechamento_id: extratoId,
      operacao_id: op.id,
      tipo: op.tipo,
      data_operacao: op.data_operacao,
      ordem_servico_numero: op.ordem_servico_numero,
      origem: op.origem,
      destino: op.destino,
      km_total: op.km_total,
      cliente_nome: op.cliente_nome,
      valor_base: op.valor_base,
      valor_pedagio: op.valor_pedagio,
      valor_ajudante: op.valor_ajudante,
      valor_adicionais: op.valor_adicionais,
      valor_descontos: op.valor_descontos,
      valor_combustivel: op.valor_combustivel,
      valor_reembolso_outros: op.valor_reembolso_outros,
      descricao: op.descricao
    }));

    const { error } = await supabase
      .from('itens_fechamento_prestador')
      .upsert(operacoesParaSalvar);

    if (error) {
      console.error('Erro ao salvar operações:', error);
    }
  },

  // Salvar movimentos do extrato
  async salvarMovimentosExtrato(extratoId: string, movimentos: MovimentoContaCorrente[]): Promise<void> {
    const movimentosParaSalvar = movimentos.map(mov => ({
      fechamento_id: extratoId,
      movimento_id: mov.id,
      tipo_movimento: mov.tipo_movimento,
      natureza: mov.natureza,
      valor: mov.valor,
      descricao: mov.descricao,
      data_movimento: mov.data_movimento
    }));

    const { error } = await supabase
      .from('movimentos_conta_corrente_prestador_extrato')
      .upsert(movimentosParaSalvar);

    if (error) {
      console.error('Erro ao salvar movimentos:', error);
    }
  },

  // Buscar extrato por ID
  async buscarExtratoPorId(extratoId: string): Promise<ExtratoFechamentoPrestador | null> {
    try {
      const { data: extratoData, error: extratoError } = await supabase
        .from('fechamentos_prestador')
        .select(`
          *,
          prestador:prestadores(id, nome_completo, cpf_cnpj, telefone)
        `)
        .eq('id', extratoId)
        .single();

      if (extratoError || !extratoData) {
        return null;
      }

      // Buscar operações do extrato
      const { data: operacoesData } = await supabase
        .from('itens_fechamento_prestador')
        .select('*')
        .eq('fechamento_id', extratoId);

      // Buscar movimentos do extrato
      const { data: movimentosData } = await supabase
        .from('movimentos_conta_corrente_prestador_extrato')
        .select('*')
        .eq('fechamento_id', extratoId);

      // Montar extrato completo
      const extrato: ExtratoFechamentoPrestador = {
        id: extratoData.id,
        prestador: {
          id: extratoData.prestador.id,
          nome_completo: extratoData.prestador.nome_completo,
          cpf_cnpj: extratoData.prestador.cpf_cnpj,
          telefone: extratoData.prestador.telefone
        },
        periodo_inicio: extratoData.periodo_inicio,
        periodo_fim: extratoData.periodo_fim,
        data_geracao: extratoData.data_geracao,
        numero: extratoData.numero,
        status: extratoData.status,
        status_pagamento: extratoData.status_pagamento,
        status_aprovacao: extratoData.status_aprovacao,
        valor_total_creditos: extratoData.valor_total_creditos,
        valor_total_debitos: extratoData.valor_total_debitos,
        valor_liquido: extratoData.valor_liquido,
        valor_servicos: extratoData.valor_servicos,
        valor_pedagio: extratoData.valor_pedagio,
        valor_adicionais: extratoData.valor_adicionais,
        valor_reembolsos: extratoData.valor_reembolsos,
        valor_descontos: extratoData.valor_descontos,
        valor_adiantamentos: extratoData.valor_adiantamentos,
        valor_combustivel: extratoData.valor_combustivel,
        valor_bonus: extratoData.valor_bonus,
        operacoes: operacoesData || [],
        movimentos: movimentosData || [],
        observacoes: extratoData.observacoes,
        data_pagamento: extratoData.data_pagamento,
        valor_pago: extratoData.valor_pago,
        created_at: extratoData.created_at,
        updated_at: extratoData.updated_at
      };

      return extrato;
    } catch (error) {
      console.error('Erro ao buscar extrato:', error);
      return null;
    }
  },

  // Listar extratos com filtros
  async listarExtratos(filtros: FiltrosExtrato = {}): Promise<ExtratoFechamentoPrestador[]> {
    try {
      let query = supabase
        .from('fechamentos_prestador')
        .select(`
          *,
          prestador:prestadores(id, nome_completo, cpf_cnpj, telefone, veiculos(tipo, placa))
        `);

      // Aplicar filtros
      if (filtros.prestador_id) {
        query = query.eq('prestador_id', filtros.prestador_id);
      }

      if (filtros.periodo_inicio) {
        query = query.gte('periodo_inicio', filtros.periodo_inicio);
      }

      if (filtros.periodo_fim) {
        query = query.lte('periodo_fim', filtros.periodo_fim);
      }

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros.status_pagamento) {
        query = query.eq('status_pagamento', filtros.status_pagamento);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao listar extratos:', error);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map(item => {
        const veiculos = (item.prestador.veiculos as any[]) || [];
        const veiculoPrincipal = veiculos[0];

        return {
          id: item.id,
          prestador: {
            id: item.prestador.id,
            nome_completo: item.prestador.nome_completo,
            cpf_cnpj: item.prestador.cpf_cnpj,
            telefone: item.prestador.telefone,
            veiculo_tipo: veiculoPrincipal?.tipo,
            veiculo_placa: veiculoPrincipal?.placa
          },
          periodo_inicio: item.periodo_inicio,
          periodo_fim: item.periodo_fim,
          data_geracao: item.data_geracao,
          numero: item.numero,
          status: item.status,
          status_pagamento: item.status_pagamento,
          status_aprovacao: item.status_aprovacao,
          valor_total_creditos: item.valor_total_creditos,
          valor_total_debitos: item.valor_total_debitos,
          valor_liquido: item.valor_liquido,
          valor_servicos: item.valor_servicos,
          valor_pedagio: item.valor_pedagio,
          valor_adicionais: item.valor_adicionais,
          valor_reembolsos: item.valor_reembolsos,
          valor_descontos: item.valor_descontos,
          valor_adiantamentos: item.valor_adiantamentos,
          valor_combustivel: item.valor_combustivel,
          valor_bonus: item.valor_bonus,
          operacoes: [],
          movimentos: [],
          observacoes: item.observacoes,
          data_pagamento: item.data_pagamento,
          valor_pago: item.valor_pago,
          created_at: item.created_at,
          updated_at: item.updated_at
        };
      });
    } catch (error) {
      console.error('Erro ao listar extratos:', error);
      return [];
    }
  },

  // Atualizar status do extrato
  async atualizarStatus(extratoId: string, updates: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('fechamentos_prestador')
        .update(updates)
        .eq('id', extratoId);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      return false;
    }
  },

  // Excluir extrato
  async excluirExtrato(extratoId: string): Promise<boolean> {
    try {
      // Primeiro excluir operações e movimentos vinculados
      const { error: operacoesError } = await supabase
        .from('itens_fechamento_prestador')
        .delete()
        .eq('fechamento_id', extratoId);

      if (operacoesError) {
        console.error('Erro ao excluir operações:', operacoesError);
      }

      const { error: movimentosError } = await supabase
        .from('movimentos_conta_corrente_prestador_extrato')
        .delete()
        .eq('fechamento_id', extratoId);

      if (movimentosError) {
        console.error('Erro ao excluir movimentos:', movimentosError);
      }

      // Depois excluir o extrato principal
      const { error } = await supabase
        .from('fechamentos_prestador')
        .delete()
        .eq('id', extratoId);

      if (error) {
        console.error('Erro ao excluir extrato:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao excluir extrato:', error);
      return false;
    }
  }
};

export default ExtratoPrestadorService;

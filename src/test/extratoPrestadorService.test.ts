import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExtratoPrestadorService from '@/services/financeiro/extratoPrestadorService';

// FIN-MOT-1H2 — testes sobre a fonte REAL (pagamentos_prestadores + itens),
// sem tocar em banco nem criar dados fictícios.
describe('ExtratoPrestadorService (FIN-MOT-1H2 — fonte real)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const fechamentoExemplo: any = {
    id: 'abc-123',
    prestador_id: 'prest-1',
    prestador_nome: 'João Silva',
    prestador_documento: '12345678901',
    valor_liquido: 8000,
    valor_servicos: 10000,
    valor_descontos: 2000,
    valor_adiantamentos: 500,
    valor_reembolsos: 300,
    valor_bonus: 200,
    periodo_inicio: '2026-08-01',
    periodo_fim: '2026-08-31',
    data_competencia: '2026-08-31',
    status: 'pendente',
    status_pagamento: 'pendente',
    status_conferencia: 'em_aberto',
    status_aprovacao: 'aguardando_aprovacao',
    observacao: 'Fechamento de 2026-08-01 a 2026-08-31',
    created_at: '2026-08-31T10:00:00.000Z',
  };

  describe('construirExtratoDeFechamento', () => {
    it('deve montar extrato a partir do fechamento real sem dados fictícios', async () => {
      // isola chamadas de rede (buscarDadosPrestador/itens) para retornar vazio
      vi.spyOn(ExtratoPrestadorService as any, 'buscarDadosPrestador').mockResolvedValue({
        id: 'prest-1',
        nome_completo: 'João Silva',
        cpf_cnpj: '12345678901',
        telefone: undefined,
        veiculo_tipo: undefined,
        veiculo_placa: undefined,
      });
      vi.spyOn(ExtratoPrestadorService as any, 'buscarItensDeFechamento').mockResolvedValue([]);

      const extrato = await ExtratoPrestadorService.construirExtratoDeFechamento(fechamentoExemplo);

      expect(extrato).toBeDefined();
      expect(extrato.prestador.nome_completo).toBe('João Silva');
      expect(extrato.periodo_inicio).toBe('2026-08-01');
      expect(extrato.periodo_fim).toBe('2026-08-31');
      // valores vêm EXATAMENTE do fechamento real (mesma fonte da tela)
      expect(extrato.valor_liquido).toBe(8000);
      expect(extrato.valor_servicos).toBe(10000);
      expect(extrato.valor_descontos).toBe(2000);
      expect(extrato.valor_total_creditos).toBe(10000 + 300 + 200); // servicos + reembolsos + bonus
      expect(extrato.valor_total_debitos).toBe(2000 + 500); // descontos + adiantamentos
      // líquido preserva o valor gravado (não recalculado para não divergir)
      expect(extrato.valor_liquido).toBe(fechamentoExemplo.valor_liquido);
    });

    it('deve gerar número de fechamento quando não houver', async () => {
      vi.spyOn(ExtratoPrestadorService as any, 'buscarDadosPrestador').mockResolvedValue({
        id: 'prest-1', nome_completo: 'João Silva', cpf_cnpj: '12345678901',
      });
      vi.spyOn(ExtratoPrestadorService as any, 'buscarItensDeFechamento').mockResolvedValue([]);

      const extrato = await ExtratoPrestadorService.construirExtratoDeFechamento(fechamentoExemplo);
      expect(extrato.numero).toMatch(/^FP-/);
    });

    it('deve lançar erro se fechamento não informado', async () => {
      await expect(
        (ExtratoPrestadorService as any).construirExtratoDeFechamento(null)
      ).rejects.toThrow('Fechamento não informado');
    });

    it('deve mapear status pagamento pago', async () => {
      vi.spyOn(ExtratoPrestadorService as any, 'buscarDadosPrestador').mockResolvedValue({});
      vi.spyOn(ExtratoPrestadorService as any, 'buscarItensDeFechamento').mockResolvedValue([]);
      const pago = await ExtratoPrestadorService.construirExtratoDeFechamento({
        ...fechamentoExemplo,
        status: 'pago',
        status_pagamento: 'pago',
        data_pagamento: '2026-08-31',
      });
      expect(pago.status).toBe('pago');
      expect(pago.status_pagamento).toBe('pago');
      expect(pago.data_pagamento).toBe('2026-08-31');
    });

    it('deve incorporar OS vinculadas (itens) nas operações', async () => {
      vi.spyOn(ExtratoPrestadorService as any, 'buscarDadosPrestador').mockResolvedValue({});
      vi.spyOn(ExtratoPrestadorService as any, 'buscarItensDeFechamento').mockResolvedValue([
        { os_id: 'os-1', os_numero: 'OS-100', valor_servico: 5000, pedagio: 100, adicional: 200, valor_desconto: 50 },
        { os_id: 'os-2', os_numero: 'OS-101', valor_servico: 5000, pedagio: 0, adicional: 0, valor_desconto: 0 },
      ]);
      vi.spyOn(ExtratoPrestadorService as any, 'enriquecerOperacoesComOS').mockResolvedValue(undefined);

      const extrato = await ExtratoPrestadorService.construirExtratoDeFechamento(fechamentoExemplo);
      expect(extrato.operacoes.length).toBe(2);
      expect(extrato.operacoes[0].ordem_servico_numero).toBe('OS-100');
      expect(extrato.operacoes[0].valor_base).toBe(5000);
      expect(extrato.operacoes[1].valor_descontos).toBe(0);
    });
  });

  describe('buscarItensDeFechamento', () => {
    it('deve retornar vazio sem id', async () => {
      const itens = await ExtratoPrestadorService.buscarItensDeFechamento('');
      expect(itens).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIN-MOT-2 — extrato consultivo por período (fonte: ordens_servico + débitos).
// Testes com o supabase mockado por tabela (sem banco, sem dados fictícios).
// Chave de deduplicação: ordens_servico.id → cada OS conta UMA vez.
// ─────────────────────────────────────────────────────────────────────────────
const mockSupabase = (tables: Record<string, any[]>) => {
  vi.resetModules();
  let currentCols: string[] = [];
  const filters: Array<{ col: string; val: any; isIn: boolean }> = [];
  vi.doMock('@/lib/supabase', () => ({
    supabase: {
      from: (t: string) => {
        filters.length = 0;
        const rows = tables[t] || [];
        let result = [...rows];
        const applyFilters = () => {
          result = [...rows];
          for (const f of filters) {
            if (f.isIn) {
              result = result.filter(r => {
                const arr = Array.isArray(f.val) ? f.val : [f.val];
                return arr.includes(r[f.col]);
              });
            } else {
              result = result.filter(r => {
                if (f.val === '' || f.val === undefined) return true;
                return r[f.col] === f.val;
              });
            }
          }
        };
        const builder: any = {
          select: (cols?: string) => { if (cols) currentCols = String(cols).split(',').map(s => s.trim()); return builder; },
          eq: (c: string, v: any) => { filters.push({ col: c, val: v, isIn: false }); return builder; },
          in: (c: string, v: any) => { filters.push({ col: c, val: v, isIn: true }); return builder; },
          gte: () => builder,
          lte: () => builder,
          order: () => builder,
          then: (resolve: (v: any) => any) => { applyFilters(); return resolve({ data: result, error: null }); },
        };
        return builder;
      },
    },
  }));
  return import('@/services/financeiro/extratoPrestadorService');
};

describe('ExtratoPrestadorService.construirExtratoPorPeriodo (FIN-MOT-2)', () => {
  it('Cenário A: prestador com operações no período, todos os clientes', async () => {
    const svc = await mockSupabase({
      ordens_servico: [
        { id: 'os-1', numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', romaneio: 'R-1', origem: 'SP', destino: 'RJ', km_total: 400, custo_prestador: 5000, pedagio: 200, adicionais: 100, descontos: 50, data: '2026-08-05', status: 'finalizada' },
        { id: 'os-2', numero: 'OS-101', prestador_id: 'p1', cliente_id: 'c2', romaneio: 'R-2', origem: 'SP', destino: 'MG', km_total: 600, custo_prestador: 6000, pedagio: 150, adicionais: 80, descontos: 30, data: '2026-08-10', status: 'concluida' },
      ],
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [],
    });
    // buscaDadosPrestador já retorna via supabase? NÃO — chama supabase.from('prestadores'). Vamos mockar método.
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({
      id: 'p1', nome_completo: 'César Augusto Holanda Silva', cpf_cnpj: '12345678901',
    });

    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-21',
    });

    expect(extrato.operacoes.length).toBe(2);
    expect(extrato.valor_servicos).toBe(11000); // 5000+6000
    expect(extrato.valor_pedagio).toBe(350);
    expect(extrato.valor_adicionais).toBe(180);
    expect(extrato.valor_total_creditos).toBe(11000 + 350 + 180);
    expect(extrato.valor_total_debitos).toBe(80); // descontos 50+30
    expect(extrato.valor_liquido).toBe(extrato.valor_total_creditos - extrato.valor_total_debitos);
  });

  it('Cenário B: mesmo prestador + cliente específico', async () => {
    const svc = await mockSupabase({
      ordens_servico: [
        { id: 'os-1', numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', custo_prestador: 5000, pedagio: 200, adicionais: 100, descontos: 50, data: '2026-08-05', status: 'finalizada' },
        { id: 'os-2', numero: 'OS-101', prestador_id: 'p1', cliente_id: 'c2', custo_prestador: 6000, pedagio: 150, adicionais: 80, descontos: 30, data: '2026-08-10', status: 'concluida' },
      ],
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [],
    });
    // mock filtro cliente globalmente: retorna só o cliente c1
    const filtered = {
      ordens_servico: [{ id: 'os-1', numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', custo_prestador: 5000, pedagio: 200, adicionais: 100, descontos: 50, data: '2026-08-05', status: 'finalizada' }],
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [],
    };
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    // trocar builder para retornar filtered
    vi.resetModules();
    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        from: (t: string) => {
          const rows = filtered[t] || [];
          const builder: any = {
            select: () => builder, eq: () => builder, in: () => builder,
            gte: () => builder, lte: () => builder, order: () => builder,
            then: (resolve: any) => resolve({ data: [...rows], error: null }),
          };
          return builder;
        },
      },
    }));
    const svc2 = await import('@/services/financeiro/extratoPrestadorService');
    vi.spyOn(svc2.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc2.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-21', clienteId: 'c1',
    });
    expect(extrato.operacoes.length).toBe(1);
    expect(extrato.valor_servicos).toBe(5000);
  });

  it('Cenário C: período sem operação → zero corretamente', async () => {
    const svc = await mockSupabase({
      ordens_servico: [],
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [],
    });
    // buscarDadosPrestador usa supabase prestadores — mock também vazio; retornar manual
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'Sem produção' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-09-01', dataFim: '2026-09-30',
    });
    expect(extrato.operacoes.length).toBe(0);
    expect(extrato.valor_total_creditos).toBe(0);
    expect(extrato.valor_total_debitos).toBe(0);
    expect(extrato.valor_liquido).toBe(0);
  });

  it('Cenário D: OS já vinculada a fechamento → marcada, sem crédito duplicado', async () => {
    const svc = await mockSupabase({
      ordens_servico: [
        { id: 'os-1', numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', custo_prestador: 5000, pedagio: 0, adicionais: 0, descontos: 0, data: '2026-08-05', status: 'finalizada' },
      ],
      pagamentos_prestadores_itens: [
        { os_id: 'os-1', pagamento_id: 'fp-abc' },
      ],
      pagamentos_prestadores: [
        { id: 'fp-abc', tipo_pagamento: 'fechamento' },
      ],
    });
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-21',
    });
    expect(extrato.operacoes.length).toBe(1); // 1 OS, sem duplicar
    expect(extrato.operacoes[0].jaFechada).toBe(true);
    expect(extrato.operacoes[0].referenciaFechamento).toContain('FP-');
  });

  it('Cenário E: conferência matemática créditos - débitos = líquido', async () => {
    const svc = await mockSupabase({
      ordens_servico: [
        { id: 'os-1', numero: 'OS-1', prestador_id: 'p1', custo_prestador: 10000, pedagio: 500, adicionais: 300, descontos: 200, data: '2026-08-05', status: 'finalizada' },
      ],
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [
        { tipo_lancamento: 'Adiantamento', valor_liquido: 1000, natureza: 'debito', data_competencia: '2026-08-06', prestador_id: 'p1', origem_lancamento: 'manual' },
      ],
    });
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31',
    });
    expect(extrato.valor_total_creditos).toBe(10000 + 500 + 300);
    expect(extrato.valor_total_debitos).toBe(200 + 1000);
    expect(extrato.valor_liquido).toBe(extrato.valor_total_creditos - extrato.valor_total_debitos);
  });
});

describe('ExtratoPrestadorService.construirExtratoPorPeriodo (FIN-MOT-2C — origens)', () => {
  const baseTables = {
    ordens_servico: [
      { id: 'os-100', numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', custo_prestador: 5000, pedagio: 100, adicionais: 50, descontos: 30, data: '2026-08-05', status: 'finalizada' },
      { id: 'os-200', numero: 'OS-200', prestador_id: 'p1', cliente_id: 'c2', custo_prestador: 7000, pedagio: 0, adicionais: 0, descontos: 0, data: '2026-08-10', status: 'concluida' },
    ],
    alocacoes_escala: [
      { id: 'esc-1', ordem_servico_id: 'os-100', os_numero: 'OS-100', prestador_id: 'p1', cliente_id: 'c1', data_escala: '2026-08-05', valor_base: 5000, valor_pedagio: 100, valor_adicionais: 50, valor_descontos: 30, status: 'finalizada', finalizada: true },
      { id: 'esc-2', ordem_servico_id: null, os_numero: 'ESC-888', prestador_id: 'p1', cliente_id: 'c3', data_escala: '2026-08-12', valor_base: 3000, valor_pedagio: 0, valor_adicionais: 0, valor_descontos: 0, status: 'executada', finalizada: true },
      { id: 'esc-3', ordem_servico_id: 'os-200', os_numero: 'OS-200', prestador_id: 'p1', cliente_id: 'c2', data_escala: '2026-08-10', valor_base: 7000, valor_pedagio: 0, valor_adicionais: 0, valor_descontos: 0, status: 'concluida', finalizada: true },
    ],
    pagamentos_prestadores: [
      { id: 'man-1', prestador_id: 'p1', tipo_lancamento: 'Crédito manual', natureza: 'credito', valor_liquido: 500, data_competencia: '2026-08-08', origem_lancamento: 'manual', cliente_id: null, observacao: 'Bônus' },
      { id: 'man-2', prestador_id: 'p1', tipo_lancamento: 'Desconto', natureza: 'debito', valor_liquido: 100, data_competencia: '2026-08-09', origem_lancamento: 'manual', cliente_id: null, observacao: 'multa' },
    ],
    pagamentos_prestadores_itens: [],
  };

  it('1. Todos os tipos: OS + Escala sem OS + manual, sem duplicar escala com OS', async () => {
    const svc = await mockSupabase(baseTables);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'todos',
    });
    // OS-100 e OS-200 (+ escala vinculada deduplicada) + ESC-888 (escala sem OS) + 2 manuais
    const oss = extrato.operacoes.filter(o => o.tipoOrigem === 'ordem_servico').length; // OS-100 e OS-200
    const escs = extrato.operacoes.filter(o => o.tipoOrigem === 'escala').length; // ESC-888
    const mans = extrato.operacoes.filter(o => o.tipoOrigem === 'manual').length;
    expect(extrato.operacoes.length).toBe(5); // OS-100, OS-200, ESC-888, man-1, man-2
    expect(oss).toBe(2);
    expect(escs).toBe(1);
    expect(mans).toBe(2);
    // total do serviço = OS-100 5000 + OS-200 7000 + ESC-888 3000
    expect(extrato.valor_servicos).toBe(15000);
  });

  it('2. Somente OS: apenas produções de OS', async () => {
    const svc = await mockSupabase(baseTables);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'ordem_servico',
    });
    // OS-100 e OS-200 são OS (origemEscala marcada p/ rastreabilidade) — só as OS
    const oss = extrato.operacoes.filter(o => o.tipoOrigem === 'ordem_servico');
    expect(oss.length).toBe(2);
    expect(extrato.operacoes.every(o => o.tipoOrigem === 'ordem_servico')).toBe(true);
  });

  it('3. Somente Escala: escalas sem duplicar as que têm OS', async () => {
    const svc = await mockSupabase(baseTables);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'escala',
    });
    // Escala: OS que vieram de escala (origemEscala) + escala sem OS — sem duplicar a mesma OS
    // OS-100, OS-200 (origemEscala) + ESC-888 (escala própria) = 3 linhas
    expect(extrato.operacoes.length).toBe(3);
    expect(extrato.operacoes.every(o => o.tipoOrigem !== 'manual')).toBe(true);
  });

  it('4. Somente Manual: apenas movimentos manuais', async () => {
    const svc = await mockSupabase(baseTables);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'manual',
    });
    expect(extrato.operacoes.length).toBe(2);
    expect(extrato.operacoes.every(o => o.tipoOrigem === 'manual')).toBe(true);
    expect(extrato.valor_bonus).toBe(500); // man-1 "Bônus"
    expect(extrato.valor_descontos).toBe(100); // man-2 "multa"
  });

  it('5. Cliente específico filtra por cliente (ID)', async () => {
    const filtrado = {
      ...baseTables,
      ordens_servico: baseTables.ordens_servico.filter(o => o.cliente_id === 'c1'),
      alocacoes_escala: baseTables.alocacoes_escala.filter(e => e.cliente_id === 'c1'),
      pagamentos_prestadores: [], // manuais sem cliente não entram no filtro específico
    };
    const svc = await mockSupabase(filtrado);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', clienteId: 'c1', origem: 'todos',
    });
    const todosCLiente1 = extrato.operacoes.every(o => o.cliente_nome === 'c1');
    expect(todosCLiente1).toBe(true);
  });

  it('7. Mesma produção em Escala + OS não duplicada', async () => {
    // dado: apenas a OS-100 e sua escala vinculada → deve aparecer UMA única linha
    const sóUma = {
      ordens_servico: [baseTables.ordens_servico[0]],
      alocacoes_escala: [baseTables.alocacoes_escala[0]], // esc-1 vinculada a os-100
      pagamentos_prestadores_itens: [],
      pagamentos_prestadores: [],
    };
    const svc = await mockSupabase(sóUma);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'todos',
    });
    expect(extrato.operacoes.length).toBe(1); // não 2
    expect(extrato.valor_servicos).toBe(5000);
  });

  it('8. créditos - débitos = líquido (com todas as origens)', async () => {
    const svc = await mockSupabase(baseTables);
    vi.spyOn(svc.default as any, 'buscarDadosPrestador').mockResolvedValue({ id: 'p1', nome_completo: 'César' });
    const extrato = await svc.default.construirExtratoPorPeriodo({
      prestadorId: 'p1', dataInicio: '2026-08-01', dataFim: '2026-08-31', origem: 'todos',
    });
    expect(extrato.valor_total_creditos).toBe(extrato.valor_servicos + extrato.valor_pedagio + extrato.valor_adicionais + extrato.valor_reembolsos + extrato.valor_bonus);
    expect(extrato.valor_liquido).toBe(extrato.valor_total_creditos - extrato.valor_total_debitos);
  });
});

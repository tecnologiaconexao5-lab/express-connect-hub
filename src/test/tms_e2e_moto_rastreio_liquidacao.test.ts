// ═══════════════════════════════════════════════════════════════════════════════
// TESTE-FLUXO-OPERACIONAL-MOTO-E-RASTREIO — validação ponta a ponta (determinística)
//
//  1. CRIAÇÃO DE OS (MOTO): tipo estritamente "MOTO" + peso compatível;
//     visível só para prestadores com MOTO (invisível p/ Fiorino/Van).
//  2. RASTREIO + TORRE DE CONTROLE: aceite no app → GPS/status na Torre.
//  3. LIQUIDAÇÃO: conclusão entra na "Fila de Liquidação" (topo) → "Liberar
//     Pagamento" → sai da fila para o extrato consolidado.
//
// Nenhuma chamada de rede real: usa as funções/handlers de produção com
// client/RPC mockados + contratos SQL lidos das migrations.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { TIPOS_VEICULO, VEICULO_PARAMETROS, sugerirVeiculo } from "@/constants/tiposVeiculo";
import {
  normalizarTipoVeiculo,
  veiculoCompativel,
  prestadorCompativelComVeiculo,
  tiposVeiculoDoPrestador,
} from "@/services/operacao/redeVeiculoFiltro";
import {
  tipoVeiculoCompativel,
  capacidadeVeiculoCompativel,
} from "@/services/escala/eligibilidadeOperacionalService";
import {
  computeGpsState,
  computeOperationalStatus,
  computeSlaState,
  isValidCoordinate,
  montarMarcadorGPS,
  montarMapaAlocacoesPorOS,
  resolverPosicaoMarcador,
} from "@/components/torre-controle/markerAdapter";
import { APP_EVENT_TYPES, APP_EVENT_LABELS, isAppEventType } from "@/components/torre-controle/eventAdapter";
import {
  calcularFilaValores,
  isItemFilaLiquidacao,
  filtrarFilaLiquidacao,
  resumoFilaLiquidacao,
} from "@/helpers/filaLiquidacaoHelper";
import { liberarPagamentoPrestador } from "@/services/financeiro/pagamentoPrestadorService";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";
const TORRE = "src/pages/TorreControle.tsx";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const osMoto = {
  id: "os-moto-1",
  numero: "OS-MOTO-1001",
  veiculo_tipo: "moto",
  peso: 30, // kg — compatível com moto (pesoMax 40)
  cubagem: 0.05,
};

const prestadorMoto = { id: "p-moto", veiculo_tipo: "moto" };
const prestadorFiorino = { id: "p-fiorino", veiculo_tipo: "fiorino" };
const prestadorVan = { id: "p-van", veiculo_tipo: "van" };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CRIAÇÃO DE OS (MOTO) + DISPONIBILIDADE NA REDE DE OPORTUNIDADES
// ═══════════════════════════════════════════════════════════════════════════════
describe("1. OS (MOTO) — tipo estrito e peso compatível", () => {
  it("'moto' é um tipo canônico com pesoMax 40kg e cubagem 0.2m³", () => {
    expect(TIPOS_VEICULO.some((t) => t.value === "moto")).toBe(true);
    expect(VEICULO_PARAMETROS.moto.pesoMax).toBe(40);
    expect(VEICULO_PARAMETROS.moto.cubagemMax).toBe(0.2);
  });

  it("sugestão de veículo respeita o peso (30kg→moto, 500kg→fiorino+)", () => {
    expect(sugerirVeiculo(30, 0.05)).toBe("moto");
    expect(sugerirVeiculo(500, 1)).not.toBe("moto");
    expect(sugerirVeiculo(500, 1)).toBe("fiorino");
  });

  it("peso acima da capacidade do veículo é rejeitado (peso compatível)", () => {
    // 50kg > 40kg da moto → inelegível; sem dados → fail-open (não bloqueia)
    const pesado = capacidadeVeiculoCompativel(50, 40, 0.03, 0.2);
    expect(pesado.elegivel).toBe(false);
    expect(pesado.motivo).toBe("capacidade_peso_insuficiente");

    const ok = capacidadeVeiculoCompativel(30, 40, 0.05, 0.2);
    expect(ok.elegivel).toBe(true);

    expect(capacidadeVeiculoCompativel(30, null, null, null).elegivel).toBe(true); // fail-open
  });

  it("gate da Escala: exige tipo EXATO (moto×moto ok; moto×fiorino/van bloqueia)", () => {
    expect(tipoVeiculoCompativel("moto", "moto").elegivel).toBe(true);
    expect(tipoVeiculoCompativel("Moto", "MOTO").elegivel).toBe(true); // case-insensitive
    expect(tipoVeiculoCompativel("moto", "fiorino").elegivel).toBe(false);
    expect(tipoVeiculoCompativel("moto", "van").elegivel).toBe(false);
    expect(tipoVeiculoCompativel("moto", null).elegivel).toBe(false); // sem veículo informado
    expect(tipoVeiculoCompativel(null, "moto").elegivel).toBe(true); // OS sem exigência
  });
});

describe("1b. Rede de Oportunidades — visível só para MOTO", () => {
  it("normalização resolve sinônimos de moto", () => {
    expect(normalizarTipoVeiculo("Motocicleta")).toBe("moto");
    expect(normalizarTipoVeiculo("MOTOBOY")).toBe("moto");
    expect(normalizarTipoVeiculo("moto")).toBe("moto");
  });

  it("prestador MOTO vê a OS; Fiorino e Van NÃO veem", () => {
    expect(prestadorCompativelComVeiculo(osMoto.veiculo_tipo, prestadorMoto)).toBe(true);
    expect(prestadorCompativelComVeiculo(osMoto.veiculo_tipo, prestadorFiorino)).toBe(false);
    expect(prestadorCompativelComVeiculo(osMoto.veiculo_tipo, prestadorVan)).toBe(false);
  });

  it("prestador sem veículo declarado não recebe a OS", () => {
    expect(prestadorCompativelComVeiculo("moto", { veiculo_tipo: null })).toBe(false);
    expect(prestadorCompativelComVeiculo("moto", {})).toBe(false);
  });

  it("frota mista: basta ter moto na coleção para ser compatível", () => {
    const frota = { veiculos: [{ tipo_veiculo: "van" }, { tipo_veiculo: "moto" }] };
    expect(tiposVeiculoDoPrestador(frota)).toEqual(["van", "moto"]);
    expect(prestadorCompativelComVeiculo("moto", frota)).toBe(true);
  });

  it("contrato SQL do feed do prestador filtra por veículo (exato, case-insensitive)", () => {
    const mig = read("supabase/migrations/20260815000000_a27_rpc_oportunidades_para_prestador.sql");
    expect(mig).toContain("f_buscar_oportunidades_para_prestador");
    expect(mig).toContain("veiculo_necessario->>'tipo'");
    expect(mig).toMatch(/LOWER\(vt\)\s*=\s*LOWER\(\(ro\.veiculo_necessario->>'tipo'\)\)/);
    expect(mig).toContain("v_max_capacidade");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RASTREIO E TORRE DE CONTROLE
// ═══════════════════════════════════════════════════════════════════════════════
function posicao(minAtras: number, overrides: Record<string, unknown> = {}): any {
  const ts = new Date(Date.now() - minAtras * 60000).toISOString();
  return { alocacao_id: "aloc-moto-1", os_id: "os-moto-1", latitude: -23.55, longitude: -46.63, captured_at: ts, created_at: ts, ...overrides };
}

describe("2. Torre de Controle — status e GPS claros para o operador", () => {
  it("estado do GPS por recência (atualizado/antigo/muito_antigo/indisponível)", () => {
    expect(computeGpsState(posicao(2), "em_rota")).toBe("atualizado");
    expect(computeGpsState(posicao(30), "em_rota")).toBe("antigo");
    expect(computeGpsState(posicao(120), "em_rota")).toBe("muito_antigo");
    expect(computeGpsState(null, "em_rota")).toBe("indisponivel");
    expect(computeGpsState(null, "aceita")).toBe("sem_rastreamento");
  });

  it("status operacional da rota traduz alocação + etapa do app", () => {
    expect(computeOperationalStatus("em_rota", "rota_iniciada", false)).toBe("em_deslocamento");
    expect(computeOperationalStatus("aceita", null, false)).toBe("aguardando_aceite");
    expect(computeOperationalStatus("em_rota", "chegou_entrega", false)).toBe("em_entrega");
    expect(computeOperationalStatus("em_rota", "carregamento", false)).toBe("em_coleta");
    expect(computeOperationalStatus("em_rota", null, true)).toBe("com_ocorrencia");
    expect(computeOperationalStatus("concluida", "servico_finalizado", false)).toBe("finalizado");
  });

  it("SLA da rota (no prazo / em risco / atrasado / concluído / sem previsão)", () => {
    const futuro = new Date(Date.now() + 5 * 3600000).toISOString();
    const risco = new Date(Date.now() + 30 * 60000).toISOString();
    const passado = new Date(Date.now() - 60000).toISOString();
    expect(computeSlaState(futuro, "em_rota")).toBe("no_prazo");
    expect(computeSlaState(risco, "em_rota")).toBe("em_risco");
    expect(computeSlaState(passado, "em_rota")).toBe("atrasado");
    expect(computeSlaState(futuro, "finalizada")).toBe("concluido");
    expect(computeSlaState(null, "em_rota")).toBe("sem_previsao");
  });

  it("marcador prioriza GPS real sobre coordenada estática da OS", () => {
    expect(isValidCoordinate(-23.55, -46.63)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate(null, -46)).toBe(false);

    const comGps = montarMarcadorGPS({ lat: -1, lng: -1 }, posicao(2), "em_rota");
    expect(comGps?.usandoGPS).toBe(true);
    expect(comGps?.lat).toBeCloseTo(-23.55, 2);
    expect(comGps?.gpsState).toBe("atualizado");

    const semGps = montarMarcadorGPS({ lat: -10, lng: -20 }, null, "aceita");
    expect(semGps?.usandoGPS).toBe(false);
    expect(semGps?.lat).toBe(-10);

    expect(montarMarcadorGPS(null, null, "aceita")).toBeNull();
  });

  it("resolve a posição da OS por alocacao_id/os_id (tracking nasce pela alocação)", () => {
    const pos = posicao(2);
    const mapa = montarMapaAlocacoesPorOS([pos]);
    expect(mapa.get("os-moto-1")?.has("aloc-moto-1")).toBe(true);
    expect(resolverPosicaoMarcador("aloc-moto-1", [pos])?.alocacao_id).toBe("aloc-moto-1");
    expect(resolverPosicaoMarcador("os-moto-1", [pos])?.os_id).toBe("os-moto-1");
  });

  it("aceite e finalização no app aparecem na timeline (event types)", () => {
    expect(APP_EVENT_TYPES).toContain("operation_accepted");
    expect(APP_EVENT_TYPES).toContain("operation_finished");
    expect(isAppEventType("operation_finished")).toBe(true);
    expect(APP_EVENT_LABELS.operation_accepted).toBe("Viagem aceita");
    expect(APP_EVENT_LABELS.operation_finished).toBe("Serviço finalizado");
  });

  it("contratos SQL: tracking realtime + evento de finalização do app", () => {
    const m106 = read("supabase/migrations/20260709000001_m106_tracking_real_go_live.sql");
    expect(m106).toContain("registrar_posicao_motorista");
    expect(m106).toContain("portal_tracking_realtime");
    expect(m106).toContain("eventos_oficiais");

    const a01 = read("supabase/migrations/20260928000000_a01_fix_rpc_app_motorista_volatile.sql");
    expect(a01).toContain("f_avancar_etapa_app_motorista");
    expect(a01).toContain("servico_finalizado");
    expect(a01).toMatch(/finalizada\s*=\s*CASE WHEN p_etapa = 'servico_finalizado'/);
  });

  it("Torre lê dados reais (sem mock) e tem mapa/rastreio", () => {
    const torre = read(TORRE);
    expect(torre).toContain("portal_tracking_realtime");
    expect(torre).toContain("torre-realtime-tracking");
    expect(torre).toContain("MapboxMap");
    expect(torre).not.toMatch(/Math\.random\(\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LIQUIDAÇÃO — entra na Fila, libera, sai para o extrato
// ═══════════════════════════════════════════════════════════════════════════════
describe("3. Fila de Liquidação — entrada, liberação e saída", () => {
  const osConcluida = {
    id: "pp-moto-1",
    prestador_id: "p-moto",
    prestador_nome: "MOTOBOY TESTE",
    os_numero: "OS-MOTO-1001",
    origem_lancamento: "os_direta",
    valor_servicos: 80,
    pedagio: 10,
    adicionais: 5,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: 5,
    valor_adiantamentos: 0,
    valor_liquido: 90,
    status: "pendente",
    status_conferencia: "em_aberto",
    status_aprovacao: "aguardando_aprovacao",
    status_pagamento: "pendente",
    is_teste: false,
  };

  it("a OS finalizada entra na fila e o valor é somado corretamente", () => {
    expect(isItemFilaLiquidacao(osConcluida)).toBe(true);
    const v = calcularFilaValores(osConcluida);
    expect(v.bruto).toBe(95); // 80 + 10 + 5
    expect(v.descontos).toBe(5);
    expect(v.liquido).toBe(90);
    expect(resumoFilaLiquidacao([osConcluida]).qtd).toBe(1);
  });

  it("fila ordena por período/created desc (novo topo) e exclui manuais/fechamento", () => {
    const comp = read(COMP);
    expect(comp).toContain('order("periodo_inicio", { ascending: false })');
    // Origens da fila = OS direta / Programação Operacional
    const fila = filtrarFilaLiquidacao([
      { ...osConcluida, id: "a", origem_lancamento: "manual" },
      { ...osConcluida, id: "b", origem_lancamento: "fechamento" },
      { ...osConcluida, id: "c", origem_lancamento: "escala_direta" },
      { ...osConcluida, id: "d" },
    ]);
    expect(fila.map((x) => x.id)).toEqual(["c", "d"]);
  });

  it("'Liberar Pagamento' aprova+baixa (RPCs oficiais) e a OS sai da fila", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const row = { ...osConcluida };
    const client = {
      from: (_t: string) => ({
        select: (_c: string) => ({
          eq: (_a: string, _b: any) => ({ single: async () => ({ data: row, error: null }) }),
        }),
      }),
      rpc: (fn: string, args: any) => {
        calls.push({ fn, args });
        if (fn === "f_aprovar_pagamento_prestadores") {
          return Promise.resolve({ data: [{ solicitados: 1, aprovados: 1, ja_aprovados: 0, bloqueados: 0, detalhes: [] }], error: null });
        }
        if (fn === "f_confirmar_pagamento_prestador") {
          // a baixa marca o título como pago
          row.status_pagamento = "pago";
          row.status = "pago";
          return Promise.resolve({ data: [{ sucesso: true, mensagem: "ok", status_pagamento: "pago" }], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    const r = await liberarPagamentoPrestador(row.id, "2026-10-09", client as any);
    expect(r.pago).toBe(true);
    expect(calls.map((c) => c.fn)).toEqual([
      "f_aprovar_pagamento_prestadores",
      "f_confirmar_pagamento_prestador",
    ]);
    // Sai da fila de liquidação (pago) e passa a compor o extrato consolidado.
    expect(isItemFilaLiquidacao(row)).toBe(false);
  });

  it("contrato do trigger de conclusão: gera registro pendente (fila)", () => {
    const mig = read("supabase/migrations/20260924000012_fin_prog05d6c_data_canonica_prestador.sql");
    expect(mig).toContain("INSERT INTO pagamentos_prestadores");
    expect(mig).toContain("'os_direta'");
    expect(mig).toContain("'em_aberto'");
    expect(mig).toContain("'pendente'");
  });

  it("UI: fila é a visão primária com ação 'Liberar Pagamento'", () => {
    const comp = read(COMP);
    expect(comp).toContain('<TabsTrigger value="fila">Fila de Liquidação</TabsTrigger>');
    expect(comp).toMatch(/searchParams\.get\("aba"\) \|\| "fila"/);
    expect(comp).toContain("Liberar Pagamento");
    expect(comp).toContain("handleLiberarPagamentoFila");
    expect(/from\("pagamentos_prestadores"\)[\s\S]{0,120}\.(update|insert|delete)\(/.test(comp)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SIMPLICIDADE PARA O OPERADOR
// ═══════════════════════════════════════════════════════════════════════════════
describe("4. Seguro e intuitivo para operador comum", () => {
  it("nada de alert/confirm/prompt nativos na tela de pagamentos", () => {
    const comp = read(COMP);
    expect(comp).not.toMatch(/\balert\(/);
    expect(comp).not.toMatch(/\bwindow\.confirm\(/);
    expect(comp).not.toMatch(/\bprompt\(/);
  });

  it("escritas financeiras passam por RPC oficial (sem service_role no front)", () => {
    const comp = read(COMP);
    expect(comp).not.toContain("service_role");
    expect(comp).not.toContain("SERVICE_ROLE");
  });
});

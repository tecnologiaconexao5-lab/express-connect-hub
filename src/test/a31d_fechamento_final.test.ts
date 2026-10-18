// ═══════════════════════════════════════════════════════════════════════════════
// A31D — Fechamento Final do Financeiro Operacional
// Testes unitários (determinísticos, sem banco):
//   1. Fallback de romaneio na Central (os.romaneio || metadata.numeroOC || app)
//   2. Classificação "Serviço sem OS Interna vinculada"
//   3. Semáforo da Central (romaneio/pod/valores/receber/pagar)
//   4. SQL da RPC revisada contém bloco 10.1 (romaneio_sync)
//   5. Sync retroativa idempotente (Parte 1)
//   6. Central↔Escala mesma fonte (alocacoes_escala + ordens_servico)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { derivarSemaforoCentral } from "@/services/financeiro/centralFinanceiroService";

const ROMANEIO_APP = "HML-FIN-A31D-001";

// ── Tipos dos mocks (sem `any`) ──────────────────────────────────────────────
type MockAlocacao = ReturnType<typeof alocacaoBase>;
type MockOS = ReturnType<typeof osBase>;

function alocacaoBase(overrides: Partial<MockAlocacao> = {}) {
  const base = {
    id: "aloc-1",
    ordem_servico_id: null as string | null,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-08-16",
    data_finalizacao: "2026-08-16",
    cliente_id: "cli-1",
    prestador_id: "prest-1",
    tipo_veiculo: "Carreta",
    placa: "ABC1D23",
    origem: "Guarulhos/SP",
    destino: "Campinas/SP",
    valor_frete: 1000,
    valor_repasse: 700,
    km_realizados: 80,
    clientes: { id: "cli-1", nome_fantasia: "Cliente Teste", razao_social: "Cliente Teste LTDA", cnpj: null },
    prestadores: { id: "prest-1", nome_completo: "Prestador Teste", cpf_cnpj: null },
    ordens_servico: null as MockOS | null,
    metadata: {
      app_motorista: { romaneio: ROMANEIO_APP, etapa_atual: "servico_finalizado" },
    },
  };
  return { ...base, ...overrides };
}

function osBase(overrides: Partial<MockOS> = {}) {
  const base = {
    id: "os-1",
    numero: "OS-100",
    romaneio: null as string | null,
  };
  return { ...base, ...overrides };
}

// ── Mocks do supabase usado por buscarCentralFinanceiro ──────────────────────
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("A31D — Fallback de romaneio na Central", () => {
  it("1.1 prioriza os.romaneio quando existe (mesmo com App)", async () => {
    vi.doMock("@/lib/supabase", () => {
      return {
        supabase: {
          from: (t: string) => {
            if (t === "alocacoes_escala") return chain({ data: [alocacaoBase({ ordem_servico_id: "os-1", ordens_servico: osBase({ romaneio: "OS-RO-999" }) })] });
            if (t === "clientes") return chain({ data: [{ id: "cli-1", nome_fantasia: "Cliente Teste" }] });
            return chain({ data: [] });
          },
        },
      };
    });
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({});
    expect(itens[0].romaneio).toBe("OS-RO-999");
    expect(itens[0].romaneioOC).toBe("OS-RO-999");
  });

  it("1.2 usa metadata.app_motorista.romaneio quando não há OS vinculada (App)", async () => {
    vi.doMock("@/lib/supabase", () => {
      return {
        supabase: {
          from: (t: string) => {
            if (t === "alocacoes_escala") return chain({ data: [alocacaoBase()] });
            if (t === "clientes") return chain({ data: [{ id: "cli-1", nome_fantasia: "Cliente Teste" }] });
            return chain({ data: [] });
          },
        },
      };
    });
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({});
    expect(itens[0].romaneio).toBe(ROMANEIO_APP);
    expect(itens[0].romaneioOC).toBe(ROMANEIO_APP);
    expect(itens[0].osId).toBeNull();
    expect(itens[0].osNumero).toBe("");
  });

  it("1.3 filtra por romaneio usando o fallback App", async () => {
    vi.doMock("@/lib/supabase", () => {
      return {
        supabase: {
          from: (t: string) => {
            if (t === "alocacoes_escala") return chain({ data: [alocacaoBase()] });
            if (t === "clientes") return chain({ data: [{ id: "cli-1", nome_fantasia: "Cliente Teste" }] });
            return chain({ data: [] });
          },
        },
      };
    });
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({ romaneio: "HML-FIN-A31D" });
    expect(itens.length).toBe(1);
  });
});

describe("A31D — Classificação 'Serviço sem OS Interna vinculada'", () => {
  it("2.1 alocação sem ordem_servico_id mantém romaneio App e sem OS", async () => {
    vi.doMock("@/lib/supabase", () => {
      return {
        supabase: {
          from: (t: string) => {
            if (t === "alocacoes_escala") return chain({ data: [alocacaoBase({ ordem_servico_id: null })] });
            if (t === "clientes") return chain({ data: [{ id: "cli-1", nome_fantasia: "Cliente Teste" }] });
            return chain({ data: [] });
          },
        },
      };
    });
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({});
    expect(itens[0].osId).toBeNull();
    expect(itens[0].osNumero).toBe("");
    expect(itens[0].romaneio).toBe(ROMANEIO_APP);
  });
});

describe("A31D — Semáforo da Central", () => {
  it("3.1 sem OS + romaneio App → verde quando POD e valores ok", () => {
    const r = derivarSemaforoCentral({
      romaneio: ROMANEIO_APP,
      valorClienteTotal: 1000,
      valorPrestadorTotal: 700,
      podSituacao: "completo",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(r.semaforo).toBe("verde");
    expect(r.motivos).toContain("Pronto para conferência");
  });

  it("3.2 sem romaneio e sem POD → amarelo (avisos)", () => {
    const r = derivarSemaforoCentral({
      romaneio: null,
      valorClienteTotal: 1000,
      valorPrestadorTotal: 700,
      podSituacao: "pendente",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(r.semaforo).toBe("amarelo");
    expect(r.motivos).toContain("Romaneio/OC pendente");
    expect(r.motivos).toContain("POD pendente");
  });

  it("3.3 sem valor do cliente → vermelho (bloqueio)", () => {
    const r = derivarSemaforoCentral({
      romaneio: "RO-1",
      valorClienteTotal: 0,
      valorPrestadorTotal: 0,
      podSituacao: "completo",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(r.semaforo).toBe("vermelho");
    expect(r.motivos).toContain("Valor do cliente ausente");
  });

  it("3.4 POD nao_entregue → vermelho", () => {
    const r = derivarSemaforoCentral({
      romaneio: "RO-1",
      valorClienteTotal: 1000,
      valorPrestadorTotal: 700,
      podSituacao: "nao_entregue",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(r.semaforo).toBe("vermelho");
    expect(r.motivos).toContain("Não entregue");
  });

  it("3.5 já recebido → motivo 'Já recebido' sem bloquear", () => {
    const r = derivarSemaforoCentral({
      romaneio: "RO-1",
      valorClienteTotal: 1000,
      valorPrestadorTotal: 700,
      podSituacao: "completo",
      receberStatus: "pago",
      pagamentoStatus: "pago",
    });
    expect(r.semaforo).toBe("verde");
    expect(r.motivos).toContain("Já recebido");
    expect(r.motivos).toContain("Pagto prestador: pago");
  });
});

describe("A31D — SQL da RPC revisada (f_avancar_etapa_app_motorista)", () => {
  it("4.1 define bloco 10.1 que sincroniza romaneio para ordens_servico", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "a31d_aplicar_sync_romaneio.mjs");
    const sql = fs.readFileSync(scriptPath, "utf8");
    // RPC nova contém o UPDATE em ordens_servico com romaneio
    expect(sql).toContain("romaneio_informado");
    expect(sql).toContain("UPDATE public.ordens_servico");
    expect(sql).toContain("romaneio = v_romaneio_app");
    expect(sql).toContain("romaneio_sync");
    // Grants restritos — sem anon/PUBLIC
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista");
  });

  it("4.2 sync retroativa (Parte 1) é idempotente e só atualiza OS vinculada com romaneio vazio", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "a31d_aplicar_sync_romaneio.mjs");
    const sql = fs.readFileSync(scriptPath, "utf8");
    // Sync retroativa: apenas WHERE ordem_servico_id IS NOT NULL + romaneio vazio na OS
    expect(sql).toContain("a.ordem_servico_id IS NOT NULL");
    expect(sql).toContain("os.romaneio IS NULL OR os.romaneio = ''");
    expect(sql).toContain("DISTINCT ON (r.os_id)");
    expect(sql).toContain("SELECT COUNT(*)");
  });
});

describe("A31D — Central ↔ Escala (mesma fonte)", () => {
  it("5.1 Central lê romaneio de ordens_servico.romaneio quando OS vinculada", async () => {
    vi.doMock("@/lib/supabase", () => {
      return {
        supabase: {
          from: (t: string) => {
            if (t === "alocacoes_escala") return chain({ data: [alocacaoBase({ ordem_servico_id: "os-1", metadata: {}, ordens_servico: osBase({ romaneio: "OC-2026-88" }) })] });
            if (t === "clientes") return chain({ data: [{ id: "cli-1", nome_fantasia: "Cliente Teste" }] });
            return chain({ data: [] });
          },
        },
      };
    });
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({});
    expect(itens[0].osId).toBe("os-1");
    expect(itens[0].romaneio).toBe("OC-2026-88");
    expect(itens[0].romaneioOC).toBe("OC-2026-88");
  });
});

// ── Helpers para simular o encadeamento do supabase-js ───────────────────────
type RowResult = { data: unknown[]; error: null };
function chain(res: RowResult) {
  const build = () => {
    const methods: Record<string, () => ReturnType<typeof build>> = {
      select: build,
      eq: build,
      neq: build,
      in: build,
      gte: build,
      lte: build,
      order: build,
      limit: build,
      range: build,
      maybeSingle: build,
      single: build,
      contains: build,
      returns: build,
      maybeThen: build,
    };
    methods.then = (onfulfilled?: (v: RowResult) => unknown) => Promise.resolve(res).then(onfulfilled);
    return methods;
  };
  return build();
}
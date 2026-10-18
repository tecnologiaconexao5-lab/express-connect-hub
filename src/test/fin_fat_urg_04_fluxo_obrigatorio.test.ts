// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FAT-URG-04 — FLUXO DE FATURAMENTO OBRIGATÓRIO
// Testes determinísticos (sem banco) + verificação estrutural das migrations.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SQL_EMITIR_HARD = "supabase/migrations/20260925000002_fin_fat_urg_04_emissao_exige_aprovacao.sql";
const SQL_MOVER = "supabase/migrations/20260925000000_fin_fat_urg_02_validacao_fatura_rpc.sql";
const SRC_MANUAL = "src/components/financeiro/FaturaManualDialog.tsx";
const SRC_CONFERENCIA = "src/components/financeiro/ConferenciaFinanceira.tsx";
const SRC_SERVICE = "src/services/financeiro/centralFinanceiroService.ts";

// ── Mock supabase para buscarCentralFinanceiro (derivação de faturamento) ──
const H = vi.hoisted(() => {
  const aloc = (id: string, os: string) => ({
    id, ordem_servico_id: os, status: "concluida", finalizada: true,
    data_escala: "2026-09-25", data_finalizacao: "2026-09-25T10:00:00Z",
    cliente_id: "cli-1", prestador_id: "pr-1", tipo_veiculo: "Van", placa: "ABC1D23",
    origem: "A", destino: "B", valor_frete: 100, valor_repasse: 70, km_realizados: 10,
    clientes: { id: "cli-1", nome_fantasia: "Cliente Teste", razao_social: "Cliente Teste LTDA", cnpj: null },
    prestadores: { id: "pr-1", nome_completo: "Prestador Teste", cpf_cnpj: null },
    ordens_servico: { id: os, numero: "OS-" + os, romaneio: "ROM-" + os },
    metadata: {},
  });
  // 3 alocações: os-1 nao_faturado; os-2 faturado(emitida); os-3 rascunho
  const ALOC = [aloc("al-1", "os-1"), aloc("al-2", "os-2"), aloc("al-3", "os-3")];
  const ITENS = [
    { os_id: "os-2", fatura_id: "f-2", faturas: { id: "f-2", numero: "FAT-2", status: "emitida" } },
    { os_id: "os-3", fatura_id: "f-3", faturas: { id: "f-3", numero: null, status: "rascunho" } },
  ];
  const tableData: Record<string, unknown[]> = { alocacoes_escala: ALOC, fatura_itens: ITENS, faturas: [] };
  const chain = (data: unknown[]) => {
    const build = (): Record<string, unknown> => {
      const m: Record<string, unknown> = {};
      const self = () => m;
      ["select", "eq", "neq", "in", "gte", "lte", "order", "limit", "range", "maybeSingle", "single", "contains", "returns"].forEach((k) => { m[k] = self; });
      m.then = (onf?: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(onf);
      return m;
    };
    return build();
  };
  const from = (t: string) => chain(tableData[t] ?? []);
  return { from };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: H.from } }));

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("TMS-FAT-URG-04 — Conferência: fila operacional default", () => {
  it("8/9) default (nao_faturado) traz só não faturados; rascunho/emitida saem", async () => {
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const fila = await buscarCentralFinanceiro({ faturado: "nao_faturado" });
    expect(fila.map((i) => i.osNumero).sort()).toEqual(["OS-os-1"]);
    expect(fila.every((i) => i.faturamento.status === "nao_faturado")).toBe(true);
  });

  it("10) histórico: 'todos' traz tudo; 'faturado' só emitidas; 'em_processo' só rascunho", async () => {
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const todos = await buscarCentralFinanceiro({ faturado: "todos" });
    expect(todos.length).toBe(3);
    const faturado = await buscarCentralFinanceiro({ faturado: "faturado" });
    expect(faturado.map((i) => i.osNumero)).toEqual(["OS-os-2"]);
    const emProc = await buscarCentralFinanceiro({ faturado: "em_processo" });
    expect(emProc.map((i) => i.osNumero)).toEqual(["OS-os-3"]);
  });

  it("5) item faturado nunca volta a ser elegível (faturamento != nao_faturado)", async () => {
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const todos = await buscarCentralFinanceiro({ faturado: "todos" });
    const faturado = todos.find((i) => i.osNumero === "OS-os-2")!;
    expect(faturado.faturamento.status).toBe("faturado");
    // a regra de elegibilidade da UI rejeita tudo que não é 'nao_faturado'
    const src = read(SRC_CONFERENCIA);
    expect(src).toContain('a.faturamento.status !== "nao_faturado"');
  });

  it("Estado inicial da tela é { faturado: 'nao_faturado' }", () => {
    expect(read(SRC_CONFERENCIA)).toContain('useState<CentralFiltros>({ faturado: "nao_faturado" })');
  });
});

describe("TMS-FAT-URG-04 — Emissão exige aprovação (SQL)", () => {
  const sql = read(SQL_EMITIR_HARD);

  it("1/2) bloqueia rascunho e aguardando; 3) permite só aprovada", () => {
    expect(sql).toMatch(/v_fatura\.status <> 'aprovada'/);
    expect(sql).toContain("FATURA_NAO_APROVADA");
    expect(sql).not.toMatch(/NOT IN \('rascunho','aguardando_aprovacao','aprovada'\)/);
  });

  it("4/5) exatamente 1 AR + guarda de duplicidade preservadas", () => {
    expect((sql.match(/INSERT\s+INTO\s+public\.financeiro_receber/gi) || []).length).toBe(1);
    expect(sql).toContain("FATURA_JA_EMITIDA");
  });

  it("segurança preservada (SECURITY DEFINER, search_path, grants sem anon)", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.f_emitir_fatura\(uuid\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_emitir_fatura\(uuid\) TO authenticated, service_role/);
  });

  it("6/7) validar/aprovar NÃO cria AR (f_mover sem financeiro_receber)", () => {
    const mover = read(SQL_MOVER);
    expect(mover).not.toMatch(/INSERT\s+INTO\s+public\.financeiro_receber/i);
    expect(mover).toContain("TRANSICAO_INVALIDA");
    expect(mover).toContain("SEM_PERMISSAO_PERFIL");
    expect(mover).toContain("SEM_PERMISSAO_TENANT");
  });
});

describe("TMS-FAT-URG-04 — Fatura Manual obedece ao mesmo contrato", () => {
  const src = read(SRC_MANUAL);
  it("11) não emite direto; cria e envia para validação", () => {
    expect(src).not.toContain("emitirFatura(");
    expect(src).toContain("enviarFaturaParaValidacao");
    expect(src).toContain("Salvar e Enviar para Validação");
  });
});

describe("TMS-FAT-URG-04 — Serviço: semântica do filtro de faturamento", () => {
  const src = read(SRC_SERVICE);
  it("nao_faturado é estrito (=== 'nao_faturado'), não apenas '!== faturado'", () => {
    expect(src).toContain('filtros.faturado === "nao_faturado"');
    expect(src).toMatch(/i\.faturamento\.status === "nao_faturado"/);
  });
});

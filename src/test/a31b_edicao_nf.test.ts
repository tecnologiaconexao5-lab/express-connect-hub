import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31B — Edição/remoção de NF no dossiê fiscal (fiscal_documentos_vinculados).
// Garante: bloqueio de remoção/edição quando NF vinculada a CT-e/MDF-e e
// remoção não-destrutiva (soft-delete via status 'desvinculada').
// ============================================================================

type Cadeia =
  | { op: "select"; result: unknown }
  | { op: "update"; result: unknown }
  | { op: "delete"; result: unknown };

const chamadas: { tabela: string; tipo: string; args: unknown }[] = [];

const construirSupabase = (seq: Cadeia[]) => {
  const proximoResultado = () => {
    const step = seq.shift() as Cadeia;
    return Promise.resolve(step.result);
  };
  // Objeto que é thenable (para `.eq(...)` awaited) e encadeável (para `.eq().select().single()`).
  const thenableQuery = () => {
    const q: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) => resolve(proximoResultado()),
      select: () => {
        const sub: Record<string, unknown> = {
          then: (r: (v: unknown) => void) => r(proximoResultado()),
          single: () => proximoResultado(),
          order: () => q,
        };
        return sub;
      },
      eq: (col: string, val: unknown) => {
        chamadas.push({ tabela: "", tipo: "eq", args: { col, val } });
        return thenableQuery();
      },
      maybeSingle: () => proximoResultado(),
      single: () => proximoResultado(),
      order: () => q,
    };
    return q;
  };
  return {
    from: (tabela: string) => {
      return {
        select: (cols?: string) => {
          chamadas.push({ tabela, tipo: "select", args: cols });
          return thenableQuery();
        },
        update: (payload: unknown) => {
          chamadas.push({ tabela, tipo: "update", args: payload });
          return { eq: () => thenableQuery() };
        },
        delete: () => {
          chamadas.push({ tabela, tipo: "delete" });
          return { eq: () => thenableQuery() };
        },
      };
    },
  };
};

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({} as unknown)) },
}));

import { supabase } from "@/lib/supabase";
import { removerNFdaOS, atualizarNFdaOS } from "@/services/financeiro/faturaService";

beforeEach(() => {
  chamadas.length = 0;
});

describe("A31B — removerNFdaOS", () => {
  it("bloqueia remoção quando NF vinculada a CT-e/MDF-e", async () => {
    const supabaseMock = construirSupabase([
      { op: "select", result: { data: { id: "nf1", cte_id: "cte-1", mdfe_id: null, status: "vinculada" }, error: null } },
    ]);
    vi.mocked(supabase.from).mockImplementation((t: string) => supabaseMock.from(t));
    const res = await removerNFdaOS("nf1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("CT-e/MDF-e");
  });

  it("não encontrada", async () => {
    const supabaseMock = construirSupabase([
      { op: "select", result: { data: null, error: null } },
    ]);
    vi.mocked(supabase.from).mockImplementation((t: string) => supabaseMock.from(t));
    const res = await removerNFdaOS("nf-x");
    expect(res.success).toBe(false);
    expect(res.error).toContain("não encontrada");
  });

  it("soft-delete: marca status 'desvinculada' quando NF suporta status", async () => {
    const supabaseMock = construirSupabase([
      { op: "select", result: { data: { id: "nf1", cte_id: null, mdfe_id: null, status: "vinculada" }, error: null } },
      { op: "update", result: { error: null } },
    ]);
    vi.mocked(supabase.from).mockImplementation((t: string) => supabaseMock.from(t));
    const res = await removerNFdaOS("nf1");
    expect(res.success).toBe(true);
    expect(chamadas).toContainEqual(
      expect.objectContaining({ tabela: "fiscal_documentos_vinculados", tipo: "update" })
    );
  });
});

describe("A31B — atualizarNFdaOS", () => {
  it("bloqueia edição quando NF vinculada a CT-e/MDF-e", async () => {
    const supabaseMock = construirSupabase([
      { op: "select", result: { data: { id: "nf1", cte_id: null, mdfe_id: "mdfe-9" }, error: null } },
    ]);
    vi.mocked(supabase.from).mockImplementation((t: string) => supabaseMock.from(t));
    const res = await atualizarNFdaOS("nf1", { numero: "1234" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("CT-e/MDF-e");
  });

  it("atualiza campos da NF", async () => {
    const supabaseMock = construirSupabase([
      { op: "select", result: { data: { id: "nf1", cte_id: null, mdfe_id: null }, error: null } },
      { op: "update", result: {
        data: {
          id: "nf1", ordem_servico_id: "os1", tipo_documento: "NFE", numero: "1234",
          serie: "1", chave_acesso: null, emitente_nome: "Emitente X", emitente_cnpj: null,
          valor_total: 500, peso_bruto: 0, volumes: 0, status: "vinculada",
          xml_storage_path: null, created_at: "2026-01-01T00:00:00Z",
        }, error: null,
      } },
    ]);
    vi.mocked(supabase.from).mockImplementation((t: string) => supabaseMock.from(t));
    const res = await atualizarNFdaOS("nf1", { numero: "1234", valor_total: 500 });
    expect(res.success).toBe(true);
    expect(res.nf?.numero).toBe("1234");
    expect(res.nf?.valor_total).toBe(500);
  });
});
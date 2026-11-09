// ============================================================
// REFINOS OPERACIONAIS (2026-11) — Dashboard premium, rotas dinâmicas,
// tags de SLA, repasse automático, exclusão sem senha e sequência da OS.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  resumoRotaOS,
  resumoRotaOSTexto,
  rotuloPontoRota,
  siglaCidade,
  derivarBairroCidade,
} from "@/lib/resumoRotaOS";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const dashboardCard = readSrc("src/components/dashboard/AlertaOscotacaoExpress.tsx");
const ordensLista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const solicitacoesLista = readSrc("src/components/operacao/SolicitacoesClienteLista.tsx");
const osSiteService = readSrc("src/services/operacao/osSiteService.ts");
const osService = readSrc("src/services/ordemServicoService.ts");
const osForm = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const migracaoSeq = readSrc("supabase/migrations/20261102000000_os_numero_sequencial.sql");
const resetScript = readSrc("scripts/_reset_operacao.cjs");

describe("A) Resumo de rota dinâmico — Bairro-SIGLA ➡️ Bairro-SIGLA", () => {
  it("A.1 sigla da cidade usa a tabela da operação e cai nas iniciais", () => {
    expect(siglaCidade("Guarulhos", "SP")).toBe("GRU");
    expect(siglaCidade("São Bernardo do Campo", "SP")).toBe("SBC");
    expect(siglaCidade("São Paulo", "SP")).toBe("SAO");
    expect(siglaCidade("Santo André", "SP")).toBe("SAN");
    // cidade desconhecida → iniciais + letras da primeira palavra
    expect(siglaCidade("Bauru", "SP")).toBe("BAU");
  });

  it("A.2 deriva bairro/cidade do texto quando o JSONB vem vazio", () => {
    const d = derivarBairroCidade("Avenida Sumaré, Vila Madalena, São Paulo - SP, 05435-000");
    expect(d.bairro).toBe("Vila Madalena");
    expect(d.cidade).toBe("São Paulo");
    expect(d.uf).toBe("SP");
    expect(derivarBairroCidade("")).toEqual({ bairro: "", cidade: "", uf: "" });
  });

  it("A.3 rótulo do ponto: bairro + sigla (ou só sigla)", () => {
    expect(rotuloPontoRota({ bairro: "Pimentas", cidade: "Guarulhos", uf: "SP" })).toBe("Pimentas-GRU");
    expect(rotuloPontoRota({ cidade: "Guarulhos", uf: "SP" })).toBe("GRU");
    // OS da cotação: bairro/cidade vazios → deriva do endereço
    expect(
      rotuloPontoRota({ bairro: "", cidade: "", uf: "", endereco: "Rua A, Demarchi, São Bernardo do Campo - SP" }),
    ).toBe("Demarchi-SBC");
  });

  it("A.4 duas paradas → origem ➡️ destino; 3+ → múltiplos destinos", () => {
    const duas = resumoRotaOS([
      { bairro: "Pimentas", cidade: "Guarulhos", uf: "SP" },
      { bairro: "Demarchi", cidade: "São Bernardo do Campo", uf: "SP" },
    ]);
    expect(duas.texto).toBe("Pimentas-GRU ➡️ Demarchi-SBC");
    expect(duas.multiplos).toBe(false);

    const tres = resumoRotaOS([
      { bairro: "Pimentas", cidade: "Guarulhos", uf: "SP" },
      { bairro: "Centro", cidade: "Osasco", uf: "SP" },
      { bairro: "Demarchi", cidade: "São Bernardo do Campo", uf: "SP" },
    ]);
    expect(tres.texto).toBe("Pimentas-GRU ➡️ Múltiplos destinos (3 paradas)");
    expect(tres.multiplos).toBe(true);
    expect(tres.paradas).toBe(3);

    expect(resumoRotaOS([]).texto).toBe("");
    expect(resumoRotaOSTexto([], "São Paulo - Matriz")).toBe("São Paulo - Matriz");
  });
});

describe("B) Dashboard — cards premium com horário e rolagem horizontal", () => {
  it("B.1 rolagem horizontal e todos os cards (sem corte em 4)", () => {
    expect(dashboardCard).toContain("overflow-x-auto");
    expect(dashboardCard).toContain("shrink-0");
    expect(dashboardCard).not.toContain("slice(0, 4)");
    expect(dashboardCard).not.toContain("rapida");
  });

  it("B.2 horário exato da solicitação + rota no card", () => {
    expect(dashboardCard).toContain("formatarHorarioSolicitacao");
    expect(dashboardCard).toContain("Clock3");
    expect(dashboardCard).toContain("os.rotaResumo");
  });

  it("B.3 service entrega rotaResumo/paradas derivados de enderecos", () => {
    expect(osSiteService).toContain('"id, numero, cliente, status, prestador, carga, enderecos');
    expect(osSiteService).toContain("resumoRotaOS(");
    expect(osSiteService).toContain("rotaResumo:");
  });
});

describe("C) Lista de OS — rota, tags de SLA e aviso de ociosidade", () => {
  it("C.1 coluna Rota usa o resumo dinâmico (sem 'São Paulo - Matriz' fixo)", () => {
    expect(ordensLista).toContain("resumoRotaOSTexto(");
    expect(ordensLista).toContain("resumoRota.multiplos");
    expect(ordensLista).not.toContain('os.unidade || "Rota Padrão"');
  });

  it("C.2 tag única de atraso/SLA (sem sobreposição) com nowrap", () => {
    expect(ordensLista).toContain('{atrasada ? "Atraso" : "Risco de SLA"}');
    expect(ordensLista).toContain("whitespace-nowrap");
    expect(ordensLista).not.toContain("Atraso/Risco de SLA");
  });

  it("C.3 OS sem prestador: alerta vermelho com tempo ocioso", () => {
    expect(ordensLista).toContain("Parada há {paradaHa}");
    expect(ordensLista).toContain("Sem prestador");
    expect(ordensLista).toContain("border-red-200/80 bg-red-50/70");
  });

  it("C.4 repasse automático pela tabela da cotação (editável e opcional)", () => {
    expect(ordensLista).toContain("calcularRepasseSugerido");
    expect(ordensLista).toContain("buscarTabelaPrestador(");
    expect(ordensLista).toContain("preencherRepasseAoSelecionar");
    expect(ordensLista).toContain("calculandoRepasse");
    expect(ordensLista).toContain("Repasse do prestador (R$) — opcional");
    expect(ordensLista).toContain("Se vazio, usa a tabela/cotação");
  });

  it("C.5 exclusão sem senha administrativa (temporário)", () => {
    expect(ordensLista).not.toContain("VITE_ADMIN_DELETE_PASSWORD");
    expect(ordensLista).not.toContain("Senha Administrativa");
    expect(ordensLista).toContain("Exclusão liberada temporariamente");
    expect(ordensLista).toContain("disabled={excluindo}");
  });
});

describe("D) Solicitações — rota no destino", () => {
  it("D.1 usa o resumo de rota nos itens de OS e pedido", () => {
    expect(solicitacoesLista).toContain("rotaResumo");
    expect(solicitacoesLista).toContain("resumoRotaOS(");
    expect(solicitacoesLista).toContain("{s.rotaResumo || s.destino}");
  });
});

describe("E) Sequência oficial da OS (OS-AAAAMM-1200+)", () => {
  it("E.1 migration cria a sequence em 1200 e a RPC de número", () => {
    expect(migracaoSeq).toContain("CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq");
    expect(migracaoSeq).toContain("START WITH 1200");
    expect(migracaoSeq).toContain("CREATE OR REPLACE FUNCTION public.f_proximo_numero_os()");
    expect(migracaoSeq).toContain("GRANT EXECUTE ON FUNCTION public.f_proximo_numero_os() TO authenticated");
  });

  it("E.2 as duas funções que criam OS usam a sequência", () => {
    expect(migracaoSeq).toContain("CREATE OR REPLACE FUNCTION public.f_cotacao_detalhes_para_os");
    expect(migracaoSeq).toContain("CREATE OR REPLACE FUNCTION public.converter_pedido_para_os");
    const ocorrencias = migracaoSeq.split("v_os_numero := public.f_proximo_numero_os();").length - 1;
    expect(ocorrencias).toBe(2);
    expect(migracaoSeq).not.toContain("floor(random() * 900000) + 100000)::int::text");
    expect(migracaoSeq).not.toContain("LPAD(floor(random() * 900000 + 100000)::TEXT");
  });

  it("E.3 frontend: serviço e formulário usam gerarNumeroOS()", () => {
    expect(osService).toContain('supabase.rpc("f_proximo_numero_os")');
    expect(osService).toContain("export async function gerarNumeroOS");
    expect(osService).toContain("const numero = await gerarNumeroOS();");
    expect(osForm).toContain("gerarNumeroOS");
    expect(osForm).toContain("numeroSequencialBuscado");
  });
});

describe("F) Script de limpeza (reset da operação)", () => {
  it("F.1 exige --apply (dry-run por padrão) e roda em transação única", () => {
    expect(resetScript).toContain('const argv = opts.argv || process.argv');
    expect(resetScript).toContain('argv.includes("--apply")');
    expect(resetScript).toContain('await c.query("BEGIN")');
    expect(resetScript).toContain('await c.query("COMMIT")');
    expect(resetScript).toContain('await c.query("ROLLBACK")');
  });

  it("F.2 apaga OS, cotações e registros financeiros", () => {
    for (const tabela of [
      "financeiro_receber",
      "financeiro_pagar",
      "pagamentos_prestadores",
      "composicao_financeira_os",
      "alocacoes_escala",
      "ordens_servico",
      "cotacoes_publicas",
    ]) {
      expect(resetScript).toContain(`"${tabela}"`);
    }
  });

  it("F.3 reinicia a sequência em 1200", () => {
    expect(resetScript).toContain("ALTER SEQUENCE public.os_numero_seq RESTART WITH 1200");
  });

  it("F.4 _reset_operacao_1200.cjs aplica a sequência e garante o 1200", () => {
    const wrapper = readSrc("scripts/_reset_operacao_1200.cjs");
    expect(wrapper).toContain('executar({ aplicarSequencia: true })');
    expect(wrapper).toContain("20261102000000_os_numero_sequencial.sql");
    expect(wrapper).toContain("OS-[ANO][MES]-1200");
    expect(resetScript).toContain("20261102000000_os_numero_sequencial.sql");
    expect(resetScript).toContain("seq.rows[0]");
    expect(resetScript).toContain('String(last_value) !== "1200"');
  });
});

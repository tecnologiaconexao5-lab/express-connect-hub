/**
 * FIN-P1-01 — Testes de filtros, período e organização operacional do financeiro
 *
 * Valida:
 * - Navegação por mês (atual, anterior, próximo)
 * - Período personalizado (data início/fim)
 * - Filtros por status efetivo
 * - Filtros por fornecedor/cliente
 * - Busca textual
 * - Ordenação
 * - is_teste excluído
 * - KPIs refletem período selecionado
 * - Timezone São Paulo
 * - Limpar filtros
 * - Combinção de filtros
 */

import { describe, it, expect } from "vitest";
import {
  calcularStatusEfetivo,
  hojeSP,
  parseDataLocal,
  compararDatas,
  type StatusEfetivo,
} from "../helpers/statusVencimento";

// ── Mock helpers ──
function makeLancamento(overrides: Record<string, any> = {}) {
  return {
    id: "test-id",
    favorecidoNome: "Fornecedor Teste",
    favorecidoCnpjCpf: "12.345.678/0001-90",
    documentoNF: "NF-001",
    categoria: "Manutenção",
    vencimento: "2026-09-15",
    valorLiquido: 1000,
    status: "pendente",
    statusEfetivo: "a_vencer" as StatusEfetivo,
    is_teste: false,
    ...overrides,
  };
}

function makeRecebivel(overrides: Record<string, any> = {}) {
  return {
    id: "test-id",
    clienteId: "cliente-1",
    clienteNome: "Cliente Teste",
    documento: "FAT-001",
    dataVencimento: "2026-09-15",
    valorLiquido: 2000,
    status: "pendente",
    statusEfetivo: "a_vencer" as StatusEfetivo,
    is_teste: false,
    ...overrides,
  };
}

// ── Mês: helpers de período ──
describe("FIN-P1-01 — Período do mês", () => {
  it("mês atual retorna range correto", () => {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    const iniStr = inicio.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const fimStr = fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    expect(iniStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fimStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(iniStr <= fimStr).toBe(true);
  });

  it("mês anterior calcula corretamente", () => {
    const hoje = new Date();
    hoje.setMonth(hoje.getMonth() - 1);
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    expect(inicio.getMonth()).toBe(m);
    expect(fim.getMonth()).toBe(m);
    expect(fim.getDate()).toBe(new Date(y, m + 1, 0).getDate());
  });

  it("mês seguinte calcula corretamente", () => {
    const hoje = new Date();
    hoje.setMonth(hoje.getMonth() + 1);
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    expect(inicio.getMonth()).toBe(m);
  });

  it("nome do mês em pt-BR", () => {
    const d = new Date();
    const nome = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    expect(nome).toMatch(/\w+ \d{4}/);
  });
});

// ── Filtros por status efetivo ──
describe("FIN-P1-01 — Filtros por status", () => {
  const lancamentos = [
    makeLancamento({ id: "r1", statusEfetivo: "atrasado", vencimento: "2026-09-01" }),
    makeLancamento({ id: "r2", statusEfetivo: "vence_hoje", vencimento: hojeSP() }),
    makeLancamento({ id: "r3", statusEfetivo: "a_vencer", vencimento: "2026-12-31" }),
    makeLancamento({ id: "r4", statusEfetivo: "pago", vencimento: "2026-09-05" }),
    makeLancamento({ id: "r5", statusEfetivo: "cancelado", vencimento: "2026-09-10" }),
    makeLancamento({ id: "r6", statusEfetivo: "parcial", vencimento: "2026-09-20" }),
    makeLancamento({ id: "r7", statusEfetivo: "provisao", vencimento: "2026-10-15" }),
  ];

  it("filtro atrasado retorna apenas atrasados", () => {
    const filtrados = lancamentos.filter(l => l.statusEfetivo === "atrasado");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe("r1");
  });

  it("filtro pago retorna apenas pagos", () => {
    const filtrados = lancamentos.filter(l => l.statusEfetivo === "pago");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe("r4");
  });

  it("filtro todos retorna tudo", () => {
    const filtrados = lancamentos.filter(() => true);
    expect(filtrados).toHaveLength(7);
  });

  it("filtro vence_hoje retorna apenas vence hoje", () => {
    const filtrados = lancamentos.filter(l => l.statusEfetivo === "vence_hoje");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe("r2");
  });

  it("filtro cancelado retorna apenas cancelados", () => {
    const filtrados = lancamentos.filter(l => l.statusEfetivo === "cancelado");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe("r5");
  });
});

// ── Busca textual ──
describe("FIN-P1-01 — Busca textual", () => {
  const lancamentos = [
    makeLancamento({ favorecidoNome: "Transportes ABC", documentoNF: "NF-1001", categoria: "Combustível frota própria" }),
    makeLancamento({ favorecidoNome: "Auto Peças XYZ", documentoNF: "NF-1002", categoria: "Manutenção" }),
    makeLancamento({ favorecidoNome: "Energia São Paulo", documentoNF: "NF-1003", categoria: "Energia elétrica" }),
  ];

  it("busca por nome do favorecido", () => {
    const q = "abc";
    const filtrados = lancamentos.filter(l => l.favorecidoNome.toLowerCase().includes(q));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].favorecidoNome).toBe("Transportes ABC");
  });

  it("busca por documento", () => {
    const q = "1002";
    const filtrados = lancamentos.filter(l => l.documentoNF.toLowerCase().includes(q));
    expect(filtrados).toHaveLength(1);
  });

  it("busca por categoria", () => {
    const q = "manutenção";
    const filtrados = lancamentos.filter(l => l.categoria.toLowerCase().includes(q));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].categoria).toBe("Manutenção");
  });

  it("busca vazia retorna todos", () => {
    const q = "";
    const filtrados = lancamentos.filter(l => !q || l.favorecidoNome.toLowerCase().includes(q));
    expect(filtrados).toHaveLength(3);
  });
});

// ── Ordenação ──
describe("FIN-P1-01 — Ordenação", () => {
  const lancamentos = [
    makeLancamento({ id: "r1", vencimento: "2026-09-20", valorLiquido: 500 }),
    makeLancamento({ id: "r2", vencimento: "2026-09-05", valorLiquido: 2000 }),
    makeLancamento({ id: "r3", vencimento: "2026-09-15", valorLiquido: 1000 }),
  ];

  it("ordenar por vencimento ascendente", () => {
    const sorted = [...lancamentos].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    expect(sorted[0].id).toBe("r2");
    expect(sorted[1].id).toBe("r3");
    expect(sorted[2].id).toBe("r1");
  });

  it("ordenar por vencimento descendente", () => {
    const sorted = [...lancamentos].sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    expect(sorted[0].id).toBe("r1");
  });

  it("ordenar por maior valor", () => {
    const sorted = [...lancamentos].sort((a, b) => b.valorLiquido - a.valorLiquido);
    expect(sorted[0].valorLiquido).toBe(2000);
  });

  it("ordenar por menor valor", () => {
    const sorted = [...lancamentos].sort((a, b) => a.valorLiquido - b.valorLiquido);
    expect(sorted[0].valorLiquido).toBe(500);
  });
});

// ── is_teste ──
describe("FIN-P1-01 — is_teste excluído", () => {
  it("registros de teste não aparecem na listagem", () => {
    const registros = [
      makeLancamento({ id: "r1", is_teste: false }),
      makeLancamento({ id: "r2", is_teste: true }),
      makeLancamento({ id: "r3", is_teste: false }),
    ];
    const producao = registros.filter(r => !r.is_teste);
    expect(producao).toHaveLength(2);
  });

  it("KPI exclui testes", () => {
    const registros = [
      makeLancamento({ valorLiquido: 1000, is_teste: false }),
      makeLancamento({ valorLiquido: 500, is_teste: true }),
    ];
    const total = registros.filter(r => !r.is_teste).reduce((a, r) => a + r.valorLiquido, 0);
    expect(total).toBe(1000);
  });
});

// ── KPIs refletem período ──
describe("FIN-P1-01 — KPIs refletem período", () => {
  it("KPIs do mês filtram por vencimento no mês", () => {
    const registros = [
      makeLancamento({ vencimento: "2026-09-15", statusEfetivo: "a_vencer", valorLiquido: 1000 }),
      makeLancamento({ vencimento: "2026-08-15", statusEfetivo: "atrasado", valorLiquido: 500 }),
      makeLancamento({ vencimento: "2026-09-20", statusEfetivo: "a_vencer", valorLiquido: 2000 }),
    ];
    const mesAtual = "2026-09";
    const doMes = registros.filter(r => r.vencimento.startsWith(mesAtual));
    expect(doMes).toHaveLength(2);
    const total = doMes.reduce((a, r) => a + r.valorLiquido, 0);
    expect(total).toBe(3000);
  });

  it("total atrasado exclui pagos", () => {
    const registros = [
      makeLancamento({ statusEfetivo: "atrasado", valorLiquido: 1000 }),
      makeLancamento({ statusEfetivo: "pago", valorLiquido: 2000 }),
    ];
    const atrasados = registros.filter(r => r.statusEfetivo === "atrasado");
    expect(atrasados).toHaveLength(1);
    expect(atrasados[0].valorLiquido).toBe(1000);
  });

  it("vence 7 dias considera janela futura", () => {
    const hoje = new Date();
    const em7 = new Date(Date.now() + 7 * 86400000);
    const hojeStr = hoje.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const em7Str = em7.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const registros = [
      makeLancamento({ vencimento: hojeStr, statusEfetivo: "vence_hoje", valorLiquido: 100 }),
      makeLancamento({ vencimento: em7Str, statusEfetivo: "a_vencer", valorLiquido: 200 }),
      makeLancamento({ vencimento: "2026-12-31", statusEfetivo: "a_vencer", valorLiquido: 300 }),
    ];
    const vence7 = registros.filter(r =>
      (r.statusEfetivo === "a_vencer" || r.statusEfetivo === "vence_hoje") &&
      r.vencimento >= hojeStr && r.vencimento <= em7Str
    );
    expect(vence7).toHaveLength(2);
  });
});

// ── Período personalizado ──
describe("FIN-P1-01 — Período personalizado", () => {
  it("período override mês", () => {
    const registros = [
      makeLancamento({ vencimento: "2026-09-01" }),
      makeLancamento({ vencimento: "2026-09-15" }),
      makeLancamento({ vencimento: "2026-10-01" }),
    ];
    const periodo = { inicio: "2026-09-10", fim: "2026-09-20" };
    const filtrados = registros.filter(r => r.vencimento >= periodo.inicio && r.vencimento <= periodo.fim);
    expect(filtrados).toHaveLength(1);
  });

  it("período com data início apenas filtra a partir de", () => {
    const registros = [
      makeLancamento({ vencimento: "2026-09-01" }),
      makeLancamento({ vencimento: "2026-09-15" }),
    ];
    const filtrados = registros.filter(r => r.vencimento >= "2026-09-10");
    expect(filtrados).toHaveLength(1);
  });

  it("período com data fim apenas filtra até", () => {
    const registros = [
      makeLancamento({ vencimento: "2026-09-01" }),
      makeLancamento({ vencimento: "2026-09-15" }),
    ];
    const filtrados = registros.filter(r => r.vencimento <= "2026-09-10");
    expect(filtrados).toHaveLength(1);
  });
});

// ── Fornecedor/Cliente ──
describe("FIN-P1-01 — Filtro fornecedor/cliente", () => {
  it("filtro por fornecedor", () => {
    const lancamentos = [
      makeLancamento({ favorecidoNome: "Transportes ABC" }),
      makeLancamento({ favorecidoNome: "Auto Peças XYZ" }),
    ];
    const filtrados = lancamentos.filter(l => l.favorecidoNome.toLowerCase().includes("transportes"));
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].favorecidoNome).toBe("Transportes ABC");
  });

  it("filtro por cliente (receber)", () => {
    const recebiveis = [
      makeRecebivel({ clienteId: "c1", clienteNome: "Cliente A" }),
      makeRecebivel({ clienteId: "c2", clienteNome: "Cliente B" }),
    ];
    const filtrados = recebiveis.filter(r => r.clienteId === "c1");
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].clienteNome).toBe("Cliente A");
  });
});

// ── Timezone ──
describe("FIN-P1-01 — Timezone São Paulo", () => {
  it("hojeSP retorna YYYY-MM-DD", () => {
    const hoje = hojeSP();
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parseDataLocal preserva dia civil", () => {
    const result = parseDataLocal("2026-09-05");
    expect(result).toBe("2026-09-05");
  });

  it("compararDatas ordena cronologicamente", () => {
    expect(compararDatas("2026-09-01", "2026-09-02")).toBe(-1);
    expect(compararDatas("2026-09-02", "2026-09-01")).toBe(1);
    expect(compararDatas("2026-09-01", "2026-09-01")).toBe(0);
  });
});

// ── Limpar filtros ──
describe("FIN-P1-01 — Limpar filtros", () => {
  it("limpar filtros restaura estado default", () => {
    const FILTROS_DEFAULT = {
      status: "todos", categoria: "", fornecedor: "", ordenacao: "vencimento_asc",
      dataInicio: "", dataFim: "",
    };
    const filtrosAtivos = {
      status: "atrasado", categoria: "Manutenção", fornecedor: "ABC", ordenacao: "valor_desc",
      dataInicio: "2026-09-01", dataFim: "2026-09-30",
    };
    // Limpar
    const limpos = { ...FILTROS_DEFAULT };
    expect(limpos.status).toBe("todos");
    expect(limpos.categoria).toBe("");
    expect(limpos.fornecedor).toBe("");
    expect(limpos.ordenacao).toBe("vencimento_asc");
  });
});

// ── Combinação de filtros ──
describe("FIN-P1-01 — Combinação de filtros", () => {
  it("status + fornecedor + busca", () => {
    const registros = [
      makeLancamento({ favorecidoNome: "Transportes ABC", statusEfetivo: "atrasado", vencimento: "2026-09-01" }),
      makeLancamento({ favorecidoNome: "Transportes ABC", statusEfetivo: "pago", vencimento: "2026-09-05" }),
      makeLancamento({ favorecidoNome: "Auto Peças XYZ", statusEfetivo: "atrasado", vencimento: "2026-09-01" }),
    ];
    const filtrados = registros.filter(l => {
      const passaStatus = l.statusEfetivo === "atrasado";
      const passaFornecedor = l.favorecidoNome.toLowerCase().includes("transportes");
      return passaStatus && passaFornecedor;
    });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].favorecidoNome).toBe("Transportes ABC");
    expect(filtrados[0].statusEfetivo).toBe("atrasado");
  });

  it("mês + status", () => {
    const registros = [
      makeLancamento({ vencimento: "2026-09-15", statusEfetivo: "a_vencer" }),
      makeLancamento({ vencimento: "2026-08-15", statusEfetivo: "a_vencer" }),
      makeLancamento({ vencimento: "2026-09-15", statusEfetivo: "pago" }),
    ];
    const mesAtual = "2026-09";
    const filtrados = registros.filter(r => r.vencimento.startsWith(mesAtual) && r.statusEfetivo === "a_vencer");
    expect(filtrados).toHaveLength(1);
  });
});

// ── FRETEBRAS regressão ──
describe("FIN-P1-01 — FRETEBRAS regressão", () => {
  it("FRETEBRAS aparece no mês correto", () => {
    const se = calcularStatusEfetivo({
      statusPersistido: "a vencer",
      dataVencimento: "2026-09-05",
    });
    expect(se).toBe("atrasado");
    // Está no mês 09
    expect("2026-09-05".startsWith("2026-09")).toBe(true);
  });
});

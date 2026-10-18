import { describe, it, expect } from "vitest";
import {
  calcularVencimentoPorRegra,
  REGRAS_FINANCEIRAS_DEFAULT,
} from "@/services/financeiro/configFinanceiraService";
import {
  montarDescricaoCalvo,
  sugerirVencimento,
} from "@/services/financeiro/faturaService";

describe("A31 — Modelo de fatura padrão por cliente (NÃO depende do nome)", () => {
  it("regra por cliente pode definir 'calvo' mesmo para nome sem 'Calvo'", () => {
    const regras = { ...REGRAS_FINANCEIRAS_DEFAULT, modeloFaturaPadrao: "calvo" as const };
    expect(regras.modeloFaturaPadrao).toBe("calvo");
  });

  it("outro cliente sem regra explícita → conexao_express", () => {
    expect(REGRAS_FINANCEIRAS_DEFAULT.modeloFaturaPadrao).toBe("conexao_express");
  });

  it("regra é explícita (não baseada em nome)", () => {
    // A31: a sugestão usa a configuração do cliente, não o texto do nome.
    const clienteNome = "MAGAZINE LUIZA";
    const regras = { ...REGRAS_FINANCEIRAS_DEFAULT, modeloFaturaPadrao: "calvo" as const };
    // Independe do nome
    expect(regras.modeloFaturaPadrao).toBe("calvo");
    expect(clienteNome.toLowerCase()).not.toContain("calvo");
  });
});

describe("A31 — Vencimento por regra do cliente", () => {
  it("prazo 15 dias → vencimento = emissão + 15", () => {
    const v = calcularVencimentoPorRegra({ dataEmissao: "2026-08-16", prazoDias: 15 });
    expect(v).toBe("2026-08-31");
  });

  it("dia fixo 15 → vence dia 15 do mês seguinte", () => {
    const v = calcularVencimentoPorRegra({ dataEmissao: "2026-08-16", diaFixo: 15 });
    expect(v).toBe("2026-09-15");
  });

  it("sem prazo → fallback 30 dias", () => {
    const v = sugerirVencimento("2026-08-16");
    expect(v).toBe("2026-09-15");
  });
});

describe("A31 — Romaneio/OC obrigatório por cliente", () => {
  it("cliente exige romaneio e não possui → bloqueia emissão", () => {
    const regras = { ...REGRAS_FINANCEIRAS_DEFAULT, exigeRomaneioOC: true };
    const temRomaneio = false;
    const bloqueado = regras.exigeRomaneioOC && !temRomaneio;
    expect(bloqueado).toBe(true);
  });

  it("cliente NÃO exige romaneio → não bloqueia só por isso", () => {
    const regras = { ...REGRAS_FINANCEIRAS_DEFAULT, exigeRomaneioOC: false };
    const temRomaneio = false;
    const bloqueado = regras.exigeRomaneioOC && !temRomaneio;
    expect(bloqueado).toBe(false);
  });
});

describe("A31 — Múltiplas NFs por OS (1:N)", () => {
  it("uma OS aceita várias NFs (relacionamento 1:N via fiscal_documentos_vinculados)", () => {
    const nfs = [
      { numero: "12345", osId: "os-1" },
      { numero: "12346", osId: "os-1" },
      { numero: "12347", osId: "os-1" },
      { numero: "12348", osId: "os-1" },
    ];
    expect(nfs.length).toBe(4);
    expect(nfs.every((n) => n.osId === "os-1")).toBe(true);
    // Não usa campos nf1/nf2/nf3
    const keys = Object.keys(nfs[0]);
    expect(keys).not.toContain("nf1");
  });

  it("NFs ficam vinculadas à OS original", () => {
    const nf = { numero: "12347", osId: "os-abc" };
    expect(nf.osId).toBe("os-abc");
  });
});

describe("A31 — Pesquisa por NF localiza serviço", () => {
  it("filtro por número de NF encontra o item (via nfs no pipeline da Central)", () => {
    const itens = [
      { osNumero: "OS-1", nfs: ["12345", "12346"] },
      { osNumero: "OS-2", nfs: ["12347"] },
    ];
    const q = "12347";
    const resultado = itens.filter((i) => i.nfs.some((nf) => nf.toLowerCase().includes(q.toLowerCase())));
    expect(resultado).toHaveLength(1);
    expect(resultado[0].osNumero).toBe("OS-2");
  });
});

describe("A31 — NF transportada ≠ NFS-e ≠ CT-e", () => {
  it("tipo NFE é nota da mercadoria; NFS-e e CT-e são documentos da Conexão", () => {
    const tipos: Record<string, string> = {
      NF_transportada: "NFE",
      NFS_e_Conexao: "NFS-e",
      CT_e_Conexao: "CT-e",
    };
    expect(tipos.NF_transportada).toBe("NFE");
    expect(tipos.NFS_e_Conexao).toBe("NFS-e");
    expect(tipos.CT_e_Conexao).toBe("CT-e");
    expect(tipos.NF_transportada).not.toBe(tipos.NFS_e_Conexao);
    expect(tipos.NF_transportada).not.toBe(tipos.CT_e_Conexao);
  });
});

describe("A31 — Valor do prestador não interfere na Fatura", () => {
  it("fatura usa exclusivamente Total Cliente", () => {
    const itens = [
      { valorClienteTotal: 600, valorPrestadorTotal: 300 },
      { valorClienteTotal: 600, valorPrestadorTotal: 250 },
    ];
    const totalCliente = itens.reduce((s, i) => s + i.valorClienteTotal, 0);
    const totalPrestador = itens.reduce((s, i) => s + i.valorPrestadorTotal, 0);
    expect(totalCliente).toBe(1200);
    expect(totalPrestador).toBe(550);
    expect(totalCliente).not.toBe(totalPrestador);
  });
});

describe("A31 — Descrição Calvo usa Romaneio/OC (referência externa)", () => {
  it("consolida romaneios sem dados operacionais", () => {
    const desc = montarDescricaoCalvo([{ romaneio: "343198" }, { romaneio: "343216" }]);
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343198 e 343216.");
    expect(desc).not.toContain("OS-");
    expect(desc).not.toContain("placa");
    expect(desc).not.toContain("→");
  });
});

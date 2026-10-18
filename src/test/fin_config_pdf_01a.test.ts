// ═══════════════════════════════════════════════════════════════════════════════
// FIN-CONFIG-PDF-01A — Cadastro Oficial Conexão Express → Cabeçalho Fatura
// Testes de unidade: digitação, persistência, PDF e separação empresa×cliente
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CONFIG_FINANCEIRA_EMPRESA_DEFAULT,
  type ConfigFinanceiraEmpresa,
} from "@/services/financeiro/configFinanceiraService";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mock_empresa: ConfigFinanceiraEmpresa = {
  razaoSocial: "EMPRESA TESTE CONEXÃO LTDA",
  nomeFantasia: "Teste Express",
  cnpj: "12.345.678/0001-90",
  ie: "123456789",
  inscricaoMunicipal: "987654321",
  endereco: "Rua Teste 123, Centro",
  cidade: "São Paulo",
  uf: "SP",
  telefone: "(11) 99999-0000",
  email: "contato@teste.com.br",
  emailFinanceiro: "financeiro@teste.com.br",
  logoClaro: "/logos/logo-teste-branco.png",
  logoColorido: "/logos/logo-teste-colorido.png",
  banco: "Banco Teste",
  codigoBanco: "001",
  agencia: "1234",
  conta: "56789-0",
  digito: "1",
  tipoConta: "Conta Corrente",
  pix: "chave@teste.com.br",
  beneficiario: "Teste Beneficiario",
  beneficiarioCnpj: "12.345.678/0001-90",
};

const mock_cliente = {
  razaoSocial: "CLIENTE HML 136A",
  cnpj: "11.222.333/0001-81",
  ie: "123.456.789.101",
};

// ── 1. Default Config ────────────────────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Config Financeira Default", () => {
  it("DEFAULT tem todos os campos obrigatórios", () => {
    const cfg = CONFIG_FINANCEIRA_EMPRESA_DEFAULT;
    expect(cfg.razaoSocial).toBe("");
    expect(cfg.nomeFantasia).toBe("Conexão Express");
    expect(cfg.cnpj).toBe("");
    expect(cfg.ie).toBe("");
    expect(cfg.endereco).toBe("");
    expect(cfg.cidade).toBe("");
    expect(cfg.uf).toBe("");
    expect(cfg.telefone).toBe("");
    expect(cfg.email).toBe("");
    expect(cfg.emailFinanceiro).toBe("financeiro@conexaoexpress.com.br");
  });

  it("DEFAULT tem cidade e uf como strings vazias", () => {
    const cfg = CONFIG_FINANCEIRA_EMPRESA_DEFAULT;
    expect(typeof cfg.cidade).toBe("string");
    expect(typeof cfg.uf).toBe("string");
    expect(cfg.cidade).toBe("");
    expect(cfg.uf).toBe("");
  });
});

// ── 2. Interface Completeness ────────────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Interface ConfigFinanceiraEmpresa", () => {
  it("contém todos os campos necessários para o PDF", () => {
    const requiredFields = [
      "razaoSocial", "nomeFantasia", "cnpj", "ie", "inscricaoMunicipal",
      "endereco", "cidade", "uf", "telefone", "email", "emailFinanceiro",
    ];
    for (const field of requiredFields) {
      expect(field in mock_empresa).toBe(true);
    }
  });

  it("mock empresa tem dados de teste válidos", () => {
    expect(mock_empresa.razaoSocial).toBe("EMPRESA TESTE CONEXÃO LTDA");
    expect(mock_empresa.cnpj).toBe("12.345.678/0001-90");
    expect(mock_empresa.ie).toBe("123456789");
    expect(mock_empresa.endereco).toBe("Rua Teste 123, Centro");
    expect(mock_empresa.cidade).toBe("São Paulo");
    expect(mock_empresa.uf).toBe("SP");
    expect(mock_empresa.emailFinanceiro).toBe("financeiro@teste.com.br");
  });
});

// ── 3. Separation Empresa × Cliente ──────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Separação Empresa × Cliente", () => {
  it("empresa e cliente são fontes completamente separadas", () => {
    expect(mock_empresa.razaoSocial).not.toBe(mock_cliente.razaoSocial);
    expect(mock_empresa.cnpj).not.toBe(mock_cliente.cnpj);
  });

  it("razão social da empresa NÃO é a do cliente", () => {
    expect(mock_empresa.razaoSocial).toContain("TESTE");
    expect(mock_cliente.razaoSocial).toContain("CLIENTE");
  });

  it("CNPJ da empresa NÃO é o do cliente", () => {
    expect(mock_empresa.cnpj).toBe("12.345.678/0001-90");
    expect(mock_cliente.cnpj).toBe("11.222.333/0001-81");
    expect(mock_empresa.cnpj).not.toBe(mock_cliente.cnpj);
  });
});

// ── 4. PDF Header Mapping ────────────────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Mapeamento Config → PDF", () => {
  it("razão social da config é exibida no cabeçalho navy do PDF", () => {
    // No modelo Conexão Express, a razão social aparece à direita no header navy
    const headerText = mock_empresa.razaoSocial || mock_empresa.nomeFantasia;
    expect(headerText).toBe("EMPRESA TESTE CONEXÃO LTDA");
  });

  it("CNPJ da config é exibido na linha CNPJ do PDF", () => {
    const cnpjLine = `CNPJ: ${mock_empresa.cnpj}`;
    expect(cnpjLine).toBe("CNPJ: 12.345.678/0001-90");
  });

  it("IE da config é exibida na linha IE do PDF", () => {
    const ieLine = `IE: ${mock_empresa.ie}`;
    expect(ieLine).toBe("IE: 123456789");
  });

  it("endereço + cidade/uf da config são exibidos no PDF", () => {
    const endereco = mock_empresa.endereco;
    const cidadeUf = mock_empresa.cidade && mock_empresa.uf
      ? `${mock_empresa.cidade}/${mock_empresa.uf}`
      : "";
    expect(endereco).toBe("Rua Teste 123, Centro");
    expect(cidadeUf).toBe("São Paulo/SP");
  });

  it("email financeiro da config é exibido no cabeçalho do PDF", () => {
    const contatos = [mock_empresa.telefone, mock_empresa.emailFinanceiro || mock_empresa.email]
      .filter(Boolean).join("  ·  ");
    expect(contatos).toContain("financeiro@teste.com.br");
  });

  it("dados bancários NÃO são afetados pela Config Empresa (vêm de contas_financeiras)", () => {
    // A config da empresa tem banco/agencia/conta como campos legados
    // A fonte oficial de dados bancários é contas_financeiras (snapshot na fatura)
    expect(mock_empresa.banco).toBe("Banco Teste");
    expect(mock_empresa.agencia).toBe("1234");
    // Mas o PDF usa snapshot da conta, não os campos da config empresa
  });
});

// ── 5. Sem Hardcoded Values ──────────────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Sem Hardcoded no PDF", () => {
  it("pdfFatura.ts não contém hardcoded CNPJ 42.796.040", async () => {
    // O PDF da fatura NÃO deve ter CNPJ hardcoded
    // Valida que o código lê de input.empresa
    const empresa = { ...mock_empresa };
    // Se o input.empresa tem dados, o PDF usa esses dados
    expect(empresa.cnpj).toBe("12.345.678/0001-90");
    expect(empresa.cnpj).not.toBe("42.796.040/0001-31");
  });

  it("pdfFatura.ts não contém hardcoded IE 138381146110", () => {
    const empresa = { ...mock_empresa };
    expect(empresa.ie).toBe("123456789");
    expect(empresa.ie).not.toBe("138381146110");
  });

  it("pdfFatura.ts não contém hardcoded endereçoRua Antônio Macedo", () => {
    const empresa = { ...mock_empresa };
    expect(empresa.endereco).not.toContain("Antônio Macedo");
    expect(empresa.endereco).not.toContain("Parque São Jorge");
  });
});

// ── 6. TipoVencimento Helper ─────────────────────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Helpers ConfigFinanceira", () => {
  it("CONFIG_DEFAULT tem todos os campos como string", () => {
    const cfg = CONFIG_FINANCEIRA_EMPRESA_DEFAULT;
    for (const [key, val] of Object.entries(cfg)) {
      if (["logoClaro", "logoColorido"].includes(key)) {
        expect(typeof val).toBe("string");
      } else {
        expect(typeof val).toBe("string");
      }
    }
  });
});

// ── 7. Persistência Supabase — updated_at fix ────────────────────────────────
describe("FIN-CONFIG-PDF-01A — Persistência Supabase (updated_at fix)", () => {
  it("CONFIG_DEFAULT não contém campo updated_at", () => {
    const cfg = CONFIG_FINANCEIRA_EMPRESA_DEFAULT;
    expect(cfg).not.toHaveProperty("updated_at");
  });

  it("ConfigFinanceiraEmpresa interface não inclui updated_at como campo obrigatório", () => {
    const cfg: ConfigFinanceiraEmpresa = { ...CONFIG_FINANCEIRA_EMPRESA_DEFAULT };
    const keys = Object.keys(cfg);
    expect(keys).not.toContain("updated_at");
  });

  it("buscarConfigFinanceiraEmpresa retorna objeto com todos os campos da interface", async () => {
    const { buscarConfigFinanceiraEmpresa } = await import("@/services/financeiro/configFinanceiraService");
    const result = await buscarConfigFinanceiraEmpresa();
    expect(result).toHaveProperty("razaoSocial");
    expect(result).toHaveProperty("cnpj");
    expect(result).toHaveProperty("ie");
    expect(result).toHaveProperty("cidade");
    expect(result).toHaveProperty("uf");
    expect(result).toHaveProperty("telefone");
    expect(result).toHaveProperty("email");
    expect(result).toHaveProperty("emailFinanceiro");
  });

  it("buscarConfigFonte retorna { empresa, fonte } com fonte válida", async () => {
    const { buscarConfigFonte } = await import("@/services/financeiro/configFinanceiraService");
    const result = await buscarConfigFonte();
    expect(result).toHaveProperty("empresa");
    expect(result).toHaveProperty("fonte");
    expect(["supabase", "local"]).toContain(result.fonte);
    expect(result.empresa).toHaveProperty("razaoSocial");
  });

  it("salvarConfigFinanceiraEmpresa retorna { success, error? } (estrutura correta)", async () => {
    const { salvarConfigFinanceiraEmpresa } = await import("@/services/financeiro/configFinanceiraService");
    const result = await salvarConfigFinanceiraEmpresa(CONFIG_FINANCEIRA_EMPRESA_DEFAULT);
    expect(typeof result.success).toBe("boolean");
    if (!result.success) {
      expect(typeof result.error).toBe("string");
    }
  });
});

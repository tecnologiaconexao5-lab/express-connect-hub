/**
 * MELHORIA-OS-CLIENTE-PRECADASTRO — horário da solicitação, contato do
 * cliente no preview e gestão do status pré-cadastro (Cotação Express).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatarDataHoraSolicitacaoBR } from "@/lib/formatDates";
import { normalizarStatusCliente, rotuloStatusCliente } from "@/lib/clienteStatus";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const LISTA_OS = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const PREVIEW = readSrc("src/components/operacao/OrdemServicoPreview.tsx");
const FORM_OS = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const LISTA_CLIENTES = readSrc("src/components/clientes/ClientesLista.tsx");
const DETALHE_CLIENTE = readSrc("src/components/clientes/ClienteDetalhe.tsx");

describe("1) Horário exato da solicitação na lista de OS", () => {
  it("formata timestamp no padrão '01/11/2026 às 14h30'", () => {
    expect(formatarDataHoraSolicitacaoBR("2026-11-01T17:30:00Z")).toBe("01/11/2026 às 14h30");
    expect(formatarDataHoraSolicitacaoBR(null)).toBe("");
  });

  it("a coluna Nº OS exibe a data e a linha 'Solicitada ...'", () => {
    expect(LISTA_OS).toContain("formatarDataHoraSolicitacaoBR");
    expect(LISTA_OS).toContain("Solicitada");
    expect(LISTA_OS).toContain("{safeFormatDate(os.data)}");
    expect(LISTA_OS).toContain("createdAt: item.created_at as string | undefined");
  });
});

describe("2) Preview da OS: horário da solicitação + telefone/WhatsApp", () => {
  it("mostra a linha exclusiva de Solicitação", () => {
    expect(PREVIEW).toContain('label="Solicitação"');
    expect(PREVIEW).toContain("formatarDataHoraSolicitacaoBR(os.createdAt)");
  });

  it("resolve telefone/whatsapp do cliente e usa fallback da observação da cotação", () => {
    expect(PREVIEW).toContain("telefone, whatsapp");
    expect(PREVIEW).toContain('label="Telefone / WhatsApp"');
    expect(PREVIEW).toContain("clienteWhatsapp");
    expect(PREVIEW).toContain("clienteTelefone");
    expect(PREVIEW).toContain("telefoneDaObservacao");
    expect(PREVIEW).toContain("WhatsApp:");
    expect(PREVIEW).toContain("os.observacoesGerais");
  });
});

describe("3) Gestão do status pré-cadastro", () => {
  it("normaliza e rotula os status aceitos", () => {
    expect(normalizarStatusCliente("Ativo")).toBe("ativo");
    expect(normalizarStatusCliente("inativo")).toBe("inativo");
    expect(normalizarStatusCliente("pre-cadastro")).toBe("pre-cadastro");
    expect(normalizarStatusCliente("Pré-cadastro")).toBe("pre-cadastro");
    expect(rotuloStatusCliente("pre-cadastro")).toBe("Pré-cadastro");
    expect(rotuloStatusCliente(undefined)).toBe("Ativo");
  });

  it("ClienteDetalhe permite alterar o status manualmente", () => {
    expect(DETALHE_CLIENTE).toContain("Status do Cadastro");
    expect(DETALHE_CLIENTE).toContain("STATUS_CLIENTE_OPCOES");
    expect(DETALHE_CLIENTE).toContain("normalizarStatusCliente(c.status)");
    expect(DETALHE_CLIENTE).toContain('handleChange("status", v)');
    expect(DETALHE_CLIENTE).toContain("Pré-cadastro gerado pela Cotação Express");
  });

  it("ClientesLista exibe 'Pré-cadastro' (badge âmbar) em vez do valor cru", () => {
    expect(LISTA_CLIENTES).toContain("rotuloStatusCliente(row.status)");
    expect(LISTA_CLIENTES).toContain("bg-amber-100 text-amber-800 border-amber-200");
    expect(LISTA_CLIENTES).toContain("classeBadgeStatus(c.status)");
  });
});

describe("4) Nova OS lista clientes pré-cadastrados", () => {
  it("filtro do seletor inclui ativo (legado) e pre-cadastro", () => {
    expect(FORM_OS).toContain("STATUS_CLIENTES_SELECIONAVEIS");
    expect(FORM_OS).toContain("const FILTRO_CLIENTES_OS_DESKTOP = { status: STATUS_CLIENTES_SELECIONAVEIS };");
    expect(FORM_OS).toContain("filters={FILTRO_CLIENTES_OS_DESKTOP}");
  });
});

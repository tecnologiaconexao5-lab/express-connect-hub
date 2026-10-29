// ============================================================
// REFINAMENTOS COMERCIAL/OPERAÇÃO
// Badge de cliente da cotação, fuso America/Sao_Paulo, paginação
// explícita, modal estático, paradas e timeline do preview.
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/formatDates";
import { clienteVeioDeCotacao } from "@/lib/clienteCotacao";

const raiz = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(raiz, p), "utf8");

const orcamentos = read("src/components/comercial/OrcamentosLista.tsx");
const osLista = read("src/components/operacao/OrdensServicoLista.tsx");
const osForm = read("src/components/operacao/OrdemServicoForm.tsx");
const osPreview = read("src/components/operacao/OrdemServicoPreview.tsx");
const operacao = read("src/pages/Operacao.tsx");
const pagination = read("src/components/ui/PaginationBar.tsx");
const enterprise = read("src/components/ui/enterprise.tsx");

describe("A) Fuso horário America/Sao_Paulo", () => {
  it("datas puras não deslocam o dia", () => {
    expect(formatarDataBR("2026-10-29")).toBe("29/10/2026");
  });

  it("timestamps UTC são convertidos para o fuso de São Paulo", () => {
    // 29/10 02:00 UTC = 28/10 23:00 em America/Sao_Paulo
    expect(formatarDataBR("2026-10-29T02:00:00Z")).toBe("28/10/2026");
    expect(formatarDataHoraBR("2026-10-29T02:00:00Z")).toContain("28/10/2026");
    expect(formatarDataHoraBR("2026-10-29T02:00:00Z")).toContain("23:00");
  });

  it("listagens usam o helper de data (sem new Date(date-only))", () => {
    expect(orcamentos).toContain("formatarDataBR(orc.dataEmissao)");
    expect(osLista).toContain("formatarDataBR(dateStr)");
    expect(osPreview).toContain("formatarDataBR(data)");
  });
});

describe("B) Badge Cliente Cotação", () => {
  it("helper identifica pré-cadastro, pedido interno e observações da cotação", () => {
    expect(clienteVeioDeCotacao({ clienteStatus: "pre-cadastro" })).toBe(true);
    expect(clienteVeioDeCotacao({ clienteOrigemComercial: "Cotação Express" })).toBe(true);
    expect(
      clienteVeioDeCotacao({ pedidoInterno: "11111111-1111-4111-8111-111111111111" }),
    ).toBe(true);
    expect(clienteVeioDeCotacao({ observacoes: "Cotação web (Fase 2)" })).toBe(true);
    expect(clienteVeioDeCotacao({ pedidoInterno: "PED-123" })).toBe(false);
    expect(clienteVeioDeCotacao({ clienteStatus: "ativo" })).toBe(false);
  });

  it("Orçamentos e OS exibem a tag ao lado do cliente", () => {
    expect(orcamentos).toContain("clienteVeioDeCotacao");
    expect(orcamentos).toContain("Cliente Cotação");
    expect(osLista).toContain("clienteVeioDeCotacao");
    expect(osLista).toContain("Cliente Cotação");
    expect(osPreview).toContain("Cliente Cotação");
  });
});

describe("C) Listagem de OS — ordenação e paginação", () => {
  it("ordena sempre por created_at DESC", () => {
    expect(osLista).toContain('.order("created_at", { ascending: false })');
  });

  it("renderiza a paginação com o texto explícito Página X de Y", () => {
    expect(osLista).toContain("<PaginationBar");
    expect(osLista).toContain("totalCount={totalCount}");
    expect(pagination).toContain("Página ${page} de ${totalPages}");
  });

  it("refaz a busca ao trocar de página", () => {
    expect(osLista).toContain("void fetchOrdens();");
    expect(osLista).toContain("}, [page]);");
  });
});

describe("D) Modal de Nova OS/Edição estático", () => {
  it("a aba de OS permanece montada ao trocar de aba interna", () => {
    expect(operacao).toContain('<TabsContent value="os" forceMount>');
  });

  it("o modal não fecha por clique fora e só sai por Voltar/X com confirmação", () => {
    expect(enterprise).toContain('role="dialog"');
    expect(enterprise).toContain("onPointerDown={(e) => e.stopPropagation()}");
    expect(osForm).toContain("const handleVoltar = async () => {");
    expect(osForm).toContain("exitGuard.confirmExit()");
    expect(osForm).toContain("PremiumDialogHeader onClose={handleVoltar}");
  });
});

describe("E) Paradas — tipo padrão e nova opção", () => {
  it("nova parada nasce como Entrega", () => {
    expect(osForm).toContain('emptyEnd("entrega")');
  });

  it("dropdown oferece Entrega e Retirada", () => {
    expect(osForm).toContain('<SelectItem value="entrega_retirada">Entrega e Retirada</SelectItem>');
    expect(osForm).toContain("entrega_retirada");
  });

  it("validação aceita entrega_retirada como coleta e entrega", () => {
    expect(osForm).toContain('e.tipo === "entrega_retirada"');
  });
});

describe("F) Preview da OS — timeline de rastreio", () => {
  it("renderiza a timeline no topo com os 5 passos", () => {
    expect(osPreview).toContain("<TimelineRastreio status={os.status} />");
    expect(osPreview).toContain('label: "Pendente"');
    expect(osPreview).toContain('label: "Alocado"');
    expect(osPreview).toContain('label: "Coletado"');
    expect(osPreview).toContain('label: "Em Trânsito"');
    expect(osPreview).toContain('label: "Entregue"');
  });

  it("destaca o passo atual e trata OS cancelada", () => {
    expect(osPreview).toContain("const ativo = !cancelada && i === idx;");
    expect(osPreview).toContain("ring-4 ring-orange-100");
    expect(osPreview).toContain('s === "cancelada"');
  });
});

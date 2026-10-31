// ============================================================
// SOLICITACOES CLIENTE — filtro exclusivo de origem externa
// + alerta de SLA nas listagens de OS e Solicitacoes.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { emRiscoSlaPendente } from "@/services/operacao/osAlocacaoPendenteService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const solicitacoesSrc = readSrc("src/components/operacao/SolicitacoesClienteLista.tsx");
const ordensSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");

describe("A) Fila de Solicitacoes Cliente — somente origens externas", () => {
  it("A.1 consulta OS externas por Cotacao Express e Pedido do Portal", () => {
    expect(solicitacoesSrc).toContain('.from("ordens_servico")');
    expect(solicitacoesSrc).toContain('.not("carga->>origem_cotacao", "is", null)');
    expect(solicitacoesSrc).toContain('.not("pedido_portal_id", "is", null)');
    expect(solicitacoesSrc).toContain('.from("portal_pedidos")');
    expect(solicitacoesSrc).toContain('.is("os_vinculada_id", null)');
  });

  it("A.2 so aceita as 3 origens permitidas (nao lista OS interna)", () => {
    expect(solicitacoesSrc).toContain('"cotacao_express"');
    expect(solicitacoesSrc).toContain('"painel_cliente"');
    expect(solicitacoesSrc).toContain('"app_cliente"');
    expect(solicitacoesSrc).toContain("const normalizarOrigem");
    expect(solicitacoesSrc).toContain('v.includes("cota")');
    // Pedido sem flag de origem permitida e descartado da fila.
    expect(solicitacoesSrc).toContain("if (!origem) return null;");
  });

  it("A.3 exibe badge de origem em cada linha", () => {
    expect(solicitacoesSrc).toContain("ORIGEM_INFO[s.origem]");
    expect(solicitacoesSrc).toContain("Cotação Express");
    expect(solicitacoesSrc).toContain("Painel do Cliente");
    expect(solicitacoesSrc).toContain("App do Cliente");
  });
});

describe("B) Alerta de SLA — Pendente / Aguardando Programacao", () => {
  it("B.1 helper marca atraso somente para status pendentes apos o limite", () => {
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    expect(emRiscoSlaPendente("pendente", tresHorasAtras)).toBe(true);
    expect(emRiscoSlaPendente("aguardando_programacao", tresHorasAtras)).toBe(true);
    expect(emRiscoSlaPendente("enviado", tresHorasAtras)).toBe(true);
    expect(emRiscoSlaPendente("pendente", trintaMinAtras)).toBe(false);
    expect(emRiscoSlaPendente("finalizada", tresHorasAtras)).toBe(false);
    expect(emRiscoSlaPendente("pendente", null)).toBe(false);
  });

  it("B.2 Ordens de Servico usam o helper, destacam a linha e exibem o badge", () => {
    expect(ordensSrc).toContain("emRiscoSlaPendente");
    expect(ordensSrc).toContain("const riscoSlaPendente = emRiscoSlaPendente(");
    expect(ordensSrc).toContain("(os as OSComDataCriacao).createdAt");
    expect(ordensSrc).toContain("semPrestador || riscoSlaPendente");
    expect(ordensSrc).toContain("Atraso/Risco de SLA");
  });

  it("B.3 Solicitacoes Cliente tambem destacam risco e badge piscante", () => {
    expect(solicitacoesSrc).toContain("emRiscoSlaPendente(");
    expect(solicitacoesSrc).toContain("border-l-4 border-l-red-500 bg-red-50/70");
    expect(solicitacoesSrc).toContain("animate-pulse");
    expect(solicitacoesSrc).toContain("Atraso/Risco de SLA");
  });
});

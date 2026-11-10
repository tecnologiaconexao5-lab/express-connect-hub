// ============================================================
// INSTRUÇÃO CIRÚRGICA 2/3 — TMS WEB (Painel e Torre)
// 7 correções: fuso, casas decimais, pedágio moto, WhatsApp,
// status Alocado no aceite, auto-refresh e contadores/ícones.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { agoraSaoPauloISO, formatarDataBR, formatarDataHoraBR } from "@/lib/formatDates";
import { formatarDistanciaKm } from "@/lib/formatNumbers";
import { estimarPedagio } from "@/lib/pedagioEstimativa";
import { gerarMensagemWhatsAppMotoboy } from "@/lib/osWhatsAppMessage";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("1) Fuso America/Sao_Paulo na gravação/exibição", () => {
  it("1.1 agoraSaoPauloISO gera datetime NAIVE no offset UTC-3", () => {
    const valor = agoraSaoPauloISO();
    expect(valor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    // A hora gerada deve ser a de São Paulo (Intl), não UTC.
    const esperado = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    expect(valor.slice(0, 10)).toBe(esperado);
  });

  it("1.2 mappers/services da OS não gravam created_at em UTC", () => {
    const mappers = readSrc("src/lib/dbMappers.ts");
    const service = readSrc("src/services/ordemServicoService.ts");
    expect(mappers).toContain("agoraSaoPauloISO()");
    expect(service).toContain("agoraSaoPauloISO()");
    expect(service).toContain("hojeISOSP()");
  });

  it("1.3 data pura de emissão não desloca o dia", () => {
    expect(formatarDataBR("2026-11-09")).toBe("09/11/2026");
    expect(formatarDataHoraBR("2026-11-09T23:50:17Z")).toBe("09/11/2026, 20:50");
  });
});

describe("2) Distância com 1 casa decimal", () => {
  it("2.1 formata 108.741547000 como 108,7", () => {
    expect(formatarDistanciaKm(108.741547)).toBe("108,7");
    expect(formatarDistanciaKm("108.741547000")).toBe("108,7");
    expect(formatarDistanciaKm(0)).toBe("0,0");
  });

  it("2.2 as telas da OS usam o helper (sem número cru)", () => {
    const form = readSrc("src/components/operacao/OrdemServicoForm.tsx");
    const preview = readSrc("src/components/operacao/OrdemServicoPreview.tsx");
    expect(form).toContain("formatarDistanciaKm(");
    expect(preview).toContain("formatarDistanciaKm(os.distanciaKm)");
  });
});

describe("3) Pedágio moto = R$ 0 (trava rígida)", () => {
  it("3.1 estimarPedagio devolve 0 para moto", () => {
    const r = estimarPedagio(100, "moto");
    expect(r.valor).toBe(0);
    expect(r.pracas).toBe(0);
  });

  it("3.2 aplicarPedagioDaRota força zero para moto", () => {
    const form = readSrc("src/components/operacao/OrdemServicoForm.tsx");
    expect(form).toContain('toLowerCase().includes("moto")');
    expect(form).toContain('pedagio: 0');
  });
});

describe("4) WhatsApp sem mojibake e cabeçalho em negrito", () => {
  it("4.1 emojis literais e cabeçalho Origem ━➤ Destino em negrito", () => {
    const msg = gerarMensagemWhatsAppMotoboy({
      veiculoTipo: "moto",
      enderecos: [
        { sequencia: 1, tipo: "coleta", bairro: "Centro", cidade: "São Paulo", cep: "01001000" },
        { sequencia: 2, tipo: "entrega", bairro: "Jardim", cidade: "Campinas", cep: "13010000" },
      ],
      distanciaKm: 108.741547,
    });
    expect(msg).toContain("🏍️");
    expect(msg).toContain("*Centro ━➤ Jardim*");
    expect(msg).not.toContain("\uFFFD");
  });
});

describe("5) Aceite muda a OS para Alocado", () => {
  it("5.1 aceitarAlocacao sincroniza ordens_servico.status = agendada", () => {
    const service = readSrc("src/services/escala/escalaService.ts");
    expect(service).toContain('status: \'agendada\'');
    expect(service).toContain("['rascunho', 'em_analise', 'pendente']");
  });
});

describe("6) Torre com auto-refresh (sem F5)", () => {
  it("6.1 setInterval periódico + clearInterval no unmount", () => {
    const torre = readSrc("src/pages/TorreControle.tsx");
    expect(torre).toContain("setInterval(() => {");
    expect(torre).toContain("clearInterval(refreshInterval)");
    expect(torre).toContain("30000");
  });
});

describe("7) Contadores e ícones da Torre", () => {
  it("7.1 KPI Em Rota usa alocações reais (não fica 0 sem GPS)", () => {
    const torre = readSrc("src/pages/TorreControle.tsx");
    expect(torre).toContain("alocPorOS");
    expect(torre).toContain("stats.emRota");
    expect(torre).toContain("Math.max(");
  });

  it("7.2 ícone do marcador respeita veiculo_tipo (moto)", () => {
    const mapa = readSrc("src/components/MapboxMap.tsx");
    expect(mapa).toContain("getVehicleIcon");
    expect(mapa).toContain("Bike");
    expect(mapa).toContain('t.includes("moto")');
  });

  it("7.3 listagem de OS mostra ícone do veículo", () => {
    const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
    expect(lista).toContain("IconeVeiculo");
    expect(lista).toContain("Bike");
  });
});

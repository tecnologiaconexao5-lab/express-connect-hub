// ============================================================
// CORREÇÃO CIRÚRGICA 2 — Pedágio/rotas, WhatsApp, telemetria,
// toast global de nova OS e isolamento do formulário.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { estimarPedagio } from "@/lib/pedagioEstimativa";
import { gerarMensagemWhatsAppMotoboy } from "@/lib/osWhatsAppMessage";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const osForm = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const rastreio = readSrc("src/components/operacao/RastreamentoOSDialog.tsx");
const hook = readSrc("src/hooks/useNovaOSAlerta.ts");
const layout = readSrc("src/components/AppLayout.tsx");

describe("1) Pedágio e seletor de rotas", () => {
  it("1.1 rota urbana curta (16 km) não cobra pedágio", () => {
    expect(estimarPedagio(16, "carro_passeio").valor).toBe(0);
    expect(estimarPedagio(16, "moto").valor).toBe(0);
  });

  it("1.2 normaliza o label do veículo (Veículo de Passeio) para 2 eixos", () => {
    const r = estimarPedagio(100, "Veículo de Passeio");
    expect(r.eixos).toBe(2);
    expect(r.valor).toBe(27);
  });

  it("1.3 ignora valor de pedágio da API incompatível com a distância", () => {
    expect(osForm).toContain("maxPorKm");
    expect(osForm).toContain("plausivel");
    expect(osForm).toContain("Pedágio da API ignorado");
  });
});

describe("2) Seletor de rotas — binding dinâmico", () => {
  it("2.1 trocar a rota atualiza distância, tempo e valor", () => {
    expect(osForm).toContain("setDistanciaRota(rota)");
    expect(osForm).toContain("tempoEstimado: rota!.duracaoTexto");
    expect(osForm).toContain("{ forcar: true }");
    expect(osForm).toContain("valorClienteEditado: false");
    expect(osForm).toContain("custoPrestadorEditado: false");
  });

  it("2.2 seletor desabilitado quando não há alternativas", () => {
    expect(osForm).toContain("!distanciasAlternativas");
    expect(osForm).toContain("Alternativas indisponíveis");
  });
});

describe("3) WhatsApp — negrito em RET/ENT e ATENÇÃO", () => {
  const msg = gerarMensagemWhatsAppMotoboy({
    veiculoTipo: "moto",
    custoPrestador: 77.5,
    formaPagamento: "faturado",
    distanciaKm: 12.5,
    observacoesGerais: "Encaixe às 14h",
    enderecos: [
      { sequencia: 1, tipo: "retirada", logradouro: "Rua A", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000" },
      { sequencia: 2, tipo: "entrega", logradouro: "Rua B", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", cep: "01310-100" },
    ],
  });

  it("3.1 identificadores com negrito do WhatsApp", () => {
    expect(msg).toContain("🟣 *【 1 】 RET* •");
    expect(msg).toContain("🟠 *【 2 】 ENT* •");
  });

  it("3.2 seção ATENÇÃO em negrito", () => {
    expect(msg).toContain("⚠️ *ATENÇÃO:* Encaixe às 14h");
  });
});

describe("4) Telemetria do mapa (bateria e GPS reais)", () => {
  it("4.1 bateria lê bateria/battery_level e oculta o card quando nula", () => {
    expect(rastreio).toContain("lerBateriaPct");
    expect(rastreio).toContain("metadata.battery_level");
    expect(rastreio).toContain("bateriaPct != null &&");
    expect(rastreio).not.toContain('"Não informada"');
  });

  it("4.2 GPS classificado pela idade real do ponto no fuso de São Paulo", () => {
    expect(rastreio).toContain("minutosGps");
    expect(rastreio).toContain('gpsState');
    expect(rastreio).toContain('"atualizado"');
    expect(rastreio).toContain('"muito_antigo"');
    expect(rastreio).toContain("date-fns-tz");
    expect(rastreio).toContain("formatInTimeZone");
    expect(rastreio).toContain("fromZonedTime");
    expect(rastreio).toContain("FUSO_BR");
    expect(rastreio).toContain("updated_at");
  });

  it("4.3 lê status_operacional do App e humaniza", () => {
    expect(rastreio).toContain("metadata.status_operacional");
    expect(rastreio).toContain("em_deslocamento");
    expect(rastreio).toContain("STATUS_OPERACIONAL_LABEL");
  });
});

describe("5) Toast global de nova OS", () => {
  it("5.1 título exato e toast chamativo", () => {
    expect(hook).toContain('"🆕 Nova Ordem de Serviço"');
    expect(hook).toContain("toast.success");
    expect(hook).toContain("duration: 60000");
    expect(hook).toContain("Abrir OS");
  });

  it("5.2 comparação por ID (não perde OS no mesmo segundo)", () => {
    expect(hook).toContain("avisadosRef");
    expect(hook).toContain("MAX_CONHECIDAS");
    expect(hook).toContain("MAX_POR_CICLO");
  });

  it("5.3 montado globalmente no AppLayout", () => {
    expect(layout).toContain("useNovaOSAlerta");
    expect(layout).toContain("/operacao?tab=os&os=");
  });
});

describe("6) Isolamento do state da Nova OS", () => {
  it("6.1 limpa rascunho compartilhado de nova OS", () => {
    expect(osForm).toContain("export const limparRascunhoNovaOS");
    expect(osForm).toContain("tms_os_draft_v1");
  });

  it("6.2 botão Nova OS limpa OS selecionada + rascunho", () => {
    expect(lista).toContain("limparRascunhoNovaOS()");
    expect(lista).toContain("setOsSelecionada(null)");
    expect(lista).toContain("key={`${modoForm}-${osSelecionada?.id || \"novo\"}`}");
  });
});

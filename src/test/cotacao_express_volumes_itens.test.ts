import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// ============================================================
// MISSÃO VOLUMES DO WIZARD /cotacao-express
// - etapa 3 com "Peso Total Estimado"
// - etapa 4 com lista dinâmica de itens/volumes (qtd + dims + peso/item)
// - motor cruza peso + cubagem total (moto em litros → carreta em m³)
// - "Peso por item" soma ao Peso Total Estimado da etapa anterior
// ============================================================

const fase1 = readFileSync("src/pages/CotacaoExpress.tsx", "utf-8");
const motor = readFileSync("src/lib/veiculoCotacao.ts", "utf-8");
const service = readFileSync("src/services/cotacoes/cotacaoPublicaService.ts", "utf-8");

// ------------------------------------------------------------
// A) Motor — volumes, cubagem total e cross-check em m³
// ------------------------------------------------------------
describe("A) Motor analisarCargaCotacao — volumes e cross-check m³", () => {
  it("A.1 — aceita lista de volumes (qtd × dims) além do legado A×L×P", () => {
    expect(motor).toContain("volumes?: VolumeCarga[]");
    expect(motor).toContain("interface VolumeCarga");
    expect(motor).toContain("qtd: number");
    expect(motor).toContain("alturaCm");
    expect(motor).toContain("larguraCm");
    expect(motor).toContain("profundidadeCm");
    // Legado A×L×P continua aceito (assinatura preservada)
    expect(motor).toContain("alturaCm?: number | null");
    expect(motor).toContain("temDimensoes");
  });

  it("A.2 — cubagem total = Σ(qtd × A×L×P/1000) e cruzada com a capacidade em m³", () => {
    expect(motor).toContain("CAPACIDADE_VEICULO_M3");
    expect(motor).toContain("ORDEM_CAPACIDADE");
    expect(motor).toContain("cubagemM3 = litros / 1000");
    // Tabela estritamente crescente até Carreta
    expect(motor).toContain("carreta: 70");
    expect(motor).toContain("truck: 35");
    expect(motor).toContain("vuc: 15");
    // Só eleva (nunca rebaixa); sem encaixe mantém o atual
    expect(motor).toContain("nunca rebaixa");
    expect(motor).toContain("indexOf(alvo) > rankAtual");
    // Motivo exposto na justificativa
    expect(motor).toContain("excede os");
    expect(motor).toContain("fmtM3");
  });

  it("A.3 — regras da moto (90/160 L) preservadas antes do cross-check", () => {
    expect(motor).toContain("BAU_MOTO_PADRAO_L");
    expect(motor).toContain('tipo = "fiorino"');
    expect(motor).toContain("cubagem acima da capacidade máxima de moto (>160 L)");
    // Mensagens contratuais intactas
    expect(motor).toContain(
      "Conforme peso e dimensões da sua mercadoria, o veículo indicado é: Moto.",
    );
    expect(motor).toContain("agendar com ao menos 24 horas de antecedência.");
  });

  it("A.4 — nome da Carreta e formatarCubagem (≥1000 L vira m³)", () => {
    expect(motor).toContain('carreta: "Carreta"');
    expect(motor).toContain("export function formatarCubagem");
    expect(motor).toContain("litros >= 1000");
  });
});

// ------------------------------------------------------------
// B) Página — etapa 3 "Peso Total Estimado" + soma do peso por item
// ------------------------------------------------------------
describe("B) CotacaoExpress — etapa 3 e soma do Peso por item", () => {
  it("B.1 — etapa 3 exibe 'Peso Total Estimado' e avisa a soma automática", () => {
    expect(fase1).toContain("Peso Total Estimado (em kg)? *");
    expect(fase1).toContain("soma dos itens");
    expect(fase1).toContain('id="cot-peso"');
  });

  it("B.2 — soma qtd × peso por item e atualiza o Peso Total Estimado", () => {
    expect(fase1).toContain("somaPesoItens");
    expect(fase1).toContain("pesoEfetivo");
    expect(fase1).toContain("setPeso(String(pesoEfetivo))");
    expect(fase1).toContain("Peso Total Estimado atualizado");
    // O motor recebe o peso efetivo (soma), não o digitado
    expect(fase1).toContain("pesoEfetivo > 0 ? pesoEfetivo : null");
  });
});

// ------------------------------------------------------------
// C) Página — etapa 4 lista dinâmica de itens/volumes
// ------------------------------------------------------------
describe("C) CotacaoExpress — etapa 4 lista dinâmica de itens/volumes", () => {
  it("C.1 — lista de itens com ids cot-vol-* e limite MAX_VOLUMES", () => {
    expect(fase1).toContain("MAX_VOLUMES");
    expect(fase1).toContain("itemVolumeVazio");
    expect(fase1).toContain("qtdEfetiva");
    expect(fase1).toContain("cot-vol-${idx}-qtd");
    expect(fase1).toContain("cot-vol-${idx}-alt");
    expect(fase1).toContain("cot-vol-${idx}-lar");
    expect(fase1).toContain("cot-vol-${idx}-prof");
    expect(fase1).toContain("cot-vol-${idx}-peso");
    // ids dinâmicos NÃO aparecem no regex do C.1 (template literal)
    expect(fase1).toContain('id={`cot-vol-${idx}-qtd`}');
  });

  it("C.2 — cada item tem Quantidade, Altura, Largura, Profundidade e Peso por item (opcional)", () => {
    expect(fase1).toContain("Quantidade");
    expect(fase1).toContain("Altura (cm)");
    expect(fase1).toContain("Largura (cm)");
    expect(fase1).toContain("Prof. (cm)");
    expect(fase1).toContain("Peso por item (kg) — opcional");
    expect(fase1).toContain("Item / volume");
  });

  it("C.3 — botão '+ Adicionar outro item/volume' com remoção por linha", () => {
    expect(fase1).toContain("Adicionar outro item/volume");
    expect(fase1).toContain("adicionarVolume");
    expect(fase1).toContain("removerVolume");
    expect(fase1).toContain("trocarVolume");
    expect(fase1).toContain("Limite de ${MAX_VOLUMES} itens/volumes por cotação.");
  });

  it("C.4 — subtítulo novo, cubagem total formatada e opt-out preservado", () => {
    expect(fase1).toContain(
      "Quais as dimensões de cada item/volume? (Altura, Largura e Profundidade)",
    );
    expect(fase1).toContain("formatarCubagem(litrosTotal)");
    expect(fase1).toContain("litrosTotal > 0");
    expect(fase1).toContain("Não sei as dimensões — indicar veículo só pelo peso");
    expect(fase1).toContain("avancarPularDimensoes");
  });

  it("C.5 — validação por linha com numeração e dimensoesTexto unindo os itens", () => {
    expect(fase1).toContain("do item ${i + 1}");
    expect(fase1).toContain("volumesAtivos");
    expect(fase1).toContain(".join(\"; \")");
    expect(fase1).toContain("dimensoesIgnoradas");
  });
});

// ------------------------------------------------------------
// D) Persistência — carga_volumes no payload e no service
// ------------------------------------------------------------
describe("D) Persistência de carga_volumes", () => {
  it("D.1 — página envia carga_volumes = Σ qtd dos itens ativos", () => {
    expect(fase1).toContain("carga_volumes: totalVolumes > 0 ? totalVolumes : null");
    expect(fase1).toContain("totalVolumes");
    expect(fase1).toContain(
      "volumesAtivos.reduce((soma, v) => soma + v.qtd, 0)",
    );
  });

  it("D.2 — service aceita e grava carga_volumes (coluna já existe)", () => {
    expect(service).toContain("carga_volumes?: number | null");
    expect(service).toContain("carga_volumes: input.carga_volumes ?? null");
    expect(service).toContain("carga_volumes:");
    // Normalizador preserva o valor lido do banco
    expect(service).toContain("row.carga_volumes === null");
  });
});

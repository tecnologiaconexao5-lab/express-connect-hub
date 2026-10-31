// ============================================================
// COTAÇÃO EXPRESS — Confirmação do pedido via WhatsApp
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  montarMensagemConfirmacaoCotacao,
  linkConfirmacaoWhatsApp,
} from "@/lib/cotacaoWhatsApp";
import type { CotacaoPublica } from "@/services/cotacoes/cotacaoPublicaService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const detalhes = readSrc("src/pages/CotacaoExpressDetalhes.tsx");

const cotacao: CotacaoPublica = {
  id: "cot-1",
  status: "Pronto para OS",
  nome_cliente: "Maria Silva",
  telefone: "(11) 98888-7777",
  carga_descricao: "Caixas de documentos",
  carga_peso: 12,
  carga_dimensoes: "40x40x40 cm",
  carga_volumes: null,
  paradas: [
    { sequencia: 1, tipo: "retirada", endereco: "Rua A, 100 - São Paulo/SP" },
    { sequencia: 2, tipo: "entrega", endereco: "Rua B, 200 - Campinas/SP" },
    { sequencia: 3, tipo: "entrega", endereco: "Rua C, 300 - Jundiaí/SP" },
  ],
  data_desejada: "2026-11-15",
  hora_desejada: "09:00 às 11:00",
  detalhes: [],
  orcamento_id: null,
  valor_aprovado: 1234.5,
  metadata: {
    precificacao: {
      valor: 1234.5,
      moeda: "BRL",
      distancia_km: 98.4,
      duracao_min: 120,
      tipo_veiculo: "fiorino",
      rotulo_veiculo: "Fiorino",
      paradas: 3,
      fonte: "tabela_local",
      tabela: "Tabela padrão SP",
      formula: {
        valorBase: 200,
        franquiaKm: 10,
        kmExcedente: 88.4,
        valorKmExcedente: 10,
        acrescimoParadasExtras: 40,
      },
      aviso: "Valor estimado",
      calculado_em: "2026-10-31T12:00:00Z",
    },
  },
};

describe("A) Mensagem de confirmação do pedido", () => {
  it("A.1 monta exatamente a estrutura solicitada com dados reais", () => {
    const mensagem = montarMensagemConfirmacaoCotacao(cotacao);
    expect(mensagem).toBe(
      [
        "Olá, fiz uma cotação no sistema e quero formalizar o meu pedido:",
        "*Nome:* Maria Silva",
        "*Telefone:* (11) 98888-7777",
        "*Veículo:* Fiorino",
        "*Valor:* R$ 1.234,50",
        "*Data:* 15/11/2026",
        "*Horário:* Das 09:00 às 11:00",
        "*Coleta:* Rua A, 100 - São Paulo/SP",
        "*Entrega:* Rua B, 200 - Campinas/SP | Rua C, 300 - Jundiaí/SP",
      ].join("\n"),
    );
  });

  it("A.2 gera link wa.me com encodeURIComponent", () => {
    const link = linkConfirmacaoWhatsApp(cotacao, "5511999999999");
    expect(link).toContain("https://wa.me/5511999999999?text=");
    expect(link).toContain(encodeURIComponent(montarMensagemConfirmacaoCotacao(cotacao)));
  });
});

describe("B) UI da tela final", () => {
  it("B.1 exibe o botão grande verde e abre em nova aba", () => {
    expect(detalhes).toContain("Confirmar Pedido via WhatsApp");
    expect(detalhes).toContain("bg-[#25D366]");
    expect(detalhes).toContain(`target="_blank"`);
    expect(detalhes).toContain(`rel="noopener noreferrer"`);
    expect(detalhes).toContain("linkConfirmacao");
    expect(detalhes).toContain("MENSAGEM_CONCLUSAO");
  });
});

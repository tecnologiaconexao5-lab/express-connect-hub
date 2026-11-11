// ============================================================
// INSTRUÇÃO CIRÚRGICA 4 — Regressões da criação da OS, formatação
// de municípios, cor do alerta, duplicidade da Rede e abas.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  municipioComSigla,
  municipioComSiglaDeTexto,
  rotuloPontoRotaDetalhado,
} from "@/lib/resumoRotaOS";
import { gerarMensagemWhatsAppMotoboy } from "@/lib/osWhatsAppMessage";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const osForm = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const resumo = readSrc("src/lib/resumoRotaOS.ts");
const whatsapp = readSrc("src/lib/osWhatsAppMessage.ts");
const alertas = readSrc("src/hooks/useOSSiteAlerts.ts");
const rede = readSrc("src/services/operacao/redePrestadoresService.ts");
const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const sheet = readSrc("src/components/torre-controle/DetalhesOperacaoSheet.tsx");
const osService = readSrc("src/services/ordemServicoService.ts");
const formatDates = readSrc("src/lib/formatDates.ts");

describe("1) Numeração da OS só é consumida ao Salvar", () => {
  it("não gera número na montagem (sem efeito void gerarNumeroOS)", () => {
    expect(osForm).not.toContain("void gerarNumeroOS()");
    expect(osForm).not.toContain('modo !== "novo"');
  });

  it("gera o número dentro do fluxo de salvar (clique em Salvar OS)", () => {
    expect(osForm).toContain("let numeroFinal = data.numero");
    expect(osForm).toContain("numeroFinal = await gerarNumeroOS()");
    expect(osForm).toContain("sanitizedPayload.numero = numeroFinal");
    expect(osForm).toContain("numeroSequencialBuscado");
  });
});

describe("2) Municípios no formato Município (Sigla)", () => {
  it("formata endereço estruturado e texto livre", () => {
    expect(
      municipioComSigla({ cidade: "São Caetano do Sul", uf: "SP" }),
    ).toBe("São Caetano do Sul (SCS)");
    expect(municipioComSiglaDeTexto("Taboão, Taboão da Serra - SP")).toBe(
      "Taboão da Serra (TAB)",
    );
  });

  it("cabeçalho do WhatsApp usa município, não bairro", () => {
    const msg = gerarMensagemWhatsAppMotoboy({
      veiculoTipo: "Moto",
      enderecos: [
        { sequencia: 1, tipo: "coleta", cidade: "São Caetano do Sul", bairro: "Santa Maria", estado: "SP" },
        { sequencia: 2, tipo: "entrega", cidade: "Diadema", bairro: "Taboão", estado: "SP" },
      ],
      distanciaKm: 12,
    });
    expect(msg).toContain("*São Caetano do Sul (SCS) ━➤ Diadema (DIA)*");
    expect(msg).not.toContain("*Santa Maria ━➤ Taboão*");
    expect(resumo).toContain("export function municipioComSigla");
    expect(whatsapp).toContain("municipioComSigla");
  });
});

describe("3) Alerta de nova oportunidade em verde sólido", () => {
  it("usa toast.success com #10B981 em vez de toast.error vermelho", () => {
    expect(alertas).toContain("#10B981");
    expect(alertas).toContain("toast.success");
    expect(alertas).not.toContain("toast.error(");
  });
});

describe("4) Duplicidade da Rede com mensagem amigável", () => {
  it("captura 23505/duplicate key e devolve a mensagem amigável", () => {
    expect(rede).toContain("MSG_REDE_JA_EXISTE");
    expect(rede).toContain("Esta OS já está na rede de prestadores");
    expect(rede).toContain("23505");
    expect(rede).toContain("duplicate key|unique constraint");
  });

  it("os toasts da Rede não exibem o erro técnico", () => {
    expect(lista).toContain("MSG_REDE_JA_EXISTE");
    expect(osForm).toContain("MSG_REDE_JA_EXISTE");
  });
});

describe("6) Sequenciador sem random e timezone date-fns-tz", () => {
  it("gera o número pelo maior existente + 1 (sem Math.random)", () => {
    expect(osService).toContain("f_proximo_numero_os_sequencial");
    expect(osService).not.toContain("Math.random");
    expect(osService).toContain("maior + 1");
    // O formulário também não pode gerar número aleatório/provisório.
    expect(osForm).not.toContain("Math.random");
    expect(osForm).toContain('numero: "",');
  });

  it("conversão visual usa date-fns-tz America/Sao_Paulo", () => {
    expect(formatDates).toContain('from "date-fns-tz"');
    expect(formatDates).toContain("formatInTimeZone");
    expect(formatDates).toContain("fromZonedTime");
    expect(formatDates).toContain("America/Sao_Paulo");
  });

  it("não repete o município (São Paulo São Paulo → São Paulo (SAO))", () => {
    expect(municipioComSigla({ cidade: "São Paulo São Paulo", uf: "SP" })).toBe(
      "São Paulo (SAO)",
    );
    expect(municipioComSiglaDeTexto("São Paulo São Paulo - SP")).toBe(
      "São Paulo (SAO)",
    );
    expect(
      rotuloPontoRotaDetalhado({ bairro: "São Paulo", cidade: "São Paulo", uf: "SP" }),
    ).toBe("São Paulo");
  });
});

describe("5) Estabilidade do cabeçalho nas abas Geral/Programação", () => {
  it("cabeçalho fixo com um único scroll e reset para a aba Geral", () => {
    expect(sheet).toContain("overflow-hidden p-0");
    expect(sheet).toContain("sticky top-0 z-20");
    expect(sheet).toContain('setTab("visao-geral")');
    expect(sheet).toContain("flex-1 overflow-y-auto");
  });
});

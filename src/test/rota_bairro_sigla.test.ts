// ============================================================
// ROTA COM BAIRRO — extração estrita do bairro no padrão brasileiro.
// Formato obrigatório: "Bairro (SIGLA) ━➤ Bairro (SIGLA)".
// Fallback para a cidade quando não há bairro, nunca "Cidade Cidade".
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  bairroComSigla,
  bairroComSiglaDeTexto,
  derivarBairroCidade,
} from "@/lib/resumoRotaOS";
import { gerarMensagemWhatsAppMotoboy } from "@/lib/osWhatsAppMessage";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("Extração estrita de bairro", () => {
  it("extrai o bairro após o número/hífen (Rua X, 100 - BAIRRO, Cidade - UF)", () => {
    expect(derivarBairroCidade("Rua X, 100 - Herculândia, Marília - SP")).toMatchObject({
      bairro: "Herculândia",
      cidade: "Marília",
      uf: "SP",
    });
  });

  it("extrai o bairro entre vírgulas (Av. Sumaré, BAIRRO, Cidade - UF)", () => {
    expect(derivarBairroCidade("Av. Sumaré, Vila Madalena, São Paulo - SP, 05435-000")).toMatchObject({
      bairro: "Vila Madalena",
      cidade: "São Paulo",
      uf: "SP",
    });
  });

  it("bairro + sigla da cidade (não a cidade isolada)", () => {
    expect(
      bairroComSigla({ endereco: "Rua X, 100 - Herculândia, Marília - SP" }),
    ).toBe("Herculândia (MAR)");
  });

  it("fallback para a cidade quando não há bairro explícito", () => {
    expect(bairroComSigla({ cidade: "Herculândia", uf: "SP" })).toBe("Herculândia (HER)");
  });

  it("NUNCA repete 'Cidade Cidade'", () => {
    expect(bairroComSigla({ bairro: "Herculândia", cidade: "Herculândia", uf: "SP" })).toBe(
      "Herculândia (HER)",
    );
    expect(bairroComSigla({ cidade: "São Paulo São Paulo", uf: "SP" })).toBe(
      "São Paulo (SAO)",
    );
    const texto = bairroComSigla({ endereco: "Herculândia - SP" });
    expect(texto).toBe("Herculândia (HER)");
    expect(texto).not.toContain("Herculândia Herculândia");
  });

  it("texto livre também extrai bairro", () => {
    expect(bairroComSiglaDeTexto("Herculândia, Marília - SP")).toBe("Herculândia (MAR)");
    expect(bairroComSiglaDeTexto("Taboão, Taboão da Serra - SP")).toBe("Taboão (TAB)");
  });
});

describe("Rota do WhatsApp e da Rede usa o bairro", () => {
  it("cabeçalho do WhatsApp no formato Bairro (SIGLA) ━➤ Bairro (SIGLA)", () => {
    const msg = gerarMensagemWhatsAppMotoboy({
      veiculoTipo: "Moto",
      distanciaKm: 300,
      enderecos: [
        {
          sequencia: 1,
          tipo: "coleta",
          endereco: "Rua X, 100 - Herculândia, Marília - SP",
        },
        {
          sequencia: 2,
          tipo: "entrega",
          endereco: "Av. Y, 200 - Centro, São Paulo - SP",
        },
      ],
    });
    expect(msg).toContain("*Herculândia (MAR) ━➤ Centro (SAO)*");
    expect(msg).not.toContain("*Marília (MAR) ━➤ São Paulo (SAO)*");
  });

  it("notificações da Rede importam e usam bairroComSigla", () => {
    const rede = readSrc("src/services/portal-prestador/redeOportunidadesService.ts");
    expect(rede).toContain("bairroComSigla");
    expect(rede).toContain("bairroComSiglaDeTexto");
    expect(rede).not.toContain("municipioComSigla(");
  });

  it("notificação da base/agregados usa bairroComSigla", () => {
    const base = readSrc("src/services/operacao/osAlocacaoPendenteService.ts");
    expect(base).toContain("bairroComSigla");
    expect(base).not.toContain("municipioComSigla");
  });
});

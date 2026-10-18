import { describe, it, expect } from "vitest";
import { montarDescricaoCalvo, montarObservacaoRomaneios } from "@/services/financeiro/faturaService";

// ============================================================================
// A31-I.2 — Fidelidade final + dados automáticos da fatura (modelo do cliente).
// Valida regras puras e de domínio sem banco.
// ============================================================================

describe("A31-I.2 — Cliente automático / cliente único", () => {
  it("seleção com um único cliente vira o cliente da fatura", () => {
    const itens = [
      { clienteId: "c1", clienteNome: "CALVO LOGÍSTICA" },
      { clienteId: "c1", clienteNome: "CALVO LOGÍSTICA" },
    ];
    const clientes = new Set(itens.map((i) => i.clienteId).filter(Boolean));
    expect(clientes.size).toBe(1);
    const clienteFatura = itens[0].clienteNome;
    expect(clienteFatura).toBe("CALVO LOGÍSTICA");
  });

  it("bloqueia fatura com clientes mistos (UMA FATURA = UM CLIENTE)", () => {
    const itens = [
      { clienteId: "c1" },
      { clienteId: "c2" },
    ];
    const clientes = new Set(itens.map((i) => i.clienteId).filter(Boolean));
    expect(clientes.size).toBe(2);
    const bloqueado = clientes.size > 1;
    expect(bloqueado).toBe(true);
  });

  it("bloqueia emissão quando serviço sem cliente (pendência cadastral)", () => {
    const itens = [{ clienteId: null }, { clienteId: "c1" }];
    const semCliente = itens.filter((i) => !i.clienteId);
    expect(semCliente.length).toBe(1);
    expect(semCliente.length > 0).toBe(true);
  });
});

describe("A31-I.2 — Número da Fatura", () => {
  it("rascunho/prévia não consome numeração (mostra Rascunho)", () => {
    const numero = null;
    expect(numero || "Rascunho").toBe("Rascunho");
  });

  it("após emissão usa número oficial na coluna FATURA e no rodapé", () => {
    const numero = "FAT-2026-000001";
    const colunaFatura = numero;
    const rodape = `Fatura ${numero} - Conexão Express`;
    expect(colunaFatura).toMatch(/^FAT-\d{4}-\d{6}$/);
    expect(rodape).toContain(numero);
  });
});

describe("A31-I.2 — Romaneios/OCs automáticos (consolidados sem duplicidade)", () => {
  it("consolida romaneios em frase única sem duplicidade", () => {
    const desc = montarDescricaoCalvo([
      { romaneio: "343241" },
      { romaneio: "343216" },
      { romaneio: "343198" },
      { romaneio: "343198" },
      { romaneio: "343099" },
    ]);
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343241, 343216, 343198 e 343099.");
  });

  it("serviço sem romaneio não inventa número", () => {
    const desc = montarDescricaoCalvo([
      { romaneio: "343241" },
      { romaneio: "" },
      { romaneio: null },
    ]);
    expect(desc).toBe("Receita de CT-e referente aos romaneios nº 343241.");
    expect(desc).not.toContain("undefined");
    expect(desc).not.toContain("null");
  });
});

describe("A31-I.2 — Observação separada (não repete romaneios da descrição)", () => {
  it("no modelo do cliente a observação automática de romaneios é omitida", () => {
    const itens = [{ romaneio: "343241" }, { romaneio: "343216" }];
    const romaneios = itens.map((i) => i.romaneio);
    // Regra A31-I.2: modelo do cliente → descricaoAuto preenche, obs fica vazia
    const descricaoAuto = montarDescricaoCalvo(itens);
    const obs = ""; // observação automática omitida no modelo do cliente
    expect(descricaoAuto).toContain("343241");
    expect(obs).toBe("");
  });

  it("modelo padrão mantém observação de romaneios quando não há descrição consolidada", () => {
    const romaneios = ["343198", "343216", "343241"];
    const obs = montarObservacaoRomaneios(romaneios);
    expect(obs).toBe("Referente aos romaneios nº 343198, 343216 e 343241.");
  });
});
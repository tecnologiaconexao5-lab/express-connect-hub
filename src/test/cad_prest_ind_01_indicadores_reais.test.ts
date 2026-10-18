/**
 * CAD-PREST-IND-01 — Indicadores reais do Cadastro do Prestador.
 *
 * Total de Entregas: alocacoes_escala status='concluida' (por prestador_id).
 * Ocorrências: tabela canônica `ocorrencias` (por prestador_id) — antes lia a
 * tabela legada/vazia `prestadores_ocorrencias`.
 *
 * A prova real no banco é feita por script dedicado (ver relatório).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DETALHE = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/prestadores/PrestadorDetalhe.tsx"),
  "utf8"
);

describe("CAD-PREST-IND-01 — Total de Entregas (concluídas)", () => {
  it("conta alocacoes_escala concluídas por prestador_id", () => {
    expect(DETALHE).toContain('.from("alocacoes_escala")');
    expect(DETALHE).toContain('.eq("prestador_id", p.id!)');
    expect(DETALHE).toContain('.eq("status", "concluida")');
    expect(DETALHE).toContain("setQtdEntregasReais");
  });

  it("não usa mock/campo fictício para o total exibido", () => {
    expect(DETALHE).not.toContain("numOsMes");
  });
});

describe("CAD-PREST-IND-01 — Ocorrências (fonte canônica)", () => {
  it("lê a tabela canônica `ocorrencias` por prestador_id", () => {
    expect(DETALHE).toContain('.from("ocorrencias")');
    expect(DETALHE).toContain('.eq("prestador_id", p.id!)');
  });

  it("não usa mais a tabela legada prestadores_ocorrencias", () => {
    expect(DETALHE).not.toContain("prestadores_ocorrencias");
  });

  it("grava nova ocorrência na tabela canônica com prestador_id", () => {
    expect(DETALHE).toMatch(/\.from\('ocorrencias'\)/);
    expect(DETALHE).toContain("prestador_id: prestadorId");
  });
});

describe("CAD-PREST-IND-01 — sem falso sucesso na ocorrência", () => {
  it("confirma resposta do banco antes do sucesso", () => {
    expect(DETALHE).toContain("Nenhuma ocorrência foi salva");
    expect(DETALHE).toContain("ocorrenciaResult");
  });
});

/**
 * CAD-PREST-IND-02 — Indicadores de qualidade (Score/Aceitação/Pontualidade/Presença).
 *
 * Auditoria: os cards leem diretamente as colunas de `prestadores`
 * (score_interno, indice_aceite, indice_entrega_prazo, indice_comparecimento)
 * via dbMappers. NÃO existe fórmula/regra que calcule esses valores (todos 0/null
 * no banco) — resultado: SEM_DADOS / REGRA_AUSENTE. Nenhum valor é fabricado.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const DETALHE = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const MAPPERS = readSrc("src/lib/dbMappers.ts");
const LISTA = readSrc("src/components/prestadores/PrestadoresLista.tsx");

describe("CAD-PREST-IND-02 — fonte dos indicadores (DB → UI)", () => {
  it("cards leem os campos reais do prestador (sem cálculo local)", () => {
    expect(DETALHE).toContain("p.scoreInterno");
    expect(DETALHE).toContain("p.indiceAceite");
    expect(DETALHE).toContain("p.indiceEntregaNoPrazo");
    expect(DETALHE).toContain("p.indiceComparecimento");
  });

  it("não usa o score de onboarding (scoreEngine) como score do prestador", () => {
    expect(DETALHE).not.toContain("calculateScore");
    expect(DETALHE).not.toContain("scoreEngine");
  });

  it("dbMappers faz o mapeamento canônico das colunas", () => {
    expect(MAPPERS).toContain("scoreInterno: item.score_interno ?? 0");
    expect(MAPPERS).toContain("indiceAceite: item.indice_aceite ?? 0");
    expect(MAPPERS).toContain("indiceComparecimento: item.indice_comparecimento ?? 0");
    expect(MAPPERS).toContain("indiceEntregaNoPrazo: item.indice_entrega_prazo ?? 0");
  });

  it("a lista carrega via fromPrestadorRow (valores reais do banco)", () => {
    expect(LISTA).toContain("fromPrestadorRow");
  });

  it("não depende de mocks para os indicadores", () => {
    expect(LISTA).not.toContain("mockPrestadores");
    expect(DETALHE).not.toContain("mockPrestadores");
  });
});

/**
 * ADM-APP-02D.2 — GAP-01 (correção cirúrgica, teste direcionado).
 *
 * `AnaliseLote.tsx` consultava colunas inexistentes em `documentos_prestadores`
 * (`status`, `validade`, `arquivo` — a coluna real é `url`), fazendo o SELECT
 * falhar silenciosamente e a aba "Lote" da Análise de Documentos ficar vazia.
 *
 * Este teste lê o fonte do componente e garante que o SELECT referencia
 * APENAS colunas que existem na tabela real:
 *   id, prestador_id, tipo, url, created_at
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COLUNAS_REAIS = new Set(["id", "prestador_id", "tipo", "url", "created_at"]);
const FONTE = readFileSync(
  resolve(__dirname, "../components/documentos/AnaliseLote.tsx"),
  "utf8"
);

describe("ADM-APP-02D.2 GAP-01 — AnaliseLote select usa colunas reais", () => {
  it("extrai o SELECT de documentos_prestadores do fonte", () => {
    const m = FONTE.match(
      /from\("documentos_prestadores"\)\s*\n?\s*\.select\("([^"]+)"\)/
    );
    expect(m, "SELECT de documentos_prestadores não encontrado").toBeTruthy();
  });

  it("todas as colunas do SELECT existem em documentos_prestadores", () => {
    const m = FONTE.match(
      /from\("documentos_prestadores"\)\s*\n?\s*\.select\("([^"]+)"\)/
    );
    const cols = (m?.[1] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => (c.includes(" as ") ? c.split(" as ")[0].trim() : c));
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) {
      expect(COLUNAS_REAIS.has(c), `coluna inexistente no SELECT: ${c}`).toBe(true);
    }
  });

  it("não referencia mais colunas removidas (arquivo/status/validade)", () => {
    const m = FONTE.match(
      /from\("documentos_prestadores"\)\s*\n?\s*\.select\("([^"]+)"\)/
    );
    const sel = m?.[1] ?? "";
    expect(sel).not.toContain("arquivo");
    expect(sel).not.toMatch(/\bstatus\b/);
    expect(sel).not.toContain("validade");
  });

  it("mantém o mapeamento url (referência consumida pelo render)", () => {
    expect(FONTE).toMatch(/url:\s*d\.url/);
  });
});

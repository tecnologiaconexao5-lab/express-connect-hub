/**
 * E2E-COMPLETO-05B — POD / Comprovantes profissional no TMS.
 *
 * Verifica (por asserção de fonte):
 *  - OS finalizada → "Ver comprovantes" abre visão POD dedicada (não o formulário da OS);
 *  - EntregasComprovantes reutiliza o DossieEntregaSheet (POD);
 *  - Dossiê: fotos/zoom, recebedor, geolocalização, timeline; SEM dado financeiro interno;
 *  - Baixas/Evidências (Comprovantes.tsx): identificação humana + busca + dossiê;
 *  - vínculo canônico via entregas_protocolo (os_id/alocacao_id), não texto.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const LISTA = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const ENTREGAS = readSrc("src/components/comprovantes/EntregasComprovantes.tsx");
const DOSSIE = readSrc("src/components/comprovantes/DossieEntregaSheet.tsx");
const PAGE = readSrc("src/pages/Comprovantes.tsx");
const SERVICE = readSrc("src/services/comprovantes/comprovantesService.ts");

describe("E2E-COMPLETO-05B — OS → Ver comprovantes (POD dedicado)", () => {
  it("o botão 'Ver comprovantes' NÃO abre o formulário da OS", () => {
    const idx = LISTA.indexOf('title="Ver comprovantes"');
    expect(idx).toBeGreaterThan(-1);
    const start = LISTA.lastIndexOf("\n", idx) + 1;
    const end = LISTA.indexOf("\n", idx);
    const line = LISTA.slice(start, end === -1 ? undefined : end);
    expect(line).toMatch(/setOsComprovantes/);
    expect(line).not.toMatch(/setModoForm\("ver"\)/);
  });

  it("a listagem importa e renderiza EntregasComprovantes (visão dedicada)", () => {
    expect(LISTA).toMatch(/import EntregasComprovantes/);
    expect(LISTA).toMatch(/<EntregasComprovantes[\s\S]*osId=/);
  });
});

describe("E2E-COMPLETO-05B — EntregasComprovantes reutiliza o POD existente", () => {
  it("usa DossieEntregaSheet + buscarEntregasDaOS (sem módulo paralelo)", () => {
    expect(ENTREGAS).toMatch(/import DossieEntregaSheet/);
    expect(ENTREGAS).toMatch(/buscarEntregasDaOS/);
    expect(ENTREGAS).toMatch(/<DossieEntregaSheet/);
    expect(ENTREGAS).toMatch(/Ver comprovante/);
  });
});

describe("E2E-COMPLETO-05B — Dossiê do POD (profissional, sem dado financeiro)", () => {
  it("exibe fotos, assinatura, recebedor, documento e geolocalização", () => {
    expect(DOSSIE).toMatch(/foto_entrega_url/);
    expect(DOSSIE).toMatch(/assinatura_url/);
    expect(DOSSIE).toMatch(/nome_recebedor/);
    expect(DOSSIE).toMatch(/documento_recebedor/);
    expect(DOSSIE).toMatch(/latitude/);
    expect(DOSSIE).toMatch(/longitude/);
  });

  it("permite ampliar a evidência (galeria) e tem timeline", () => {
    expect(DOSSIE).toMatch(/setGaleriaAmpliada/);
    expect(DOSSIE).toMatch(/timeline/);
  });

  it("NÃO revela dado financeiro interno (margem/custo/valor/repasse)", () => {
    expect(DOSSIE).not.toMatch(/margem/i);
    expect(DOSSIE).not.toMatch(/custo_prestador/i);
    expect(DOSSIE).not.toMatch(/valor_cliente/i);
    expect(DOSSIE).not.toMatch(/valor_prestador|repasse/i);
  });
});

describe("E2E-COMPLETO-05B — Baixas/Evidências com identificação humana", () => {
  it("a tabela usa OS/Cliente/Prestador/Veículo/Recebedor/Data", () => {
    for (const col of ["OS / Romaneio", "Cliente", "Prestador", "Veículo", "Recebedor", "Data / Hora"]) {
      expect(PAGE).toContain(col);
    }
  });

  it("tem busca por OS/cliente/prestador/destinatário/recebedor/documento", () => {
    expect(PAGE).toMatch(/OS, cliente, prestador, destinatário, recebedor, documento/);
    expect(PAGE).toMatch(/listarComprovantes/);
  });

  it("'Ver comprovante' abre o DossieEntregaSheet", () => {
    expect(PAGE).toMatch(/<DossieEntregaSheet/);
    expect(PAGE).toMatch(/Ver comprovante/);
  });
});

describe("E2E-COMPLETO-05B — vínculo canônico (entregas_protocolo)", () => {
  it("o service usa alocacao_id/ordem_servico_id (não apenas texto)", () => {
    expect(SERVICE).toMatch(/entregas_protocolo/);
    expect(SERVICE).toMatch(/alocacao_id/);
    expect(SERVICE).toMatch(/ordem_servico_id/);
    expect(SERVICE).toMatch(/\.in\("alocacao_id"/);
  });
});

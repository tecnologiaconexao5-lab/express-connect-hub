// ============================================================
// REFINO OS — Composição financeira two-way, POD visível,
// rastreamento real e distância/observações limpas.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fromOSRow, type OSRow } from "@/lib/dbMappers";
import { montarEntregaOS } from "@/services/comprovantes/comprovantesService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const osForm = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const preview = readSrc("src/components/operacao/OrdemServicoPreview.tsx");
const rastreio = readSrc("src/components/operacao/RastreamentoOSDialog.tsx");
const entregas = readSrc("src/components/comprovantes/EntregasComprovantes.tsx");
const comprovantesSrv = readSrc("src/services/comprovantes/comprovantesService.ts");
const dbMappers = readSrc("src/lib/dbMappers.ts");
const migracao = readSrc("supabase/migrations/20261109040000_os_obs_limpas_distancia.sql");

describe("1) Composição Financeira — margem two-way + tabela do prestador", () => {
  it("1.1 valor inicial do repasse vem da tabela DO PRESTADOR", () => {
    expect(osForm).toContain("buscarTabelaPrestador");
    expect(osForm).toContain("aplicarTabelaPrestador");
    expect(osForm).toContain("prestador_id: prestadorId");
    expect(osForm).toContain("await aplicarTabelaPrestador(");
  });

  it("1.2 % de margem recalcula o valor do prestador (two-way)", () => {
    expect(osForm).toContain("aplicarMargemPercentual");
    expect(osForm).toContain("valor * (1 - pctClamped / 100)");
    expect(osForm).toContain('label="Margem (%)"');
    // O valor do prestador continua editável e recalcula a margem derivada.
    expect(osForm).toContain("margemPercentualAtual");
    expect(osForm).toContain('update("custoPrestador"');
  });
});

describe("2) POD — fotos e assinatura renderizadas", () => {
  it("2.1 service resolve mídia e expõe URLs no EntregaOS", () => {
    expect(comprovantesSrv).toContain("resolverMidiasPods");
    expect(comprovantesSrv).toContain("foto_entrega_url: pod?.foto_entrega_url");
    expect(comprovantesSrv).toContain("assinatura_url: pod?.assinatura_url");
  });

  it("2.2 componente renderiza <img> para foto/canhoto/assinatura", () => {
    expect(entregas).toContain("entrega.foto_entrega_url");
    expect(entregas).toContain("entrega.foto_canhoto_url");
    expect(entregas).toContain("entrega.assinatura_url");
    expect(entregas).toContain("<img");
  });

  it("2.3 Visualização da OS inclui os comprovantes (POD) na secção Documentos", () => {
    expect(preview).toContain("EntregasComprovantes");
    expect(preview).toContain("Comprovantes (POD)");
  });

  it("2.4 montarEntregaOS devolve as URLs das evidências", () => {
    const e = montarEntregaOS({
      alocacao: { id: "a1" },
      pod: {
        id: "p1",
        nome_recebedor: "João",
        foto_entrega_url: "https://x/foto.jpg",
        assinatura_url: "https://x/assinatura.png",
        foto_canhoto_url: null,
      },
    });
    expect(e.foto_entrega_url).toBe("https://x/foto.jpg");
    expect(e.assinatura_url).toBe("https://x/assinatura.png");
    expect(e.foto_canhoto_url).toBeNull();
  });
});

describe("3) Rastreamento real + distância", () => {
  it("3.1 modal lê portal_tracking_realtime (telemetria do App)", () => {
    expect(rastreio).toContain('from("portal_tracking_realtime")');
    expect(rastreio).toContain('from("alocacoes_escala")');
    expect(rastreio).toContain("MapboxMap");
    expect(rastreio).toContain("Google Maps");
  });

  it("3.2 lista usa o novo modal e removeu o placeholder de integração", () => {
    expect(lista).toContain("RastreamentoOSDialog");
    expect(lista).not.toContain("Aguardando integração com o aplicativo");
  });

  it("3.3 fromOSRow expõe distanciaKm (coluna/rota/carga/observações)", () => {
    expect(dbMappers).toContain("extrairDistanciaKmOS");
    const base = { id: "os1", data: "2026-11-09", status: "em_analise" } as unknown as OSRow;
    expect(fromOSRow({ ...base, distancia_km: 22.6 } as OSRow).distanciaKm).toBe(22.6);
    expect(fromOSRow({ ...base, distancia_rota: { distancia_km: 18.2 } } as unknown as OSRow).distanciaKm).toBe(18.2);
    expect(
      fromOSRow({ ...base, observacoes_gerais: "Distância estimada: 38.4 km" } as OSRow).distanciaKm,
    ).toBe(38.4);
  });
});

describe("4) Observações limpas + distância na OS da cotação", () => {
  it("4.1 migration cria o trigger de normalização e o backfill", () => {
    expect(migracao).toContain("f_trg_os_normalizar_cotacao");
    expect(migracao).toContain("trg_os_normalizar_cotacao");
    expect(migracao).toContain("Coleta agendada");
    expect(migracao).toContain("Aguardando confirmação do cliente via WhatsApp");
    expect(migracao).toContain("precificacao");
  });

  it("4.2 trigger preenche distancia_km e carga.distancia_km", () => {
    expect(migracao).toContain("NEW.distancia_km := v_km");
    expect(migracao).toContain("'distancia_km', NEW.distancia_km");
  });
});

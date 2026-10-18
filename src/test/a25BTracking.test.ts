import { describe, it, expect } from "vitest";
import type { TrackingPosition } from "@/services/rastreamento/trackingService";
import {
  montarMarcadorGPS,
  montarMapaAlocacoesPorOS,
  resolverPosicaoMarcador,
  posicaoRecente,
  isValidCoordinate,
  marcadorIdAlocacaoSemOS,
  extrairIdAlocacaoDeMarcador,
  montarMarcadorAlocacaoSemOS,
} from "@/components/torre-controle/markerAdapter";

const gps = (
  overrides: Partial<TrackingPosition> & { alocacao_id: string }
): TrackingPosition => ({
  latitude: -23.5505,
  longitude: -46.6333,
  alocacao_id: overrides.alocacao_id,
  captured_at: new Date().toISOString(),
  ...overrides,
});

describe("MISSÃO A25-B — GPS real tem prioridade no marcador da Torre", () => {
  it("1 — OS sem coordenada + GPS recente → marcador aparece", () => {
    const m = montarMarcadorGPS(null, gps({ alocacao_id: "aloc-1", latitude: -23.5, longitude: -46.6 }), "em_rota");
    expect(m).not.toBeNull();
    expect(m!.usandoGPS).toBe(true);
    expect(m!.lat).toBe(-23.5);
    expect(m!.lng).toBe(-46.6);
  });

  it("2 — OS com coordenada + GPS recente → usa GPS", () => {
    const osCoords = { lat: -10, lng: -50 };
    const m = montarMarcadorGPS(osCoords, gps({ alocacao_id: "aloc-1", latitude: -23.5, longitude: -46.6 }), "em_rota");
    expect(m).not.toBeNull();
    expect(m!.usandoGPS).toBe(true);
    expect(m!.lat).toBe(-23.5);
  });

  it("3 — OS com coordenada + sem GPS → usa coordenada da OS", () => {
    const osCoords = { lat: -10, lng: -50 };
    const m = montarMarcadorGPS(osCoords, null, "em_rota");
    expect(m).not.toBeNull();
    expect(m!.usandoGPS).toBe(false);
    expect(m!.lat).toBe(-10);
    expect(m!.lng).toBe(-50);
  });

  it("4 — OS sem coordenada + sem GPS → sem marcador", () => {
    const m = montarMarcadorGPS(null, null, "em_rota");
    expect(m).toBeNull();
  });

  it("5 — match por alocacao_id (tracking é iniciado por alocação)", () => {
    const posicoes = [
      gps({ alocacao_id: "aloc-9", os_id: "os-9", latitude: -23.55, longitude: -46.63 }),
    ];
    const mapa = montarMapaAlocacoesPorOS(posicoes);
    // OS "os-1" não tem posição direta por os_id, mas possui alocação mapeada
    const mapaManual = new Map<string, Set<string>>([["os-1", new Set(["aloc-9"])]]);
    const resolvida = resolverPosicaoMarcador("os-1", posicoes, mapaManual);
    expect(resolvida?.alocacao_id).toBe("aloc-9");
  });

  it("6 — fallback por os_id quando apropriado", () => {
    const posicoes = [gps({ alocacao_id: "aloc-7", os_id: "os-7", latitude: -23.55, longitude: -46.63 })];
    const resolvida = resolverPosicaoMarcador("os-7", posicoes);
    expect(resolvida?.os_id).toBe("os-7");
  });

  it("7 — posição antiga (>60min) não conta como GPS ativo", () => {
    const antiga = gps({
      alocacao_id: "aloc-1",
      captured_at: new Date(Date.now() - 90 * 60000).toISOString(),
    });
    expect(posicaoRecente(antiga)).toBe(false);
    const recente = gps({ alocacao_id: "aloc-1" });
    expect(posicaoRecente(recente)).toBe(true);
  });

  it("8 — seed antigo não conta como motorista online (posicaoRecente falso)", () => {
    const seed = gps({
      alocacao_id: "aloc-1",
      status: "pendente",
      origem: "homologacao",
      captured_at: "2026-07-29T02:49:28.976Z", // semanas atrás
    });
    expect(posicaoRecente(seed)).toBe(false);
  });

  it("9 — novo evento Realtime atualiza marcador (posição recente passa a valer)", () => {
    // Antes: sem posição → sem marcador (sem coords na OS)
    const antes = montarMarcadorGPS(null, null, "em_rota");
    expect(antes).toBeNull();
    // Depois: chega posição recente via Realtime → marcador surge
    const depois = montarMarcadorGPS(null, gps({ alocacao_id: "aloc-1" }), "em_rota");
    expect(depois).not.toBeNull();
    expect(depois!.usandoGPS).toBe(true);
  });

  it("10 — filtros GPS Ativo/Antigo/Sem GPS continuam coerentes (gpsState)", () => {
    const ativo = montarMarcadorGPS(null, gps({ alocacao_id: "a", captured_at: new Date().toISOString() }), "em_rota");
    expect(ativo!.gpsState).toBe("atualizado");

    const antigo = montarMarcadorGPS(
      { lat: -10, lng: -50 },
      gps({ alocacao_id: "b", captured_at: new Date(Date.now() - 30 * 60000).toISOString() }),
      "em_rota"
    );
    expect(antigo!.gpsState).toBe("antigo");

    const semGps = montarMarcadorGPS({ lat: -10, lng: -50 }, null, "em_rota");
    expect(semGps!.gpsState).toBe("indisponivel");
    expect(isValidCoordinate(0, 0)).toBe(false);
  });
});

describe("MISSÃO A25-L — Contrato Grupo 2 (alocação SEM OS) no painel", () => {
  it("1 — marcador id 'aloc-<uuid>' e extração devolvem o uuid original", () => {
    const alocId = "ca5fe225-7114-42da-9997-c3d466e5df52";
    const markerId = marcadorIdAlocacaoSemOS(alocId);
    expect(markerId).toBe(`aloc-${alocId}`);
    expect(extrairIdAlocacaoDeMarcador(markerId)).toBe(alocId);
  });

  it("2 — id de OS normal (sem prefixo aloc-) → null (Grupo 1)", () => {
    expect(extrairIdAlocacaoDeMarcador("9c1a7f2e-4c88-4f6b-9c0e-7a3b6e1d0f01")).toBeNull();
  });

  it("3 — prefixo sem uuid (ex.: 'aloc-') → null", () => {
    expect(extrairIdAlocacaoDeMarcador("aloc-")).toBeNull();
    expect(extrairIdAlocacaoDeMarcador("")).toBeNull();
  });

  it("4 — montarMarcadorAlocacaoSemOS usa o id com prefixo aloc-", () => {
    const aloc = { id: "ca5fe225-7114-42da-9997-c3d466e5df52", status: "em_rota" };
    const m = montarMarcadorAlocacaoSemOS(
      aloc as never,
      gps({ alocacao_id: aloc.id, latitude: -23.5, longitude: -46.6 })
    );
    expect(m).not.toBeNull();
    expect(m!.id).toBe("aloc-ca5fe225-7114-42da-9997-c3d466e5df52");
    expect(extrairIdAlocacaoDeMarcador(m!.id)).toBe(aloc.id);
  });
});

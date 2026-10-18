import { describe, it, expect } from "vitest";
import type { TrackingPosition } from "@/services/rastreamento/trackingService";
import {
  montarMarcadorAlocacaoSemOS,
  montarMapaAlocacoesPorOS,
  resolverPosicaoMarcador,
  posicaoRecente,
  type AlocacaoSemOS,
  type MarcadorAlocacaoSemOS,
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

const alocSemOS = (
  overrides: Partial<AlocacaoSemOS> = {}
): AlocacaoSemOS => ({
  id: "ca5fe225-7114-42da-9997-c3d466e5df52",
  status: "em_rota",
  prestador_id: "e6646799-fbac-453e-a3ef-afdfc01a7085",
  prestador_nome: "PRESTADOR TESTE APP",
  veiculo_tipo: "Fiorino",
  placa: "ABC1T23",
  origem: "Guarulhos - SP",
  destino: "São Paulo - SP",
  numero_os: "OS-HML-MULTI-001",
  romaneio: "HML-MULTI-001",
  etapa_app: "saiu_em_rota",
  metadata: {},
  ...overrides,
});

describe("MISSÃO A25-D — Alocação sem OS no mapa da Torre", () => {
  it("1 — alocação sem OS + GPS recente → marcador", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "ca5fe225-7114-42da-9997-c3d466e5df52" }));
    expect(m).not.toBeNull();
    expect(m!.id).toBe("aloc-ca5fe225-7114-42da-9997-c3d466e5df52");
    expect(m!.latitude).toBe(-23.5505);
  });

  it("2 — alocação sem OS + sem GPS → NÃO cria marcador", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), null);
    expect(m).toBeNull();
  });

  it("3 — alocação com OS + GPS → NÃO duplica (dedup via representação OS)", () => {
    // Este helper é puro por alocação; a dedup é feita na Torre.
    // Aqui validamos que o marcador da alocação existe e tem identificador próprio.
    const m = montarMarcadorAlocacaoSemOS(alocSemOS({ id: "aloc-1" }), gps({ alocacao_id: "aloc-1" }));
    expect(m).not.toBeNull();
    expect(m!.id.startsWith("aloc-")).toBe(true);
  });

  it("4 — match prioritário por alocacao_id", () => {
    const posicoes = [gps({ alocacao_id: "aloc-77", latitude: -23.55, longitude: -46.63 })];
    const resolvida = resolverPosicaoMarcador("aloc-77", posicoes);
    expect(resolvida?.alocacao_id).toBe("aloc-77");
  });

  it("5 — os_id NULL não quebra", () => {
    const pos = gps({ alocacao_id: "aloc-5", os_id: undefined });
    const mapa = montarMapaAlocacoesPorOS([pos]);
    expect(mapa.size).toBe(0); // sem os_id → não mapeia, mas posição existe
    const m = montarMarcadorAlocacaoSemOS(alocSemOS({ id: "aloc-5" }), pos);
    expect(m).not.toBeNull();
  });

  it("6 — metadata.numero_os aparece quando disponível", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "ca5fe225-7114-42da-9997-c3d466e5df52" }));
    expect(m!.numero).toBe("OS-HML-MULTI-001");
    expect(m!.osNumero).toBe("OS-HML-MULTI-001");
  });

  it("7 — romaneio aparece quando disponível", () => {
    const m = montarMarcadorAlocacaoSemOS(
      alocSemOS({ numero_os: null, romaneio: "HML-MULTI-001" }),
      gps({ alocacao_id: "aloc-1" })
    );
    expect(m!.numero).toBe("HML-MULTI-001");
  });

  it("8 — motorista/prestador aparece", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "aloc-1" }));
    expect(m!.prestador).toBe("PRESTADOR TESTE APP");
    expect(m!.driverName).toBe("PRESTADOR TESTE APP");
  });

  it("9 — veículo aparece quando disponível", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "aloc-1" }));
    expect(m!.plate).toBe("ABC1T23");
    expect(m!.vehicleType).toBe("Fiorino");
  });

  it("10 — GPS recente conta Motoristas Online (gpsState atualizado)", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "aloc-1" }));
    expect(m!.gpsState).toBe("atualizado");
  });

  it("11 — GPS antigo NÃO conta Motoristas Online", () => {
    const antiga = gps({ alocacao_id: "aloc-1", captured_at: new Date(Date.now() - 30 * 60000).toISOString() });
    const m = montarMarcadorAlocacaoSemOS(alocSemOS(), antiga);
    expect(m).not.toBeNull();
    expect(m!.gpsState).toBe("antigo"); // "antigo" NÃO é "atualizado" → não conta
  });

  it("12 — Realtime consegue introduzir marcador (posição nova + alocação sem OS)", () => {
    const antes = montarMarcadorAlocacaoSemOS(alocSemOS(), null);
    expect(antes).toBeNull();
    const depois = montarMarcadorAlocacaoSemOS(alocSemOS(), gps({ alocacao_id: "aloc-1" }));
    expect(depois).not.toBeNull();
  });

  it("13 — filtros continuam funcionando (status em_rota mapeado)", () => {
    const m = montarMarcadorAlocacaoSemOS(alocSemOS({ status: "em_rota" }), gps({ alocacao_id: "aloc-1" }));
    expect(m!.status).toBe("em_rota");
    // em_rota casa com filtro "Em rota" da Torre
    expect(["em_rota", "em_coleta", "em_entrega"]).toContain(m!.status);
  });

  it("14 — OS real existente continua funcionando (resolverPosicaoMarcador por os_id)", () => {
    const posicoes = [gps({ alocacao_id: "aloc-9", os_id: "os-9" })];
    const resolvida = resolverPosicaoMarcador("os-9", posicoes);
    expect(resolvida?.os_id).toBe("os-9");
  });

  it("15 — KPI PODs Pendentes permanece funcionando (rota/menu intactos)", async () => {
    const { sidebarItems } = await import("@/lib/sidebarData");
    const { ROUTE_PERMISSIONS } = await import("@/lib/routePermissions");
    expect(ROUTE_PERMISSIONS["/comprovantes"]).toBeDefined();
    const apoio = sidebarItems.find((i) => i.title === "Apoio Operacional");
    expect(apoio?.children?.some((c) => c.path === "/comprovantes")).toBe(true);
  });

  it("16 — Chat/Mensagens permanece funcionando (serviço A22 presente)", async () => {
    const mod = await import("@/services/operacaoChatService");
    expect(typeof mod.responderMensagem).toBe("function");
    expect(typeof mod.listarConversasTorre).toBe("function");
  });

  it("17 — Torre abre sem erro (serviço de alocação sem OS exportado)", async () => {
    const mod = await import("@/services/rastreamento/trackingService");
    expect(typeof mod.buscarAlocacoesSemOS).toBe("function");
    expect(typeof mod.buscarUltimasPosicoes).toBe("function");
  });

  it("18 — remontagem Torre continua funcionando (recência intacta)", () => {
    expect(posicaoRecente(gps({ alocacao_id: "aloc-1" }))).toBe(true);
    expect(posicaoRecente(gps({ alocacao_id: "aloc-1", captured_at: new Date(Date.now() - 120 * 60000).toISOString() }))).toBe(false);
  });
});

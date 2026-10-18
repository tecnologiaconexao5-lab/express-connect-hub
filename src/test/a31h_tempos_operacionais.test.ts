import { describe, it, expect } from "vitest";
import { derivarTemposDeEventos, formatarDuracaoMin, type TemposOperacionaisReais } from "@/services/escala/escalaTemposService";
import type { EventoNormalizado } from "@/components/torre-controle/eventAdapter";

// ============================================================================
// A31-H — Tempos operacionais derivados dos eventos REAIS do App Motorista.
// Garante que a Escala calcule tempos a partir de eventos_oficiais (fonte
// única) e não de relógio manual concorrente.
// ============================================================================

const ev = (eventType: string, iso: string): EventoNormalizado => ({
  id: `${eventType}-${iso}`,
  operationId: "aloc-1",
  orderServiceId: null,
  eventType,
  category: "sistema",
  title: eventType,
  description: "",
  occurredAt: iso,
  source: "app_motorista",
  status: null,
  stage: null,
  driverId: null,
  driverName: null,
  vehicleId: null,
  latitude: null,
  longitude: null,
  accuracy: null,
  evidenceIds: [],
  occurrenceId: null,
  protocolId: null,
  metadata: {},
});

describe("A31-H — derivarTemposDeEventos", () => {
  it("chegada à origem alimenta tempo aguardando", () => {
    const t: TemposOperacionaisReais = derivarTemposDeEventos([
      ev("arrived_pickup", "2026-08-17T08:00:00Z"),
      ev("loading_started", "2026-08-17T09:15:00Z"),
    ]);
    expect(t.chegadaOrigem).toBe("2026-08-17T08:00:00Z");
    expect(t.tempoAguardandoMin).toBe(75);
  });

  it("início/fim carregamento alimentam tempo de carregamento", () => {
    const t = derivarTemposDeEventos([
      ev("loading_started", "2026-08-17T09:15:00Z"),
      ev("loading_finished", "2026-08-17T10:00:00Z"),
    ]);
    expect(t.tempoCarregamentoMin).toBe(45);
  });

  it("saída/encerramento alimentam tempo em rota", () => {
    const t = derivarTemposDeEventos([
      ev("route_started", "2026-08-17T10:00:00Z"),
      ev("operation_finished", "2026-08-17T12:30:00Z"),
    ]);
    expect(t.tempoEmRotaMin).toBe(150);
  });

  it("tempo total = chegada origem → finalização", () => {
    const t = derivarTemposDeEventos([
      ev("arrived_pickup", "2026-08-17T08:00:00Z"),
      ev("operation_finished", "2026-08-17T12:30:00Z"),
    ]);
    expect(t.tempoTotalMin).toBe(270);
  });

  it("sem eventos retorna nulos (não inventa tempo)", () => {
    const t = derivarTemposDeEventos([]);
    expect(t.chegadaOrigem).toBeNull();
    expect(t.tempoTotalMin).toBeNull();
    expect(t.origem).toBe("app_eventos");
  });

  it("eventos parciais não geram médias inventadas", () => {
    const t = derivarTemposDeEventos([ev("arrived_pickup", "2026-08-17T08:00:00Z")]);
    expect(t.tempoTotalMin).toBeNull();
    expect(t.tempoAguardandoMin).toBeNull();
  });
});

describe("A31-H — formatarDuracaoMin", () => {
  it("formata horas e minutos", () => {
    expect(formatarDuracaoMin(150)).toBe("2h 30m");
    expect(formatarDuracaoMin(45)).toBe("45 min");
    expect(formatarDuracaoMin(0)).toBe("0 min");
  });
  it("null/vazio vira em-dash", () => {
    expect(formatarDuracaoMin(null)).toBe("—");
  });
});
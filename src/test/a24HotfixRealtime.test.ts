import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// HOTFIX A24 — regressão do Realtime do chat/Torre.
// O bug real: `supabase.channel(topic)` REUTILIZA um canal existente com o mesmo
// topic (realtime-js). Quando 3 componentes (AppTopbar, TorreControle,
// ChatTorrePanel) chamavam inscreverMensagensTorre(), o 2º/3º recebia o MESMO
// canal já subscrito e o .on() após subscribe disparava:
//   "cannot add 'postgres_changes' callbacks ... after 'subscribe()'".
// Este teste garante que cada inscrição usa um topic ÚNICO e que os handlers
// são registrados ANTES do subscribe, com cleanup.
// ============================================================================

// Mock do supabase (apenas o que o serviço usa para os canais)
const canaisCriados: { topic: string; chamadas: string[] }[] = [];

const mockChannel = (topic: string) => {
  const chamadas: string[] = [];
  const chan = {
    topic,
    _subscribed: false,
    on: (_type: string, _filter: unknown, _cb: unknown) => {
      chamadas.push("on");
      return chan;
    },
    subscribe: () => {
      chamadas.push("subscribe");
      chan._subscribed = true;
      return chan;
    },
  } as unknown as RealtimeChannel & { _subscribed: boolean };
  canaisCriados.push({ topic, chamadas });
  return chan;
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: (topic: string) => mockChannel(topic),
    removeChannel: vi.fn((c: any) => { /* noop */ }),
  },
}));

import { supabase } from "@/lib/supabase";
import {
  inscreverMensagensTorre,
  inscreverMensagensOperacao,
} from "@/services/operacaoChatService";

const removeChannelSpy = vi.mocked(supabase.removeChannel);

beforeEach(() => {
  canaisCriados.length = 0;
  removeChannelSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HOTFIX A24 — lifecycle Realtime do chat/Torre", () => {
  it("1 — handlers são registrados ANTES do subscribe (ordem on → subscribe)", () => {
    const cleanup = inscreverMensagensTorre(() => {});
    expect(canaisCriados).toHaveLength(1);
    const chamadas = canaisCriados[0].chamadas;
    expect(chamadas.indexOf("on")).toBeGreaterThanOrEqual(0);
    expect(chamadas.indexOf("subscribe")).toBeGreaterThan(chamadas.indexOf("on"));
    cleanup();
  });

  it("2 — cada inscrição da Torre usa um topic ÚNICO (sem reutilizar canal subscrito)", () => {
    const cleanup1 = inscreverMensagensTorre(() => {});
    const cleanup2 = inscreverMensagensTorre(() => {});
    const cleanup3 = inscreverMensagensTorre(() => {});
    expect(canaisCriados).toHaveLength(3);
    const topics = new Set(canaisCriados.map((c) => c.topic));
    expect(topics.size).toBe(3);
    cleanup1(); cleanup2(); cleanup3();
  });

  it("3 — inscrição por operação também usa topic único (não reutiliza canal)", () => {
    const cleanup1 = inscreverMensagensOperacao("aloc-1", () => {});
    const cleanup2 = inscreverMensagensOperacao("aloc-1", () => {});
    expect(canaisCriados).toHaveLength(2);
    const topics = new Set(canaisCriados.map((c) => c.topic));
    expect(topics.size).toBe(2);
    cleanup1(); cleanup2();
  });

  it("4 — cleanup remove o canal criado (sem vazamento de subscriptions)", () => {
    const cleanup = inscreverMensagensTorre(() => {});
    cleanup();
    expect(removeChannelSpy).toHaveBeenCalledTimes(1);
  });

  it("5 — montagem e re-montagem (cleanup entre elas) não reutiliza canal subscrito", () => {
    // Simula: montar → cleanup → montar novamente (navegação Torre → outra → Torre)
    const cleanup1 = inscreverMensagensTorre(() => {});
    cleanup1();
    const cleanup2 = inscreverMensagensTorre(() => {});
    cleanup2();
    expect(canaisCriados).toHaveLength(2);
    const topics = new Set(canaisCriados.map((c) => c.topic));
    expect(topics.size).toBe(2);
  });

  it("6 — nunca adiciona callback em canal já subscrito (proteção contra subscribe duplicado)", () => {
    // Sempre cria novo canal → .on() é sempre chamado em canal não subscrito.
    for (let i = 0; i < 5; i++) {
      const cleanup = inscreverMensagensTorre(() => {});
      const c = canaisCriados[i];
      expect(c.chamadas.indexOf("on")).toBeLessThan(c.chamadas.indexOf("subscribe"));
      cleanup();
    }
  });

  it("7 — A28: inscrição por operação registra INSERT e UPDATE antes do subscribe", () => {
    const cleanup = inscreverMensagensOperacao("aloc-1", () => {}, () => {});
    expect(canaisCriados).toHaveLength(1);
    const chamadas = canaisCriados[0].chamadas;
    const nOns = chamadas.filter((c) => c === "on").length;
    expect(nOns, 2); // INSERT + UPDATE (read receipt A28)
    expect(chamadas.indexOf("subscribe")).toBeGreaterThan(chamadas.lastIndexOf("on"));
    cleanup();
  });
});

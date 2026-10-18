import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * APP-E2E-11D — Consumo de POD privado (driver-evidence) no TMS/Portal.
 *
 * Prova que referências privadas (publicUrl legada do bucket privado) são
 * convertidas em SIGNED URLs temporárias antes de chegar à UI, reutilizando
 * o podMediaService (sem segundo sistema de resolução).
 *
 * Sem fixture de banco (a fixture E2E-11 foi removida): Supabase é mockado.
 */

const h = vi.hoisted(() => {
  const state: { rows: Record<string, unknown>; signFail: boolean } = { rows: {}, signFail: false };
  const createSignedUrl = vi.fn(async (p: string) => {
    if (state.signFail) return { data: null, error: { message: "denied" } };
    return {
      data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/driver-evidence/${p}?token=tk` },
      error: null,
    };
  });
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.single = async () => ({ data: state.rows[table] ?? null, error: state.rows[table] ? null : { message: "no rows" } });
    b.maybeSingle = async () => ({ data: state.rows[table] ?? null, error: null });
    b.insert = async () => ({ data: null, error: null });
    b.update = () => b;
    return b;
  };
  const from = vi.fn((t: string) => builder(t));
  return { state, createSignedUrl, storageFrom, from };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { storage: { from: h.storageFrom }, from: h.from },
}));

import { resolverMidiaPod, resolverMidiasPod } from "@/services/comprovantes/podMediaService";
import { buscarPOD } from "@/services/podService";
import { buscarDetalhesEntregaCompleto } from "@/services/portalCliente/portalClienteService";

const PUBLIC_PRIV =
  "https://proj.supabase.co/storage/v1/object/public/driver-evidence/uid/pod/aloc/2026/09/27/foto.jpg";
const PUBLIC_PUB =
  "https://proj.supabase.co/storage/v1/object/public/comprovantes-entrega/pod/op/f.png";
const SIGNED_PRIV =
  "https://proj.supabase.co/storage/v1/object/sign/driver-evidence/uid/pod/aloc/2026/09/27/can.jpg?token=old";
const EXTERNAL = "https://storage.example.com/foto_108c1.jpg";

beforeEach(() => {
  h.state.signFail = false;
  h.state.rows = {};
  h.createSignedUrl.mockClear();
});

describe("APP-E2E-11D — resolução de mídia POD privada", () => {
  it("1) publicUrl de bucket privado → signed URL temporária", async () => {
    const out = await resolverMidiaPod(PUBLIC_PRIV);
    expect(out).toContain("/storage/v1/object/sign/driver-evidence/");
    expect(out).toContain("?token=");
    expect(out).not.toContain("/object/public/");
  });

  it("2) referência já assinada não sofre corrupção (path preservado)", async () => {
    const out = await resolverMidiaPod(SIGNED_PRIV);
    expect(out).toContain("/storage/v1/object/sign/driver-evidence/uid/pod/aloc/2026/09/27/can.jpg");
  });

  it("3) bucket público/legado permanece cru (sem re-assinatura)", async () => {
    const out = await resolverMidiaPod(PUBLIC_PUB);
    expect(out).toBe(PUBLIC_PUB);
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });

  it("4) URL externa permanece crua", async () => {
    expect(await resolverMidiaPod(EXTERNAL)).toBe(EXTERNAL);
  });

  it("5) referência nula/ausente/vazia não quebra a UI", async () => {
    expect(await resolverMidiaPod(null)).toBeNull();
    expect(await resolverMidiaPod(undefined)).toBeNull();
    expect(await resolverMidiaPod("")).toBeNull();
  });

  it("6) foto_entrega / foto_canhoto / assinatura resolvidas; ausentes preservadas", async () => {
    const pod = await resolverMidiasPod({
      foto_entrega_url: PUBLIC_PRIV,
      foto_canhoto_url: null,
      assinatura_url: SIGNED_PRIV,
    });
    expect(pod.foto_entrega_url).toContain("/object/sign/driver-evidence/");
    expect(pod.foto_canhoto_url).toBeNull();
    expect(pod.assinatura_url).toContain("/object/sign/driver-evidence/");
  });

  it("7) erro de resolução → fallback controlado (sem crash)", async () => {
    h.state.signFail = true;
    const out = await resolverMidiaPod(PUBLIC_PRIV);
    expect(out).toBe(PUBLIC_PRIV);
  });
});

describe("APP-E2E-11D — Torre de Controle (buscarPOD resolve na fonte)", () => {
  it("buscarPOD devolve mídia privada como signed URL (não crua)", async () => {
    h.state.rows["alocacoes_escala"] = {
      metadata: {
        pod: {
          nome_recebedor: "RECEBEDOR_TESTE_E2E11",
          data_hora_entrega: "2026-09-27T07:56:00Z",
          status: "entregue",
          foto_entrega_url: PUBLIC_PRIV,
          foto_canhoto_url: PUBLIC_PRIV,
          assinatura_url: SIGNED_PRIV,
        },
      },
    };
    const pod = await buscarPOD("aloc-1");
    expect(pod).not.toBeNull();
    expect(pod!.foto_entrega_url).toContain("/object/sign/driver-evidence/");
    expect(pod!.foto_canhoto_url).toContain("/object/sign/driver-evidence/");
    expect(pod!.assinatura_url).toContain("/object/sign/driver-evidence/");
    expect(pod!.foto_entrega_url).not.toContain("/object/public/");
  });

  it("buscarPOD faz fallback sem crash quando a assinatura falha", async () => {
    h.state.signFail = true;
    h.state.rows["alocacoes_escala"] = {
      metadata: {
        pod: {
          nome_recebedor: "X",
          data_hora_entrega: "d",
          status: "entregue",
          foto_entrega_url: PUBLIC_PRIV,
        },
      },
    };
    const pod = await buscarPOD("aloc-1");
    expect(pod!.foto_entrega_url).toBe(PUBLIC_PRIV);
  });
});

describe("APP-E2E-11D — Portal Cliente (detalhe da entrega resolve mídia)", () => {
  it("buscarDetalhesEntregaCompleto devolve POD com signed URL (não crua)", async () => {
    h.state.rows["entregas_protocolo"] = {
      id: "pod-1",
      alocacao_id: null,
      nome_recebedor: "RECEBEDOR_TESTE_E2E11",
      foto_entrega_url: PUBLIC_PRIV,
      foto_canhoto_url: PUBLIC_PRIV,
      assinatura_url: SIGNED_PRIV,
      data_hora_entrega: "2026-09-27T07:56:00Z",
      status: "entregue",
    };
    const d = await buscarDetalhesEntregaCompleto("pod-1");
    expect(d).not.toBeNull();
    expect(d!.pod.foto_entrega_url).toContain("/object/sign/driver-evidence/");
    expect(d!.pod.foto_canhoto_url).toContain("/object/sign/driver-evidence/");
    expect(d!.pod.assinatura_url).toContain("/object/sign/driver-evidence/");
  });
});

describe("APP-E2E-11D — garantias estruturais (fonte única, sem 2º sistema)", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), "utf8");

  it("Torre (DetalhesOperacaoSheet) consome buscarPOD (mídia resolvida na fonte)", () => {
    expect(read("src/components/torre-controle/DetalhesOperacaoSheet.tsx")).toMatch(
      /import\s*\{[^}]*buscarPOD[^}]*\}\s*from\s*"@\/services\/podService"/
    );
  });

  it("podService reutiliza podMediaService", () => {
    const s = read("src/services/podService.ts");
    expect(s).toContain('from "@/services/comprovantes/podMediaService"');
    expect(s).toContain("resolverMidiasPod");
  });

  it("portalClienteService resolve POD (lista/detalhe) e mídia da alocação", () => {
    const s = read("src/services/portalCliente/portalClienteService.ts");
    expect(s).toContain('from "@/services/comprovantes/podMediaService"');
    expect(s).toContain("resolverMidiasPods");
    expect(s).toContain("resolverMidiaPod");
  });

  it("PortalCliente resolve comprovante/assinatura da alocação", () => {
    const s = read("src/pages/PortalCliente.tsx");
    expect(s).toContain('from "@/services/comprovantes/podMediaService"');
    expect(s).toContain("resolverMidiaPod");
  });

  it("baseline: PodLista e Dossiê continuam usando o podMediaService", () => {
    expect(read("src/components/operacao/PodLista.tsx")).toContain("resolverMidiasPods");
    expect(read("src/services/comprovantes/comprovantesService.ts")).toContain("resolverMidiasPod");
  });
});

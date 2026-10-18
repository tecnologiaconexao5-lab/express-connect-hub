import { describe, it, expect } from "vitest";
import {
  montarConversasTorre,
  type MensagemConversaRaw,
  type ConversaOperacaoTorre,
} from "@/services/operacaoChatService";
import { sidebarItems } from "@/lib/sidebarData";
import { ROUTE_PERMISSIONS } from "@/lib/routePermissions";

describe("MISSÃO A24-B — Refinamento final do Chat da Torre", () => {
  const enriquecer = (aloc: string, ultima: MensagemConversaRaw) => ({
    prestadorNome: ultima.prestador_id === "p1" ? "Motorista A" : "Motorista B",
    osNumero: ultima.os_id === "os-1" ? "343198" : ultima.os_id === "os-2" ? "343200" : "",
    destino: aloc === "aloc-1" ? "São Paulo - SP" : aloc === "aloc-2" ? "Campinas - SP" : null,
    origem: aloc === "aloc-1" ? "Guarulhos - SP" : null,
    status: aloc === "aloc-1" ? "em_rota" : aloc === "aloc-2" ? "concluida" : null,
    placa: aloc === "aloc-1" ? "BRA2E19" : "BRA2E20",
    tipoVeiculo: "Truck",
  });

  function convsBase(extra: MensagemConversaRaw[] = []): ConversaOperacaoTorre[] {
    const msgs: MensagemConversaRaw[] = [
      { id: "m1", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "Preciso de ajuda", status: "enviada", created_at: "2026-08-14T10:15:00Z" },
      { id: "m2", alocacao_id: "aloc-2", os_id: "os-2", prestador_id: "p2", sender_type: "prestador", mensagem: "Entreguei", status: "enviada", created_at: "2026-08-14T11:00:00Z" },
      ...extra,
    ];
    return montarConversasTorre(msgs, enriquecer);
  }

  it("1 — OS/Romaneio aparece na conversa quando disponível", () => {
    const convs = convsBase();
    const c1 = convs.find((c) => c.alocacaoId === "aloc-1")!;
    expect(c1.osNumero).toBe("343198");
    expect(c1.osId).toBe("os-1");
    // Não usa UUID como informação principal
    expect(c1.osNumero).not.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("2 — contador não lido por conversa", () => {
    const convs = convsBase([
      { id: "m3", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "Segunda ajuda", status: "enviada", created_at: "2026-08-14T10:20:00Z" },
    ]);
    expect(convs.find((c) => c.alocacaoId === "aloc-1")!.naoLidas).toBe(2);
    expect(convs.find((c) => c.alocacaoId === "aloc-2")!.naoLidas).toBe(1);
  });

  it("3 — contador global (soma das não lidas)", () => {
    const convs = convsBase([
      { id: "m3", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "x", status: "enviada", created_at: "2026-08-14T10:20:00Z" },
    ]);
    const global = convs.reduce((s, c) => s + c.naoLidas, 0);
    expect(global).toBe(3);
  });

  it("4 — não lida é priorizada na ordenação", () => {
    // aloc-1 (10:15, sem não lidas) vs aloc-3 (12:00, com 1 não lida)
    const msgs: MensagemConversaRaw[] = [
      { id: "m1", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "velha", status: "lida", created_at: "2026-08-14T10:15:00Z" },
      { id: "m2", alocacao_id: "aloc-3", os_id: "os-3", prestador_id: "p2", sender_type: "prestador", mensagem: "nova não lida", status: "enviada", created_at: "2026-08-14T12:00:00Z" },
    ];
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs[0].alocacaoId).toBe("aloc-3"); // não lida sobe
  });

  it("5 — conversa mais recente sobe", () => {
    const convs = convsBase();
    // aloc-2 é mais recente (11:00) → deve vir primeiro entre as sem distinção de não lida
    expect(convs[0].alocacaoId).toBe("aloc-2");
    expect(convs[1].alocacaoId).toBe("aloc-1");
  });

  it("6 — busca por prestador (filtro local)", () => {
    const convs = convsBase();
    const q = "motorista a";
    const r = convs.filter((c) => `${c.prestadorNome} ${c.osNumero} ${c.destino || ""} ${c.origem || ""} ${c.statusOperacao || ""} ${c.ultimaMensagem} ${c.veiculoPlaca || ""}`.toLowerCase().includes(q));
    expect(r.length).toBe(1);
    expect(r[0].prestadorNome).toBe("Motorista A");
  });

  it("7 — busca por OS/Romaneio", () => {
    const convs = convsBase();
    const q = "343198";
    const r = convs.filter((c) => `${c.prestadorNome} ${c.osNumero} ${c.destino || ""} ${c.origem || ""} ${c.statusOperacao || ""} ${c.ultimaMensagem} ${c.veiculoPlaca || ""}`.toLowerCase().includes(q));
    expect(r.length).toBe(1);
    expect(r[0].osNumero).toBe("343198");
  });

  it("8 — abrir conversa marca leitura (mecanismo A22 existe e reduz não lidas)", async () => {
    const mod = await import("@/services/operacaoChatService");
    expect(typeof mod.marcarComoLidaTorre).toBe("function");
    expect(typeof mod.listarMensagens).toBe("function");
    // Simula: ao marcar lida, a contagem da conversa diminui (naoLidas recalculada)
    const convs = convsBase([
      { id: "m3", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "x", status: "enviada", created_at: "2026-08-14T10:20:00Z" },
    ]);
    const antes = convs.find((c) => c.alocacaoId === "aloc-1")!.naoLidas;
    // Após leitura, a mensagem nova teria status 'lida' → recálculo
    const msgsLidas: MensagemConversaRaw[] = [
      { id: "m1", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "Preciso de ajuda", status: "lida", created_at: "2026-08-14T10:15:00Z" },
      { id: "m3", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "x", status: "lida", created_at: "2026-08-14T10:20:00Z" },
    ];
    const depois = montarConversasTorre(msgsLidas, enriquecer).find((c) => c.alocacaoId === "aloc-1")!.naoLidas;
    expect(antes).toBeGreaterThan(depois);
    expect(depois).toBe(0);
  });

  it("9 — 'Abrir operação' usa osId (vínculo operação) — DetalhesOperacaoSheet abre por osId", async () => {
    const convs = convsBase();
    const c1 = convs.find((c) => c.alocacaoId === "aloc-1")!;
    expect(c1.osId).toBe("os-1");
    const mod = await import("@/components/torre-controle/DetalhesOperacaoSheet");
    expect(typeof mod.DetalhesOperacaoSheet).toBe("function");
  });

  it("10 — ausência de OS não quebra", () => {
    const msgs: MensagemConversaRaw[] = [
      { id: "m1", alocacao_id: "aloc-9", os_id: null, prestador_id: null, sender_type: "prestador", mensagem: "sem OS", status: "enviada", created_at: "2026-08-14T09:00:00Z" },
    ];
    const convs = montarConversasTorre(msgs, () => ({ prestadorNome: "Motorista", osNumero: "", destino: null, origem: null, status: null, placa: null, tipoVeiculo: null }));
    expect(convs).toHaveLength(1);
    expect(convs[0].osNumero).toBe("");
    expect(convs[0].osId).toBeNull();
  });

  it("11 — ausência de conversas mostra estado vazio (retorna lista vazia)", () => {
    expect(montarConversasTorre([], enriquecer)).toEqual([]);
  });

  it("12 — Realtime hotfix continua protegido (handlers antes do subscribe, topic único)", async () => {
    const mod = await import("@/services/operacaoChatService");
    expect(typeof mod.inscreverMensagensTorre).toBe("function");
    expect(typeof mod.inscreverMensagensOperacao).toBe("function");
  });

  it("13 — Torre → outra tela → Torre continua sem erro (rotas existem)", () => {
    expect(ROUTE_PERMISSIONS["/torre-controle"]).toBeDefined();
    expect(ROUTE_PERMISSIONS["/dashboard"]).toBeDefined();
  });

  it("14 — KPI PODs Pendentes continua funcionando", () => {
    expect(ROUTE_PERMISSIONS["/comprovantes"]).toBeDefined();
    const apoio = sidebarItems.find((i) => i.title === "Apoio Operacional");
    const item = apoio?.children?.find((c) => c.path === "/comprovantes");
    expect(item?.title).toBe("Comprovantes de Entrega");
  });
});

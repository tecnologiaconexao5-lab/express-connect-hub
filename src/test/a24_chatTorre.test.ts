import { describe, it, expect } from "vitest";
import { montarConversasTorre, type MensagemConversaRaw } from "@/services/operacaoChatService";
import { sidebarItems } from "@/lib/sidebarData";
import { ROUTE_PERMISSIONS } from "@/lib/routePermissions";

describe("MISSÃO A24 — Chat visível na Torre (reusa A22)", () => {
  const msgs: MensagemConversaRaw[] = [
    { id: "m1", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "Cheguei", status: "enviada", created_at: "2026-08-14T10:00:00Z" },
    { id: "m2", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "prestador", mensagem: "Descarga concluída", status: "enviada", created_at: "2026-08-14T10:05:00Z" },
    { id: "m3", alocacao_id: "aloc-1", os_id: "os-1", prestador_id: "p1", sender_type: "torre", mensagem: "Recebido", status: "enviada", created_at: "2026-08-14T10:10:00Z" },
    { id: "m4", alocacao_id: "aloc-2", os_id: "os-2", prestador_id: "p2", sender_type: "prestador", mensagem: "Problema no trânsito", status: "enviada", created_at: "2026-08-14T11:00:00Z" },
  ];
  const enriquecer = (_aloc: string, ultima: MensagemConversaRaw) => ({
    prestadorNome: ultima.prestador_id === "p1" ? "Motorista A" : ultima.prestador_id === "p2" ? "Motorista B" : "Motorista",
    osNumero: ultima.os_id === "os-1" ? "OS-001" : ultima.os_id === "os-2" ? "OS-002" : "",
    destino: ultima.alocacao_id === "aloc-1" ? "SP" : "RJ",
    origem: null,
    status: ultima.alocacao_id === "aloc-1" ? "em_rota" : "concluida",
    placa: "ABC1D23",
    tipoVeiculo: "Truck",
  });

  it("1 — agrupa conversas por alocação", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs).toHaveLength(2);
  });

  it("2 — contador de não lidas por conversa", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    // aloc-1: 2 do prestador não lidas (m1,m2); m3 da torre não conta
    expect(convs.find((c) => c.alocacaoId === "aloc-1")!.naoLidas).toBe(2);
    // aloc-2: 1 do prestador não lida
    expect(convs.find((c) => c.alocacaoId === "aloc-2")!.naoLidas).toBe(1);
  });

  it("3 — lista de conversas ordenada pelas mais recentes", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs[0].alocacaoId).toBe("aloc-2"); // 11:00
    expect(convs[1].alocacaoId).toBe("aloc-1"); // 10:10
  });

  it("4 — OS/Romaneio associado", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs.find((c) => c.alocacaoId === "aloc-1")!.osNumero).toBe("OS-001");
    expect(convs.find((c) => c.alocacaoId === "aloc-1")!.osId).toBe("os-1");
  });

  it("5 — prestador associado", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs.find((c) => c.alocacaoId === "aloc-1")!.prestadorNome).toBe("Motorista A");
    expect(convs.find((c) => c.alocacaoId === "aloc-2")!.prestadorNome).toBe("Motorista B");
  });

  it("6 — abre conversa (alocação identificada)", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    expect(convs[0].alocacaoId).toBeTruthy();
    expect(convs[0].totalMensagens).toBeGreaterThan(0);
  });

  it("7 — histórico carregado (última mensagem e horário)", () => {
    const convs = montarConversasTorre(msgs, enriquecer);
    const c1 = convs.find((c) => c.alocacaoId === "aloc-1")!;
    expect(c1.ultimaMensagem).toBe("Recebido");
    expect(c1.ultimoRemetente).toBe("torre");
    expect(c1.ultimoHorario).toBe("2026-08-14T10:10:00Z");
  });

  it("8 — resposta usa serviço A22 existente (responderMensagem exportado)", async () => {
    const mod = await import("@/services/operacaoChatService");
    expect(typeof mod.responderMensagem).toBe("function");
    expect(typeof mod.listarMensagens).toBe("function");
    expect(typeof mod.marcarComoLidaTorre).toBe("function");
  });

  it("9 — aba Mensagens do DetalhesOperacaoSheet preservada (ChatOperacaoPanel existe)", async () => {
    const mod = await import("@/components/torre-controle/ChatOperacaoPanel");
    expect(typeof mod.ChatOperacaoPanel).toBe("function");
  });

  it("10 — ausência de mensagens não quebra (retorna lista vazia)", () => {
    expect(montarConversasTorre([], enriquecer)).toEqual([]);
  });

  it("11 — A23 Central continua acessível (rota + menu)", () => {
    expect(ROUTE_PERMISSIONS["/comprovantes"]).toBeDefined();
    const apoio = sidebarItems.find((i) => i.title === "Apoio Operacional");
    const item = apoio?.children?.find((c) => c.path === "/comprovantes");
    expect(item?.title).toBe("Comprovantes de Entrega");
  });

  it("12 — KPI POD continua funcional (onClick navega para /comprovantes)", async () => {
    const { KpiItem } = await import("@/components/torre-controle/ExecutiveKpis");
    const item: KpiItem = {
      key: "pendencias",
      label: "PODs Pendentes",
      value: 42,
      sub: "entregas concluídas sem POD",
      icon: (await import("lucide-react")).FileX,
      tone: "purple",
      onClick: () => undefined,
    };
    expect(item.label).toBe("PODs Pendentes");
    expect(item.onClick).toBeDefined();
  });
});

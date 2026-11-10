// ============================================================
// INSTRUÇÃO CIRÚRGICA 3/3 (PARTE A) — Notificar base/agregados
// Push (Edge FCM/Realtime), payload formatado e feedback do botão.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const service = readSrc("src/services/operacao/osAlocacaoPendenteService.ts");
const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const edgeFn = readSrc("supabase/functions/enviar-push/index.ts");
const bridge = readSrc("supabase/migrations/20261109030000_push_motorista_bridge.sql");

describe("1) Acionamento do push a partir do botão da OS", () => {
  it("notificarBaseAgregados aciona a Edge Function e o broadcast Realtime", () => {
    expect(service).toContain('functions.invoke("enviar-push"');
    expect(service).toContain('type: "broadcast"');
    expect(service).toContain('event: "notificar_base"');
    expect(service).toContain("portal_notificacoes");
  });

  it("o trigger da fila copia o metadata para o payload de push", () => {
    expect(bridge).toContain("NEW.metadata");
    expect(bridge).toContain("push_notificacoes_fila");
  });
});

describe("2) Payload do alerta formatado", () => {
  it("inclui cidade_origem, cidade_destino e valor_prestador", () => {
    expect(service).toContain("cidade_origem");
    expect(service).toContain("cidade_destino");
    expect(service).toContain("valor_prestador");
    expect(service).toContain("cidadeColeta(");
    expect(service).toContain("cidadeEntrega(");
  });

  it("a Edge Function envia os 3 campos no data do FCM (string)", () => {
    expect(edgeFn).toContain("cidade_origem: cidadeOrigem");
    expect(edgeFn).toContain("cidade_destino: cidadeDestino");
    expect(edgeFn).toContain("valor_prestador: valorPrestador");
    expect(edgeFn).toContain("click_action: \"FLUTTER_NOTIFICATION_CLICK\"");
  });
});

describe("3) Feedback visual do botão", () => {
  it("mostra aviso verde de sucesso com o texto exato", () => {
    expect(lista).toContain('toast.success("Base notificada com sucesso!")');
  });

  it("desativa o botão por 5 segundos e previne duplo clique", () => {
    expect(lista).toContain("baseCooldown");
    expect(lista).toContain("5000");
    expect(lista).toContain("baseCooldownAtivoRef");
    expect(lista).toContain("Boolean(baseCooldown[os.id])");
  });

  it("limpa os timers ao desmontar", () => {
    expect(lista).toContain("clearTimeout(timer)");
  });
});

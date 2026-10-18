// ============================================================================
// Cenário 1 — MOBILE / RESILIÊNCIA OFFLINE -> ONLINE (contrato da RPC)
// ----------------------------------------------------------------------------
// Testa o backend do App Motorista pela RPC oficial
//   f_avancar_etapa_app_motorista
// simulando a PERDA DE CONEXÃO no momento da baixa (POD) e a posterior
// sincronização, provando:
//   (a) evento offline NÃO é persistido;
//   (b) ao voltar online, a fila é drenada;
//   (c) a MESMA idempotency_key aplica UMA única vez;
//   (d) dupla entrega (at-least-once) NÃO duplica estado/eventos.
//
// ⚠️ A anomalia A01 (RPC declarada STABLE em produção) impede escrita no banco.
//    O gate abaixo detecta e faz SKIP com diagnóstico. Fix pronto:
//      supabase/migrations/20260722000003_m133d4_fix_rpc_app_security.sql
//
// Requisitos: SUPABASE_SERVICE_ROLE_KEY + (DATABASE_URL opcional p/ A01) +
//             ambiente NÃO produtivo (global-setup bloqueia produção).
// ============================================================================
import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarClienteAdmin,
  criarClienteMotorista,
  resolverOuCriarFixtureMotorista,
  limparFixtureMotorista,
  verificarVolatilidadeRpc,
  OutboxMotorista,
  ErroRedeOffline,
  obterEstadoMotorista,
  eventosPorIdempotencyKey,
  timelinePorEtapa,
  novoIdempotencyKey,
  CAMINHO_ATE_POD,
  type FixtureMotorista,
  type ControleRede,
} from "./helpers/idempotencia";

test.describe.configure({ mode: "serial" });

test.describe("Cenário 1 — Mobile: resiliência offline → online e idempotência", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Defina SUPABASE_SERVICE_ROLE_KEY (fixture mock + leitura/cleanup).",
  );

  let admin: SupabaseClient;
  let motorista: SupabaseClient;
  let rede: ControleRede;
  let outbox: OutboxMotorista;
  let fixture: FixtureMotorista;

  test.beforeAll(async () => {
    admin = criarClienteAdmin();

    // GATE A01 (HARD-FAIL) — exige RPC VOLATILE. Sem DATABASE_URL não há como
    // verificar; falha explicitamente para não mascarar o risco de produção.
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "[E2E Cenário 1] DATABASE_URL é obrigatória: sem ela não é possível " +
          "verificar pg_proc.provolatile (gate A01). Configure a string de conexão do QA.",
      );
    }
    const vol = await verificarVolatilidadeRpc();
    if (vol !== "v") {
      const rotulo = vol === "s" ? "STABLE" : vol === "i" ? "IMMUTABLE" : String(vol);
      throw new Error(
        `[E2E Cenário 1] GATE A01 REPROVADO — f_avancar_etapa_app_motorista está ` +
          `${rotulo} (esperado VOLATILE). Uma função não-volátil não pode executar ` +
          `INSERT/UPDATE, portanto a baixa do App Motorista falha em runtime. ` +
          `Aplique supabase/migrations/20260722000003_m133d4_fix_rpc_app_security.sql e reexecute.`,
      );
    }

    fixture = await resolverOuCriarFixtureMotorista();
    const auth = await criarClienteMotorista(fixture.email, fixture.password, { online: true });
    motorista = auth.client;
    rede = auth.controleRede;
    outbox = new OutboxMotorista(motorista, rede);

    console.log(
      `[E2E Cenário 1] Fixture: alocacao=${fixture.alocacaoId} ` +
        `prestador=${fixture.prestadorId} mock=${fixture.criadoAutomaticamente}`,
    );
  });

  test.afterAll(async () => {
    if (fixture) await limparFixtureMotorista(fixture);
  });

  test("1. Avanço ONLINE até 'assinatura_capturada' (pré-baixa)", async () => {
    // Gate A01 é hard-fail no beforeAll (sem skip em runtime).
    rede.online = true;

    const preBaixa = CAMINHO_ATE_POD.filter((e) => e !== "pod_registrado");
    for (const etapa of preBaixa) {
      outbox.enfileirar(fixture.alocacaoId, etapa);
    }

    const respostas = await outbox.sincronizar();
    expect(respostas.every((r) => r.success), "Todas as etapas devem ter sucesso").toBe(true);

    const estado = await obterEstadoMotorista(admin, fixture.alocacaoId);
    expect(estado?.etapaAtual).toBe("assinatura_capturada");
    expect(estado?.status).toBe("em_rota");
    console.log("[E2E Cenário 1] PASSO 1 OK — pré-baixa concluída online.");
  });

  test("2. OFFLINE no momento da baixa: nada é persistido", async () => {
    // Gate A01 é hard-fail no beforeAll (sem skip em runtime).

    const keyBaixa = novoIdempotencyKey();
    const evento = outbox.enfileirar(
      fixture.alocacaoId,
      "pod_registrado",
      {
        pod_registrado: true,
        pod: {
          nome_recebedor: "RECEBEDOR E2E",
          documento_recebedor: "12345678900",
          foto_entrega_url: "storage://bucket/foto-e2e.png",
          assinatura_url: "storage://bucket/assinatura-e2e.png",
          registrado_offline: true,
        },
      },
      keyBaixa,
    );

    // Derruba a rede (modo avião) e tenta sincronizar.
    rede.online = false;
    await expect(outbox.sincronizar(), "sync com rede caída deve falhar").rejects.toBeInstanceOf(
      ErroRedeOffline,
    );

    // O evento permanece na fila, NÃO sincronizado.
    expect(evento.sincronizado).toBe(false);
    expect(outbox.pendentes).toHaveLength(1);

    // Banco inalterado: etapa continua 'assinatura_capturada' e sem evento da key.
    const estado = await obterEstadoMotorista(admin, fixture.alocacaoId);
    expect(estado?.etapaAtual).toBe("assinatura_capturada");
    expect(estado?.podRegistrado).toBe(false);

    const eventos = await eventosPorIdempotencyKey(admin, fixture.alocacaoId, keyBaixa);
    expect(eventos, "evento offline não deve existir no banco").toHaveLength(0);

    console.log("[E2E Cenário 1] PASSO 2 OK — baixa offline não persistida.");
    test.info().annotations.push({ type: "idempotency_key_offline", description: keyBaixa });
  });

  test("3. ONLINE: drena a fila e aplica a baixa UMA única vez", async () => {
    // Gate A01 é hard-fail no beforeAll (sem skip em runtime).
    const pendente = outbox.pendentes[0];
    expect(pendente, "deve haver exatamente 1 evento pendente do passo 2").toBeTruthy();

    // Volta a conexão e sincroniza.
    rede.online = true;
    const respostas = await outbox.sincronizar();
    expect(respostas[0]?.success).toBe(true);
    expect(respostas[0]?.etapa).toBe("pod_registrado");

    const estado = await obterEstadoMotorista(admin, fixture.alocacaoId);
    expect(estado?.etapaAtual).toBe("pod_registrado");
    expect(estado?.podRegistrado).toBe(true);
    expect(estado?.ultimaIdempotency).toBe(pendente.idempotencyKey);

    // Exatamente 1 evento oficial e 1 evento de timeline para essa baixa.
    const eventos = await eventosPorIdempotencyKey(admin, fixture.alocacaoId, pendente.idempotencyKey);
    expect(eventos, "baixa deve gerar exatamente 1 evento").toHaveLength(1);
    expect(eventos[0].event_type).toBe("pod_sent");

    const timeline = await timelinePorEtapa(admin, fixture.alocacaoId, "pod_registrado");
    expect(timeline, "baixa deve gerar exatamente 1 evento de timeline").toHaveLength(1);

    console.log("[E2E Cenário 1] PASSO 3 OK — baixa aplicada uma única vez.");
  });

  test("4. Dupla entrega (at-least-once) não duplica a baixa", async () => {
    // Gate A01 é hard-fail no beforeAll (sem skip em runtime).
    const pendente = outbox.todos.find((e) => e.etapa === "pod_registrado");
    expect(pendente).toBeTruthy();
    if (!pendente) return;

    rede.online = true;
    const [primeira, segunda] = await outbox.enviarComDuplaEntrega(pendente);

    // A primeira reentrega é idempotente (mesma key já registrada).
    expect(primeira.success).toBe(true);
    expect(primeira.idempotent).toBe(true);
    expect(segunda.success).toBe(true);
    expect(segunda.idempotent).toBe(true);

    // Continua havendo exatamente 1 evento — sem duplicação.
    const eventos = await eventosPorIdempotencyKey(admin, fixture.alocacaoId, pendente.idempotencyKey);
    expect(eventos, "reentrega não pode duplicar evento").toHaveLength(1);

    const timeline = await timelinePorEtapa(admin, fixture.alocacaoId, "pod_registrado");
    expect(timeline).toHaveLength(1);

    console.log("[E2E Cenário 1] PASSO 4 OK — dupla entrega idempotente.");
  });

  test("5. Finalização do serviço consolida estado único", async () => {
    // Gate A01 é hard-fail no beforeAll (sem skip em runtime).
    rede.online = true;

    const evento = outbox.enfileirar(fixture.alocacaoId, "servico_finalizado");
    const respostas = await outbox.sincronizar();
    expect(respostas[0]?.success).toBe(true);

    const estado = await obterEstadoMotorista(admin, fixture.alocacaoId);
    expect(estado?.etapaAtual).toBe("servico_finalizado");
    expect(estado?.status).toBe("concluida");
    expect(estado?.finalizada).toBe(true);

    const eventos = await eventosPorIdempotencyKey(admin, fixture.alocacaoId, evento.idempotencyKey);
    expect(eventos, "finalização única").toHaveLength(1);
    expect(eventos[0].event_type).toBe("operation_finished");

    // Uma única transição de timeline para a finalização.
    const timeline = await timelinePorEtapa(admin, fixture.alocacaoId, "servico_finalizado");
    expect(timeline).toHaveLength(1);

    console.log("[E2E Cenário 1] PASSO 5 OK — serviço finalizado sem duplicidade.");
  });
});

// Export para eventual reuso (alguns runners importam o tipo).
export type { FixtureMotorista };

// ============================================================
// PUSH MOTORISTA — ponte TMS → App (FCM)
// Tokens, fila, trigger, Edge Function e RLS de leitura/baixa.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const migBridge = readSrc("supabase/migrations/20261109030000_push_motorista_bridge.sql");
const migRls = readSrc("supabase/migrations/20261109030001_portal_notificacoes_prestador_update.sql");
const edgeFn = readSrc("supabase/functions/enviar-push/index.ts");
const config = readSrc("supabase/config.toml");

describe("Push motorista — banco (tokens + fila + notificações)", () => {
  it("cria a tabela de tokens e a RPC de registo do FCM", () => {
    expect(migBridge).toContain("CREATE TABLE IF NOT EXISTS public.motorista_push_tokens");
    expect(migBridge).toContain("CREATE OR REPLACE FUNCTION public.f_registrar_push_token");
    expect(migBridge).toContain("auth_user_id = auth.uid()");
    expect(migBridge).toContain("ON CONFLICT (token) DO UPDATE");
  });

  it("cria a fila de push e o trigger em portal_notificacoes", () => {
    expect(migBridge).toContain("CREATE TABLE IF NOT EXISTS public.push_notificacoes_fila");
    expect(migBridge).toContain("f_trg_enfileirar_push_notificacao");
    expect(migBridge).toContain("AFTER INSERT ON public.portal_notificacoes");
  });

  it("alocação direta gera 'Novo chamado em aberto' com os_id", () => {
    expect(migBridge).toContain("Novo chamado em aberto");
    expect(migBridge).toContain("Nova OS %s disponível para você");
    expect(migBridge).toContain("NEW.id,");
  });

  it("oportunidade publicada na Rede gera 'Nova OS disponível'", () => {
    expect(migBridge).toContain("Nova OS disponível");
    expect(migBridge).toContain("rede_oportunidades");
  });

  it("prestador pode marcar as suas notificações como lidas", () => {
    expect(migRls).toContain('CREATE POLICY "pn_update_prestador_own"');
    expect(migRls).toContain("prestador_id IN (");
    expect(migRls).toContain("auth.uid()");
  });
});

describe("Push motorista — Edge Function (FCM HTTP v1)", () => {
  it("lê a fila e os tokens com service role", () => {
    expect(edgeFn).toContain('"push_notificacoes_fila"');
    expect(edgeFn).toContain('"motorista_push_tokens"');
    expect(edgeFn).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeFn).toContain("NAO_AUTORIZADO");
  });

  it("envia payload compatível com o Flutter (ícone e canal)", () => {
    expect(edgeFn).toContain("messages:send");
    expect(edgeFn).toContain("ic_notification");
    expect(edgeFn).toContain("#2E1065");
    expect(edgeFn).toContain("FLUTTER_NOTIFICATION_CLICK");
    expect(edgeFn).toContain("FCM_SERVICE_ACCOUNT_JSON");
  });

  it("o app pode marcar tokens inválidos como inativos", () => {
    expect(edgeFn).toContain("tokenInvalido");
    expect(edgeFn).toContain("ativo: false");
  });

  it("função está declarada no config com JWT desativado (auth interna)", () => {
    expect(config).toContain("[functions.enviar-push]");
    expect(config).toContain("verify_jwt = false");
  });
});

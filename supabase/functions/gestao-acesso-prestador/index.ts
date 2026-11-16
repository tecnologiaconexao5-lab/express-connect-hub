import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAPEIS_GESTAO_ACESSO = new Set(["super_admin", "admin_tenant", "gestor", "operacional"]);

interface Input {
  acao:
    | "consultar"
    | "gerar_credenciais"
    | "ativar_e_gerar_credenciais"
    | "bloquear"
    | "desbloquear"
    | "reenviar_credenciais";
  prestador_id: string;
  email?: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function gerarSenhaTemporaria(): string {
  const grupos = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];
  const todos = grupos.join("");
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const senha = grupos.map((grupo, i) => grupo[bytes[i] % grupo.length]);
  for (let i = grupos.length; i < bytes.length; i++) senha.push(todos[bytes[i] % todos.length]);
  for (let i = senha.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1);
    [senha[i], senha[j]] = [senha[j], senha[i]];
  }
  return senha.join("");
}

function habilitarPermissoesApp(metadata: unknown): Record<string, unknown> {
  const metadataAtual =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {};
  const permissoesAtuais =
    metadataAtual.permissoes_app &&
    typeof metadataAtual.permissoes_app === "object" &&
    !Array.isArray(metadataAtual.permissoes_app)
      ? metadataAtual.permissoes_app as Record<string, unknown>
      : {};

  return {
    ...metadataAtual,
    permissoes_app: {
      ...permissoesAtuais,
      podeVerOS: true,
      podeAceitarServico: true,
      podeVerValores: true,
      podeVerHistorico: true,
      podeEnviarDocumentos: true,
      podeAtualizarCadastro: true,
      podeReceberNotificacoes: true,
    },
  };
}

async function obterPrestador(
  admin: SupabaseClient,
  prestadorId: string,
  tenantIds: string[],
  superAdmin: boolean,
) {
  const { data, error } = await admin.from("prestadores").select("*").eq("id", prestadorId).maybeSingle();
  if (error) throw new HttpError(500, "Não foi possível consultar o prestador.");
  if (!data) throw new HttpError(404, "Prestador não encontrado.");
  const tenantId = typeof data.tenant_id === "string" ? data.tenant_id : null;
  if (tenantId && !superAdmin && !tenantIds.includes(tenantId)) {
    throw new HttpError(403, "Você não tem acesso a este prestador.");
  }
  return data as Record<string, unknown>;
}

async function autorizarOperador(
  req: Request,
  url: string,
  anonKey: string,
  admin: SupabaseClient,
): Promise<{ tenantIds: string[]; superAdmin: boolean }> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "Sessão não autenticada.");

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, "Sessão inválida ou expirada.");

  const { data: memberships, error: membershipError } = await admin
    .from("tenant_usuarios")
    .select("tenant_id, papel")
    .eq("user_id", userData.user.id)
    .eq("status", "ativo");
  if (membershipError) throw new HttpError(500, "Não foi possível validar as permissões do operador.");

  const permitted = (memberships || []).filter((row) =>
    PAPEIS_GESTAO_ACESSO.has(String(row.papel))
  );
  if (permitted.length === 0) throw new HttpError(403, "Seu perfil não pode gerenciar acessos de prestadores.");

  return {
    tenantIds: permitted.map((row) => String(row.tenant_id)),
    superAdmin: permitted.some((row) => String(row.papel) === "super_admin"),
  };
}

function normalizarEmail(input: unknown): string {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!EMAIL_REGEX.test(email) || email.length > 254) throw new HttpError(400, "Informe um e-mail de acesso válido.");
  return email;
}

function validarInput(value: unknown): Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Corpo da requisição inválido.");
  }
  const input = value as Record<string, unknown>;
  const acoes = [
    "consultar",
    "gerar_credenciais",
    "ativar_e_gerar_credenciais",
    "bloquear",
    "desbloquear",
    "reenviar_credenciais",
  ];
  if (typeof input.prestador_id !== "string" || !UUID_REGEX.test(input.prestador_id)) {
    throw new HttpError(400, "Identificador do prestador inválido.");
  }
  if (typeof input.acao !== "string" || !acoes.includes(input.acao)) {
    throw new HttpError(400, "Ação de acesso inválida.");
  }
  if (input.email !== undefined && typeof input.email !== "string") {
    throw new HttpError(400, "E-mail de acesso inválido.");
  }
  return input as unknown as Input;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) {
      throw new HttpError(500, "A Edge Function não está configurada corretamente.");
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const operador = await autorizarOperador(req, url, anonKey, admin);
    const input = validarInput(await req.json());
    const prestador = await obterPrestador(admin, input.prestador_id, operador.tenantIds, operador.superAdmin);
    const authUserId = typeof prestador.auth_user_id === "string" ? prestador.auth_user_id : null;

    if (input.acao === "consultar") {
      if (!authUserId) {
        return json(200, {
          ok: true,
          mensagem: "Conta não vinculada.",
          email: null,
          contaExiste: false,
          status: String(prestador.status || "em_analise"),
          liberadoApp: prestador.liberado_app === true,
        });
      }
      const { data, error } = await admin.auth.admin.getUserById(authUserId);
      if (error) throw new HttpError(500, "Não foi possível consultar a conta do aplicativo.");
      return json(200, {
        ok: true,
        mensagem: "Acesso consultado.",
        email: data.user.email || null,
        contaExiste: true,
        status: String(prestador.status || "em_analise"),
        liberadoApp: prestador.liberado_app === true,
      });
    }

    if (input.acao === "bloquear") {
      const { error: blockError } = await admin.from("prestadores")
        .update({ status: "bloqueado", liberado_app: false })
        .eq("id", input.prestador_id);
      if (blockError) throw new HttpError(500, "Não foi possível bloquear o acesso do prestador.");

      if (authUserId) {
        const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
          ban_duration: "876000h",
        });
        if (authError) {
          const { error: rollbackError } = await admin.from("prestadores")
            .update({
              status: String(prestador.status || "em_analise"),
              liberado_app: prestador.liberado_app === true,
              metadata: prestador.metadata ?? null,
            })
            .eq("id", input.prestador_id);
          if (rollbackError) {
            throw new HttpError(500, "O bloqueio da conta falhou e o status não pôde ser restaurado. Verifique o cadastro.");
          }
          throw new HttpError(500, "Não foi possível bloquear a conta. O status anterior foi restaurado.");
        }
      }

      return json(200, {
        ok: true,
        mensagem: "Acesso do motorista bloqueado.",
        email: null,
        contaExiste: Boolean(authUserId),
        status: "bloqueado",
        liberadoApp: false,
      });
    }

    if (input.acao === "desbloquear") {
      if (!authUserId) throw new HttpError(409, "Este prestador ainda não possui uma conta vinculada.");
      const { error } = await admin.auth.admin.updateUserById(authUserId, { ban_duration: "none" });
      if (error) throw new HttpError(500, "Não foi possível desbloquear a conta.");
      return json(200, {
        ok: true,
        mensagem: "Acesso desbloqueado.",
        email: null,
        contaExiste: true,
      });
    }

    const email = normalizarEmail(input.email);
    const redirectTo = `${(Deno.env.get("TMS_SITE_URL") || "https://tms.conexaoexpress.com.br").replace(/\/+$/, "")}/reset-password`;

    if (input.acao === "ativar_e_gerar_credenciais") {
      const senha = gerarSenhaTemporaria();
      let novoAuthUserId: string | null = null;

      if (authUserId) {
        const { error: activationError } = await admin.from("prestadores")
          .update({
            status: "ativo",
            liberado_app: true,
            metadata: habilitarPermissoesApp(prestador.metadata),
          })
          .eq("id", input.prestador_id);
        if (activationError) throw new HttpError(500, "Não foi possível ativar o prestador.");

        const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
          email,
          email_confirm: true,
          password: senha,
          ban_duration: "none",
        });
        if (authError) {
          const { error: rollbackError } = await admin.from("prestadores")
            .update({
              status: String(prestador.status || "em_analise"),
              liberado_app: prestador.liberado_app === true,
            })
            .eq("id", input.prestador_id);
          if (rollbackError) {
            throw new HttpError(500, "A credencial falhou e o status anterior não pôde ser restaurado. Verifique o cadastro.");
          }
          throw new HttpError(409, "Não foi possível atualizar a credencial. O status anterior foi restaurado.");
        }
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { prestador_id: input.prestador_id },
        });
        if (error || !data.user) throw new HttpError(409, "Não foi possível criar a conta. Verifique se o e-mail já está em uso.");
        novoAuthUserId = data.user.id;

        const { error: activationError } = await admin.from("prestadores")
          .update({
            status: "ativo",
            liberado_app: true,
            auth_user_id: novoAuthUserId,
            metadata: habilitarPermissoesApp(prestador.metadata),
          })
          .eq("id", input.prestador_id);
        if (activationError) {
          const { error: cleanupError } = await admin.auth.admin.deleteUser(novoAuthUserId);
          if (cleanupError) {
            throw new HttpError(500, "A conta foi criada, mas a ativação falhou e a conta não pôde ser removida. A equipe técnica precisa verificar o acesso.");
          }
          throw new HttpError(500, "A conta foi criada, mas não foi possível ativar o prestador. A conta temporária foi removida.");
        }
      }

      return json(200, {
        ok: true,
        mensagem: "Motorista ativado e credencial gerada com sucesso.",
        email,
        contaExiste: true,
        senhaTemporaria: senha,
        status: "ativo",
        liberadoApp: true,
      });
    }

    if (input.acao === "gerar_credenciais") {
      const senha = gerarSenhaTemporaria();
      if (authUserId) {
        const { error } = await admin.auth.admin.updateUserById(authUserId, {
          email,
          email_confirm: true,
          password: senha,
          ban_duration: "none",
        });
        if (error) throw new HttpError(409, "Não foi possível atualizar a conta. Verifique se o e-mail já está em uso.");
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { prestador_id: input.prestador_id },
        });
        if (error || !data.user) throw new HttpError(409, "Não foi possível criar a conta. Verifique se o e-mail já está em uso.");
        const { error: linkError } = await admin
          .from("prestadores")
          .update({ auth_user_id: data.user.id })
          .eq("id", input.prestador_id);
        if (linkError) {
          const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
          if (cleanupError) {
            throw new HttpError(
              500,
              "A conta foi criada, mas não pôde ser vinculada nem removida. A equipe técnica precisa verificar a conta.",
            );
          }
          throw new HttpError(500, "A conta foi criada, mas não pôde ser vinculada ao prestador.");
        }
      }
      return json(200, {
        ok: true,
        mensagem: "Login atualizado. A senha temporária é exibida somente nesta tela.",
        email,
        contaExiste: true,
        senhaTemporaria: senha,
      });
    }

    if (!authUserId) throw new HttpError(409, "Gere o login antes de reenviar as credenciais.");
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      email_confirm: true,
    });
    if (updateError) throw new HttpError(409, "Não foi possível atualizar o e-mail. Verifique se ele já está em uso.");

    const emailClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: emailError } = await emailClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (emailError) throw new HttpError(502, "O e-mail foi atualizado, mas não foi possível enviar o link de redefinição.");
    return json(200, {
      ok: true,
      mensagem: "E-mail de redefinição enviado ao endereço de acesso.",
      email,
      contaExiste: true,
    });
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error("Erro não tratado na gestão de acesso do prestador.");
    return json(500, { error: "Erro interno ao gerenciar o acesso do prestador." });
  }
});

import { supabase } from "@/lib/supabase";

export type AcaoGestaoAcessoPrestador =
  | "consultar"
  | "gerar_credenciais"
  | "ativar_e_gerar_credenciais"
  | "bloquear"
  | "desbloquear"
  | "reenviar_credenciais";

interface GestaoAcessoPrestadorInput {
  acao: AcaoGestaoAcessoPrestador;
  prestadorId: string;
  email?: string;
}

interface GestaoAcessoPrestadorResult {
  ok: true;
  mensagem: string;
  email: string | null;
  contaExiste: boolean;
  senhaTemporaria?: string;
  status?: string;
  liberadoApp?: boolean;
}

interface GestaoAcessoPrestadorError {
  error?: string;
}

export async function gerirAcessoPrestador(
  input: GestaoAcessoPrestadorInput,
): Promise<GestaoAcessoPrestadorResult> {
  const { data, error } = await supabase.functions.invoke<
    GestaoAcessoPrestadorResult | GestaoAcessoPrestadorError
  >("gestao-acesso-prestador", {
    body: {
      acao: input.acao,
      prestador_id: input.prestadorId,
      email: input.email,
    },
  });

  if (error) {
    let responseError = data && "error" in data ? data.error : undefined;
    const context = "context" in error ? error.context : undefined;
    if (!responseError && context instanceof Response) {
      try {
        const body = await context.clone().json() as GestaoAcessoPrestadorError;
        responseError = body.error;
      } catch {
        responseError = undefined;
      }
    }
    throw new Error(responseError || error.message || "Falha na gestão de acesso do prestador.");
  }
  if (!data || !("ok" in data) || data.ok !== true) {
    throw new Error((data && "error" in data && data.error) || "A Edge Function não confirmou a operação.");
  }
  return data;
}

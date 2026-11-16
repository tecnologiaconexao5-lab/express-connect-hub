import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fromPrestadorRow, toPrestadorUpdate } from "@/lib/dbMappers";

const raiz = resolve(__dirname, "../..");
const ler = (path: string) => readFileSync(resolve(raiz, path), "utf8");

describe("Gestão de acesso de prestadores", () => {
  it("persiste permissões no metadata e as recupera ao abrir o prestador", () => {
    const permissoes = {
      podeVerOS: true,
      podeAceitarServico: true,
      podeVerValores: false,
    };
    const payload = toPrestadorUpdate({
      metadata: { origem: "app" },
      permissoes,
    });

    expect(payload.metadata).toEqual({ origem: "app", permissoes_app: permissoes });
    expect(fromPrestadorRow({
      id: "p-1",
      metadata: payload.metadata as Record<string, unknown>,
    }).permissoes).toEqual(permissoes);
  });

  it("mantém as permissões individuais e atualiza o estado do painel após a ação", () => {
    const source = ler("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(source).toContain("...(checked");
    expect(source).toContain("PERMISSOES_APP.map(({ field }) => [field, true])");
    expect(source).toContain("checked={p.liberadoApp ?? false}");
    expect(source).toContain("setContaAcessoExiste(resultado.contaExiste)");
    expect(source).toContain("liberadoApp: resultado.liberadoApp ?? prev.liberadoApp");
  });

  it("usa uma Edge Function autenticada para operações de Auth sem expor service role", () => {
    const edge = ler("supabase/functions/gestao-acesso-prestador/index.ts");
    const config = ler("supabase/config.toml");
    expect(config).toContain("[functions.gestao-acesso-prestador]\nverify_jwt = true");
    expect(edge).toContain("tenant_usuarios");
    expect(edge).toContain("PAPEIS_GESTAO_ACESSO");
    expect(edge).toContain("admin.auth.admin.updateUserById");
    expect(edge).toContain("resetPasswordForEmail");
    expect(edge).not.toContain("console.log(senha");
  });

  it("exibe painel de ativação, preferências do App e ações sincronizadas com o status", () => {
    const source = ler("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(source).toContain("Gerenciamento de Acesso");
    expect(source).toContain("Preferências escolhidas no app");
    expect(source).toContain("Ambos (Contrato e Esporádico)");
    expect(source).toContain("Ativar Motorista e Gerar Credencial");
    expect(source).toContain('executarAcaoAcesso("ativar_e_gerar_credenciais")');
    expect(source).toContain('executarAcaoAcesso("bloquear")');
    expect(source).toContain('executarAcaoAcesso("reenviar_credenciais")');
    expect(source).toContain("motoristaAtivo ? (");
    expect(source).toContain("Motorista Ativo");
    expect(source).not.toContain("onClick={liberarAcessoApp}");
    const edge = ler("supabase/functions/gestao-acesso-prestador/index.ts");
    expect(edge).toContain('status: "ativo"');
    expect(edge).toContain("liberado_app: true");
    expect(edge).toContain("metadata: habilitarPermissoesApp(prestador.metadata)");
    expect(edge).toContain("podeAceitarServico: true");
    expect(edge).toContain('status: "bloqueado", liberado_app: false');
  });
});

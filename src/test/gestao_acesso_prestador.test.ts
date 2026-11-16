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

  it("ativa todas as permissões individuais ao ligar o acesso master", () => {
    const source = ler("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(source).toContain("...(checked");
    expect(source).toContain("PERMISSOES_APP.map(({ field }) => [field, true])");
    expect(source).toContain("checked={p.liberadoApp ?? false}");
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

  it("expõe ações de credencial e liberação na seção Gerenciamento de Acesso", () => {
    const source = ler("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(source).toContain("Gerenciamento de Acesso");
    expect(source).toContain("Gerar/Resetar Senha de Acesso");
    expect(source).toContain('executarAcaoAcesso("gerar_credenciais")');
    expect(source).toContain("Liberar Acesso ao App");
    expect(source).toContain("onClick={liberarAcessoApp}");
    expect(source).toContain('normalizarStatusPrestador(p.status) !== "ativo"');
    expect(source).toContain("liberadoApp: true");
    expect(source).toContain("Salve o prestador para aplicar a alteração.");
  });
});

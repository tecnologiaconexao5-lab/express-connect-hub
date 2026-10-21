import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const osMobile = readSrc("src/pages/OsMobile.tsx");
const historico = readSrc("src/services/clientes/historicoEnderecosCliente.ts");
const searchable = readSrc("src/components/ui/SearchableSelect.tsx");

describe("1) PIX opcional na criação da OS", () => {
  it("1.1 — criação não exige mais o PIX do avulso", () => {
    expect(osMobile).not.toContain("validarPixChave(avulsoPixTipo, avulsoPixChave)");
    expect(osMobile).toContain("// PIX é OPCIONAL na criação da OS");
  });

  it("1.2 — labels de PIX sem asterisco obrigatório e com aviso", () => {
    expect(osMobile).not.toContain("Tipo de PIX *");
    expect(osMobile).not.toContain("Chave PIX *");
    expect(osMobile).toContain("O PIX é opcional na criação da OS");
  });

  it("1.3 — a baixa/finalização exige PIX válido", () => {
    expect(osMobile).toContain("validarPixChave(pixTipoBaixa, pixChaveBaixa)");
    expect(osMobile).toContain('"Informe a chave PIX do repasse"');
    expect(osMobile).toContain("PIX do repasse ao prestador *");
  });

  it("1.4 — PIX confirmado na baixa volta para financeiro_pagar", () => {
    expect(osMobile).toContain("chave_pix: chavePix");
    expect(osMobile).toContain('from("financeiro_pagar")');
    expect(osMobile).toContain("PIX ${pixTipoBaixa}: ${chavePix}");
  });
});

describe("2) Histórico de endereços filtrado por cliente_id", () => {
  it("2.1 — consulta de cadastro sempre filtra por cliente_id", () => {
    expect(historico).toContain('.from("enderecos_clientes")');
    expect(historico).toContain('.eq("cliente_id", clienteId)');
  });

  it("2.2 — leitura tolerante a colunas opcionais (select *)", () => {
    expect(historico).toContain('.select("*")');
    expect(historico).not.toContain("COLUNAS_ENDERECO_COMPLETAS");
    expect(historico).not.toContain("COLUNAS_ENDERECO_BASE");
  });

  it("2.3 — histórico de OS também é filtrado pelo cliente", () => {
    expect(historico).toContain('.from("ordens_servico")');
    expect(historico).toContain("cliente_id.eq.${clienteId},cliente.eq.${clienteId}");
  });

  it("2.4 — cliente inválido/vazio não consulta o banco", () => {
    expect(historico).toContain("UUID_REGEX.test(clienteId)");
  });
});

describe("3) Favorito por cliente nas paradas", () => {
  it("3.1 — checkbox presente no preenchimento de cada parada", () => {
    expect(osMobile).toContain("Salvar endereço como favorito para este cliente");
    expect(osMobile).toContain("salvarFavorito");
    expect(osMobile).toContain("atualizarParada(parada.id, { salvarFavorito: e.target.checked })");
  });

  it("3.2 — favoritos são gravados vinculados ao cliente da OS", () => {
    expect(osMobile).toContain("salvarEnderecoFavoritoCliente(clienteId");
    expect(osMobile).toContain("p.salvarFavorito");
  });

  it("3.3 — serviço de favorito insere/atualiza por cliente_id", () => {
    expect(historico).toContain("export const salvarEnderecoFavoritoCliente");
    expect(historico).toContain("cliente_id: clienteId");
    expect(historico).toContain('.eq("id", idExistente)');
    expect(historico).toContain("limparCacheHistoricoEnderecos(clienteId)");
  });

  it("3.4 — fallback para ambientes sem colunas operacionais extras", () => {
    expect(historico).toContain("let resultado = await salvar(true)");
    expect(historico).toContain("resultado = await salvar(false)");
  });

  it("3.5 — EnderecoCompleto recebe o cliente da OS", () => {
    expect(osMobile).toContain("clienteId={clienteId || undefined}");
  });
});

describe("4) Pré-cadastro do cliente reflete no Supabase", () => {
  it("4.1 — INSERT sem RETURNING (não mascara/força erro de RLS)", () => {
    expect(osMobile).not.toContain(".insert([payload])\n        .select(");
    expect(osMobile).toContain('const { error } = await supabase.from("clientes").insert([payload])');
    expect(osMobile).toContain("if (error) throw error;");
  });

  it("4.2 — id gerado no cliente garante o vínculo mesmo sem RETURNING", () => {
    expect(osMobile).toContain("const novoId = uid()");
    expect(osMobile).toContain("payload.id = novoId");
    expect(osMobile).toContain("setClienteId(novoId)");
  });

  it("4.3 — tenant resolvido com fallback em tenant_usuarios", () => {
    expect(osMobile).toContain("const resolverTenantId");
    expect(osMobile).toContain('from("tenant_usuarios")');
    expect(osMobile).toContain('.eq("user_id", authUserId)');
  });

  it("4.4 — pré-cadastro continua marcado e visível no seletor", () => {
    expect(osMobile).toContain('status: "pre-cadastro"');
    expect(osMobile).toContain("FILTRO_CLIENTES_OS");
    expect(osMobile).toContain('["ativo", "pre-cadastro"]');
    expect(searchable).toContain("query = query.in(k, v)");
  });

  it("4.5 — erro real é exposto no toast e no console", () => {
    expect(osMobile).toContain('console.error("[OsMobile] Erro ao pré-cadastrar cliente:"');
    expect(osMobile).toContain('toast.error("Não foi possível cadastrar o cliente"');
  });
});

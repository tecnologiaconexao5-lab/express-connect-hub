// ============================================================
// AJUSTES FINOS PÓS-HOMOLOGAÇÃO — UUID do prestador na lista,
// repasse automático, preview rica, Voltar por etapa e ordem do rodapé.
// Testes baseados em fonte (padrão do repo).
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
const readSrc = (rel: string): string => readFileSync(join(raiz, rel), "utf8");

const listaSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const previewSrc = readSrc("src/components/operacao/OrdemServicoPreview.tsx");
const formSrc = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const footerSrc = readSrc("src/components/ui/enterprise.tsx");
const mapperSrc = readSrc("src/lib/dbMappers.ts");

describe("1) Prestador exibido pelo NOME (nunca UUID)", () => {
  it("1.1 lista resolve os uuid via tabela prestadores e mantém o id para gravação", () => {
    expect(listaSrc).toContain('.from("prestadores")');
    expect(listaSrc).toContain('.select("id, nome_completo")');
    expect(listaSrc).toContain("prestador: prestadorUuid ? (nomesPrestador[prestadorUuid] || \"\") : (os.prestador || \"\")");
    expect(listaSrc).toContain("prestadorId: prestadorUuid || undefined");
  });

  it("1.2 preview resolve nome/cliente quando o registro traz uuid", () => {
    expect(previewSrc).toContain("nomesResolvidos");
    expect(previewSrc).toContain('const prestadorNome = nomesResolvidos.prestador');
    expect(previewSrc).toContain("<LabelRow label=\"Cliente\">{clienteNome || \"—\"}</LabelRow>");
    expect(previewSrc).toContain("{prestadorNome ? (");
  });
});

describe("2) Repasse automático no modal de alocação", () => {
  it("2.1 abrirAlocacao pré-carrega o custo da OS com fallbacks legados", () => {
    expect(listaSrc).toContain("const repasseAtual =");
    expect(listaSrc).toContain("Number(os.custoPrestador) ||");
    expect(listaSrc).toContain("Number(os.carga?.custoPrestador) ||");
    expect(listaSrc).toContain("Number(os.carga?.repassePrestador) ||");
    expect(mapperSrc).toContain("custoPrestador: item.custo_prestador ?? item.custoPrestador ?? (item as any).carga?.custoPrestador ?? 0");
  });

  it("2.2 o campo continua editável manualmente", () => {
    expect(listaSrc).toContain("value={repasseAlocacao}");
    expect(listaSrc).toContain('onChange={(e) => setRepasseAlocacao(e.target.value)}');
  });
});

describe("3) Preview com Resumo Operacional rico", () => {
  it("3.1 painéis de Cliente/Prestador/Receita/Custo/Status", () => {
    expect(previewSrc).toContain("Resumo Operacional");
    expect(previewSrc).toContain("/> Cliente");
    expect(previewSrc).toContain("/> Prestador");
    expect(previewSrc).toContain("/> Receita");
    expect(previewSrc).toContain("/> Custo");
    expect(previewSrc).toContain("/> Status");
    expect(previewSrc).toContain("Margem:");
  });

  it("3.2 bug pré-existente do alias `sup` corrigido (fiscal volta a funcionar)", () => {
    expect(previewSrc).not.toContain("sup.from(");
    expect(previewSrc).toContain('supabase.from("fiscal_ctes")');
  });
});

describe("4) Botão Voltar do rodapé retrocede uma etapa", () => {
  it("4.1 handleVoltarEtapa usa a etapa anterior e só sai na primeira", () => {
    expect(formSrc).toContain("const handleVoltarEtapa = () => {");
    expect(formSrc).toContain("const anterior = idxAbaAtual > 0 ? etapasDoc[idxAbaAtual - 1] : null;");
    expect(formSrc).toContain("setAbaAtiva(anterior.value);");
    expect(formSrc).toContain("void handleVoltar();");
    expect(formSrc).toContain("onCancelar={handleVoltarEtapa}");
  });

  it("4.2 saída real (credenciais/close) continua passando pelo guard", () => {
    expect(formSrc).toContain("<PremiumDialogHeader onClose={handleVoltar}>");
    expect(formSrc).toContain("const pode = await exitGuard.confirmExit();");
  });
});

describe("5) Ordem dos botões do rodapé", () => {
  it("5.1 rascunho → avançar → salvar (salvar por último, à direita)", () => {
    const bloco = footerSrc.slice(
      footerSrc.indexOf("export function FormFooterBar"),
      footerSrc.indexOf("* Workspace Enterprise"),
    );
    const iRascunho = bloco.indexOf("onSalvarRascunho && (");
    const iAvancar = bloco.indexOf("onAvancar && (");
    const iSalvar = bloco.indexOf("onSalvar && (");
    expect(iRascunho).toBeGreaterThan(-1);
    expect(iAvancar).toBeGreaterThan(iRascunho);
    expect(iSalvar).toBeGreaterThan(iAvancar);
  });
});

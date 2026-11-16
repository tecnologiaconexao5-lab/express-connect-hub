import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const detalhe = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/prestadores/PrestadorDetalhe.tsx"),
  "utf8",
);

describe("PrestadorDetalhe — preservação de estado", () => {
  it("mantém rascunhos temporários também na edição, separados por prestador", () => {
    expect(detalhe).toContain("`${DRAFT_KEY}:${user?.id || \"session\"}:${initial.id}`");
    expect(detalhe).toContain("loadDraft(draftKey)");
    expect(detalhe).toContain("useAutoSaveFormDraft(draftKey, draftData, isDirty)");
    expect(detalhe).toContain("veiculos");
    expect(detalhe).toContain("contatosEmergencia");
    expect(detalhe).toContain("permissoes");
  });

  it("guarda e restaura rascunhos com o TTL padrão do formulário", () => {
    expect(detalhe).toContain("lerRascunhoForm<Partial<Prestador>>(key)");
    expect(detalhe).toContain("liberarRascunhoForm(draftKey)");
  });

  it("protege o voltar do cabeçalho e o cancelar com a mesma confirmação", () => {
    expect(detalhe).toContain("onClick={handleRequestBack}");
    expect(detalhe).toContain("if (isDirty) {");
    expect(detalhe).toContain("setShowDiscardDialog(true)");
    expect(detalhe).not.toContain("onClick={onBack}");
  });

  it("remove e bloqueia o rascunho ao descartar ou salvar com sucesso", () => {
    expect(detalhe).toContain("descartarRascunhoForm(draftKey)");
    expect(detalhe).toContain("onClick={handleDiscardClick}");
  });
});

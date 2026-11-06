// ═══════════════════════════════════════════════════════════════════════════════
// PROP-ANEXO-PDF (GD-11) — Upload de PDF no Editor de Propostas + Orçamento
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validarArquivoAnexo } from "@/lib/anexoDocumento";
import { toOrcamentoInsert } from "@/lib/dbMappers";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SRC_EDITOR = "src/components/comercial/propostas/EditorProposta.tsx";
const SRC_ORC = "src/components/comercial/OrcamentoForm.tsx";
const SRC_TYPES = "src/components/comercial/types.ts";

describe("A — EditorProposta: upload para o bucket privado `propostas`", () => {
  const src = read(SRC_EDITOR);

  it("A.1 — imports de upload (supabase, validarArquivoAnexo, BUCKET_PROPOSTAS, SIGN_TTL_SECONDS)", () => {
    expect(src).toContain('import { supabase } from "@/lib/supabase";');
    expect(src).toContain('import { validarArquivoAnexo } from "@/lib/anexoDocumento";');
    expect(src).toContain('import { BUCKET_PROPOSTAS } from "@/services/documentos/documentoStorageService";');
    expect(src).toContain('import { SIGN_TTL_SECONDS } from "@/services/storage/storageRefService";');
  });

  it("A.2 — upload vai para BUCKET_PROPOSTAS com contentType application/pdf e upsert false", () => {
    expect(src).toContain(".from(BUCKET_PROPOSTAS)");
    expect(src).toContain('.upload(caminho, file, { upsert: false, contentType: "application/pdf" })');
    expect(src).toContain("const referencia = `${BUCKET_PROPOSTAS}/${path}`;");
    expect(src).toContain("createSignedUrl(path, SIGN_TTL_SECONDS)");
  });

  it("A.3 — valida arquivo + recusa não-PDF com mensagem específica", () => {
    expect(src).toContain("const erroArquivo = validarArquivoAnexo(file);");
    expect(src).toContain('toast.error("Envie um arquivo PDF para a proposta.");');
    expect(src).toContain('file.type === "application/pdf" || /\\.pdf$/i.test(file.name)');
    // guard anti-duplo upload
    expect(src).toContain("if (!file || isUploading) return;");
  });

  it("A.4 — Título Oficial preenchido pelo nome do PDF só quando vazio", () => {
    expect(src).toContain("titulo: prev.titulo.trim() ? prev.titulo : tituloDoPdf(file.name)");
    expect(src).toContain("return nome.replace(/\\.pdf$/i, \"\").trim();");
    // rótulo do campo preservado
    expect(src).toContain("Título Oficial da Proposta");
  });

  it("A.5 — estado do anexo gravado com nome/path/referencia/url", () => {
    expect(src).toContain("anexo: { nome: file.name, path, referencia, url }");
    expect(src).toContain("anexo: normalizarAnexo(proposta?.anexo)");
    // normalizar recupera path da referencia quando ausente
    expect(src).toContain("path: a.path || referencia.replace(/^propostas\\//, \"\")");
    expect(src).toContain("if (!a || !a.referencia) return null;");
  });

  it("A.6 — feedback de isUploading no dropzone, no botão e no salvar", () => {
    expect(src).toContain("Enviando PDF para o bucket propostas...");
    expect(src).toContain("Anexando PDF...");
    expect(src).toContain("disabled={loading || isUploading}");
    expect(src).toContain("Aguarde o upload do PDF terminar antes de salvar.");
    expect(src).toContain("const [isUploading, setIsUploading] = useState(false);");
  });

  it("A.7 — dropzone com drag & drop, input oculto e chip com Abrir/Remover", () => {
    expect(src).toContain('data-testid="prop-anexo-input"');
    expect(src).toContain('data-testid="prop-anexo-dropzone"');
    expect(src).toContain('data-testid="prop-anexo-chip"');
    expect(src).toContain("void anexarPdf(e.dataTransfer.files?.[0]);");
    expect(src).toContain('accept="application/pdf,.pdf"');
    // abrir = signed URL nova + window.open seguro; remover = anexo null
    expect(src).toContain("createSignedUrl(formData.anexo.path, SIGN_TTL_SECONDS)");
    expect(src).toContain('window.open(data.signedUrl, "_blank", "noopener,noreferrer")');
    expect(src).toContain("setFormData((prev) => ({ ...prev, anexo: null }));");
  });

  it("A.8 — salvar menciona o anexo gravado e pronto para envio por e-mail", () => {
    expect(src).toContain("Proposta salva com sucesso!");
    expect(src).toContain("gravado e pronto para envio por e-mail.");
  });
});

describe("B — OrcamentoForm: botão 'Anexar Arquivo' funcional (GD-11)", () => {
  const src = read(SRC_ORC);

  it("B.1 — botão deixa de ser morto: abre o input oculto", () => {
    expect(src).toContain("onClick={() => anexoInputRef.current?.click()}");
    expect(src).toContain('<UploadCloud className="w-4 h-4 mr-2" /> Anexar Arquivo');
    expect(src).toContain("disabled={isUploadingAnexo}");
    expect(src).toContain('data-testid="orc-anexo-input"');
    expect(src).toContain('data-testid="orc-anexo-dropzone"');
    expect(src).toContain("void anexarArquivoOrcamento(e.dataTransfer.files?.[0]);");
  });

  it("B.2 — upload para o mesmo bucket `propostas` com MIME PDF", () => {
    expect(src).toContain('import { supabase } from "@/lib/supabase";');
    expect(src).toContain('import { validarArquivoAnexo } from "@/lib/anexoDocumento";');
    expect(src).toContain('import { BUCKET_PROPOSTAS } from "@/services/documentos/documentoStorageService";');
    expect(src).toContain(".from(BUCKET_PROPOSTAS)");
    expect(src).toContain('.upload(caminho, file, { upsert: false, contentType: "application/pdf" })');
    expect(src).toContain('toast.error("Envie um arquivo PDF para anexar ao orçamento.");');
  });

  it("B.3 — anexo fica no estado do formulário (data.anexo) com Abrir/Remover", () => {
    expect(src).toContain("const [isUploadingAnexo, setIsUploadingAnexo] = useState(false);");
    expect(src).toContain("setData((prev) => ({ ...prev, anexo }));");
    expect(src).toContain('data-testid="orc-anexo-chip"');
    expect(src).toContain("abrirAnexoOrcamento");
    expect(src).toContain("removerAnexoOrcamento");
    expect(src).toContain("setData((prev) => ({ ...prev, anexo: null }));");
    expect(src).toContain("A referência do arquivo é gravada com o orçamento ao salvar e fica pronta para envio por e-mail.");
  });
});

describe("C — tipos + persistência (sem coluna nova em `orcamentos`)", () => {
  const types = read(SRC_TYPES);

  it("C.1 — AnexoOrcamento com nome/path/referencia/url e campo opcional em Orcamento", () => {
    expect(types).toContain("export interface AnexoOrcamento");
    expect(types).toMatch(/interface AnexoOrcamento \{[^}]*nome: string;[^}]*path: string;[^}]*referencia: string;[^}]*url: string;/s);
    expect(types).toContain("anexo?: AnexoOrcamento | null;");
  });

  it("C.2 — toOrcamentoInsert não envia anexo (whitelist sem migration)", () => {
    const payload = toOrcamentoInsert({
      numero: "ORC-1",
      valores: { valorBase: 100, valorFinal: 100 },
      anexo: { nome: "p.pdf", path: "p.pdf", referencia: "propostas/p.pdf", url: "" },
    } as never) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("anexo");
    expect(payload).not.toHaveProperty("anexo_url");
  });

  it("C.3 — validarArquivoAnexo rejeita arquivo grande/errado antes do upload", () => {
    const grande = new File([new Uint8Array(10)], "a.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 60 * 1024 * 1024 });
    expect(validarArquivoAnexo(grande)).toBeTruthy();
  });
});

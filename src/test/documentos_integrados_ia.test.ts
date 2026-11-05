/**
 * DOCUMENTOS-INTEGRADOS-IA — cadastro rápido de cliente + bucket/metadados +
 * upload do prestador + análise de IA com modal de relatório.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const CADASTRO_RAPIDO = readSrc("src/lib/cadastroRapido.ts");
const FORM_OS = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const MIGRATION = readSrc("supabase/migrations/20261102000001_documentos_operacionais_metadata.sql");
const METADATA_SERVICE = readSrc("src/services/documentos/documentosMetadataService.ts");
const STORAGE = readSrc("src/services/storage/storageRefService.ts");
const DOC_STORAGE = readSrc("src/services/documentos/documentoStorageService.ts");
const PRESTADOR = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const MODAL = readSrc("src/components/documentos/DocumentoIAReportModal.tsx");
const EDGE = readSrc("supabase/functions/documentos-ia/index.ts");

describe("1) Cadastro rápido de cliente na Nova OS", () => {
  it("cria cliente pré-cadastro com telefone e WhatsApp", () => {
    expect(CADASTRO_RAPIDO).toContain('status: "pre-cadastro"');
    expect(CADASTRO_RAPIDO).toContain("whatsapp: (input.telefone || \"\").trim() || undefined");
  });

  it("Nova OS tem botão discreto, modal nome+telefone e auto-seleção", () => {
    expect(FORM_OS).toContain('title="Cadastro rápido de cliente (nome + WhatsApp)"');
    expect(FORM_OS).toContain("Cadastro Rápido de Cliente");
    expect(FORM_OS).toContain("Nome / Razão Social");
    expect(FORM_OS).toContain("Telefone / WhatsApp");
    expect(FORM_OS).toContain("criarClienteRapido({ nome, telefone })");
    expect(FORM_OS).toContain('update("clienteId", clienteId || null)');
    expect(FORM_OS).toContain("criado como pré-cadastro e selecionado");
  });
});

describe("2) Bucket documentos_operacionais + documentos_metadata", () => {
  it("migration cria bucket privado e policies", () => {
    expect(MIGRATION).toContain("'documentos_operacionais'");
    expect(MIGRATION).toContain("CREATE POLICY \"documentos_operacionais_select\"");
    expect(MIGRATION).toContain("USING (bucket_id = 'documentos_operacionais')");
  });

  it("migration cria tabela com colunas e espelhamento App -> metadata", () => {
    for (const coluna of [
      "url",
      "nome",
      "tipo",
      "modulo_origem",
      "entidade_id",
      "status_ia",
      "relatorio_ia",
      "data_inclusao",
    ]) {
      expect(MIGRATION).toContain(coluna);
    }
    expect(MIGRATION).toContain("trg_documentos_prestadores_metadata");
    expect(MIGRATION).toContain("f_documentos_prestadores_para_metadata");
    expect(MIGRATION).toContain("ON CONFLICT (modulo_origem, entidade_id, url) DO NOTHING");
  });
});

describe("3) Integração com a Documentação do Prestador", () => {
  it("liê metadados e envia upload ao novo bucket", () => {
    expect(PRESTADOR).toContain('listarDocumentosMetadata("prestadores", p.id)');
    expect(PRESTADOR).toContain("enviarDocumentoOperacionalPrestador");
    expect(PRESTADOR).toContain("documentosMetadata");
    expect(METADATA_SERVICE).toContain("BUCKET_DOCUMENTOS_OPERACIONAIS");
    expect(METADATA_SERVICE).toContain('.from(TABELA).insert([payload])');
    expect(METADATA_SERVICE).toContain('.from("documentos_prestadores").insert');
  });

  it("resolve referências do bucket novo sem regressão do bucket legado", () => {
    expect(STORAGE).toContain('"documentos_operacionais"');
    expect(DOC_STORAGE).toContain("BUCKET_DOCUMENTOS_OPERACIONAIS");
    expect(DOC_STORAGE).toContain("const permitidos = new Set([bucketEsperado, BUCKET_DOCUMENTOS_OPERACIONAIS]);");
  });
});

describe("4) Análise com IA + modal de relatório", () => {
  it("serviço chama a Edge Function e mantém fallback simulado", () => {
    expect(METADATA_SERVICE).toContain('supabase.functions.invoke("documentos-ia"');
    expect(METADATA_SERVICE).toContain("simularAnaliseDocumentoIA");
    expect(EDGE).toContain("APROVADO NA CONFERÊNCIA");
    expect(EDGE).toContain("COM RESSALVAS");
    expect(EDGE).toContain("NECESSITA DE CORREÇÃO");
  });

  it("prestador dispara a análise e abre o modal com status/observações", () => {
    expect(PRESTADOR).toContain("handleAnalisarIA");
    expect(PRESTADOR).toContain("analisarDocumentoComIA");
    expect(PRESTADOR).toContain("atualizarAnaliseDocumentoMetadata");
    expect(PRESTADOR).toContain("<DocumentoIAReportModal");
    expect(MODAL).toContain("Relatório de Conformidade");
    expect(MODAL).toContain("resultado.observacoes");
    expect(MODAL).toContain("APROVADO NA CONFERÊNCIA");
    expect(MODAL).toContain("NECESSITA DE CORREÇÃO");
  });
});

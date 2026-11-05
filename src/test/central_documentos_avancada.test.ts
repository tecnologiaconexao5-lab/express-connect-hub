/**
 * CENTRAL-DOCUMENTOS-AVANCADA — página dedicada, filtros combinados, ações por
 * documento, upload universal, versionamento e relatório de IA estruturado.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const APP = readSrc("src/App.tsx");
const ROUTES = readSrc("src/lib/routePermissions.ts");
const SIDEBAR = readSrc("src/lib/sidebarData.ts");
const PAGE = readSrc("src/pages/CentralDocumentos.tsx");
const ACTIONS = readSrc("src/components/documentos/DocumentoAcoesDropdown.tsx");
const UPLOAD = readSrc("src/components/documentos/DocumentoUploadUniversal.tsx");
const IA_MODAL = readSrc("src/components/documentos/DocumentoIAReportModal.tsx");
const SERVICE = readSrc("src/services/documentos/documentosMetadataService.ts");
const MIGRATION = readSrc("supabase/migrations/20261102000002_documentos_central_avancada.sql");
const PRESTADOR = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");

describe("1) Página e rota da Central de Documentos", () => {
  it("rota dedicada, permissão e item de sidebar", () => {
    expect(APP).toContain('const CentralDocumentos = lazy(() => import("@/pages/CentralDocumentos"))');
    expect(APP).toContain('<Route path="/central-documentos"');
    expect(ROUTES).toContain('"/central-documentos"');
    expect(SIDEBAR).toContain('"/central-documentos"');
    expect(SIDEBAR).toContain('title: "Central de Documentos"');
  });

  it("filtros combinados obrigatórios", () => {
    for (const filtro of ["nome", "categoria", "departamento", "entidade", "responsavel", "dataInicio", "dataFim", "statusIa"]) {
      expect(PAGE).toContain(filtro);
    }
    expect(PAGE).toContain("listarDocumentosCentral");
    expect(PAGE).toContain("Filtros combinados");
    expect(SERVICE).toContain('query.ilike("nome"');
    expect(SERVICE).toContain('query.eq("categoria"');
    expect(SERVICE).toContain('query.ilike("departamento"');
    expect(SERVICE).toContain('query.ilike("entidade_nome"');
    expect(SERVICE).toContain('query.ilike("responsavel"');
    expect(SERVICE).toContain('query.gte("data_inclusao"');
  });
});

describe("2) Ações individuais por documento", () => {
  it("dropdown contém as 7 ações obrigatórias", () => {
    for (const acao of [
      "Adicionar nova versão",
      "Visualizar",
      "Baixar",
      "Compartilhar Internamente",
      "Análise de Conformidade",
      "Consultar Histórico",
      "Atualizar Versão",
    ]) {
      expect(ACTIONS).toContain(acao);
    }
  });

  it("perfil do prestador também usa o dropdown completo", () => {
    expect(PRESTADOR).toContain("<DocumentoAcoesDropdown");
    expect(PRESTADOR).toContain("<DocumentoHistoricoModal");
    expect(PRESTADOR).toContain("<DocumentoCompartilharModal");
    expect(PRESTADOR).toContain("<DocumentoNovaVersaoDialog");
  });
});

describe("3) Upload universal", () => {
  it("aciona câmera e gerenciador de arquivos nativamente", () => {
    expect(UPLOAD).toContain('accept="image/*"');
    expect(UPLOAD).toContain('capture="environment"');
    expect(UPLOAD).toContain('type="file"');
    expect(UPLOAD).toContain("Tirar foto");
    expect(UPLOAD).toContain("Escolher arquivo");
  });

  it("envia direto ao Storage sem persistência local", () => {
    expect(SERVICE).toContain("BUCKET_DOCUMENTOS_OPERACIONAIS");
    expect(SERVICE).toContain(".upload(path, file");
    expect(SERVICE).toContain('.from(TABELA).insert([payload])');
  });
});

describe("4) Relatório de Conformidade denso + versionamento", () => {
  it("modal exibe as 5 seções e os 4 status exatos", () => {
    for (const secao of [
      "Informações Verificadas",
      "Itens Corretos",
      "Informações Ausentes",
      "Erros Identificados",
      "Recomendações",
    ]) {
      expect(IA_MODAL).toContain(secao);
    }
    for (const status of [
      "APROVADO NA CONFERÊNCIA",
      "APROVADO COM RESSALVAS",
      "NECESSITA DE CORREÇÃO",
      "AGUARDANDO CONFERÊNCIA HUMANA",
    ]) {
      expect(IA_MODAL).toContain(status);
    }
  });

  it("oferece Gerar Nova Versão preservando o original", () => {
    expect(IA_MODAL).toContain("Gerar Nova Versão");
    expect(SERVICE).toContain("criarNovaVersaoDocumento");
    expect(SERVICE).toContain("documento_pai_id");
    expect(SERVICE).toContain('update({ ativo: false })');
    expect(SERVICE).toContain("Arquivo original preservado");
  });

  it("migration adiciona organização/versão/histórico e novos status", () => {
    for (const coluna of [
      "categoria",
      "departamento",
      "entidade_nome",
      "responsavel",
      "versao",
      "documento_pai_id",
      "ativo",
      "historico",
    ]) {
      expect(MIGRATION).toContain(coluna);
    }
    expect(MIGRATION).toContain("aprovado_com_ressalvas");
    expect(MIGRATION).toContain("aguardando_conferencia_humana");
  });
});

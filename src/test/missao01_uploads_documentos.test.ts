/**
 * MISSÃO 1 — Uploads de documentos existentes.
 * GAP 1: anexo de contrato de cliente vai ao Storage e o contrato guarda a referência.
 * GAP 2: comprovante de pedágio pode ser enviado como arquivo (não só URL colada).
 * Os testes abaixo são de contrato/fonte (padrão do repositório) + validação pura.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  validarArquivoAnexo,
  garantirTipoAnexo,
  TAMANHO_MAX_ANEXO_BYTES,
} from "@/lib/anexoDocumento";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const CLIENTE_DETALHE = readSrc("src/components/clientes/ClienteDetalhe.tsx");
const CONTRATO_SERVICE = readSrc("src/services/clientes/contratoAnexoService.ts");
const CONFERENCIA = readSrc("src/components/financeiro/ConferenciaFinanceira.tsx");
const REEMBOLSO_SERVICE = readSrc("src/services/operacao/reembolsoPedagioService.ts");
const METADATA_SERVICE = readSrc("src/services/documentos/documentosMetadataService.ts");
const ANEXO_LIB = readSrc("src/lib/anexoDocumento.ts");

const arquivoFake = (input: { name: string; type: string; size: number }): File =>
  input as unknown as File;

describe("A) Contrato de cliente — upload real do anexo", () => {
  it("o binário é enviado ao Storage via serviço existente", () => {
    expect(CLIENTE_DETALHE).toContain("enviarAnexoContrato({");
    expect(CONTRATO_SERVICE).toContain("enviarDocumentoOperacional({");
    expect(CONTRATO_SERVICE).toContain('BUCKET_ANEXO_CONTRATO = "documentos_operacionais"');
  });

  it("o contrato persiste a referência estável (anexo_url), não apenas o nome", () => {
    expect(CLIENTE_DETALHE).toContain("anexo_url: referenciaAnexo");
    expect(CLIENTE_DETALHE).toContain("anexo_nome: nomeAnexo");
    expect(CLIENTE_DETALHE).not.toContain("URL.createObjectURL(f)");
  });

  it("o documento é associado ao cliente e ao contrato correto", () => {
    expect(CONTRATO_SERVICE).toContain('moduloOrigem: "clientes"');
    expect(CONTRATO_SERVICE).toContain("clienteId: input.clienteId");
    expect(CONTRATO_SERVICE).toContain('tipo: "Contrato"');
    expect(CONTRATO_SERVICE).toContain("vincularAnexoAoContrato");
    expect(CONTRATO_SERVICE).toContain('tipo: "vinculo_contrato"');
  });

  it("abrir e baixar usam URL assinada com fallback para anexos antigos", () => {
    expect(CLIENTE_DETALHE).toContain("resolverUrlAnexoContrato(referencia)");
    expect(CLIENTE_DETALHE).toContain("const abrirAnexoContrato");
    expect(CLIENTE_DETALHE).toContain("const baixarAnexoContrato");
    expect(CONTRATO_SERVICE).toContain("assinarStorageRef(ref, SIGN_TTL_SECONDS)");
    expect(CONTRATO_SERVICE).toContain("if (ref.external) return ref.raw;");
  });

  it("valida formato/tamanho e propaga erro de upload para o usuário", () => {
    expect(CLIENTE_DETALHE).toContain("validarArquivoAnexo(contratoFile)");
    expect(CLIENTE_DETALHE).toContain('toast.error("Erro ao salvar contrato: "');
    expect(CLIENTE_DETALHE).toContain("Enviando anexo...");
  });
});

describe("B) Comprovante de pedágio — upload real do arquivo", () => {
  it("a UI aceita arquivo além do link textual", () => {
    expect(CONFERENCIA).toContain('id="comprovante-pedagio-input"');
    expect(CONFERENCIA).toContain("handleComprovantePedagioFile");
    expect(CONFERENCIA).toContain('accept={EXTENSOES_ANEXO_ACEITAS}');
    expect(CONFERENCIA).toContain("Anexar arquivo");
    expect(CONFERENCIA).toContain("ou cole um link existente (comprovantes antigos)");
  });

  it("envia o binário ao Storage e indexa na Central", () => {
    expect(CONFERENCIA).toContain("enviarDocumentoOperacional({");
    expect(CONFERENCIA).toContain('moduloOrigem: "financeiro"');
    expect(CONFERENCIA).toContain('tipo: "Comprovante de Pedágio"');
    expect(CONFERENCIA).toContain("garantirTipoAnexo(file)");
  });

  it("associa o comprovante à alocação da conferência e não altera lançamentos", () => {
    expect(CONFERENCIA).toContain("vincularDocumentoEntidade(comprovantePedagioDocId");
    expect(CONFERENCIA).toContain("entidadeId: res.alocacaoId");
    expect(CONFERENCIA).toContain("registrarComprovantePedagioUrl");
    expect(CONFERENCIA).not.toContain("salvarComprovantePedagio({");
  });

  it("resolução de leitura suporta bucket privado e URL antiga", () => {
    expect(REEMBOLSO_SERVICE).toContain("resolverUrlComprovantePedagio");
    expect(REEMBOLSO_SERVICE).toContain("if (ref.external) return ref.raw;");
    expect(REEMBOLSO_SERVICE).toContain("assinarStorageRef(ref, SIGN_TTL_SECONDS)");
    expect(CONFERENCIA).toContain("url_assinada");
  });

  it("busca mantém compatibilidade com comprovantes antigos (os_id/metadata)", () => {
    expect(REEMBOLSO_SERVICE).toContain("buscarReembolsoPorOs");
    expect(REEMBOLSO_SERVICE).toContain("buscarReembolsoPorComprovante");
    expect(REEMBOLSO_SERVICE).toContain('.eq("tipo", TIPO_COMPROVANTE_PEDAGIO)');
    expect(REEMBOLSO_SERVICE).toContain('modulo_origem", "financeiro"');
  });

  it("não altera cálculos/valores financeiros do lançamento", () => {
    expect(CONFERENCIA).toContain("valor_pedagio: num(formLancamento.valor_pedagio)");
    expect(CONFERENCIA).toContain("pedagio_cobrar_excedente: !!formLancamento.pedagio_cobrar_excedente");
    expect(CONFERENCIA).toContain("calcularResumoLancamento");
  });
});

describe("C) Serviços reutilizados e sem storage paralelo", () => {
  it("reutiliza documentosMetadataService e storageRefService", () => {
    expect(METADATA_SERVICE).toContain("export async function vincularDocumentoEntidade");
    expect(CONTRATO_SERVICE).toContain('@/services/storage/storageRefService');
    expect(REEMBOLSO_SERVICE).toContain('@/services/storage/storageRefService');
    expect(CONTRATO_SERVICE).not.toContain("createClient(");
    expect(REEMBOLSO_SERVICE).not.toContain("createClient(");
  });

  it("biblioteca valida os formatos suportados pelo bucket privado", () => {
    expect(ANEXO_LIB).toContain('"application/pdf"');
    expect(ANEXO_LIB).toContain('"image/jpeg"');
    expect(ANEXO_LIB).toContain('"image/png"');
    expect(ANEXO_LIB).toContain('"image/webp"');
    expect(ANEXO_LIB).toContain("50 * 1024 * 1024");
  });
});

describe("D) Validação pura de anexo (runtime)", () => {
  it("rejeita arquivo vazio, grande demais e formato inválido", () => {
    expect(validarArquivoAnexo(null)).toContain("Selecione");
    expect(validarArquivoAnexo(arquivoFake({ name: "a.pdf", type: "", size: 0 }))).toContain("vazio");
    expect(
      validarArquivoAnexo(
        arquivoFake({ name: "a.pdf", type: "application/pdf", size: TAMANHO_MAX_ANEXO_BYTES + 1 }),
      ),
    ).toContain("50 MB");
    expect(
      validarArquivoAnexo(arquivoFake({ name: "a.docx", type: "application/msword", size: 10 })),
    ).toContain("Formato não suportado");
  });

  it("aceita PDF/imagem válidos e infere MIME pela extensão", () => {
    expect(validarArquivoAnexo(arquivoFake({ name: "a.pdf", type: "application/pdf", size: 10 }))).toBeNull();
    expect(validarArquivoAnexo(arquivoFake({ name: "a.png", type: "image/png", size: 10 }))).toBeNull();
    const semTipo = arquivoFake({ name: "foto.webp", type: "", size: 10 });
    expect(validarArquivoAnexo(semTipo)).toBeNull();
    const realSemTipo = new File([new Uint8Array([1, 2, 3])], "foto.webp", { type: "" });
    const inferido = garantirTipoAnexo(realSemTipo);
    expect(inferido.type).toBe("image/webp");
  });
});

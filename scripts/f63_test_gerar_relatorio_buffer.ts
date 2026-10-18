// ============================================================
// Etapa 6.3 — Validacao da funcao gerarRelatorioBuffer
// Valida 3 tipos: faturamento, pagamento_prestador, prestadores
// Uso: npx tsx scripts/f63_test_gerar_relatorio_buffer.ts
// ============================================================

import { gerarRelatorioBuffer } from "../src/services/relatorios/relatorioService";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("\n========== ETAPA 6.3 — VALIDACAO gerarRelatorioBuffer ==========\n");

  // =============================================
  // TESTE 1: faturamento + Ambos
  // =============================================
  console.log("[TEST 1] faturamento + Ambos");
  try {
    const resultado = await gerarRelatorioBuffer("faturamento", {
      dataInicial: "2026-06-01",
      dataFinal: "2026-06-30",
    }, "Ambos");

    assert(resultado.tipo === "faturamento", "tipo = faturamento");
    assert(resultado.formatosGerados.includes("pdf"), "PDF gerado");
    assert(resultado.formatosGerados.includes("excel"), "Excel gerado");
    assert(resultado.arquivos.length === 2, "2 arquivos gerados", `${resultado.arquivos.length}`);
    assert(resultado.totalArquivos === 2, "totalArquivos = 2");

    const pdf = resultado.arquivos.find(a => a.tipo === "pdf");
    const xls = resultado.arquivos.find(a => a.tipo === "excel");

    assert(pdf !== undefined, "PDF presente");
    assert(pdf!.buffer instanceof Uint8Array || Buffer.isBuffer(pdf!.buffer), "PDF buffer válido", `${pdf!.buffer.constructor.name}`);
    assert(pdf!.tamanho > 1000, "PDF tamanho > 1KB", `${pdf!.tamanho} bytes`);
    assert(pdf!.nome.endsWith(".pdf"), "PDF nome com extensão", pdf!.nome);
    const pdfMagic = new Uint8Array(pdf!.buffer as ArrayBuffer)[0] === 0x25;
    assert(pdfMagic, "PDF magic bytes");

    assert(xls !== undefined, "Excel presente");
    assert(xls!.tamanho > 100, "Excel tamanho > 100 bytes", `${xls!.tamanho} bytes`);
    assert(xls!.nome.endsWith(".xlsx"), "Excel nome com extensão", xls!.nome);
    const xlsMagic = (xls!.buffer as Buffer)[0] === 0x50 && (xls!.buffer as Buffer)[1] === 0x4B;
    assert(xlsMagic, "Excel magic bytes (PK)");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // TESTE 2: pagamento_prestador + pdf
  // =============================================
  console.log("\n[TEST 2] pagamento_prestador + pdf");
  try {
    const resultado = await gerarRelatorioBuffer("pagamento_prestador", {
      dataInicial: "2026-06-01",
      dataFinal: "2026-06-30",
      prestador: "João Silva",
    }, "pdf");

    assert(resultado.tipo === "pagamento_prestador", "tipo = pagamento_prestador");
    assert(resultado.formatosGerados.includes("pdf"), "PDF gerado");
    assert(!resultado.formatosGerados.includes("excel"), "Excel NAO gerado (solicitado apenas pdf)");
    assert(resultado.arquivos.length === 1, "1 arquivo gerado");

    const pdf = resultado.arquivos[0];
    assert(pdf.tipo === "pdf", "arquivo tipo = pdf");
    assert(pdf.tamanho > 1000, "PDF tamanho > 1KB", `${pdf.tamanho} bytes`);
    const pdfMagic = new Uint8Array(pdf.buffer as ArrayBuffer)[0] === 0x25;
    assert(pdfMagic, "PDF magic bytes");
    assert(pdf.nome.includes("pagamento_prestador"), "Nome contém pagamento_prestador", pdf.nome);
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // TESTE 3: prestadores + excel
  // =============================================
  console.log("\n[TEST 3] prestadores + excel");
  try {
    const resultado = await gerarRelatorioBuffer("prestadores", {
      nome: "João",
    }, "excel");

    assert(resultado.tipo === "prestadores", "tipo = prestadores");
    assert(!resultado.formatosGerados.includes("pdf"), "PDF NAO gerado (solicitado apenas excel)");
    assert(resultado.formatosGerados.includes("excel"), "Excel gerado");
    assert(resultado.arquivos.length === 1, "1 arquivo gerado");

    const xls = resultado.arquivos[0];
    assert(xls.tipo === "excel", "arquivo tipo = excel");
    assert(xls.tamanho > 100, "Excel tamanho > 100 bytes", `${xls.tamanho} bytes`);
    const xlsMagic = (xls.buffer as Buffer)[0] === 0x50 && (xls.buffer as Buffer)[1] === 0x4B;
    assert(xlsMagic, "Excel magic bytes (PK)");
    assert(xls.nome.includes("prestadores"), "Nome contém prestadores", xls.nome);
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // TESTE 4: extrato_operacional + Ambos
  // =============================================
  console.log("\n[TEST 4] extrato_operacional + Ambos");
  try {
    const resultado = await gerarRelatorioBuffer("extrato_operacional", {
      dataInicial: "2026-06-01",
      dataFinal: "2026-06-30",
    }, "Ambos");

    assert(resultado.tipo === "extrato_operacional", "tipo = extrato_operacional");
    assert(resultado.formatosGerados.includes("pdf"), "PDF gerado");
    assert(resultado.formatosGerados.includes("excel"), "Excel gerado");
    assert(resultado.arquivos.length === 2, "2 arquivos gerados");

    const pdf = resultado.arquivos.find(a => a.tipo === "pdf");
    assert(pdf !== undefined, "PDF presente");
    assert(pdf!.tamanho > 1000, "PDF tamanho > 1KB", `${pdf!.tamanho} bytes`);
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Resumo
  // =============================================
  console.log(`\n========== RESULTADO ==========`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Status: ${failed === 0 ? "✅ TODOS OK" : "❌ FALHAS ENCONTRADAS"}`);
  console.log("=============================\n");

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
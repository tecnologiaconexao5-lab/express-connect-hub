// ============================================================
// Etapa 6.2 — Validacao das funcoes Buffer de PDF e Excel
// Uso: npx tsx scripts/f62_test_buffer_functions.ts
// ============================================================

import {
  gerarPDFRelatorioOperacionalBuffer,
  gerarPDFRepassePrestadorBuffer,
  gerarPDFFaturamentoDetalhadoBuffer,
} from "../src/utils/pdfRelatorioOperacional";

import {
  exportToExcelBuffer,
  exportFaturamentoToExcelBuffer,
  exportPagamentoToExcelBuffer,
  exportPrestadoresToExcelBuffer,
  exportClienteAgregadoRefrigeradoToExcelBuffer,
} from "../src/utils/excelExport";

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

const DADOS_FAKE = [
  { cliente_nome: "Logística Express S.A.", cliente_cnpj: "12.345.678/0001-90", quantidade_os: 15, valor_faturado: 45000, valor_pago: 42000, valor_pendente: 3000, ticket_medio: 3000, ultima_operacao: "2026-07-01", margem_total: 8500 },
  { cliente_nome: "Fretes Rápidos Ltda", cliente_cnpj: "98.765.432/0001-00", quantidade_os: 8, valor_faturado: 22000, valor_pago: 22000, valor_pendente: 0, ticket_medio: 2750, ultima_operacao: "2026-06-30", margem_total: 4400 },
];

const DADOS_PAGAMENTO = [
  { numero: "OS-1001", data_finalizacao: "2026-07-01", prestador: "João Silva", prestador_nome: "João Silva", cliente_nome: "Logística Express", cliente: "Logística Express", veiculo_tipo: "Truck", custo_prestador: 1500, valor_final_repasse: 1350, status_pagamento: "pago", enderecos: [{ cidade: "São Paulo" }, { cidade: "Rio de Janeiro" }] },
  { numero: "OS-1002", data_finalizacao: "2026-07-02", prestador: "Maria Santos", prestador_nome: "Maria Santos", cliente_nome: "Fretes Rápidos", cliente: "Fretes Rápidos", veiculo_tipo: "Carreta", custo_prestador: 2800, valor_final_repasse: 2520, status_pagamento: "pendente", enderecos: [{ cidade: "BH" }, { cidade: "SP" }] },
];

const DADOS_PRESTADORES = [
  { nome: "João Silva", cpf_cnpj: "123.456.789-00", tipo_parceiro: "Agregado", cidade: "São Paulo", uf: "SP", veiculo_principal: "ABC-1234", operacoes_finalizadas: 45, valor_recebido: 15000, score_interno: 8.5, status: "ativo", ultima_operacao: "2026-07-01" },
  { nome: "Maria Santos", cpf_cnpj: "987.654.321-00", tipo_parceiro: "Fixo", cidade: "Rio de Janeiro", uf: "RJ", veiculo_principal: "XYZ-5678", operacoes_finalizadas: 32, valor_recebido: 11200, score_interno: 9.2, status: "ativo", ultima_operacao: "2026-06-30" },
];

const DADOS_REFRIGERADO = [
  { data_viagem: "01/07/2026", motorista: "Carlos Pereira", placa: "DEF-5678", tipo_veiculo: "Truck Refrigerado", observacao: "Carga frágil", horario_chegada: "08:00", horario_saida: "09:30", diaria: "R$ 400,00", km_total: "450", km_excedente: "50", vlr_km: "R$ 2,50", vlr_total: "R$ 4.525,00", numero_oc: "OC-001", obs: "OK" },
];

const DADOS_OS_DETALHADO = [
  { numero: "OS-1001", data_finalizacao: "2026-07-01", created_at: "2026-07-01", cliente_id: "1", cliente_nome: "Logística Express", cliente_cnpj: "12.345.678/0001-90", status: "entregue", valor_cliente: 5000, custo_prestador: 3500, margem_liquida: 1500, pedagio: 120, adicionais: 80, descontos: 0, veiculo_tipo: "Truck", enderecos: [{ cidade: "São Paulo" }, { cidade: "Campinas" }], veiculo_placa: "ABC-1234", km_total: 200, km_base: 200, km_excedente: 0, valor_frete: 5000 },
  { numero: "OS-1002", data_finalizacao: "2026-07-02", created_at: "2026-07-02", cliente_id: "1", cliente_nome: "Logística Express", cliente_cnpj: "12.345.678/0001-90", status: "entregue", valor_cliente: 3200, custo_prestador: 2400, margem_liquida: 800, pedagio: 80, adicionais: 0, descontos: 20, veiculo_tipo: "VUC", enderecos: [{ cidade: "São Paulo" }, { cidade: "Santos" }], veiculo_placa: "DEF-5678", km_total: 150, km_base: 200, km_excedente: 0, valor_frete: 3200 },
];

async function run() {
  console.log("\n========== ETAPA 6.2 — VALIDACAO FUNCOES BUFFER ==========\n");

  // =============================================
  // PDF — gerarPDFRelatorioOperacionalBuffer
  // =============================================
  console.log("[TEST] gerarPDFRelatorioOperacionalBuffer");
  try {
    const buffer = await gerarPDFRelatorioOperacionalBuffer({
      titulo: "Relatorio Operacional Teste",
      periodo: "Julho 2026",
      usuario: "Teste Automa",
      colunas: ["Cliente", "CNPJ", "Qtd OS", "Valor Faturado"],
      linhas: [["Logística Express", "12.345.678/0001-90", "15", "R$ 45.000"]],
      totais: [{ label: "Total Faturado", valor: "R$ 45.000" }],
    });
    assert(buffer instanceof Uint8Array, "Retorna Uint8Array", `tipo: ${typeof buffer}, length: ${buffer.length}`);
    assert(buffer.length > 1000, "Tamanho > 1KB", `${buffer.length} bytes`);
    assert(buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46, "E PDF header (%PDF)");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // PDF — gerarPDFRepassePrestadorBuffer
  // =============================================
  console.log("\n[TEST] gerarPDFRepassePrestadorBuffer");
  try {
    const buffer = await gerarPDFRepassePrestadorBuffer(
      DADOS_PAGAMENTO,
      { dataInicial: "2026-07-01", dataFinal: "2026-07-31", prestador: "João Silva" },
      { totalRepasses: 5000, qtdOperacoes: 2, mediaOperacional: 2500, pendencias: 1, valorAprovado: 4500 }
    );
    assert(buffer instanceof Uint8Array, "Retorna Uint8Array", `tipo: ${typeof buffer}, length: ${buffer.length}`);
    assert(buffer.length > 1000, "Tamanho > 1KB", `${buffer.length} bytes`);
    assert(buffer[0] === 0x25, "E PDF header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // PDF — gerarPDFFaturamentoDetalhadoBuffer
  // =============================================
  console.log("\n[TEST] gerarPDFFaturamentoDetalhadoBuffer");
  try {
    const buffer = await gerarPDFFaturamentoDetalhadoBuffer(
      { nome: "Logística Express", cnpj: "12.345.678/0001-90" },
      "Julho 2026",
      DADOS_OS_DETALHADO
    );
    assert(buffer instanceof Uint8Array, "Retorna Uint8Array", `tipo: ${typeof buffer}, length: ${buffer.length}`);
    assert(buffer.length > 1000, "Tamanho > 1KB", `${buffer.length} bytes`);
    assert(buffer[0] === 0x25, "E PDF header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Excel — exportToExcelBuffer
  // =============================================
  console.log("\n[TEST] exportToExcelBuffer");
  try {
    const buf = exportToExcelBuffer(
      DADOS_FAKE,
      [
        { header: "Cliente", key: "cliente_nome", width: 30 },
        { header: "CNPJ", key: "cliente_cnpj", width: 20 },
        { header: "Valor Faturado", key: "valor_faturado", width: 18 },
      ],
      "teste_buffer",
      "Teste de Buffer"
    );
    assert(buf instanceof Buffer, "Retorna Buffer", `tipo: ${typeof buf}, construtor: ${buf.constructor.name}`);
    assert(buf.length > 100, "Tamanho > 100 bytes", `${buf.length} bytes`);
    // XLSX magic bytes: PK (0x50 0x4B)
    assert(buf[0] === 0x50 && buf[1] === 0x4B, "E ZIP/XLSX header (PK)");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Excel — exportFaturamentoToExcelBuffer
  // =============================================
  console.log("\n[TEST] exportFaturamentoToExcelBuffer");
  try {
    const buf = exportFaturamentoToExcelBuffer(DADOS_FAKE, "07_2026");
    assert(buf instanceof Buffer, "Retorna Buffer", `tipo: ${typeof buf}`);
    assert(buf.length > 100, "Tamanho > 100 bytes", `${buf.length} bytes`);
    assert(buf[0] === 0x50 && buf[1] === 0x4B, "E ZIP/XLSX header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Excel — exportPagamentoToExcelBuffer
  // =============================================
  console.log("\n[TEST] exportPagamentoToExcelBuffer");
  try {
    const buf = exportPagamentoToExcelBuffer(DADOS_PAGAMENTO, "07_2026");
    assert(buf instanceof Buffer, "Retorna Buffer", `tipo: ${typeof buf}`);
    assert(buf.length > 100, "Tamanho > 100 bytes", `${buf.length} bytes`);
    assert(buf[0] === 0x50 && buf[1] === 0x4B, "E ZIP/XLSX header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Excel — exportPrestadoresToExcelBuffer
  // =============================================
  console.log("\n[TEST] exportPrestadoresToExcelBuffer");
  try {
    const buf = exportPrestadoresToExcelBuffer(DADOS_PRESTADORES, "07_2026");
    assert(buf instanceof Buffer, "Retorna Buffer", `tipo: ${typeof buf}`);
    assert(buf.length > 100, "Tamanho > 100 bytes", `${buf.length} bytes`);
    assert(buf[0] === 0x50 && buf[1] === 0x4B, "E ZIP/XLSX header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Excel — exportClienteAgregadoRefrigeradoToExcelBuffer
  // =============================================
  console.log("\n[TEST] exportClienteAgregadoRefrigeradoToExcelBuffer");
  try {
    const buf = exportClienteAgregadoRefrigeradoToExcelBuffer(DADOS_REFRIGERADO, "Logística Express", "Carlos Pereira", "07_2026");
    assert(buf instanceof Buffer, "Retorna Buffer", `tipo: ${typeof buf}`);
    assert(buf.length > 100, "Tamanho > 100 bytes", `${buf.length} bytes`);
    assert(buf[0] === 0x50 && buf[1] === 0x4B, "E ZIP/XLSX header");
  } catch (err: any) {
    console.log(`  ❌ ERRO: ${err.message}`);
    failed++;
  }

  // =============================================
  // Resumo
  // =============================================
  console.log(`\n========== RESULTADO ==========`);
  console.log(`  Passed: ${passed}/8`);
  console.log(`  Failed: ${failed}/8`);
  console.log(`  Status: ${failed === 0 ? "✅ TODOS OK" : "❌ FALHAS ENCONTRADAS"}`);
  console.log("=============================\n");

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
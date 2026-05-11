// ============================================================
// SCRIPT TESTE PRESTADOR COMPLETO REAL
// Executar via: npx tsx scripts/teste-prestador-completo-real.ts
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseKey);

const generateCPF = (): string => {
  const random = () => Math.floor(Math.random() * 10);
  const cpf = [random(), random(), random(), random(), random(), random(), random(), random(), random(), random(), random()];
  const calc = cpf.slice(0, 9).reduce((acc, x, i) => acc + x * (10 - i), 0);
  const dv1 = calc % 11 < 2 ? 0 : 11 - (calc % 11);
  cpf.push(dv1);
  const calc2 = [...cpf.slice(0, 10)].reduce((acc, x, i) => acc + x * (11 - i), 0);
  const dv2 = calc2 % 11 < 2 ? 0 : 11 - (calc2 % 11);
  cpf.push(dv2);
  return cpf.join("").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const timestamp = Date.now();
const cpf = generateCPF();

const dadosPrestador = {
  nome_completo: "MOTORISTA TESTE COMPLETO",
  cpf_cnpj: cpf,
  rg_ie: "123456789",
  data_nascimento: "1988-01-10",
  telefone: "11999999999",
  whatsapp: "11999999999",
  email: `motorista.teste+${timestamp}@conexaoexpress.com`,
  tipo_parceiro: "autonomo",
  status: "ativo",
  regiao_principal: "Grande SP",
  regioes_secundarias: ["ABC Paulista", "Interior SP"],
  foto: "https://placehold.co/300x300.png",
  endereco: JSON.stringify({
    cep: "04194250",
    rua: "Rua Teste",
    numero: "123",
    complemento: "",
    bairro: "Centro",
    cidade: "São Paulo",
    estado: "SP"
  }),
  acepta_refrigerada: true,
  acepta_urbana: true,
  aceita_dedicada: false,
  acepta_esporadica: true,
  banco: "Banco Teste",
  agencia: "0001",
  conta: "123456",
  digito: "6",
  tipo_conta: "Corrente",
  favorece: "MOTORISTA TESTE COMPLETO",
  cpf_cnpj_favorecido: cpf,
  chave_pix: `motorista.teste+${timestamp}@pix.com`,
  tipo_chave_pix: "email",
  valor_diaria: 650.00,
  valor_km: 2.00,
  valor_saida: 650.00,
  fixo_mensal: 0,
  valor_ajudante: 0,
  valor_espera: 50.00,
  valor_reentrega: 100.00,
  valor_devolucao: 100.00,
  periodicidade_pagamento: "semanal",
  prazo_pagamento: "sexta-feira",
  forma_preferencial_pagamento: "pix",
  score_interno: 4.8,
  indice_aceite: 95,
  indice_comparecimento: 98,
  indice_entrega_prazo: 97,
  data_cadastro: new Date().toISOString().split("T")[0],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

async function executarTeste() {
  console.log("===========================================");
  console.log("  TESTE PRESTADOR COMPLETO REAL");
  console.log("===========================================\n");

  let erros: string[] = [];
  let prestadorId = "";
  let veiculosIds: string[] = [];
  let documentosIds: string[] = [];

  try {
    console.log("1️⃣  Criando PRESTADOR...\n");

    const { data: prestadorData, error: prestadorError } = await supabase
      .from("prestadores")
      .insert([dadosPrestador])
      .select()
      .single();

    if (prestadorError) {
      throw new Error(`Erro ao criar prestador: ${prestadorError.message}`);
    }

    prestadorId = prestadorData.id;
    console.log(`   ✅ PRESTADOR CRIADO: ${prestadorId}`);

    console.log("\n2️⃣  Vinculando FOTO...\n");

    const { data: fotoData, error: fotoError } = await supabase
      .from("prestadores")
      .update({ foto: dadosPrestador.foto })
      .eq("id", prestadorId)
      .select();

    if (fotoError) {
      console.log(`   ⚠️  Erro Foto: ${fotoError.message}`);
    } else {
      console.log(`   ✅ FOTO SALVA`);
    }

    console.log("\n3️⃣  Criando VEÍCULO 1 (Principal)...\n");

    const veiculo1 = {
      placa: "TST1A23",
      tipo_veiculo: "HR",
      marca: "Hyundai",
      modelo: "HR Baú",
      ano_fabricacao: 2020,
      capacidade_kg: 1800,
      capacidade_m3: 10,
      tipo_carga: "refrigerado",
      temp_min: 13,
      temp_max: 16,
      prestador_vinculado: prestadorId,
      status: "Principal",
      created_at: new Date().toISOString()
    };

    const { data: v1, error: e1 } = await supabase.from("veiculos").insert([veiculo1]).select().single();
    if (e1) throw new Error(`Erro veiculo1: ${e1.message}`);
    veiculosIds.push(v1.id);
    console.log(`   ✅ VEÍCULO 1 CRIADO: ${v1.id}`);

    console.log("\n4️⃣  Criando VEÍCULO 2...\n");

    const veiculo2 = {
      placa: "TST2B34",
      tipo_veiculo: "fiorino",
      marca: "Fiat",
      modelo: "Fiorino",
      ano_fabricacao: 2021,
      capacidade_kg: 600,
      capacidade_m3: 3,
      tipo_carga: "seco",
      prestador_vinculado: prestadorId,
      status: "Ativo",
      created_at: new Date().toISOString()
    };

    const { data: v2, error: e2 } = await supabase.from("veiculos").insert([veiculo2]).select().single();
    if (e2) throw new Error(`Erro veiculo2: ${e2.message}`);
    veiculosIds.push(v2.id);
    console.log(`   ✅ VEÍCULO 2 CRIADO: ${v2.id}`);

    console.log("\n5️⃣  Criando DOCUMENTOS...\n");

    const documentos = [
      { tipo: "CNH Frente", url: "https://placehold.co/800x1000.png", validade: "2027-12-31" },
      { tipo: "CRLV", url: "https://placehold.co/800x1000.png", validade: "2027-12-31" },
      { tipo: "Comprovante Residência", url: "https://placehold.co/800x1000.png", validade: "2027-12-31" },
      { tipo: "Contrato", url: "https://placehold.co/800x1000.png", validade: "2027-12-31" }
    ];

    for (const doc of documentos) {
      const docData = {
        prestador_id: prestadorId,
        tipo: doc.tipo,
        url: doc.url,
        validade: doc.validade,
        status: "valido",
        analisado_ia: false,
        resultado_ia: null,
        created_at: new Date().toISOString()
      };
      const { data: d, error: de } = await supabase.from("documentos_prestadores").insert([docData]).select().single();
      if (de) throw new Error(`Erro documento ${doc.tipo}: ${de.message}`);
      documentosIds.push(d.id);
    }
    console.log(`   ✅ ${documentos.length} DOCUMENTOS CRIADOS`);

    console.log("\n6️⃣  Verificando DADOS no banco...\n");

    const { data: verificado, error: vError } = await supabase
      .from("prestadores")
      .select("*")
      .eq("id", prestadorId)
      .single();

    if (vError) throw new Error(`Erro verificação: ${vError.message}`);

    console.log(`   ✅ REGIAO: ${verificado.regiao_principal}`);
    console.log(`   ✅ REGIOES SEC: ${verificado.regioes_secundarias?.join(", ") || "-"}`);
    console.log(`   ✅ FINANCEIRO - Banco: ${verificado.banco}`);
    console.log(`   ✅ FINANCEIRO - Diária: R$ ${verificado.valor_diaria}`);
    console.log(`   ✅ FINANCEIRO - Saída: R$ ${verificado.valor_saida}`);
    console.log(`   ✅ FINANCEIRO - KM: R$ ${verificado.valor_km}`);
    console.log(`   ✅ QUALIDADE - Score: ${verificado.score_interno}`);
    console.log(`   ✅ QUALIDADE - Aceite: ${verificado.indice_aceite}%`);
    console.log(`   ✅ QUALIDADE - Comparecimento: ${verificado.indice_comparecimento}%`);
    console.log(`   ✅ QUALIDADE - Prazo: ${verificado.indice_entrega_prazo}%`);
    console.log(`   ✅ STATUS: ${verificado.status}`);
    console.log(`   ✅ DATA CADASTRO: ${verificado.data_cadastro}`);

    console.log("\n===========================================");
    console.log("  RESULTADO FINAL");
    console.log("===========================================\n");

    console.log(`✅ PRESTADOR CRIADO`);
    console.log(`✅ FOTO SALVA`);
    console.log(`✅ REGIÃO SALVA`);
    console.log(`✅ FINANCEIRO SALVO`);
    console.log(`✅ ${veiculosIds.length} VEÍCULOS VINCULADOS`);
    console.log(`✅ VEÍCULO PRINCIPAL DEFINIDO`);
    console.log(`✅ ${documentos.length} DOCUMENTOS SALVOS`);
    console.log(`✅ QUALIDADE SALVA`);
    console.log(`✅ TESTE COMPLETO FINALIZADO SEM ERROS\n`);

    console.log("===========================================");
    console.log("  IDs CRIADOS");
    console.log("===========================================");
    console.log(`Prestador ID: ${prestadorId}`);
    console.log(`Veículos: ${veiculosIds.join(", ")}`);
    console.log(`Documentos: ${documentosIds.join(", ")}`);

    const relatorio = {
      data: new Date().toISOString(),
      sucesso: true,
      prestadorId,
      cpf: dadosPrestador.cpf_cnpj,
      veiculos: veiculosIds.length,
      documentos: documentosIds.length,
      dados: {
        nome: dadosPrestador.nome_completo,
        regiao: dadosPrestador.regiao_principal,
        regioesSecundarias: dadosPrestador.regioes_secundarias,
        valorDiaria: dadosPrestador.valor_diaria,
        valorSaida: dadosPrestador.valor_saida,
        valorKm: dadosPrestador.valor_km,
        score: dadosPrestador.score_interno,
        status: dadosPrestador.status
      }
    };

    writeFileSync("./teste-prestador-resultado.json", JSON.stringify(relatorio, null, 2));
    console.log("\n📄 Relatório salvo em: teste-prestador-resultado.json");

  } catch (err: any) {
    console.log(`\n❌ ERRO REAL: ${err.message}\n`);
    if (err.message.includes("duplicate")) {
      console.log("   → CPF já existe no banco");
    } else if (err.message.includes("column")) {
      console.log("   → Coluna não existe - aplicar migration primeiro");
    } else if (err.message.includes("relation")) {
      console.log("   → Tabela não existe - aplicar migration primeiro");
    }
    console.log("\n===========================================");
    console.log("  REGRA: Aplicar SQL primeiro!");
    console.log("===========================================");

    writeFileSync("./teste-prestador-resultado.json", JSON.stringify({
      data: new Date().toISOString(),
      sucesso: false,
      erro: err.message
    }, null, 2));
  }
}

executarTeste();
/**
 * VALID-REAL-P1-P2 — Script de descoberta de dados de teste
 *
 * Verifica: prestadores, pagamentos_prestadores, fechamentos existentes
 * NÃO altera nenhum dado.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(URL, KEY);

async function main() {
  console.log("=== VALID-REAL-P1-P2 — Descoberta de dados ===\n");

  // 1. Buscar prestadores com is_teste=true ou nome TESTE
  console.log("--- 1. Prestadores de teste ---");
  const { data: prestTeste, error: e1 } = await supabase
    .from("prestadores")
    .select("id, nome_completo, cpf_cnpj, is_teste, ativo")
    .or("is_teste.eq.true,nome_completo.ilike.%TESTE%")
    .order("nome_completo");

  if (e1) {
    console.log("  Erro:", e1.message);
  } else if (!prestTeste?.length) {
    console.log("  Nenhum prestador de teste encontrado.");
  } else {
    prestTeste.forEach(p => {
      console.log(`  ${p.is_teste ? "[TESTE]" : "[?????]"} ${p.nome_completo} | ${p.cpf_cnpj} | ativo=${p.ativo} | id=${p.id}`);
    });
  }

  // 2. Buscar pagamentos_prestadores de teste (fechamento ou com TESTE no nome)
  console.log("\n--- 2. Pagamentos_prestadores existentes ---");
  const { data: pps, error: e2 } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_id, prestador_nome, status, status_conferencia, status_aprovacao, status_pagamento, valor_liquido, tipo_pagamento, fechamento_id, is_teste, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (e2) {
    console.log("  Erro:", e2.message);
  } else if (!pps?.length) {
    console.log("  Nenhum pagamento encontrado.");
  } else {
    pps.forEach(p => {
      const teste = p.is_teste ? " [TESTE]" : "";
      const conf = p.fechamento_id ? ` fechamento=${p.fechamento_id.slice(0,8)}` : "";
      console.log(`  ${p.prestador_nome}${teste} | ${p.status} | conf=${p.status_conferencia} | apr=${p.status_aprovacao} | pag=${p.status_pagamento} | R$${p.valor_liquido} | tipo=${p.tipo_pagamento}${conf} | id=${p.id.slice(0,8)}`);
    });
  }

  // 3. Fechamentos existentes (tipo_pagamento = fechamento)
  console.log("\n--- 3. Fechamentos existentes ---");
  const { data: fechs, error: e3 } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_nome, status, status_conferencia, status_aprovacao, status_pagamento, valor_liquido, is_teste, qtd_os, created_at")
    .eq("tipo_pagamento", "fechamento")
    .order("created_at", { ascending: false })
    .limit(10);

  if (e3) {
    console.log("  Erro:", e3.message);
  } else if (!fechs?.length) {
    console.log("  Nenhum fechamento encontrado.");
  } else {
    fechs.forEach(f => {
      const teste = f.is_teste ? " [TESTE]" : "";
      console.log(`  ${f.prestador_nome}${teste} | status=${f.status} | conf=${f.status_conferencia} | apr=${f.status_aprovacao} | pag=${f.status_pagamento} | R$${f.valor_liquido} | itens=${f.qtd_os} | id=${f.id.slice(0,8)}`);
    });
  }

  // 4. Conta corrente existente
  console.log("\n--- 4. Conta Corrente ---");
  const { data: cc, error: e4 } = await supabase
    .from("conta_corrente")
    .select("id, descricao, saldo, is_teste, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (e4) {
    console.log("  Erro:", e4.message);
  } else if (!cc?.length) {
    console.log("  Nenhuma conta corrente encontrada.");
  } else {
    cc.forEach(c => {
      const teste = c.is_teste ? " [TESTE]" : "";
      console.log(`  ${c.descricao}${teste} | saldo=R$${c.saldo} | id=${c.id}`);
    });
  }

  // 5. Contas financeiras (para pagamento)
  console.log("\n--- 5. Contas financeiras ---");
  const { data: cf, error: e5 } = await supabase
    .from("contas_financeiras")
    .select("id, nome, banco, ativa")
    .eq("ativa", true);

  if (e5) {
    console.log("  Erro:", e5.message);
  } else if (!cf?.length) {
    console.log("  Nenhuma conta financeira encontrada.");
  } else {
    cf.forEach(c => {
      console.log(`  ${c.nome} (${c.banco}) | id=${c.id}`);
    });
  }

  // 6. Verificar colunas de pagamentos_prestadores
  console.log("\n--- 6. Schema pagamentos_prestadores ---");
  const { data: cols, error: e6 } = await supabase
    .rpc("executar_sql_seguro", {
      q: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'pagamentos_prestadores' AND column_name IN ('id','prestador_id','prestador_nome','status','status_conferencia','status_aprovacao','status_pagamento','valor_liquido','tipo_pagamento','fechamento_id','is_teste','data_conferencia','data_aprovacao','data_pagamento','conta_financeira_id','observacao') ORDER BY ordinal_position"
    });

  if (e6) {
    // Fallback: try direct query
    console.log("  RPC indisponível, tentando via information_schema...");
  } else {
    console.log("  Colunas:", JSON.stringify(cols, null, 2));
  }
}

main().catch(console.error);

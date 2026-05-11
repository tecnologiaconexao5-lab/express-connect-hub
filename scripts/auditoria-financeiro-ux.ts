// Script de Auditoria UX - Validar estrutura do Financeiro
// Executar com: npx tsx scripts/auditoria-financeiro-ux.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const checks: { nome: string; status: "PASS" | "FAIL"; mensagem: string }[] = [];

function check(nome: string, passou: boolean, mensagem: string = "") {
  checks.push({ nome, status: passou ? "PASS" : "FAIL", mensagem });
  console.log(`${passou ? "✅" : "❌"} ${nome}${mensagem ? ": " + mensagem : ""}`);
}

async function main() {
  console.log("\n🚀 AUDITORIA UX - FINANCEIRO\n");
  console.log("=".repeat(50));

  // 1. Verificar arquivo Financeiro.tsx existe
  try {
    const fs = await import("fs");
    const FinanceiroPath = "./src/pages/Financeiro.tsx";
    const exists = fs.existsSync(FinanceiroPath);
    check("Financeiro.tsx existe", exists);
    if (!exists) {
      console.log("\n❌ ABORT: Financeiro.tsx não encontrado");
      process.exit(1);
    }
  } catch (e: any) {
    check("Financeiro.tsx existe", false, e.message);
  }

  // 2. Verificar aba margem-os existe
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/pages/Financeiro.tsx", "utf-8");
    const temMargemOs = content.includes('value="margem-os"') || content.includes("value=margem-os");
    check("Aba margem-os existe", temMargemOs);
  } catch (e: any) {
    check("Aba margem-os existe", false, e.message);
  }

  // 3. Verificar MargemPorOS não tem SelectItem value="" e tem fallback
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/components/financeiro/MargemPorOS.tsx", "utf-8");
    const temSelectVazio = content.includes('SelectItem value=""');
    const temFallback = content.includes("catch (err)") || content.includes("catch(error)");
    const querySimples = content.includes('.from("composicao_financeira_os")\n        .select("*")');
    check("MargemPorOS sem SelectItem value=\"\"", !temSelectVazio);
    check("MargemPorOS tem fallback erro", temFallback);
    check("MargemPorOS usa query simples sem JOIN", querySimples);
  } catch (e: any) {
    check("MargemPorOS validado", false, e.message);
  }

  // 4. Verificar import RelatorioFinanceiroCompleto
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/pages/Financeiro.tsx", "utf-8");
    const temImport = content.includes("RelatorioFinanceiroCompleto");
    check("RelatorioFinanceiroCompleto importado", temImport);
  } catch (e: any) {
    check("RelatorioFinanceiroCompleto importado", false, e.message);
  }

  // 5. Verificar import MargemPorOS
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/pages/Financeiro.tsx", "utf-8");
    const temImport = content.includes("MargemPorOS");
    check("MargemPorOS importado", temImport);
  } catch (e: any) {
    check("MargemPorOS importado", false, e.message);
  }

  // 6. Verificar abas principais existem
  const abasPrincipais = [
    { nome: "dashboard", valor: 'value="dashboard"' },
    { nome: "receber", valor: 'value="receber"' },
    { nome: "pagar", valor: 'value="pagar"' },
    { nome: "pagamento-prestadores", valor: 'value="pagamento-prestadores"' },
    { nome: "margem-os", valor: 'value="margem-os"' },
    { nome: "fluxo", valor: 'value="fluxo"' },
    { nome: "dre", valor: 'value="dre"' },
    { nome: "conciliacao", valor: 'value="conciliacao"' },
    { nome: "lotes", valor: 'value="lotes"' },
    { nome: "plano-contas", valor: 'value="plano-contas"' },
    { nome: "relatorios", valor: 'value="relatorios"' }
  ];

  let TodasAbasOk = true;
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/pages/Financeiro.tsx", "utf-8");
    for (const aba of abasPrincipais) {
      if (!content.includes(aba.valor)) {
        TodasAbasOk = false;
        console.log(`❌ Falta aba: ${aba.nome}`);
      }
    }
    check("Todas abas principais existem", TodasAbasOk);
  } catch (e: any) {
    check("Todas abas principais existem", false, e.message);
  }

  // 7. Verificar renderização ou placeholder para cada aba
  const abasComConteudo = [
    { nome: "margem-os", conteudo: "MargemPorOS" },
    { nome: "centro-resultado", conteudo: "Centro de Resultado" },
    { nome: "provisoes", conteudo: "Provis" },
    { nome: "seguros-auto", conteudo: "Seguros" },
    { nome: "contabilidade", conteudo: "Contabilidade" }
  ];

  let TodasComConteudo = true;
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/pages/Financeiro.tsx", "utf-8");
    for (const aba of abasComConteudo) {
      if (!content.includes(aba.conteudo)) {
        TodasComConteudo = false;
        console.log(`❌ Falta conteúdo: ${aba.nome}`);
      }
    }
    check("Abas com renderização/placeholder", TodasComConteudo);
  } catch (e: any) {
    check("Abas com renderização/placeholder", false, e.message);
  }

  // 8. Verificar query do relatório usa JOIN
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/components/financeiro/RelatorioFinanceiroCompleto.tsx", "utf-8");
    const temJoin = content.includes("cliente:cliente_id") && content.includes("prestador:prestador_id");
    check("Relatorio usa JOINs direto", temJoin);
  } catch (e: any) {
    check("Relatorio usa JOINs direto", false, "Arquivo não encontrado");
  }

  // 9. Verificar fmtBRL usa nullish coalescing
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/components/financeiro/RelatorioFinanceiroCompleto.tsx", "utf-8");
    const temNullish = content.includes("(v ?? 0).toLocaleString");
    check("fmtBRL protege undefined/null", temNullish);
  } catch (e: any) {
    check("fmtBRL protege undefined/null", false, "Arquivo não encontrado");
  }

  // 10. Verificar fmtData tem proteção
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/components/financeiro/RelatorioFinanceiroCompleto.tsx", "utf-8");
    const temNullCheck = content.includes("d ? new Date(d)") || content.includes("d ||");
    check("fmtData protege null/undefined", temNullCheck);
  } catch (e: any) {
    check("fmtData protege null/undefined", false, "Arquivo não encontrado");
  }

  // 11. Verificar catch reseta dados
  try {
    const fs = await import("fs");
    const content = fs.readFileSync("./src/components/financeiro/RelatorioFinanceiroCompleto.tsx", "utf-8");
    const temCatchReset = content.includes("setDados([])") && content.includes("catch (err)");
    check("Catch reseta dados para array vazio", temCatchReset);
  } catch (e: any) {
    check("Catch reseta dados para array vazio", false, "Arquivo não encontrado");
  }

  // Resumo
  console.log("\n" + "=".repeat(50));
  const pass = checks.filter(c => c.status === "PASS").length;
  const fail = checks.filter(c => c.status === "FAIL").length;
  console.log(`📊 RESULTADO: ${pass} PASS | ${fail} FAIL`);

  if (fail > 0) {
    console.log("\n❌ AUDITORIA FALHOU!");
    process.exit(1);
  }

  console.log("\n✅ AUDITORIA UX PASSOU!");
  console.log("=".repeat(50));
}

main().catch(e => {
  console.error("❌ ERRO:", e);
  process.exit(1);
});
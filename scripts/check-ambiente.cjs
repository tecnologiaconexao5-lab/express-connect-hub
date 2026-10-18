#!/usr/bin/env node
// ============================================================
// check-ambiente.cjs — Guard Rail de Ambiente
// ============================================================
// Uso:
//   node scripts/check-ambiente.cjs          (modo interrogativo)
//   node scripts/check-ambiente.cjs qa        (exige QA)
//   node scripts/check-ambiente.cjs production (exige PROD)
//   node scripts/check-ambiente.cjs development (exige DEV)
// ============================================================

const SUPABASE_PROD_REF = "uwrvzsjtpgaifkktpepn";
const SUPABASE_QA_REF = "aqpfayildtcnrkfeeyjg";

function detectAmbiente() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const envVar = (process.env.ENVIRONMENT || "").toLowerCase();
  const mode = (process.env.VITE_MODE || "").toLowerCase();

  // 1. Se ENVIRONMENT ou VITE_MODE estiver definido explicitamente
  if (envVar === "qa" || mode === "qa") return { nome: "qa", ref: SUPABASE_QA_REF, url: `https://${SUPABASE_QA_REF}.supabase.co` };
  if (envVar === "development" || mode === "development") return { nome: "development", ref: SUPABASE_PROD_REF, url: supabaseUrl || `https://${SUPABASE_PROD_REF}.supabase.co` };

  // 2. Detectar pela URL
  if (supabaseUrl.includes(SUPABASE_QA_REF)) return { nome: "qa", ref: SUPABASE_QA_REF, url: supabaseUrl };
  if (supabaseUrl.includes(SUPABASE_PROD_REF)) return { nome: "producao", ref: SUPABASE_PROD_REF, url: supabaseUrl };

  // 3. Se ENVIRONMENT for production
  if (envVar === "production") return { nome: "producao", ref: SUPABASE_PROD_REF, url: supabaseUrl };

  // 4. Fallback: tenta extrair ref da URL
  const match = supabaseUrl.match(/https:\/\/(\w+)\.supabase\.co/);
  if (match) return { nome: `desconhecido (${match[1]})`, ref: match[1], url: supabaseUrl };

  return { nome: "indefinido", ref: "?", url: supabaseUrl || "nao configurado" };
}

function mostrarStatus(ambiente, exigido) {
  const linha = "=".repeat(60);
  console.log(`\n${linha}`);
  console.log(`  AMBIENTE DETECTADO:`);
  console.log(`  ${linha}`);
  console.log(`  Modo        : ${process.env.VITE_MODE || "(padrao)"}`);
  console.log(`  ENVIRONMENT : ${process.env.ENVIRONMENT || "(nao definido)"}`);
  console.log(`  Project Ref : ${ambiente.ref}`);
  console.log(`  URL         : ${ambiente.url}`);
  console.log(`  Ambiente    : ${ambiente.nome.toUpperCase()}`);
  console.log(`  ${linha}`);

  if (exigido && ambiente.nome !== exigido) {
    console.log(`\n  ❌ BLOQUEADO: Ambiente '${ambiente.nome}' nao corresponde ao exigido '${exigido}'.`);
    console.log(`  ${linha}\n`);
    process.exit(1);
  }

  if (ambiente.nome === "producao" && exigido !== "production") {
    console.log(`\n  ⚠️  ATENCAO: AMBIENTE DE PRODUCAO DETECTADO!`);
    console.log(`  ⚠️  Verifique se deseja continuar antes de executar acoes destrutivas.`);
    console.log(`  ${linha}\n`);
  }

  console.log(`  ✅ Ambiente OK para execucao.`);
  console.log(`  ${linha}\n`);
}

// --- MAIN ---
const args = process.argv.slice(2);
const exigido = args[0] || null;

// Carrega .env manualmente se disponivel
try {
  const dotenv = require("dotenv");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), ".env");
  dotenv.config({ path: envPath });

  // Se um modo foi especificado, tenta carregar .env.[modo]
  if (exigido) {
    const modePath = path.resolve(process.cwd(), `.env.${exigido}`);
    dotenv.config({ path: modePath });
  }
} catch {
  // dotenv nao disponivel ou erro ao carregar
}

const ambiente = detectAmbiente();
mostrarStatus(ambiente, exigido);

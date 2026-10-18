import "dotenv/config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY nao encontrados no .env");
  process.exit(1);
}

const DADOS_CALVO = {
  razao_social: "CALVO COML IMP. E EXP. LTDA.",
  nome_fantasia: "CALVO",
  cnpj: "00640071000159",
  ie: "796497088113",
  logradouro: "R.JAMIL JOAO ZARIF",
  numero: "684",
  complemento: "ANEXO 20/21/22 E 23",
  bairro: "JD.STA.VICENCIA",
  cidade: "GUARULHOS",
  uf: "SP",
  cep: "07143000",
  telefone: "1129426000",
  segmento: "INDUSTRIA",
};

function mask(s: string | null | undefined): string {
  if (!s) return "(vazio)";
  if (s.length <= 6) return s;
  return s.slice(0, 4) + "***" + s.slice(-2);
}

async function main() {
  console.log("═".repeat(70));
  console.log("  CADASTRO/ATUALIZACAO CALVO");
  console.log("═".repeat(70));

  const cnpjLimpo = DADOS_CALVO.cnpj.replace(/[^0-9]/g, "");
  if (cnpjLimpo.length !== 14) { console.log("❌ CNPJ invalido"); process.exit(1); }

  console.log(`  CNPJ: ${mask(cnpjLimpo)}`);
  console.log(`  Razao: ${DADOS_CALVO.razao_social}`);
  console.log(`  Endereco: ${DADOS_CALVO.logradouro}, ${DADOS_CALVO.numero}`);

  console.log("\n📡 Enviando para Edge Function (action=cadastrar_cliente)...");

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/focus-emissao`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cadastrar_cliente", cliente: DADOS_CALVO }),
    });

    const result = await resp.json();
    console.log(`   HTTP ${resp.status}: ${JSON.stringify(result)}`);

    if (result.ok) {
      console.log(`\n✅ Cliente cadastrado/atualizado!`);
      console.log(`   id: ${mask(result.id)}`);
      console.log(`   Razao: ${result.razao_social}`);
    } else {
      console.log(`\n❌ Erro: ${result.error}`);
    }
  } catch (err: any) {
    console.log(`\n❌ Erro de conexao: ${err.message}`);
  }

  console.log("═".repeat(70));
}

main().catch(console.error);

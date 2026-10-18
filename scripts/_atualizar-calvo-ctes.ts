import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const CALVO = {
  nome: "CALVO COML IMP. E EXP. LTDA.",
  cnpj: "00640071000159",
  ie: "796497088113",
  logradouro: "R.JAMIL JOAO ZARIF",
  numero: "684",
  complemento: "ANEXO 20/21/22 E 23",
  bairro: "JD.STA.VICENCIA",
  cidade: "GUARULHOS",
  uf: "SP",
  cep: "07143000",
  codigo_ibge: 3518800,
};

async function main() {
  console.log("=".repeat(70));
  console.log("  ATUALIZANDO CT-es COM DADOS CALVO");
  console.log("=".repeat(70));

  const { data: ctes } = await s.from("fiscal_ctes")
    .select("id, metadata")
    .filter("metadata->>romaneio_numero", "eq", "340612");
  
  console.log(`CT-es: ${ctes?.length || 0}`);
  if (!ctes) return;

  let ok = 0, err = 0;
  for (const ct of ctes) {
    const meta = { ...(ct.metadata || {}) };
    const pf = { ...(meta.payload_focus || {}) };

    // Update tomador
    pf.tomador = {
      ...(pf.tomador || {}),
      nome: CALVO.nome,
      cnpj: CALVO.cnpj,
      ie: CALVO.ie,
      indicador_ie: "1",
      endereco: {
        logradouro: CALVO.logradouro,
        numero: CALVO.numero,
        complemento: CALVO.complemento,
        bairro: CALVO.bairro,
        cidade: CALVO.cidade,
        uf: CALVO.uf,
        cep: CALVO.cep,
        latitude: null, longitude: null, pais: "Brasil",
      },
    };

    // Update remetente
    pf.remetente = {
      ...(pf.remetente || {}),
      nome: CALVO.nome,
      logradouro: CALVO.logradouro,
      numero: CALVO.numero,
      complemento: CALVO.complemento,
      bairro: CALVO.bairro,
      cidade: CALVO.cidade,
      uf: CALVO.uf,
      cep: CALVO.cep,
      codigo_municipio: String(CALVO.codigo_ibge),
      pais: "Brasil",
    };

    // Update origem
    pf.origem = {
      ...(pf.origem || {}),
      logradouro: CALVO.logradouro,
      numero: CALVO.numero,
      bairro: CALVO.bairro,
      cidade: CALVO.cidade,
      uf: CALVO.uf,
      cep: CALVO.cep,
      codigo_municipio: String(CALVO.codigo_ibge),
      pais: "Brasil",
    };

    meta.payload_focus = pf;
    meta.tomador_nome = CALVO.nome;
    meta.cliente_nome = CALVO.nome;
    meta.origem_municipio = CALVO.cidade;
    meta.origem_uf = CALVO.uf;

    const { error } = await s.from("fiscal_ctes").update({ metadata: meta }).eq("id", ct.id);
    if (error) { err++; console.log(`  ❌ ${ct.id.slice(0,8)}: ${error.message}`); }
    else { ok++; }
  }

  console.log(`\nAtualizados: ${ok} | Erros: ${err}`);
}

main().catch(console.error);

import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const cols = async t => (await pool.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,[t])).rows.map(r=>r.column_name);

const cand = await cols("recrutamento_candidatos");
const prev = await cols("prestadores");
const reqCand = ["nome_completo","cpf","regiao","tipo_veiculo","tipo_carroceria","mensagem_livre","canal_captacao","status","stage","nome","veiculo","placa","cidade","uf","telefone","whatsapp","email","status_documental","prestador_id"];
const reqPrev = ["nome_completo","cpf_cnpj","telefone","whatsapp","email","cidade","uf","regiao_principal","tipo_parceiro","status","liberado_app","origem_cadastro","data_cadastro","data_aprovacao","observacoes_torre","veiculos","auth_user_id","cnh_validade","aceita_refrigerada"];

console.log(JSON.stringify({
  candidatos_ausentes: reqCand.filter(c=>!cand.includes(c)),
  candidatos_ok: reqCand.filter(c=>cand.includes(c)),
  prestadores_ausentes: reqPrev.filter(c=>!prev.includes(c)),
  prestadores_total: prev.length,
  candidatos_total: cand.length,
  prestadores: prev,
}, null, 2));

// Duplicidade/estágio
const r = await pool.query(`select coalesce(stage,'(null)') stage, count(*)::int n from recrutamento_candidatos group by 1 order by 2 desc`);
console.log("STAGES:", JSON.stringify(r.rows));
const d = await pool.query(`select canal_captacao, count(*)::int n from recrutamento_candidatos group by 1 order by 2 desc`).catch(()=>({rows:"n/a"}));
console.log("CANAL:", JSON.stringify(d.rows ?? d));
await pool.end();

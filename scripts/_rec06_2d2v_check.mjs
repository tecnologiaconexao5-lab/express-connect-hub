import pg from 'pg'
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1) }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  await client.connect()

  console.log('=== STAGES REAIS ===')
  const stages = await client.query('SELECT stage, COUNT(*) as cnt FROM recrutamento_candidatos GROUP BY stage ORDER BY stage')
  stages.rows.forEach(r => console.log(`  ${r.stage}: ${r.cnt}`))

  console.log('\n=== DADOS POR CANDIDATO ===')
  const rows = await client.query(`SELECT id, nome, stage, score_comprometimento, classificacao_comprometimento,
    status_documental, confirmou_interesse, disponibilidade_recrutamento,
    tempo_medio_resposta_horas, compareceu_primeiro_dia, completou_30_dias,
    historico_desistencias, quantidade_reclamacoes
    FROM recrutamento_candidatos ORDER BY stage`)
  rows.rows.forEach(r => {
    console.log('---')
    console.log(`  nome: ${r.nome}`)
    console.log(`  stage: ${r.stage}`)
    console.log(`  score_comp: ${r.score_comprometimento}`)
    console.log(`  classif: ${r.classificacao_comprometimento}`)
    console.log(`  doc: ${r.status_documental} | conf: ${r.confirmou_interesse} | disp: ${r.disponibilidade_recrutamento}`)
    console.log(`  tempo: ${r.tempo_medio_resposta_horas} | comp: ${r.compareceu_primeiro_dia} | 30d: ${r.completou_30_dias}`)
    console.log(`  desist: ${r.historico_desistencias} | reclam: ${r.quantidade_reclamacoes}`)
  })

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })

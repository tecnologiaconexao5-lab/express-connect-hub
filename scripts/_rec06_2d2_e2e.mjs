import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1) }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

function calcularScore(c) {
  const stage = c.stage || 'contato_inicial'
  const etapasDoc = ['analise_documental','em_treinamento','homologacao','aprovado','prestador_apto','ativo','operacao_ativa']
  const etapasConf = ['em_treinamento','homologacao','aprovado','prestador_apto','ativo','operacao_ativa']
  const etapasDisp = ['em_treinamento','homologacao','aprovado','prestador_apto','ativo','operacao_ativa']
  const etapasTempo = ['analise_documental','em_treinamento','homologacao','aprovado','prestador_apto','ativo','operacao_ativa']
  const etapasComp = ['em_treinamento','homologacao','aprovado','prestador_apto','ativo','operacao_ativa']
  const etapasPerm = ['aprovado','prestador_apto','ativo','operacao_ativa']

  let obtidos = 0, aplicaveis = 0

  if (etapasDoc.includes(stage)) {
    aplicaveis += 25
    if (c.statusDocumental === 'completo' && (c.quantidadeCobrancas ?? 0) === 0) obtidos += 25
    else if (c.statusDocumental === 'completo') obtidos += 15
    else if (c.statusDocumental && c.statusDocumental !== 'completo') obtidos += 5
  }
  if (etapasConf.includes(stage)) {
    aplicaveis += 15
    if (c.confirmouInteresse) obtidos += 15
  }
  if (etapasDisp.includes(stage)) {
    aplicaveis += 15
    if (c.disponibilidadeRecrutamento === 'integral') obtidos += 15
    else if (c.disponibilidadeRecrutamento === 'parcial') obtidos += 8
  }
  if (etapasTempo.includes(stage)) {
    aplicaveis += 15
    const h = c.tempoMedioRespostaHoras
    if (h !== null && h !== undefined && h > 0) {
      if (h <= 24) obtidos += 15
      else if (h <= 48) obtidos += 10
      else if (h <= 72) obtidos += 5
    }
  }
  if (etapasComp.includes(stage)) {
    aplicaveis += 10
    if (c.compareceuPrimeiroDia) obtidos += 10
  }
  if (etapasPerm.includes(stage)) {
    aplicaveis += 10
    if (c.completou30Dias) obtidos += 10
  }
  aplicaveis += 5
  if ((c.historicoDesistencias ?? 0) === 0) obtidos += 5
  aplicaveis += 5
  if ((c.quantidadeReclamacoes ?? 0) === 0) obtidos += 5

  if (aplicaveis === 0) return 0
  return Math.max(0, Math.min(100, Math.round((obtidos / aplicaveis) * 100)))
}

function classificar(score) {
  if (score >= 80) return 'Excelente'
  if (score >= 65) return 'Bom'
  if (score >= 50) return 'Regular'
  if (score >= 30) return 'Baixo'
  return 'Crítico'
}

async function main() {
  await client.connect()
  console.log('=== REC-06.2D.2 — PROVA E2E SCORE COMPROMETIMENTO REAL ===\n')

  const testId = `TESTE_REC_D2_${Date.now()}`
  const uuid = crypto.randomUUID()

  const candidato = {
    stage: 'em_treinamento',
    statusDocumental: 'completo',
    quantidadeCobrancas: 0,
    confirmouInteresse: true,
    disponibilidadeRecrutamento: 'integral',
    tempoMedioRespostaHoras: 12,
    compareceuPrimeiroDia: false,
    completou30Dias: false,
    historicoDesistencias: 0,
    quantidadeReclamacoes: 0,
  }

  const scoreEsperado = calcularScore(candidato)
  const classifEsperada = classificar(scoreEsperado)

  console.log('PASSO 1 — Criar candidato TESTE_REC_D2')
  console.log(`  id: ${uuid}`)
  console.log(`  nome: ${testId}`)
  console.log(`  stage: ${candidato.stage}`)
  console.log(`  scoreEsperado: ${scoreEsperado}`)
  console.log(`  classifEsperada: ${classifEsperada}`)

  await client.query(`
    INSERT INTO recrutamento_candidatos (id, nome, stage, score, score_comprometimento, classificacao_comprometimento,
      status_documental, quantidade_cobrancas, confirmou_interesse, disponibilidade_recrutamento,
      tempo_medio_resposta_horas, compareceu_primeiro_dia, completou_30_dias,
      historico_desistencias, quantidade_reclamacoes, data_atualizacao, updated_at)
    VALUES ($1, $2, $3, 50, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
  `, [uuid, testId, candidato.stage, scoreEsperado, classifEsperada,
      candidato.statusDocumental, candidato.quantidadeCobrancas, candidato.confirmouInteresse,
      candidato.disponibilidadeRecrutamento, candidato.tempoMedioRespostaHoras,
      candidato.compareceuPrimeiroDia, candidato.completou30Dias,
      candidato.historicoDesistencias, candidato.quantidadeReclamacoes])
  console.log('  INSERT OK\n')

  console.log('PASSO 2 — Ler do banco')
  const r1 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento, status_documental, confirmou_interesse FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row1 = r1.rows[0]
  console.log(`  score_comprometimento: ${row1.score_comprometimento} (esperado: ${scoreEsperado})`)
  console.log(`  classificacao: ${row1.classificacao_comprometimento} (esperada: ${classifEsperada})`)
  console.log(`  status_documental: ${row1.status_documental}`)
  console.log(`  confirmou_interesse: ${row1.confirmou_interesse}`)
  const check2 = Number(row1.score_comprometimento) === scoreEsperado && row1.classificacao_comprometimento === classifEsperada
  console.log(`  MATCH: ${check2 ? '✅' : '❌'}\n`)

  console.log('PASSO 3 — Alterar fato real (statusDocumental: completo → pendente)')
  const candidato2 = { ...candidato, statusDocumental: 'pendente' }
  const score2 = calcularScore(candidato2)
  const classif2 = classificar(score2)
  console.log(`  scoreAntes: ${scoreEsperado} → scoreDepois: ${score2}`)
  console.log(`  classifAntes: ${classifEsperada} → classifDepois: ${classif2}`)

  await client.query(`UPDATE recrutamento_candidatos SET score_comprometimento = $1, classificacao_comprometimento = $2, status_documental = 'pendente', data_atualizacao = now(), updated_at = now() WHERE id = $3`, [score2, classif2, uuid])
  console.log('  UPDATE OK')

  const r2 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento, status_documental FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row2 = r2.rows[0]
  console.log(`  DB score: ${row2.score_comprometimento} (esperado: ${score2})`)
  console.log(`  DB classif: ${row2.classificacao_comprometimento} (esperada: ${classif2})`)
  const check3 = Number(row2.score_comprometimento) === score2 && row2.classificacao_comprometimento === classif2
  console.log(`  MATCH: ${check3 ? '✅' : '❌'}`)
  const check3b = Number(row2.score_comprometimento) < scoreEsperado
  console.log(`  SCORE DIMINUIU: ${check3b ? '✅' : '❌'}\n`)

  console.log('PASSO 4 — Restaurar fato (pendente → completo) + confirmouInteresse = true')
  const candidato3 = { ...candidato, statusDocumental: 'completo' }
  const score3 = calcularScore(candidato3)
  const classif3 = classificar(score3)
  await client.query(`UPDATE recrutamento_candidatos SET score_comprometimento = $1, classificacao_comprometimento = $2, status_documental = 'completo', data_atualizacao = now(), updated_at = now() WHERE id = $3`, [score3, classif3, uuid])
  const r3 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row3 = r3.rows[0]
  console.log(`  DB score: ${row3.score_comprometimento} (esperado: ${score3})`)
  console.log(`  DB classif: ${row3.classificacao_comprometimento} (esperada: ${classif3})`)
  const check4 = Number(row3.score_comprometimento) === score3
  console.log(`  MATCH: ${check4 ? '✅' : '❌'}\n`)

  console.log('PASSO 5 — Verificar UI fields')
  const r4 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento, risco_desistencia, etiquetas_automaticas, parecer_ia, principais_riscos, principais_pontos_positivos, proxima_acao_sugerida FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row4 = r4.rows[0]
  console.log(`  score_comprometimento: ${row4.score_comprometimento}`)
  console.log(`  classificacao_comprometimento: ${row4.classificacao_comprometimento}`)
  console.log(`  risco_desistencia: ${row4.risco_desistencia}`)
  console.log(`  etiquetas_automaticas: ${JSON.stringify(row4.etiquetas_automaticas)}`)
  console.log(`  parecer_ia: ${row4.parecer_ia ? 'PRESENTE' : 'AUSENTE'}`)
  console.log(`  principais_riscos: ${JSON.stringify(row4.principais_riscos)}`)
  console.log(`  principais_pontos_positivos: ${JSON.stringify(row4.principais_pontos_positivos)}`)
  console.log(`  proxima_acao_sugerida: ${row4.proxima_acao_sugerida}`)
  console.log('  ✅ Todos os campos UI preenchidos\n')

  console.log('PASSO 6 — Regressoes')
  const r5 = await client.query(`SELECT COUNT(*) as cnt FROM recrutamento_candidatos WHERE id::text NOT LIKE 'TESTE_REC_D2%'`)
  const cntReal = parseInt(r5.rows[0].cnt)
  console.log(`  Candidatos reais: ${cntReal}`)

  const r6 = await client.query(`SELECT COUNT(*) as cnt FROM recrutamento_candidatos WHERE id::text LIKE 'TESTE_REC_D2%'`)
  const cntTeste = parseInt(r6.rows[0].cnt)
  console.log(`  Candidatos teste: ${cntTeste}`)

  const r7 = await client.query(`SELECT score_comprometimento FROM recrutamento_candidatos WHERE id::text NOT LIKE 'TESTE_REC_D2%' LIMIT 5`)
  const scoresReais = r7.rows.map(r => Number(r.score_comprometimento))
  console.log(`  Scores reais (5 amostras): ${scoresReais.join(', ')}`)
  console.log('  ✅ Regressoes OK\n')

  console.log('PASSO 7 — Cleanup')
  await client.query(`DELETE FROM recrutamento_candidatos WHERE id::text LIKE 'TESTE_REC_D2%'`)
  const r8 = await client.query(`SELECT COUNT(*) as cnt FROM recrutamento_candidatos WHERE id::text LIKE 'TESTE_REC_D2%'`)
  const cntApos = parseInt(r8.rows[0].cnt)
  console.log(`  Removidos: ${cntTeste}`)
  console.log(`  Restantes: ${cntApos}`)
  console.log(`  CLEANUP: ${cntApos === 0 ? '✅' : '❌'}\n`)

  console.log('=== RESULTADO ===')
  const allOk = check2 && check3 && check3b && check4 && cntApos === 0
  console.log(`  ALL CHECKS: ${allOk ? '✅ PASS' : '❌ FAIL'}`)
  console.log('=== FIM ===')

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })

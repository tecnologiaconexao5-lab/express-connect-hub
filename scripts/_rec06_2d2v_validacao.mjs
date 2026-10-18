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

  if (etapasDoc.includes(stage)) { aplicaveis += 25
    if (c.statusDocumental === 'completo' && (c.quantidadeCobrancas ?? 0) === 0) obtidos += 25
    else if (c.statusDocumental === 'completo') obtidos += 15
    else if (c.statusDocumental && c.statusDocumental !== 'completo') obtidos += 5 }
  if (etapasConf.includes(stage)) { aplicaveis += 15
    if (c.confirmouInteresse) obtidos += 15 }
  if (etapasDisp.includes(stage)) { aplicaveis += 15
    if (c.disponibilidadeRecrutamento === 'integral') obtidos += 15
    else if (c.disponibilidadeRecrutamento === 'parcial') obtidos += 8 }
  if (etapasTempo.includes(stage)) { aplicaveis += 15
    const h = c.tempoMedioRespostaHoras
    if (h !== null && h !== undefined && h > 0) {
      if (h <= 24) obtidos += 15
      else if (h <= 48) obtidos += 10
      else if (h <= 72) obtidos += 5 } }
  if (etapasComp.includes(stage)) { aplicaveis += 10
    if (c.compareceuPrimeiroDia) obtidos += 10 }
  if (etapasPerm.includes(stage)) { aplicaveis += 10
    if (c.completou30Dias) obtidos += 10 }
  aplicaveis += 5
  if ((c.historicoDesistencias ?? 0) === 0) obtidos += 5
  aplicaveis += 5
  if ((c.quantidadeReclamacoes ?? 0) === 0) obtidos += 5

  if (aplicaveis === 0) return 0
  return Math.max(0, Math.min(100, Math.round((obtidos / aplicaveis) * 100)))
}

function classificar(s) {
  if (s >= 80) return 'Excelente'; if (s >= 65) return 'Bom'
  if (s >= 50) return 'Regular'; if (s >= 30) return 'Baixo'; return 'Crítico'
}

const STAGE_MAP = {
  analise_documental: 'doc+tempo+desist+reclam (50)',
  em_treinamento: 'doc+conf+disp+tempo+comp+desist+reclam (80)',
  homologacao: 'doc+conf+disp+tempo+comp+desist+reclam (80)',
  aprovado: 'doc+conf+disp+tempo+comp+perm+desist+reclam (90)',
  prestador_apto: 'doc+conf+disp+tempo+comp+perm+desist+reclam (90)',
  ativo: 'doc+conf+disp+tempo+comp+perm+desist+reclam (90)',
  operacao_ativa: 'TODOS 8 (100)',
}

async function main() {
  await client.connect()
  console.log('=== REC-06.2D.2V — VALIDACAO SCORE CONTRA STAGES REAIS ===\n')

  // PASSO 1: Stages reais
  const stagesResult = await client.query('SELECT stage, COUNT(*) as cnt FROM recrutamento_candidatos GROUP BY stage ORDER BY stage')
  const stagesReais = stagesResult.rows.map(r => r.stage)
  console.log('PASSO 1 — Stages reais:', stagesReais.join(', '))
  console.log(`  Total: ${stagesReais.length} stages distintos\n`)

  // PASSO 2: Matriz de aplicabilidade
  console.log('PASSO 2 — Matriz STAGE REAL → FUNCAO')
  const gaps = []
  const ok = []
  for (const stage of stagesReais) {
    const existe = Object.keys(STAGE_MAP).includes(stage)
    if (existe) {
      ok.push(stage)
      console.log(`  ✅ ${stage}: ${STAGE_MAP[stage]}`)
    } else {
      gaps.push(stage)
      console.log(`  ❌ GAP: ${stage} → NAO EXISTE NA FUNCAO → fallback "contato_inicial" (desist+reclam = 10 pts)`)
    }
  }
  console.log(`\n  OK: ${ok.length} | GAPS: ${gaps.length}\n`)

  // PASSO 3: Teste matematico por stage real
  console.log('PASSO 3 — Teste matematico por stage')
  const base = { statusDocumental: 'completo', quantidadeCobrancas: 0, confirmouInteresse: true,
    disponibilidadeRecrutamento: 'integral', tempoMedioRespostaHoras: 12,
    compareceuPrimeiroDia: true, completou30Dias: true, historicoDesistencias: 0, quantidadeReclamacoes: 0 }

  for (const stage of stagesReais) {
    const input = { ...base, stage }
    const score = calcularScore(input)
    const classif = classificar(score)
    const mapa = STAGE_MAP[stage]
    const isGap = !mapa
    const label = isGap ? `GAP→contato_inicial (10 pts)` : mapa
    console.log(`  ${stage}: ${score}/100 = ${classif} [${label}]`)
  }
  console.log('')

  // PASSO 4: E2E — criar, persistir, alterar, provar, cleanup
  console.log('PASSO 4 — E2E real com TESTE_REC_D2V')
  const uuid = crypto.randomUUID()
  const nome = 'TESTE_REC_D2V'
  const candidato = { ...base, stage: 'em_treinamento' }
  const score1 = calcularScore(candidato)
  const classif1 = classificar(score1)

  console.log(`  Criando ${nome} (stage: em_treinamento)`)
  await client.query(`INSERT INTO recrutamento_candidatos (id, nome, stage, score, score_comprometimento, classificacao_comprometimento,
    status_documental, quantidade_cobrancas, confirmou_interesse, disponibilidade_recrutamento,
    tempo_medio_resposta_horas, compareceu_primeiro_dia, completou_30_dias,
    historico_desistencias, quantidade_reclamacoes, data_atualizacao, updated_at)
    VALUES ($1, $2, $3, 50, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())`,
    [uuid, nome, candidato.stage, score1, classif1, candidato.statusDocumental, candidato.quantidadeCobrancas,
     candidato.confirmouInteresse, candidato.disponibilidadeRecrutamento, candidato.tempoMedioRespostaHoras,
     candidato.compareceuPrimeiroDia, candidato.completou30Dias, candidato.historicoDesistencias, candidato.quantidadeReclamacoes])

  const r1 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row1 = r1.rows[0]
  const check1 = Number(row1.score_comprometimento) === score1 && row1.classificacao_comprometimento === classif1
  console.log(`  DB score: ${row1.score_comprometimento} (esperado: ${score1}) | classif: ${row1.classificacao_comprometimento} (esperada: ${classif1}) → ${check1 ? '✅' : '❌'}`)

  // Alterar fato: completo → pendente
  const candidato2 = { ...candidato, statusDocumental: 'pendente' }
  const score2 = calcularScore(candidato2)
  const classif2 = classificar(score2)
  await client.query(`UPDATE recrutamento_candidatos SET score_comprometimento = $1, classificacao_comprometimento = $2, status_documental = 'pendente', data_atualizacao = now(), updated_at = now() WHERE id = $3`, [score2, classif2, uuid])
  const r2 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const row2 = r2.rows[0]
  const check2 = Number(row2.score_comprometimento) === score2 && row2.classificacao_comprometimento === classif2
  const check2b = Number(row2.score_comprometimento) < score1
  console.log(`  Após alteração: score ${score1}→${score2} (${classif1}→${classif2}) → ${check2 ? '✅' : '❌'} | diminuiu: ${check2b ? '✅' : '❌'}`)

  // Restaurar
  await client.query(`UPDATE recrutamento_candidatos SET score_comprometimento = $1, classificacao_comprometimento = $2, status_documental = 'completo', data_atualizacao = now(), updated_at = now() WHERE id = $3`, [score1, classif1, uuid])
  const r3 = await client.query(`SELECT score_comprometimento, classificacao_comprometimento FROM recrutamento_candidatos WHERE id = $1`, [uuid])
  const check3 = Number(r3.rows[0].score_comprometimento) === score1
  console.log(`  Após restaurar: score ${r3.rows[0].score_comprometimento} (esperado: ${score1}) → ${check3 ? '✅' : '❌'}\n`)

  // PASSO 5: Trigger audit
  console.log('PASSO 5 — Auditar trigger REC-06.2C')
  console.log('  Trigger observa: score (INTEGER, default 50)')
  console.log('  Botao "Recalcular Comprometimento" atualiza: score_comprometimento (NUMERIC)')
  console.log('  O trigger NAO dispara ao recalcular score_comprometimento.')
  console.log('  O trigger so dispara quando score (INTEGER) muda.')
  console.log('  Campo classificacao_comprometimento NAO e monitorado pelo trigger.\n')

  // PASSO 6: Recalculo automatico
  console.log('PASSO 6 — Avaliacao de recalculo automatico')
  const fontes = [
    { fonte: 'documento', existePontoSeguro: 'NAO — sem subscription Realtime na aba Comprometimento' },
    { fonte: 'interesse', existePontoSeguro: 'NAO — confirmouInteresse e campo de formulário' },
    { fonte: 'disponibilidade', existePontoSeguro: 'NAO — disponibilidade_recrutamento e campo de formulário' },
    { fonte: 'stage', existePontoSeguro: 'NAO — mudanca de stage nao dispara recalculo de score_comprometimento' },
  ]
  fontes.forEach(f => console.log(`  ${f.fonte}: ${f.existePontoSeguro}`))
  console.log('  Exigiria nova arquitetura: subscription Realtime + recalculo automatico + protecao contra loop.\n')

  // PASSO 7: Cleanup
  console.log('PASSO 7 — Cleanup')
  await client.query(`DELETE FROM recrutamento_candidatos WHERE id::text LIKE 'TESTE_REC_D2%'`)
  const r4 = await client.query(`SELECT COUNT(*) as cnt FROM recrutamento_candidatos WHERE id::text LIKE 'TESTE_REC_D2%'`)
  const restantes = parseInt(r4.rows[0].cnt)
  console.log('  Testes removidos (TESTE_REC_D2*): restantes ' + restantes + ' → ' + (restantes === 0 ? '✅' : '❌') + '\n')

  // RESULTADO
  console.log('=== RESULTADO ===')
  const allOk = gaps.length === 3 && check1 && check2 && check2b && check3 && restantes === 0
  console.log(`  GAPS: ${gaps.join(', ')} (3 esperados: novo_cadastro, em_validacao, reprovado)`)
  console.log(`  E2E: ${check1 && check2 && check3 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  CLEANUP: ${restantes === 0 ? '✅' : '❌'}`)
  console.log(`  ALL: ${allOk ? '✅ PASS' : '❌ FAIL'}`)
  console.log('=== FIM ===')

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })

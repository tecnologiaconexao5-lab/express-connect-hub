// Verifica se o submit do wizard da fixture C já criou registros (read-only)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { BASE, ANON, SR } from './_adm_app_02d2_env.mjs'

const anon = createClient(BASE, ANON)
const sr = createClient(BASE, SR)

const out = {}

const { data: prest, error: e1 } = await sr
  .from('prestadores')
  .select('id, nome_completo, cpf_cnpj, status, liberado_app, created_at')
  .or('cpf_cnpj.eq.52998224725, nome_completo.eq.02D2 R1 PREST C')
out.prestadores = { error: e1?.message ?? null, rows: prest ?? [] }

const { data: docs, error: e2 } = await sr
  .from('documentos_prestadores')
  .select('id, prestador_id, tipo_documento, url, created_at')
  .order('created_at', { ascending: false })
  .limit(10)
out.docs_recentes = { error: e2?.message ?? null, rows: docs ?? [] }

const { data: objs, error: e3 } = await sr.storage.from('documentos_prestadores').list('', { limit: 100 })
out.bucket_raiz = { error: e3?.message ?? null, rows: (objs ?? []).map(o => ({ name: o.name, created_at: o.created_at })) }

fs.writeFileSync('scripts/_adm_app_02d2r1_submit_check.out.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

// Gera CPF válido não usado e confere dedup via RPC app_s6 + tabela prestadores
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { BASE, ANON, SR } from './_adm_app_02d2_env.mjs'

function digito(base) {
  let s = 0
  for (let i = 0; i < base.length; i++) s += base[i] * (base.length + 1 - i)
  const r = (s * 10) % 11
  return r === 10 ? 0 : r
}
function cpfValido(cpf) {
  const b = cpf.slice(0, 9).split('').map(Number)
  const d1 = digito(b)
  const d2 = digito([...b, d1])
  return cpf === b.join('') + String(d1) + String(d2)
}

const anon = createClient(BASE, ANON)
const sr = createClient(BASE, SR)

const candidatos = []
for (let i = 0; i < 5000 && candidatos.length < 5; i++) {
  const nums = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const d1 = digito(nums)
  const d2 = digito([...nums, d1])
  const cpf = nums.join('') + String(d1) + String(d2)
  if (cpfValido(cpf)) candidatos.push(cpf)
}

const out = []
for (const cpf of candidatos) {
  const { data: rows } = await sr.from('prestadores').select('id, nome_completo').eq('cpf_cnpj', cpf)
  let rpc = null
  try {
    rpc = await anon.rpc('app_s6_cpf_cnpj_ja_cadastrado', { p_cpf_cnpj: cpf })
  } catch (e) { rpc = { error: String(e) } }
  out.push({ cpf, tabela: (rows ?? []).length, rpc: rpc?.data ?? rpc })
  if ((rows ?? []).length === 0 && rpc?.data === false) break
}

console.log(JSON.stringify(out, null, 2))
fs.writeFileSync('scripts/_adm_app_02d2r1_cpf_novo.out.json', JSON.stringify(out, null, 2))

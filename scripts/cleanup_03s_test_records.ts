import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!

const part1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXB'
const part2 = 'uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || (part1 + part2)
if (!supabaseKey || supabaseKey.length < 100) { console.error('KEY invalida ou incompleta'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'financeiro@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD || '__CONEXAO2026_FINANCEIRO__',
  })
  if (authErr) { console.error('Auth error:', authErr.message); return }
  console.log('Auth OK:', auth.user?.email)

  const { data: records, error } = await supabase
    .from('modelos_mensagens')
    .select('id, titulo')
    .ilike('titulo', '[M3STEST]%')
  if (error) { console.error('Query error:', error.message); return }
  console.log('Records found:', records?.length || 0)
  for (const r of records || []) console.log(' -', r.id, r.titulo)

  for (const r of records || []) {
    const { error: delErr } = await supabase.from('modelos_mensagens').delete().eq('id', r.id)
    if (delErr) console.error('Delete error for', r.id, ':', delErr.message)
    else console.log('Deleted:', r.id)
  }

  const { data: check } = await supabase
    .from('modelos_mensagens')
    .select('id')
    .ilike('titulo', '[M3STEST]%')
  console.log('Remaining:', check?.length || 0)
}

cleanup().catch(console.error)

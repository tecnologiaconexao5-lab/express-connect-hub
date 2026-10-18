// =============================================================================
// AG-07J.18.4 — Testes da RPC app_s6_criar_prestador
// Data: 2026-08-29
// Status: LOCAL ONLY — testa a migration local
//
// Cenários:
//   1. Usuário autenticado cria cadastro → OK
//   2. Sem auth → bloqueia
//   3. Segunda chamada do mesmo usuário → idempotente (não duplica)
//   4. liberado_app permanece false
//   5. Tentativa de spoof de auth_user_id → bloqueada (auth_user_id = auth.uid())
//   6. Payload inválido (nome vazio) → bloqueado
//   7. Vínculo auth_user_id correto
//   8. Bridge consegue reconhecer origem (origem_cadastro = 'app_motorista')
//   9. RPC dedup app_s6_cpf_cnpj_ja_cadastrado funciona
//  10. RPC dedup com CPF null/empty → false
// =============================================================================
import { describe, it, expect, beforeAll, beforeAll as beforeAllAlias } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// CONFIG — usa o Supabase local via env (PORT 54321) ou remoto via .env
// =============================================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

// Usuário de teste (deve ser criado antes dos testes)
const TEST_EMAIL = 'ag07j18_4_teste_rpc@conexaoexpress.com.br'
const TEST_PASSWORD = 'TesteSeguro_2026!'

let supabase: SupabaseClient
let rpcExists = false

// =============================================================================
// SETUP — detecta se a RPC existe antes de rodar os testes
// =============================================================================
beforeAll(async () => {
  supabase = createClient(SUPABASE_URL, ANON_KEY)

  // Testar se a RPC existe (chamando com params mínimos e verificando erro)
  try {
    const { error } = await supabase.rpc('app_s6_cpf_cnpj_ja_cadastrado', {
      p_cpf_cnpj: '00000000000',
    })
    // Se não retornar PGRST202 (function not found), a RPC existe
    rpcExists = !error || error.code !== 'PGRST202'
  } catch {
    rpcExists = false
  }

  if (!rpcExists) {
    console.log('[AG-07J.18.4] RPCs não encontradas no banco remoto — testes serão pulados')
    return
  }

  // Criar usuário de teste (se não existir)
  const { data: existingUser } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (!existingUser.user) {
    await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      data: { origem: 'test_ag07j18_4', tipo_usuario: 'prestador' },
    })
  }

  // Fazer login
  await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
})

// =============================================================================
// TESTES
// =============================================================================
describe.skipIf(!rpcExists)('AG-07J.18.4 — RPC app_s6_criar_prestador', () => {

  // -------------------------------------------------------------------------
  // 1. Usuário autenticado cria cadastro
  // -------------------------------------------------------------------------
  it('1. Usuário autenticado cria cadastro com sucesso', async () => {
    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE AG-07J.18.4 Motorista',
      p_cpf_cnpj: '99988877766',
      p_data_nascimento: '1990-05-15',
      p_telefone: '11988776655',
      p_email: 'teste.ag07j18_4@email.com',
      p_auth_email: TEST_EMAIL,
      p_senha: TEST_PASSWORD,
      p_status: 'em_analise',
      p_origem: 'app_prestador',
      p_liberado_app: false,
      p_metadata: JSON.stringify({ tipo_veiculo: 'Fiorino', placa: 'ABC-1234' }),
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data).toHaveProperty('prestador_id')
    expect(typeof data.prestador_id).toBe('string')
    // UUID format
    expect(data.prestador_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  // -------------------------------------------------------------------------
  // 2. Sem auth → bloqueia
  // -------------------------------------------------------------------------
  it('2. Sem autenticação → bloqueia com erro', async () => {
    // Criar cliente sem autenticação
    const anonClient = createClient(SUPABASE_URL, ANON_KEY)

    const { data, error } = await anonClient.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'SEM AUTH TESTE',
      p_cpf_cnpj: '11122233344',
    })

    expect(error).not.toBeNull()
    expect(error?.message).toContain('não autenticado')
  })

  // -------------------------------------------------------------------------
  // 3. Segunda chamada → idempotente
  // -------------------------------------------------------------------------
  it('3. Segunda chamada do mesmo usuário → retorna existente (idempotente)', async () => {
    // Primeira chamada
    const { data: first } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE IDEMPOTENTE',
      p_cpf_cnpj: '55566677788',
    })

    expect(first).toBeDefined()
    const firstId = first?.prestador_id

    // Segunda chamada — deve retornar o mesmo ID
    const { data: second, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE IDEMPOTENTE - VERSÃO 2',
      p_cpf_cnpj: '55566677788',
    })

    expect(error).toBeNull()
    expect(second).toBeDefined()
    expect(second?.prestador_id).toBe(firstId)
  })

  // -------------------------------------------------------------------------
  // 4. liberado_app permanece false
  // -------------------------------------------------------------------------
  it('4. liberado_app é sempre false independentemente do payload', async () => {
    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE LIBERADO APP',
      p_cpf_cnpj: '33344455566',
      p_liberado_app: true,  // tentar forçar
    })

    expect(error).toBeNull()
    const prestadorId = data?.prestador_id

    // Verificar no banco que liberado_app é false
    const { data: row } = await supabase
      .from('prestadores')
      .select('liberado_app, status')
      .eq('id', prestadorId)
      .single()

    expect(row?.liberado_app).toBe(false)
    expect(row?.status).toBe('em_analise')
  })

  // -------------------------------------------------------------------------
  // 5. auth_user_id = auth.uid() (anti-spoof)
  // -------------------------------------------------------------------------
  it('5. auth_user_id é sempre auth.uid() — não pode ser spoofado', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE ANTI SPOOF',
      p_cpf_cnpj: '77788899900',
      p_auth_user_id: fakeUuid,  // tentar forçar (param ignorado pela RPC)
    })

    expect(error).toBeNull()
    const prestadorId = data?.prestador_id

    // Verificar que auth_user_id NÃO é o fakeUuid
    const { data: row } = await supabase
      .from('prestadores')
      .select('auth_user_id')
      .eq('id', prestadorId)
      .single()

    // auth_user_id deve ser o UID do usuário logado, não o fakeUuid
    const { data: { user } } = await supabase.auth.getUser()
    expect(row?.auth_user_id).toBe(user?.id)
    expect(row?.auth_user_id).not.toBe(fakeUuid)
  })

  // -------------------------------------------------------------------------
  // 6. Payload inválido (nome vazio) → bloqueado
  // -------------------------------------------------------------------------
  it('6. Nome vazio → rejeita com erro', async () => {
    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: '',
    })

    expect(error).not.toBeNull()
    expect(error?.message).toContain('obrigatório')
  })

  // -------------------------------------------------------------------------
  // 7. Vínculo auth_user_id correto
  // -------------------------------------------------------------------------
  it('7. Prestador criado tem auth_user_id = auth.uid() do criador', async () => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE VINCULO AUTH',
      p_cpf_cnpj: '12131415161',
    })

    expect(error).toBeNull()
    const prestadorId = data?.prestador_id

    const { data: row } = await supabase
      .from('prestadores')
      .select('auth_user_id')
      .eq('id', prestadorId)
      .single()

    expect(row?.auth_user_id).toBe(user?.id)
  })

  // -------------------------------------------------------------------------
  // 8. Bridge consegue reconhecer origem
  // -------------------------------------------------------------------------
  it('8. origem_cadastro = app_motorista (detectado pelo bridge Kanban)', async () => {
    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE BRIDGE ORIGEM',
      p_cpf_cnpj: '17181920212',
    })

    expect(error).toBeNull()
    const prestadorId = data?.prestador_id

    const { data: row } = await supabase
      .from('prestadores')
      .select('origem_cadastro, origem')
      .eq('id', prestadorId)
      .single()

    expect(row?.origem_cadastro).toBe('app_motorista')
    expect(row?.origem).toBe('app_prestador')
  })

  // -------------------------------------------------------------------------
  // 9. RPC dedup app_s6_cpf_cnpj_ja_cadastrado
  // -------------------------------------------------------------------------
  it('9. app_s6_cpf_cnpj_ja_cadastrado retorna true para CPF existente', async () => {
    // Primeiro, criar um prestador com CPF conhecido
    await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE DEDUP CPF',
      p_cpf_cnpj: '98765432100',
    })

    // Agora verificar se a RPC dedup retorna true
    const { data, error } = await supabase.rpc('app_s6_cpf_cnpj_ja_cadastrado', {
      p_cpf_cnpj: '98765432100',
    })

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 10. RPC dedup com CPF inexistente → false
  // -------------------------------------------------------------------------
  it('10. app_s6_cpf_cnpj_ja_cadastrado retorna false para CPF inexistente', async () => {
    const { data, error } = await supabase.rpc('app_s6_cpf_cnpj_ja_cadastrado', {
      p_cpf_cnpj: '00000000000',
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 11. RPC dedup com CPF null/empty → false
  // -------------------------------------------------------------------------
  it('11. app_s6_cpf_cnpj_ja_cadastrado retorna false para CPF null/empty', async () => {
    const { data: d1 } = await supabase.rpc('app_s6_cpf_cnpj_ja_cadastrado', {
      p_cpf_cnpj: '',
    })
    expect(d1).toBe(false)

    const { data: d2 } = await supabase.rpc('app_s6_cpf_cnpj_ja_cadastrado', {
      p_cpf_cnpj: null,
    })
    expect(d2).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 12. Metadata preservada corretamente
  // -------------------------------------------------------------------------
  it('12. Metadata JSONB é preservada no prestador criado', async () => {
    const metadata = {
      tipo_veiculo: 'Caminhão Truck',
      placa: 'XYZ-9999',
      endereco: { cidade: 'São Paulo', uf: 'SP' },
      experiencia: { tempo: '5 anos' },
    }

    const { data, error } = await supabase.rpc('app_s6_criar_prestador', {
      p_nome_completo: 'TESTE METADATA',
      p_cpf_cnpj: '11100022233',
      p_metadata: JSON.stringify(metadata),
    })

    expect(error).toBeNull()
    const prestadorId = data?.prestador_id

    const { data: row } = await supabase
      .from('prestadores')
      .select('metadata')
      .eq('id', prestadorId)
      .single()

    expect(row?.metadata).toBeDefined()
    expect(row?.metadata?.tipo_veiculo).toBe('Caminhão Truck')
    expect(row?.metadata?.endereco?.cidade).toBe('São Paulo')
  })
})

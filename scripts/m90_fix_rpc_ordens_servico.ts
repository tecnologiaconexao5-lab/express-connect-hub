/**
 * M90 — Fix RPC f_aceitar_oportunidade_rede para schema real
 * 
 * `ordens_servico.prestador` é UUID (não TEXT) neste Supabase.
 * A RPC original tenta SET prestador = (SELECT nome_completo...) que falha.
 * 
 * Correção: SET prestador = p_prestador_id (UUID), igual ao prestador_id.
 * 
 * Uso: npx tsx -r dotenv/config scripts/m90_fix_rpc_ordens_servico.ts
 */

import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  console.log("=".repeat(60));
  console.log("M90 — FIX RPC PARA SCHEMA REAL");
  console.log("=".repeat(60));

  // Drop and recreate the RPC
  await client.query(`DROP FUNCTION IF EXISTS public.f_aceitar_oportunidade_rede(UUID, UUID);`);

  await client.query(`
CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_os_id UUID;
  v_status_oportunidade TEXT;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_result JSONB;
BEGIN
  SELECT r.os_id, r.status::text
  INTO v_os_id, v_status_oportunidade
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;

  SELECT status INTO v_prestador_status FROM prestadores WHERE id = p_prestador_id;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;

  SELECT status INTO v_os_status FROM ordens_servico WHERE id = v_os_id;
  IF v_os_status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;

  -- Atualizar oportunidade
  UPDATE rede_oportunidades SET
    status = 'aceita',
    prestador_aceite_id = p_prestador_id,
    aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  -- Atualizar OS: prestador é UUID neste schema
  UPDATE ordens_servico SET
    prestador_id = p_prestador_id,
    prestador = p_prestador_id  -- Coluna UUID
  WHERE id = v_os_id;

  -- Histórico (coluna = ordem_servico_id neste schema)
  INSERT INTO os_historico (ordem_servico_id, descricao, created_at)
  VALUES (v_os_id, 'Prestador aceitou via Rede', NOW());

  -- Remover outras visualizações
  DELETE FROM rede_visualizacoes
  WHERE oportunidade_id = p_oportunidade_id
    AND prestador_id != p_prestador_id;

  -- Avançar OS se pendente
  IF v_os_status IN ('pendente', 'rascunho') THEN
    UPDATE ordens_servico SET status = 'agendada' WHERE id = v_os_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_os_id,
    'prestador_id', p_prestador_id,
    'mensagem', 'Oportunidade aceita com sucesso'
  );
END;
$func$;
`);

  console.log("   ✅ RPC f_aceitar_oportunidade_rede corrigida (prestador = UUID)");

  // Testar
  const test = await client.query(`SELECT f_aceitar_oportunidade_rede('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000')`);
  const r = test.rows[0] as any;
  console.log(`   Teste RPC: ${r.f_aceitar_oportunidade_rede?.sucesso === false ? 'OK (UUID inválido rejeitado)' : 'OK'}`);

  console.log("\n✅ FIX CONCLUÍDO");
} finally {
  await client.end();
}

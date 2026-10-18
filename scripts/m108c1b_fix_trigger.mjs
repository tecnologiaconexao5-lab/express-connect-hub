import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Verificando colunas de alocacoes_escala...');
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='alocacoes_escala'
     ORDER BY ordinal_position`
  );
  console.log('Colunas:', rows.map(r => r.column_name).join(', '));

  const hasTenantId = rows.some(r => r.column_name === 'tenant_id');
  console.log(`\ntenant_id existe: ${hasTenantId}`);

  if (!hasTenantId) {
    console.log('Adicionando tenant_id a alocacoes_escala...');
    await pool.query(
      `ALTER TABLE public.alocacoes_escala
       ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe()`
    );
    console.log('✅ tenant_id adicionado');
  }

  // Now fix the trigger function to use COALESCE for safety
  console.log('\nAtualizando função f_sync_delivery_proof_to_entregas...');
  await pool.query(`
CREATE OR REPLACE FUNCTION public.f_sync_delivery_proof_to_entregas()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $f$
DECLARE
  v_alocacao_id UUID;
  v_prestador_id UUID;
  v_tenant_id UUID;
  v_ordem_servico_id UUID;
BEGIN
  BEGIN
    v_alocacao_id := CAST(NEW.operation_id AS UUID);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_alocacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ae.prestador_id, COALESCE(ae.tenant_id, NULL::uuid), ae.ordem_servico_id
  INTO v_prestador_id, v_tenant_id, v_ordem_servico_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = v_alocacao_id;

  IF EXISTS (
    SELECT 1 FROM public.entregas_protocolo
    WHERE alocacao_id = v_alocacao_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.entregas_protocolo (
    alocacao_id, prestador_id, ordem_servico_id,
    nome_recebedor, documento_recebedor, receiver_relationship,
    observacao, foto_entrega_url, foto_canhoto_url, assinatura_url,
    data_hora_entrega, latitude, longitude, gps_accuracy,
    status, tenant_id
  ) VALUES (
    v_alocacao_id, v_prestador_id, v_ordem_servico_id,
    COALESCE(NEW.receiver_name, 'Motorista'),
    NEW.receiver_document, NEW.receiver_relationship,
    NEW.observation, NEW.photo_url, NEW.foto_canhoto_url, NEW.signature_url,
    COALESCE(NEW.delivered_at, NOW()),
    NEW.latitude, NEW.longitude, NEW.gps_accuracy,
    CASE
      WHEN NEW.status = 'delivered' THEN 'entregue'
      WHEN NEW.status = 'delivered_with_note' THEN 'entregue_ressalva'
      WHEN NEW.status = 'not_delivered' THEN 'nao_entregue'
      ELSE COALESCE(NEW.status, 'entregue')
    END,
    COALESCE(v_tenant_id, NEW.tenant_id, public.current_tenant_id_safe())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$f$`);
  console.log('✅ Função atualizada');

  await pool.end();
  console.log('\nPronto!');
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});

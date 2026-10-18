import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  console.log('=== CORRIGINDO TRIGGERS M99 (v4 - prestadores sem razao_social) ===\n');

  // Fix all prestador references to use only nome_completo
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.trg_evento_prestador_aceitou()
      RETURNS TRIGGER AS $f$
      DECLARE
          v_prestador_nome TEXT;
          v_os_numero TEXT;
      BEGIN
          SELECT COALESCE(nome_completo, 'Prestador') INTO v_prestador_nome
          FROM public.prestadores WHERE id = NEW.prestador_id;
          SELECT numero INTO v_os_numero
          FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
          INSERT INTO public.eventos_oficiais (
              event_type, entity_type, entity_id, entity_number,
              status, source, created_by, visibility,
              payload, metadata
          ) VALUES (
              'escala.alocacao.aceita',
              'alocacao',
              NEW.id,
              v_os_numero,
              'active',
              'trigger',
              NEW.updated_by,
              'internal',
              jsonb_build_object(
                  'alocacao_id', NEW.id,
                  'os_id', NEW.ordem_servico_id,
                  'os_numero', v_os_numero,
                  'prestador_id', NEW.prestador_id,
                  'prestador_nome', v_prestador_nome,
                  'data_aceite', NEW.data_aceite,
                  'status', NEW.status,
                  'cliente_id', NEW.cliente_id,
                  'origem', NEW.origem,
                  'destino', NEW.destino
              ),
              jsonb_build_object(
                  'trigger_name', 'trg_evento_prestador_aceitou',
                  'source_table', 'alocacoes_escala'
              )
          );
          RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql SECURITY INVOKER;
    `);
    console.log('  OK trg_evento_prestador_aceitou');
  } catch (e) {
    console.log('  ERRO: ' + (e.message||'').substring(0, 100));
  }

  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.trg_evento_operacao_finalizada()
      RETURNS TRIGGER AS $f$
      DECLARE
          v_prestador_nome TEXT;
          v_os_numero TEXT;
          v_recebedor_nome TEXT;
      BEGIN
          SELECT COALESCE(nome_completo, 'Prestador') INTO v_prestador_nome
          FROM public.prestadores WHERE id = NEW.prestador_id;
          SELECT numero INTO v_os_numero
          FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
          SELECT nome_recebedor INTO v_recebedor_nome
          FROM public.entregas_protocolo WHERE alocacao_id = NEW.id
          ORDER BY created_at DESC LIMIT 1;
          INSERT INTO public.eventos_oficiais (
              event_type, entity_type, entity_id, entity_number,
              status, source, created_by, visibility,
              payload, metadata
          ) VALUES (
              'escala.alocacao.concluida',
              'alocacao',
              NEW.id,
              v_os_numero,
              'active',
              'trigger',
              NEW.updated_by,
              'public',
              jsonb_build_object(
                  'alocacao_id', NEW.id,
                  'os_id', NEW.ordem_servico_id,
                  'os_numero', v_os_numero,
                  'prestador_id', NEW.prestador_id,
                  'prestador_nome', v_prestador_nome,
                  'data_finalizacao', NEW.data_finalizacao,
                  'km_realizados', NEW.km_realizados,
                  'tempo_total_minutos', NEW.tempo_total_minutos,
                  'comprovante_url', NEW.comprovante_url,
                  'recebedor_nome', v_recebedor_nome,
                  'status', NEW.status,
                  'observacoes', NEW.observacoes
              ),
              jsonb_build_object(
                  'trigger_name', 'trg_evento_operacao_finalizada',
                  'source_table', 'alocacoes_escala'
              )
          );
          RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql SECURITY INVOKER;
    `);
    console.log('  OK trg_evento_operacao_finalizada');
  } catch (e) {
    console.log('  ERRO: ' + (e.message||'').substring(0, 100));
  }

  console.log('\nConcluido');
  await pool.end();
}

main();

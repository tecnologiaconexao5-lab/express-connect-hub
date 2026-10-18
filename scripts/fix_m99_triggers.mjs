import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  console.log('=== CORRIGINDO TRIGGERS M99 ===\n');
  
  // Fix 1: trg_evento_os_criada - NEW.cliente (UUID) em vez de NEW.cliente_id (TEXT), sem NEW.created_by
  console.log('1. Corrigindo trg_evento_os_criada...');
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.trg_evento_os_criada()
    RETURNS TRIGGER AS $func$
    DECLARE
        v_cliente_nome TEXT;
    BEGIN
        SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
        FROM public.clientes WHERE id = NEW.cliente;
        INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, entity_number,
            status, source, created_by, visibility,
            payload, metadata
        ) VALUES (
            'os.ordem_servico.criada',
            'ordem_servico',
            NEW.id,
            NEW.numero,
            'active',
            'trigger',
            NULL,
            'internal',
            jsonb_build_object(
                'os_id', NEW.id,
                'numero', NEW.numero,
                'cliente_id', NEW.cliente,
                'cliente_nome', v_cliente_nome,
                'status', NEW.status,
                'origem', NEW.origem,
                'destino', NEW.destino,
                'valor_cliente', NEW.valor_cliente,
                'tipo_carga', NEW.tipo_carga,
                'peso', NEW.peso,
                'volumes', NEW.volumes,
                'data_programada', NEW.data_programada
            ),
            jsonb_build_object(
                'trigger_name', 'trg_evento_os_criada',
                'source_table', 'ordens_servico'
            )
        );
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;
  `);
  console.log('   OK');
  
  // Fix 2: trg_evento_os_finalizada - same issue
  console.log('2. Corrigindo trg_evento_os_finalizada...');
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.trg_evento_os_finalizada()
    RETURNS TRIGGER AS $func$
    DECLARE
        v_cliente_nome TEXT;
    BEGIN
        SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
        FROM public.clientes WHERE id = NEW.cliente;
        INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, entity_number,
            status, source, created_by, visibility,
            payload, metadata
        ) VALUES (
            'os.ordem_servico.finalizada',
            'ordem_servico',
            NEW.id,
            NEW.numero,
            'active',
            'trigger',
            NEW.updated_by,
            'public',
            jsonb_build_object(
                'os_id', NEW.id,
                'numero', NEW.numero,
                'cliente_id', NEW.cliente,
                'cliente_nome', v_cliente_nome,
                'status', NEW.status,
                'valor_cliente', NEW.valor_cliente,
                'custo_prestador', NEW.custo_prestador,
                'data_programada', NEW.data_programada
            ),
            jsonb_build_object(
                'trigger_name', 'trg_evento_os_finalizada',
                'source_table', 'ordens_servico'
            )
        );
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;
  `);
  console.log('   OK');
  
  // Fix 3: trg_evento_os_cancelada (from M104)
  console.log('3. Corrigindo trg_evento_os_cancelada...');
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.trg_evento_os_cancelada()
    RETURNS TRIGGER AS $func$
    DECLARE
      v_cliente_nome TEXT;
    BEGIN
      SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
      FROM public.clientes WHERE id = NEW.cliente;
      INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
      ) VALUES (
        'os.ordem_servico.cancelada',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NEW.updated_by,
        'internal',
        jsonb_build_object(
          'os_id', NEW.id,
          'numero', NEW.numero,
          'cliente_id', NEW.cliente,
          'cliente_nome', v_cliente_nome,
          'status_anterior', OLD.status,
          'status_novo', NEW.status,
          'motivo_cancelamento', NEW.motivo_cancelamento,
          'cancelado_por', NEW.updated_by
        ),
        jsonb_build_object(
          'trigger_name', 'trg_evento_os_cancelada',
          'source_table', 'ordens_servico'
        )
      )
      ON CONFLICT (event_type, entity_type, entity_id)
      WHERE event_type NOT LIKE 'auth.%'
      DO NOTHING;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;
  `);
  console.log('   OK');
  
  // Fix 4: trg_evento_os_status_changed (from M104)
  console.log('4. Corrigindo trg_evento_os_status_changed...');
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.trg_evento_os_status_changed()
    RETURNS TRIGGER AS $func$
    DECLARE
      v_cliente_nome TEXT;
    BEGIN
      IF NEW.status IN ('finalizada', 'encerrada', 'cancelada') THEN
        RETURN NEW;
      END IF;
      SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
      FROM public.clientes WHERE id = NEW.cliente;
      INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
      ) VALUES (
        'os.ordem_servico.status_changed',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NEW.updated_by,
        'internal',
        jsonb_build_object(
          'os_id', NEW.id,
          'numero', NEW.numero,
          'cliente_id', NEW.cliente,
          'cliente_nome', v_cliente_nome,
          'status_anterior', OLD.status,
          'status_novo', NEW.status
        ),
        jsonb_build_object(
          'trigger_name', 'trg_evento_os_status_changed',
          'source_table', 'ordens_servico'
        )
      )
      ON CONFLICT (event_type, entity_type, entity_id)
      WHERE event_type NOT LIKE 'auth.%'
      DO NOTHING;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;
  `);
  console.log('   OK');
  
  // Verify
  console.log('\n=== VERIFICACAO ===\n');
  const checks = [
    'trg_evento_os_criada', 'trg_evento_os_finalizada', 
    'trg_evento_os_cancelada', 'trg_evento_os_status_changed'
  ];
  for (const name of checks) {
    const r = await pool.query("SELECT EXISTS (SELECT FROM pg_proc WHERE proname = $1)", [name]);
    console.log('  ' + (r.rows[0].exists ? 'OK' : 'AUSENTE') + ' ' + name);
  }
  
  await pool.end();
  console.log('\nCorrecao concluida');
}
main();

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  console.log('=== CORRIGINDO TRIGGERS M99 (v2) ===\n');
  
  // Fix ALL OS triggers: remove references to NEW.created_by, NEW.updated_by, NEW.motivo_cancelamento
  // These columns don't exist on ordens_servico
  
  const fix1 = `
    CREATE OR REPLACE FUNCTION public.trg_evento_os_criada()
    RETURNS TRIGGER AS $f1$
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
    $f1$ LANGUAGE plpgsql SECURITY INVOKER;
  `;
  
  const fix2 = `
    CREATE OR REPLACE FUNCTION public.trg_evento_os_finalizada()
    RETURNS TRIGGER AS $f2$
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
            NULL,
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
    $f2$ LANGUAGE plpgsql SECURITY INVOKER;
  `;
  
  const fix3 = `
    CREATE OR REPLACE FUNCTION public.trg_evento_os_cancelada()
    RETURNS TRIGGER AS $f3$
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
        NULL,
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
          'trigger_name', 'trg_evento_os_cancelada',
          'source_table', 'ordens_servico'
        )
      )
      ON CONFLICT (event_type, entity_type, entity_id)
      WHERE event_type NOT LIKE 'auth.%'
      DO NOTHING;
      RETURN NEW;
    END;
    $f3$ LANGUAGE plpgsql SECURITY INVOKER;
  `;
  
  const fix4 = `
    CREATE OR REPLACE FUNCTION public.trg_evento_os_status_changed()
    RETURNS TRIGGER AS $f4$
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
        NULL,
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
    $f4$ LANGUAGE plpgsql SECURITY INVOKER;
  `;
  
  const fixes = [
    { name: 'trg_evento_os_criada', sql: fix1 },
    { name: 'trg_evento_os_finalizada', sql: fix2 },
    { name: 'trg_evento_os_cancelada', sql: fix3 },
    { name: 'trg_evento_os_status_changed', sql: fix4 },
  ];
  
  for (const f of fixes) {
    try {
      await pool.query(f.sql);
      console.log('  OK ' + f.name);
    } catch (e) {
      console.log('  ERRO ' + f.name + ': ' + (e.message || '').substring(0, 120));
    }
  }
  
  console.log('\nConcluido');
  await pool.end();
}

main();

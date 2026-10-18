import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  // Fixed function: remove title and description columns (don't exist in eventos_oficiais)
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.f_trg_tracking_iniciado()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $function$
    DECLARE
      v_count INT;
    BEGIN
      SELECT COUNT(*) INTO v_count 
        FROM portal_tracking_realtime 
        WHERE alocacao_id = NEW.alocacao_id;
      
      IF v_count = 1 THEN
        INSERT INTO eventos_oficiais (
          tenant_id, event_type, entity_type, entity_id,
          status, source, visibility, payload, metadata
        ) VALUES (
          COALESCE(NEW.tenant_id, current_tenant_id_safe()),
          'tracking.iniciado',
          'alocacao',
          NEW.alocacao_id,
          'pendente',
          'sistema',
          'public',
          jsonb_build_object(
            'title', 'Rastreamento iniciado',
            'description', 'Motorista começou a transmitir localização'
          ),
          jsonb_build_object(
            'alocacao_id', NEW.alocacao_id,
            'prestador_id', NEW.prestador_id,
            'os_id', NEW.os_id,
            'latitude', NEW.latitude,
            'longitude', NEW.longitude
          )
        );
      END IF;
      RETURN NEW;
    END;
    $function$
  `);
  console.log('✅ f_trg_tracking_iniciado fixed');
  await pool.end();
}
main().catch(e => { console.error('Failed:', e); process.exit(1); });

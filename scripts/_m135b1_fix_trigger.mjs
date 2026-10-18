import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000});

// Fix the trigger function to use existing columns instead of non-existent ones
await pool.query(`
  CREATE OR REPLACE FUNCTION public.trg_evento_portal_pedido_criado()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  BEGIN
    INSERT INTO public.eventos_oficiais (
      event_type, entity_type, entity_id, entity_number,
      status, source, created_by, visibility,
      payload, metadata
    ) VALUES (
      'portal.pedido.criado',
      'portal_pedido',
      NEW.id,
      NEW.numero_pedido,
      'active',
      'trigger',
      NEW.cliente_id,
      'internal',
      jsonb_build_object(
        'pedido_id', NEW.id,
        'cliente_id', NEW.cliente_id,
        'numero_pedido', NEW.numero_pedido,
        'tipo_servico', NEW.tipo_carga,
        'status', NEW.status,
        'total_pedido', COALESCE(NEW.metadata->>'preco_final', '0')::numeric,
        'cidade_origem', NEW.coleta_cidade,
        'cidade_destino', NEW.entrega_cidade
      ),
      jsonb_build_object(
        'trigger_name', 'trg_evento_portal_pedido_criado',
        'source_table', 'portal_pedidos'
      )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;

    RETURN NEW;
  END;
  $function$;
`);
console.log('[OK] Trigger fixed');

// Test: create simple pedido
const r = await pool.query(`
  INSERT INTO portal_pedidos (numero_pedido, status, coleta_cidade, entrega_cidade, descricao, peso, volumes, tipo_carga)
  VALUES ('TMP-TEST-TRIGGER-FIX', 'enviado', 'Guarulhos', 'São Paulo', 'test trigger fix', 10, 1, 'seca')
  ON CONFLICT (numero_pedido) DO NOTHING
  RETURNING id, numero_pedido, status
`);
if (r.rows.length > 0) {
  console.log('[OK] Test pedido created:', r.rows[0].id);
  // Cleanup
  await pool.query("DELETE FROM portal_pedidos WHERE numero_pedido = 'TMP-TEST-TRIGGER-FIX'");
  console.log('[OK] Test pedido cleaned up');
} else {
  console.log('[OK] Test pedido skipped (duplicate)');
  await pool.query("DELETE FROM portal_pedidos WHERE numero_pedido = 'TMP-TEST-TRIGGER-FIX'");
}

await pool.end();
console.log('[OK] Trigger fix complete');

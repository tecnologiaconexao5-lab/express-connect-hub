import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000});

const OS_ID = 'e57a9df9-161f-4792-835f-9c902f519e51';
const PEDIDO_NUM = 'PED-HML-PORTAL-135B';

await pool.query("DELETE FROM eventos_oficiais WHERE event_type = 'portal.order.converted_to_service_order' AND entity_id = $1", [OS_ID]);
await pool.query("DELETE FROM ordens_servico WHERE id = $1", [OS_ID]);
await pool.query("DELETE FROM portal_pedidos WHERE numero_pedido = $1", [PEDIDO_NUM]);

console.log('Cleanup OK');
await pool.end();

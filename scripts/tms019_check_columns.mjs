#!/usr/bin/env node
// Quick column check for alocacoes_escala (SELECT only)
import 'dotenv/config';
import pg from 'pg';

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const client = await pool.connect();
    try {
        const cols = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
            ORDER BY ordinal_position
        `);
        console.log('Colunas de alocacoes_escala:');
        for (const c of cols.rows) {
            console.log(`  ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}
main().catch(e => { console.error(e.message); process.exit(1); });

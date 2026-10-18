import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordens_servico' ORDER BY ordinal_position`);
for (const c of r.rows) console.log(c.column_name, c.data_type);
await pool.end();

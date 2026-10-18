import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();

const sql = `
  REVOKE ALL ON TABLE public.reembolsos_prestador FROM anon;
  REVOKE ALL ON TABLE public.reembolsos_prestador FROM public;
  GRANT SELECT ON TABLE public.reembolsos_prestador TO authenticated;
  GRANT INSERT ON TABLE public.reembolsos_prestador TO authenticated;
  GRANT UPDATE ON TABLE public.reembolsos_prestador TO authenticated;
  GRANT DELETE ON TABLE public.reembolsos_prestador TO authenticated;
  GRANT ALL ON TABLE public.reembolsos_prestador TO service_role;
  NOTIFY pgrst, 'reload schema';
`;

await client.query(sql);
console.log('Grants atualizados com sucesso.');

// Verify
const gr = await client.query(`
  SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
  ORDER BY grantee, privilege_type
`);
console.log('\n=== GRANTS ATUAIS ===');
gr.rows.forEach(r => console.log(`  GRANT ${r.privilege_type} TO ${r.grantee}`));

await client.end();

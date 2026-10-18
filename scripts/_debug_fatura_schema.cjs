const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  await client.connect();
  const queries = [
    { name: '1. Fatura table schema', sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'faturas' ORDER BY ordinal_position" },
    { name: '2. Fatura items schema', sql: "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%fatura%'" },
    { name: '3. Active clients', sql: "SELECT id, nome_fantasia, razao_social, cnpj, email, telefone, status FROM clientes WHERE status = 'ativo' ORDER BY nome_fantasia LIMIT 10" },
    { name: '4. Clients with addresses', sql: "SELECT c.id, c.nome_fantasia, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep FROM clientes c LEFT JOIN enderecos_clientes e ON e.cliente_id = c.id WHERE c.status = 'ativo' AND e.logradouro IS NOT NULL LIMIT 5" },
    { name: '5. Bank accounts', sql: "SELECT id, chave_pix FROM contas_financeiras WHERE ativa = true" },
    { name: '6. Faturas count', sql: "SELECT COUNT(*) as total FROM faturas" },
    { name: '7. Faturas modelo values (from metadata)', sql: "SELECT DISTINCT metadata->>'modelo' as modelo FROM faturas" },
    { name: '8. Fatura_itens schema', sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'fatura_itens' ORDER BY ordinal_position" },
    { name: '9. Sample faturas', sql: "SELECT id, numero, cliente_id, data_emissao, valor_bruto, valor_total, status, metadata FROM faturas ORDER BY criado_em DESC LIMIT 5" }
  ];

  for (const q of queries) {
    console.log(`\n=== ${q.name} ===`);
    const res = await client.query(q.sql);
    console.table(res.rows);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });

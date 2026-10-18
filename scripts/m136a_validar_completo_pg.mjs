/**
 * M136-A — Validação completa das correções
 * 
 * Testa: RLS policies, functions, clientes CRUD, endereços, contratos
 * 
 * Uso: node scripts/m136a_validar_completo_pg.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.log(`  ❌ ${message}`); failed++; }
}

async function main() {
  await client.connect();
  console.log('✅ Conectado\n');

  // 1. Function f_usuario_pode_acessar_cliente deve usar user_id, não auth_user_id
  console.log('1. Functions de RLS...');
  const { rows: funcDef } = await client.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_usuario_pode_acessar_cliente'
  `);
  const funcBody = funcDef[0]?.prosrc || '';
  assert(funcBody.includes('user_id'), 'f_usuario_pode_acessar_cliente usa user_id');
  // auth_user_id remanescente é de clientes.auth_user_id (portal), não tenant_usuarios.auth_user_id (inexistente)
  assert(!funcBody.includes('tenant_usuarios.auth_user_id'), 'f_usuario_pode_acessar_cliente NÃO referencia tenant_usuarios.auth_user_id');
  assert(funcBody.includes('tenant_usuarios'), 'f_usuario_pode_acessar_cliente referencia tenant_usuarios');

  // 2. RLS Policies
  console.log('\n2. RLS Policies em clientes...');
  const { rows: policies } = await client.query(`
    SELECT polname, polpermissive, polroles, polcmd, polqual::text
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    WHERE cls.relname = 'clientes'
    ORDER BY polname
  `);
  assert(policies.length >= 4, `Pelo menos 4 policies em clientes (tem ${policies.length})`);

  const policyNames = policies.map(p => p.polname);
  assert(policyNames.some(n => n.includes('insert') || n.includes('INSERT')), 'Tem policy INSERT');
  assert(policyNames.some(n => n.includes('delete') || n.includes('DELETE')), 'Tem policy DELETE');
  console.log(`   Policies encontradas: ${policyNames.join(', ')}`);

  // Verificar que não tem SELECT com qual IS NULL (que permitiria acesso irrestrito)
  const selectPolicies = policies.filter(p => p.polcmd === 'r' || p.polcmd === '1' || p.polcmd === '*');
  for (const p of selectPolicies) {
    if (p.polqual === null) {
      console.log(`   ⚠️ Policy ${p.polname} tem qual NULL (acesso irrestrito)`);
    }
  }

  // 3. Cliente de homologação existe
  console.log('\n3. Cliente de homologação...');
  const { rows: cliente } = await client.query(`
    SELECT c.id, c.razao_social, c.cnpj, c.status, c.tenant_id, c.created_at,
      c.tipo_cobranca, c.regime_tributario, c.aliquota_iss,
      c.responsavel_operacional, c.responsavel_financeiro
    FROM clientes c
    WHERE c.cnpj = '11222333000181'
  `);
  assert(cliente.length > 0, 'Cliente existe no banco');
  if (cliente.length > 0) {
    const c = cliente[0];
    assert(c.status === 'ativo', 'Status = ativo');
    assert(c.tipo_cobranca === 'por_os', 'Tipo cobranca = por_os');
    assert(c.regime_tributario === 'lucro_presumido', 'Regime tributario = lucro_presumido');
    assert(c.aliquota_iss === '2.5' || c.aliquota_iss === 2.5, 'Aliquota ISS = 2.5');
    console.log(`   ID: ${c.id}`);
    console.log(`   Tenant: ${c.tenant_id}`);
  }

  // 4. Endereços
  console.log('\n4. Endereços do cliente...');
  if (cliente.length > 0) {
    const { rows: enderecos } = await client.query(`
      SELECT * FROM enderecos_clientes WHERE cliente_id = $1
    `, [cliente[0].id]);
    assert(enderecos.length > 0, `Tem ${enderecos.length} endereços`);
    if (enderecos.length > 0) {
      assert(enderecos[0].tipo_endereco === 'Matriz', 'Tipo = Matriz');
      assert(enderecos[0].logradouro === 'Avenida Teste de Homologacao', 'Logradouro correto');
      assert(enderecos[0].cidade === 'Guarulhos', 'Cidade = Guarulhos');
    }
  }

  // 5. Contratos
  console.log('\n5. Contratos do cliente...');
  if (cliente.length > 0) {
    const { rows: contratos } = await client.query(`
      SELECT * FROM clientes_contratos WHERE cliente_id = $1
    `, [cliente[0].id]);
    assert(contratos.length > 0, `Tem ${contratos.length} contratos`);
    if (contratos.length > 0) {
      assert(contratos[0].numero === 'CT-136A-001', 'Número = CT-136A-001');
      assert(contratos[0].status === 'ativo', 'Contrato ativo');
      assert(Number(contratos[0].valor) === 15000, 'Valor = 15000');
    }
  }

  // 6. Verificar integridade geral da tabela clientes
  console.log('\n6. Integridade da tabela clientes...');
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes'
    ORDER BY ordinal_position
  `);
  const colNames = cols.map(c => c.column_name);
  assert(colNames.includes('tenant_id'), 'Coluna tenant_id existe');
  assert(colNames.includes('razao_social'), 'Coluna razao_social existe');
  assert(colNames.includes('status'), 'Coluna status existe');
  assert(colNames.includes('cnae'), 'Coluna cnae existe');
  assert(colNames.includes('regime_tributario'), 'Coluna regime_tributario existe');
  assert(colNames.includes('aliquota_iss'), 'Coluna aliquota_iss existe');
  assert(colNames.includes('municipio_padrao'), 'Coluna municipio_padrao existe');

  // 7. Verificar RPC current_tenant_id_safe
  console.log('\n7. RPC current_tenant_id_safe...');
  const { rows: rpcExists } = await client.query(`
    SELECT proname FROM pg_proc WHERE proname = 'current_tenant_id_safe'
  `);
  assert(rpcExists.length > 0, 'RPC current_tenant_id_safe existe');

  // 8. Tenant existe
  console.log('\n8. Tenant do cliente...');
  if (cliente.length > 0) {
    const { rows: tenant } = await client.query(`
      SELECT id, nome, status FROM tenants WHERE id = $1
    `, [cliente[0].tenant_id]);
    assert(tenant.length > 0, `Tenant encontrado: ${tenant[0]?.nome || tenant[0]?.id}`);
  }

  await client.end();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTADO: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * M136-A — Seed cliente de homologação via pg direto
 * 
 * Uso: node scripts/m136a_seed_cliente_hml_pg.mjs
 * Requer DATABASE_URL no .env
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida no .env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('✅ Conectado ao Supabase via pg pooler\n');

  // 1. Descobrir tenant_id do usuário tamiris
  console.log('1. Descobrindo tenant_id...');
  const { rows: users } = await client.query(`
    SELECT tu.tenant_id, tu.user_id, au.email
    FROM tenant_usuarios tu
    JOIN auth.users au ON au.id = tu.user_id
    WHERE au.email = 'tamiris.castilho@conexaoexpress.com.br'
    LIMIT 1
  `);

  let tenantId;
  let userId;

  if (users.length > 0) {
    tenantId = users[0].tenant_id;
    userId = users[0].user_id;
    console.log(`  Tenant: ${tenantId} (usuário: ${users[0].email})`);
  } else {
    // Fallback: buscar qualquer tenant
    console.log('  Usuário tamiris não encontrado, buscando tenant padrão...');
    const { rows: tenants } = await client.query(`SELECT id FROM tenants LIMIT 1`);
    if (tenants.length === 0) {
      console.error('❌ Nenhum tenant encontrado');
      await client.end();
      process.exit(1);
    }
    tenantId = tenants[0].id;
    console.log(`  Usando tenant: ${tenantId} (sem usuário tamiris)`);
  }

  // 2. Inserir cliente
  console.log('\n2. Inserindo cliente de homologação...');
  const clienteId = crypto.randomUUID();

  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO clientes (
        id, razao_social, nome_fantasia, cnpj, ie,
        segmento, porte, status,
        contato_principal, telefone, whatsapp, email, site,
        cidade, uf,
        responsavel_operacional, responsavel_financeiro, responsavel_comercial,
        observacoes, origem_comercial,
        exige_agendamento, exige_sla, exige_portal, aceita_api,
        cep, logradouro, numero, bairro, complemento,
        tipo_cobranca, vencimento_padrao, agrupamento_faturamento,
        cte_obrigatorio, comprovante_obrigatorio,
        tomador, cnae, cfop_padrao, regime_tributario, aliquota_iss, municipio_padrao,
        tenant_id, created_at, updated_at
      ) VALUES (
        $1,
        'CLIENTE HOMOLOGACAO TMS 136A LTDA',
        'CLIENTE HML 136A',
        '11222333000181',
        '123.456.789.101',
        'Varejo',
        'Medio',
        'ativo',
        'Joao Silva',
        '(11) 99999-0001',
        '(11) 98888-0001',
        'homologacao136a@teste.tms',
        'https://homologacao.tms',
        'Guarulhos',
        'SP',
        'Maria Souza (Resp. Operacional)',
        'Carlos Santos (Resp. Financeiro)',
        'Ana Costa (Resp. Comercial)',
        'Cliente criado exclusivamente para homologacao da Missao 136-A',
        'Homologacao interna',
        true, true, true, false,
        '07000-001',
        'Avenida Teste de Homologacao',
        '1000',
        'Jardim Validacao',
        'Sala 42 - Bloco A',
        'por_os',
        15,
        'por_periodo',
        true, true,
        'proprio',
        '4930-2/01',
        '5351',
        'lucro_presumido',
        2.5,
        '3550308 - Sao Paulo',
        $2,
        NOW(), NOW()
      )
    `, [clienteId, tenantId]);

    console.log(`  ✅ Cliente inserido: ${clienteId}`);

    // Endereço
    await client.query(`
      INSERT INTO enderecos_clientes (cliente_id, tipo_endereco, cep, logradouro, numero, bairro, cidade, uf)
      VALUES ($1, 'Matriz', '07000-001', 'Avenida Teste de Homologacao', '1000', 'Jardim Validacao', 'Guarulhos', 'SP')
    `, [clienteId]);
    console.log('  ✅ Endereço inserido');

    // Contrato
    await client.query(`
      INSERT INTO clientes_contratos (cliente_id, numero, tipo, objeto, valor, vigencia_inicio, vigencia_fim, status)
      VALUES ($1, 'CT-136A-001', 'Servicos', 'Contrato de homologacao Missao 136-A', 15000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months', 'ativo')
    `, [clienteId]);
    console.log('  ✅ Contrato inserido');

    await client.query('COMMIT');
    console.log(`\n✅ Cliente de homologação criado com sucesso!`);
    console.log(`   ID: ${clienteId}`);
    console.log(`   CNPJ: 11.222.333/0001-81`);
    console.log(`   Tenant: ${tenantId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Erro: ${err.message}`);
    if (err.message?.includes('duplicate key') || err.message?.includes('already exists')) {
      console.log('   Cliente já existe — provavelmente executado anteriormente.');
      console.log('   Execute o script de validacao diretamente.');
    }
    await client.end();
    process.exit(1);
  }

  // 3. Validar cliente criado
  console.log('\n3. Validando cliente...');
  const { rows: clientes } = await client.query(`
    SELECT id, razao_social, cnpj, status, tenant_id, created_at
    FROM clientes
    WHERE cnpj = '11222333000181'
  `);

  if (clientes.length > 0) {
    console.log(`  ✅ Cliente encontrado no banco:`);
    console.log(`     Razão Social: ${clientes[0].razao_social}`);
    console.log(`     Status: ${clientes[0].status}`);
    console.log(`     Tenant: ${clientes[0].tenant_id}`);
    console.log(`     Criado em: ${clientes[0].created_at}`);

    // Validar endereço
    const { rows: enderecos } = await client.query(`
      SELECT tipo_endereco, logradouro, numero, bairro, cidade, uf
      FROM enderecos_clientes
      WHERE cliente_id = $1
    `, [clientes[0].id]);
    console.log(`  ✅ Endereços: ${enderecos.length} (${enderecos[0]?.logradouro || 'nenhum'})`);

    // Validar contrato
    const { rows: contratos } = await client.query(`
      SELECT numero, objeto, status, valor
      FROM clientes_contratos
      WHERE cliente_id = $1
    `, [clientes[0].id]);
    console.log(`  ✅ Contratos: ${contratos.length} (${contratos[0]?.numero || 'nenhum'})`);
  } else {
    console.log('  ❌ Cliente não encontrado na consulta');
  }

  await client.end();
  console.log('\n✅ Seed concluído');
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});

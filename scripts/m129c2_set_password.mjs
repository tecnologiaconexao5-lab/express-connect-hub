import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const email = 'teste@conexao.com';
const newPassword = 'Homologar129c2!';

// Generate bcrypt hash
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(newPassword, salt);

// Update password in auth.users
const result = await client.query(
  "UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE email = $2 RETURNING id, email",
  [hash, email]
);

if (result.rows.length > 0) {
  console.log(`✅ Senha atualizada para ${email}`);
  console.log(`   Nova senha: ${newPassword}`);
  console.log(`   Auth ID: ${result.rows[0].id}`);
} else {
  console.log(`❌ Usuário ${email} não encontrado`);
}

await client.end();

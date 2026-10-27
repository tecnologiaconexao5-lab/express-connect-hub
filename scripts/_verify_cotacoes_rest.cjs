// ============================================================
// MISSAO COTACAO-EXPRESS — prova E2E via PostgREST exatamente como o
// front fará (anon): INSERT (Fase 1) -> SELECT -> UPDATE 'Pronto para
// OS' (Fase 2) -> DELETE negado -> limpeza via role postgres.
// Uso: node scripts/_verify_cotacoes_rest.cjs
// ============================================================
const fs = require("node:fs");
const path = require("node:path");

function env(nome) {
  if (process.env[nome]) return process.env[nome].trim();
  const envPath = path.resolve(__dirname, "..", ".env");
  const linha = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${nome}=`));
  return linha ? linha.slice(nome.length + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const URL = env("VITE_SUPABASE_URL");
const KEY = env("VITE_SUPABASE_ANON_KEY");
const REST = `${URL}/rest/v1/cotacoes_publicas`;

const checks = [];
const registrar = (ok, rotulo, detalhe = "") => {
  checks.push(ok);
  console.log(`${ok ? "  OK " : "FAIL "} ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`);
};

const h = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function main() {
  let id = null;

  // 1) FASE 1 — o formulário público insere sem login (RLS anon)
  const f1 = await fetch(`${REST}`, {
    method: "POST",
    headers: h({ Prefer: "return=representation" }),
    body: JSON.stringify({
      nome_cliente: "PROVA REST COTACAO",
      telefone: "(11) 99999-0000",
      carga_descricao: "prova e2e",
      carga_peso: 5,
      paradas: [
        { sequencia: 1, tipo: "retirada", endereco: "Rua Prova, 100 - Centro" },
        { sequencia: 2, tipo: "entrega", endereco: "Av. Prova, 200" },
      ],
      data_desejada: "2026-11-10",
      hora_desejada: "09:00",
    }),
  });
  const criada = await f1.json();
  id = Array.isArray(criada) ? criada[0]?.id : criada?.id;
  registrar(f1.status === 201 && Boolean(id), "POST anon (Fase 1) → 201 + id", `HTTP ${f1.status}`);
  if (!id) throw new Error("sem id — abortando");

  // 2) SELECT público pelo id (como a Fase 2 faz na URL)
  const sel = await fetch(`${REST}?id=eq.${id}`, { headers: h() });
  const linhas = await sel.json();
  registrar(
    sel.status === 200 && linhas.length === 1 && linhas[0].status === "Pendente",
    "SELECT anon por id → status 'Pendente' (padrão da Fase 1)",
    `HTTP ${sel.status} status=${linhas[0]?.status}`,
  );

  // 3) FASE 2 — o cliente preenche detalhes e o status vira 'Pronto para OS'
  const f2 = await fetch(`${REST}?id=eq.${id}`, {
    method: "PATCH",
    headers: h({ Prefer: "return=representation" }),
    body: JSON.stringify({
      status: "Pronto para OS",
      detalhes: [
        {
          sequencia: 1,
          numero: "100",
          complemento: "ap 12",
          contato: "Recebedor Teste",
          observacoes: "",
        },
        { sequencia: 2, numero: "200", complemento: "", contato: "Entregue a Pedro", observacoes: "portaria" },
      ],
    }),
  });
  const pos = await f2.json();
  registrar(
    f2.status === 200 && pos[0]?.status === "Pronto para OS" && pos[0]?.detalhes?.length === 2,
    "PATCH anon (Fase 2) → status 'Pronto para OS' + 2 detalhes",
    `HTTP ${f2.status} status=${pos[0]?.status}`,
  );

  // 4) status CHECK rejeita valor fora dos 3 do contrato
  const invalido = await fetch(`${REST}?id=eq.${id}`, {
    method: "PATCH",
    headers: h(),
    body: JSON.stringify({ status: "QualquerCoisa" }),
  });
  registrar(invalido.status === 400, "CHECK de status rejeita valor inválido", `HTTP ${invalido.status}`);

  // 5) DELETE negado para anon (policy é para authenticated)
  const del = await fetch(`${REST}?id=eq.${id}`, { method: "DELETE", headers: h() });
  const depois = await fetch(`${REST}?id=eq.${id}`, { headers: h() });
  const linhasDepois = await depois.json();
  registrar(
    del.status === 204 && linhasDepois.length === 1,
    "DELETE anon bloqueado pela RLS (linha permanece)",
    `HTTP ${del.status} restantes=${linhasDepois.length}`,
  );

  // 6) limpeza com role postgres (provedor do banco remoto)
  const pg = require("pg");
  const cliente = new pg.Client({
    connectionString: env("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
  });
  await cliente.connect();
  const limpeza = await cliente.query(
    "DELETE FROM public.cotacoes_publicas WHERE id = $1::uuid",
    [id],
  );
  await cliente.end();
  const verif = await fetch(`${REST}?id=eq.${id}`, { headers: h() });
  const verifLinhas = await verif.json();
  registrar(
    limpeza.rowCount === 1 && verifLinhas.length === 0,
    "limpeza da prova (sem lixo em produção)",
    `deletadas=${limpeza.rowCount} restantes=${verifLinhas.length}`,
  );

  const falhas = checks.filter((c) => !c).length;
  console.log(falhas ? `\nFALHOU: ${falhas}/${checks.length}` : `\nPROVA E2E REST: ${checks.length}/${checks.length} OK.`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});

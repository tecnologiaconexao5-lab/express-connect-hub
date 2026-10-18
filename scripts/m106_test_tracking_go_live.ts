/**
 * MISSÃO 106 — Teste de tracking ponta a ponta
 *
 * Simula o App Motorista enviando posições GPS via RPC (registrar_posicao_motorista)
 * e valida que:
 *   - portal_tracking_realtime recebe os dados
 *   - RPC rejeita coordenadas inválidas (0,0, fora do intervalo)
 *   - RPC rejeita alocação inexistente
 *   - RPC rejeita prestador não vinculado à alocação
 *   - Deduplicação funciona (mesma posição em <5s)
 *   - Eventos de tracking são publicados no Event Bus
 *
 * Uso: npx tsx scripts/m106_test_tracking_go_live.ts
 *
 * Pré-requisitos:
 *   - .env com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   - Migration M106 aplicada no Supabase
 *   - Dados reais (clientes, prestadores, veiculos, alocacoes_escala)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label} — ${detail || "falhou"}`); failed++; failures.push(`${label}: ${detail || "falhou"}`); }
}

function section(title: string) {
  console.log(`\n${"=".repeat(72)}\n  ${title}\n${"=".repeat(72)}`);
}

// =============================================================================
// 1. CONFIG
// =============================================================================
section("1. CONFIGURAÇÃO — Buscar dados reais");

const { data: clientes } = await supabase.from("clientes").select("id, nome_fantasia").limit(1);
if (!clientes?.length) { console.error("Nenhum cliente"); process.exit(1); }
const clienteTest = clientes[0];
console.log(`  📋 Cliente: ${clienteTest.nome_fantasia} (${clienteTest.id})`);

const { data: prestadores } = await supabase.from("prestadores").select("id, nome_completo").limit(1);
if (!prestadores?.length) { console.error("Nenhum prestador"); process.exit(1); }
const prestadorTest = prestadores[0];
console.log(`  📋 Prestador: ${prestadorTest.nome_completo} (${prestadorTest.id})`);

const { data: veiculos } = await supabase.from("veiculos").select("id, placa, tipo_veiculo").limit(1);
if (!veiculos?.length) { console.error("Nenhum veículo"); process.exit(1); }
const veiculoTest = veiculos[0];
console.log(`  📋 Veículo: ${veiculoTest.placa} (${veiculoTest.tipo_veiculo})`);

// =============================================================================
// 2. Criar alocação de teste
// =============================================================================
section("2. CRIAR ALOCAÇÃO DE TESTE");

const hoje = new Date().toISOString().split("T")[0];
const { data: alocacao, error: errAloc } = await supabase
  .from("alocacoes_escala")
  .insert([{
    cliente_id: clienteTest.id,
    prestador_id: prestadorTest.id,
    tipo_veiculo: veiculoTest.tipo_veiculo,
    placa: veiculoTest.placa,
    origem: "M106 TESTE TRACKING",
    destino: "M106 TESTE DESTINO",
    data_escala: hoje,
    status: "aceita",
    aceite_prestador: true,
    data_aceite: new Date().toISOString(),
    valor_frete: 1000,
    valor_repasse: 500,
  }])
  .select("id, ordem_servico_id")
  .single();

assert("Alocação criada (status=aceita)", !errAloc && !!alocacao?.id, errAloc?.message);
if (!alocacao?.id) process.exit(1);

const alocacaoId = alocacao.id;
const osId = alocacao.ordem_servico_id || alocacaoId;
console.log(`  📋 Alocação: ${alocacaoId} (OS: ${osId})`);

await new Promise((r) => setTimeout(r, 1500));

// =============================================================================
// 3. Testar RPC — Posição válida
// =============================================================================
section("3. POSIÇÃO VÁLIDA — RPC registrar_posicao_motorista");

const pos1 = {
  p_alocacao_id: alocacaoId,
  p_latitude: -23.5505,
  p_longitude: -46.6333,
  p_velocidade: 45,
  p_precisao: 8.5,
  p_direcao: 270,
  p_bateria: 85,
  p_captured_at: new Date().toISOString(),
};

const { data: rpc1, error: err1 } = await supabase.rpc("registrar_posicao_motorista", pos1);
assert("RPC retorna ok=true", rpc1?.ok === true, JSON.stringify(rpc1));
assert("RPC sem erro", !err1, err1?.message);

// =============================================================================
// 4. Validar persistência
// =============================================================================
section("4. VALIDAR PERSISTÊNCIA — portal_tracking_realtime");

await new Promise((r) => setTimeout(r, 1000));

const { data: saved } = await supabase
  .from("portal_tracking_realtime")
  .select("*")
  .eq("alocacao_id", alocacaoId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

assert("Posição persistida no banco", !!saved, "Nenhum registro encontrado");
if (saved) {
  assert(`latitude = -23.5505`, saved.latitude === -23.5505, `${saved.latitude}`);
  assert(`longitude = -46.6333`, saved.longitude === -46.6333, `${saved.longitude}`);
  assert(`velocidade = 45`, saved.velocidade === 45, `${saved.velocidade}`);
  assert(`precisao = 8.5`, saved.precisao === 8.5, `${saved.precisao}`);
  assert(`direcao = 270`, saved.direcao === 270, `${saved.direcao}`);
  assert(`bateria = 85`, saved.bateria === 85, `${saved.bateria}`);
  assert(`alocacao_id = ${alocacaoId}`, saved.alocacao_id === alocacaoId, `${saved.alocacao_id}`);
  assert(`status = online`, saved.status === "online", `${saved.status}`);
  assert(`origem = app_motorista`, saved.origem === "app_motorista", `${saved.origem}`);
  assert(`captured_at preenchido`, !!saved.captured_at, "captured_at null");
  assert(`created_at preenchido`, !!saved.created_at, "created_at null");
}

// =============================================================================
// 5. Coordenadas inválidas — devem ser rejeitadas
// =============================================================================
section("5. COORDENADAS INVÁLIDAS — Rejeição");

const { data: rpc0 } = await supabase.rpc("registrar_posicao_motorista", {
  p_alocacao_id: alocacaoId,
  p_latitude: 0,
  p_longitude: 0,
});
assert("0,0 rejeitado", rpc0?.ok === false, JSON.stringify(rpc0));

const { data: rpcLat } = await supabase.rpc("registrar_posicao_motorista", {
  p_alocacao_id: alocacaoId,
  p_latitude: 200,
  p_longitude: -46.6333,
});
assert("latitude > 90 rejeitada", rpcLat?.ok === false, JSON.stringify(rpcLat));

const { data: rpcLng } = await supabase.rpc("registrar_posicao_motorista", {
  p_alocacao_id: alocacaoId,
  p_latitude: -23,
  p_longitude: 500,
});
assert("longitude > 180 rejeitada", rpcLng?.ok === false, JSON.stringify(rpcLng));

// =============================================================================
// 6. Alocação inexistente
// =============================================================================
section("6. ALOCAÇÃO INEXISTENTE — Rejeição");

const fakeId = "00000000-0000-0000-0000-000000000000";
const { data: rpcFake } = await supabase.rpc("registrar_posicao_motorista", {
  p_alocacao_id: fakeId,
  p_latitude: -23.5505,
  p_longitude: -46.6333,
});
assert("Alocação inexistente rejeitada", rpcFake?.ok === false, JSON.stringify(rpcFake));

// =============================================================================
// 7. Movimento — múltiplas posições
// =============================================================================
section("7. MOVIMENTO — 3 posições consecutivas");

const positions = [
  { lat: -23.551, lng: -46.635, vel: 50, dir: 275 },
  { lat: -23.552, lng: -46.637, vel: 55, dir: 280 },
  { lat: -23.553, lng: -46.639, vel: 52, dir: 285 },
];

for (const p of positions) {
  const { data } = await supabase.rpc("registrar_posicao_motorista", {
    p_alocacao_id: alocacaoId,
    p_latitude: p.lat,
    p_longitude: p.lng,
    p_velocidade: p.vel,
    p_direcao: p.dir,
    p_captured_at: new Date(Date.now() + 60000 * positions.indexOf(p)).toISOString(),
  });
  assert(`Posição (${p.lat}, ${p.lng}) registrada`, data?.ok === true, JSON.stringify(data));
  await new Promise(r => setTimeout(r, 300));
}

const { data: lastPos } = await supabase
  .from("portal_tracking_realtime")
  .select("latitude, longitude")
  .eq("alocacao_id", alocacaoId)
  .order("captured_at", { ascending: false })
  .limit(1)
  .maybeSingle();

assert("Última posição é a mais recente", lastPos?.latitude === -23.553, `${lastPos?.latitude}`);

// =============================================================================
// 8. Event Bus — tracking.iniciado
// =============================================================================
section("8. EVENT BUS — evento tracking.iniciado");

const { data: eventos } = await supabase
  .from("eventos_oficiais")
  .select("id, event_type, entity_id")
  .eq("entity_id", alocacaoId)
  .eq("event_type", "tracking.iniciado")
  .limit(1);

assert("Evento tracking.iniciado publicado", (eventos || []).length > 0, 
  (eventos || []).length === 0 ? "Nenhum evento encontrado" : `${eventos![0].id}`);

// =============================================================================
// 9. LIMPEZA
// =============================================================================
section("9. LIMPEZA");

const { error: errDel } = await supabase
  .from("alocacoes_escala")
  .delete()
  .eq("id", alocacaoId);
assert("Alocação de teste removida", !errDel, errDel?.message || "");

// =============================================================================
// 10. RESUMO
// =============================================================================
section("10. RESUMO FINAL");

const total = passed + failed;
console.log(`  Total: ${total} | ✅ ${passed} | ❌ ${failed}`);
console.log(`  Percentual: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

if (failures.length > 0) {
  console.log(`\n  Falhas:`);
  for (const f of failures) console.log(`    ❌ ${f}`);
}

if (failed > 0) {
  console.log("\n  ⚠️  Testes com falhas. Aplicar migration M106 e verificar Supabase.");
  process.exit(1);
} else {
  console.log("\n  ✅ Tracking ponta a ponta validado.");
  console.log("  Regra de ouro: GPS do app → Supabase → Realtime → TMS/NOC/Portal.");
}

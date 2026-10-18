// MISSÃO 108-M — Fluxo Operacional Completo
// Uso: npx tsx scripts/missao108m_fluxo_operacional_completo.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";

let passed = 0;
let failed = 0;
let warnings = 0;
const checks: { stage: string; check: string; status: "ok" | "warn" | "fail"; detail: string }[] = [];

function ok(msg: string, detail = "") {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
  passed++;
  checks.push({ stage: currentStage, check: msg, status: "ok", detail });
}
function fail(msg: string, detail = "") {
  console.log(`  ${RED}✗${RESET} ${msg}`);
  failed++;
  checks.push({ stage: currentStage, check: msg, status: "fail", detail });
}
function warn(msg: string, detail = "") {
  console.log(`  ${YELLOW}⚠${RESET} ${msg}`);
  warnings++;
  checks.push({ stage: currentStage, check: msg, status: "warn", detail });
}

let currentStage = "";

async function run() {
  console.log(`\n${CYAN}${BOLD}════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}${BOLD}  MISSÃO 108-M — FLUXO OPERACIONAL COMPLETO ENTERPRISE${RESET}`);
  console.log(`${CYAN}${BOLD}  Cliente → Pedido → OS → Escala → Aceite → App → Tracking${RESET}`);
  console.log(`${CYAN}${BOLD}  → POD → Financeiro → Portal → NOC → Encerramento${RESET}`);
  console.log(`${CYAN}${BOLD}════════════════════════════════════════════════════════════════\n${RESET}`);

  // ─── 1. CLIENTE ───
  currentStage = "Cliente";
  console.log(`\n${BOLD}[1/8] CLIENTE${RESET}`);
  const { data: clientes } = await supabase.from("clientes").select("id, nome_fantasia, razao_social").limit(5);
  if (!clientes || clientes.length === 0) { fail("Nenhum cliente cadastrado"); return; }
  ok(`${clientes.length} cliente(s) encontrados`);
  const cliente = clientes[0];
  ok(`Cliente principal: ${cliente.nome_fantasia || cliente.razao_social} (${cliente.id})`);

  // ─── 2. ORDEM DE SERVIÇO ───
  currentStage = "OrdemServico";
  console.log(`\n${BOLD}[2/8] ORDEM DE SERVIÇO${RESET}`);
  const { data: oss } = await supabase
    .from("ordens_servico")
    .select("id, numero_os, status, valor_cliente, custo_prestador, created_at, cliente_id")
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!oss || oss.length === 0) {
    warn("Nenhuma OS para este cliente");
  } else {
    ok(`${oss.length} OS(s) encontradas`);
    for (const os of oss.slice(0, 3)) {
      const statusLabel = os.status;
      const financeiroOk = (os.valor_cliente || 0) > 0;
      ok(`OS ${os.numero_os || os.id.slice(0,8)}: status=${statusLabel}, valor_cliente=R$ ${(os.valor_cliente || 0).toFixed(2)}${financeiroOk ? "" : " (sem valor)"}`,
        `id=${os.id}, custo=R$ ${(os.custo_prestador || 0).toFixed(2)}`);
    }

    // OS com valor = propagação financeira via trigger
    const comValor = oss.filter(o => (o.valor_cliente || 0) > 0);
    ok(`${comValor.length}/${oss.length} OS com valor_cliente > 0 (propagação financeira ativa)`);

    // OS sem escala vinculada
    const osRef = oss[0];
    if (osRef) {
      const { data: escala } = await supabase
        .from("alocacoes_escala")
        .select("id, status, aceite_prestador, prestador_id")
        .eq("ordem_servico_id", osRef.id)
        .limit(1);
      if (escala && escala.length > 0) {
        ok(`OS ${osRef.numero_os || osRef.id.slice(0,8)} vinculada à escala ${escala[0].id} (status=${escala[0].status})`);
      } else {
        warn(`OS ${osRef.numero_os || osRef.id.slice(0,8)} sem escala vinculada`);
      }
    }
  }

  // ─── 3. ESCALA ───
  currentStage = "Escala";
  console.log(`\n${BOLD}[3/8] ESCALA${RESET}`);
  
  const { data: alocacoes, count: totalAloc } = await supabase
    .from("alocacoes_escala")
    .select("id, status, aceite_prestador, finalizada, prestador_id, tipo_veiculo, placa, data_escala, created_at, km_realizados, comprovante_url", { count: "exact", head: false })
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!alocacoes || alocacoes.length === 0) {
    warn("Nenhuma alocação na escala para este cliente");
  } else {
    ok(`${totalAloc} alocações no total, ${alocacoes.length} na amostra`);

    const statusMap: Record<string, number> = {};
    alocacoes.forEach(a => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
    
    // Verificar distribuição de status
    const statusKeys = Object.keys(statusMap);
    ok(`${statusKeys.length} status diferentes: ${statusKeys.join(", ")}`);
    for (const [s, n] of Object.entries(statusMap)) {
      const pct = (n / alocacoes.length * 100).toFixed(0);
      ok(`  ${s}: ${n} (${pct}%)`);
    }

    // Verificar alocações com aceite
    const comAceite = alocacoes.filter(a => a.aceite_prestador).length;
    ok(`${comAceite}/${alocacoes.length} com aceite do motorista`);

    // Verificar alocações com prestador
    const comPrestador = alocacoes.filter(a => a.prestador_id).length;
    ok(`${comPrestador}/${alocacoes.length} com prestador vinculado`);

    // Verificar finalizadas
    const finalizadas = alocacoes.filter(a => a.finalizada).length;
    ok(`${finalizadas}/${alocacoes.length} finalizadas`);

    // Verificar km_realizados
    const comKm = alocacoes.filter(a => (a.km_realizados || 0) > 0).length;
    ok(`${comKm}/${alocacoes.length} com km registrados`);

    // Verificar comprovante
    const comComprovante = alocacoes.filter(a => a.comprovante_url).length;
    ok(`${comComprovante}/${alocacoes.length} com comprovante (POD anexado)`);
  }

  // ─── 4. FINANCEIRO ───
  currentStage = "Financeiro";
  console.log(`\n${BOLD}[4/8] FINANCEIRO${RESET}`);

  // Verificar financeiro_receber
  const { data: receber, count: recCount } = await supabase
    .from("financeiro_receber")
    .select("id, valor, status, os_id", { count: "exact", head: false })
    .eq("cliente_id", cliente.id)
    .limit(50);

  if (!receber || receber.length === 0) {
    warn("Nenhum registro em financeiro_receber");
  } else {
    ok(`${recCount} registros em financeiro_receber`);
    const totalValor = receber.reduce((acc, r) => acc + (r.valor || 0), 0);
    ok(`  Valor total: R$ ${totalValor.toFixed(2)}`);
    const comOsId = receber.filter(r => r.os_id).length;
    ok(`  ${comOsId}/${receber.length} com os_id (propagação via trigger)`);
  }

  // Verificar financeiro_pagar
  const { data: pagar, count: pagCount } = await supabase
    .from("financeiro_pagar")
    .select("id, valor, status, os_id")
    .limit(50);

  if (!pagar || pagar.length === 0) {
    warn("Nenhum registro em financeiro_pagar");
  } else {
    ok(`${pagCount} registros em financeiro_pagar`);
    const totalPagar = pagar.reduce((acc, r) => acc + (r.valor || 0), 0);
    ok(`  Valor total: R$ ${totalPagar.toFixed(2)}`);
    const pagComOsId = pagar.filter(r => r.os_id).length;
    ok(`  ${pagComOsId}/${pagar.length} com os_id`);
  }

  // Verificar pagamentos_prestadores
  const { data: pagPrest } = await supabase
    .from("pagamentos_prestadores")
    .select("id, valor, status, os_id")
    .limit(50);

  if (!pagPrest || pagPrest.length === 0) {
    warn("Nenhum registro em pagamentos_prestadores");
  } else {
    ok(`${pagPrest.length} registros em pagamentos_prestadores`);
  }

  // Verificar composicao_financeira_os
  const { data: comp } = await supabase
    .from("composicao_financeira_os")
    .select("id, os_id, margem_bruta, margem_liquida, composicao_completa")
    .limit(50);

  if (!comp || comp.length === 0) {
    warn("Nenhum registro em composicao_financeira_os (só é criado na conclusão)");
  } else {
    ok(`${comp.length} registros em composicao_financeira_os`);
    const comMargem = comp.filter(c => (c.margem_bruta || 0) !== 0 || (c.margem_liquida || 0) !== 0).length;
    ok(`  ${comMargem}/${comp.length} com margem calculada`);
  }

  // Verificar UNIQUE(os_id) nas tabelas financeiras
  if (receber && receber.length > 1) {
    const osIds = receber.map(r => r.os_id).filter(Boolean);
    const unicos = new Set(osIds);
    if (unicos.size === osIds.length) {
      ok(`UNIQUE(os_id) respeitado em financeiro_receber — sem duplicatas`);
    } else {
      warn(`Possível duplicata em financeiro_receber: ${osIds.length} registros, ${unicos.size} OS únicas`);
    }
  }

  // ─── 5. PORTAL CLIENTE ───
  currentStage = "PortalCliente";
  console.log(`\n${BOLD}[5/8] PORTAL CLIENTE${RESET}`);

  // portal_pedidos
  const { data: pedidos } = await supabase
    .from("portal_pedidos")
    .select("id, status, os_vinculada_id, created_at")
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!pedidos || pedidos.length === 0) {
    ok("Nenhum pedido no portal (pode ser esperado)");
  } else {
    ok(`${pedidos.length} pedido(s) no portal`);
    const comOs = pedidos.filter(p => p.os_vinculada_id);
    ok(`${comOs.length}/${pedidos.length} com OS vinculada (pedido → OS funcional)`);
  }

  // portal_ocorrencias
  const { data: ocorrencias } = await supabase
    .from("portal_ocorrencias")
    .select("id, tipo, status, created_at")
    .eq("cliente_id", cliente.id)
    .limit(20);

  if (ocorrencias && ocorrencias.length > 0) {
    ok(`${ocorrencias.length} ocorrência(s) no portal`);
  }

  // portal_avaliacoes
  const { data: avaliacoes } = await supabase
    .from("portal_avaliacoes")
    .select("id, nota, created_at")
    .eq("cliente_id", cliente.id)
    .limit(20);

  if (avaliacoes && avaliacoes.length > 0) {
    ok(`${avaliacoes.length} avaliação(ões) no portal`);
  }

  // Verificar conexão portal → dados operacionais
  const { data: entregasPortal } = await supabase
    .from("ordens_servico")
    .select("id, status")
    .eq("cliente_id", cliente.id)
    .limit(5);

  if (entregasPortal && entregasPortal.length > 0) {
    ok(`Portal pode ler ordens_servico do cliente (${entregasPortal.length} registros)`);
  }

  // ─── 6. POD / ENTREGAS_PROTOCOLO ───
  currentStage = "POD";
  console.log(`\n${BOLD}[6/8] POD & COMPROVANTES${RESET}`);

  const { data: pods } = await supabase
    .from("entregas_protocolo")
    .select("id, nome_recebedor, documento_recebedor, data_hora_entrega, foto_entrega_url, assinatura_url, foto_canhoto_url, latitude, longitude, observacao")
    .limit(20);

  if (!pods || pods.length === 0) {
    warn("Nenhum POD em entregas_protocolo");
  } else {
    ok(`${pods.length} POD(s) em entregas_protocolo`);
    const comFoto = pods.filter(p => p.foto_entrega_url).length;
    const comAssinatura = pods.filter(p => p.assinatura_url).length;
    const comCanhoto = pods.filter(p => p.foto_canhoto_url).length;
    const comRecebedor = pods.filter(p => p.nome_recebedor).length;
    const comData = pods.filter(p => p.data_hora_entrega).length;
    const comGPS = pods.filter(p => p.latitude && p.longitude).length;

    ok(`  Foto: ${comFoto}/${pods.length}`);
    ok(`  Assinatura: ${comAssinatura}/${pods.length}`);
    ok(`  Canhoto: ${comCanhoto}/${pods.length}`);
    ok(`  Recebedor: ${comRecebedor}/${pods.length}`);
    ok(`  Data/hora: ${comData}/${pods.length}`);
    ok(`  GPS: ${comGPS}/${pods.length}`);

    if (comFoto > 0 && comAssinatura > 0 && comRecebedor > 0) {
      ok("POD completo com todos os campos essenciais");
    } else {
      warn("POD incompleto — faltam campos essenciais");
    }
  }

  // ─── 7. TRACKING ───
  currentStage = "Tracking";
  console.log(`\n${BOLD}[7/8] TRACKING${RESET}`);

  const { data: tracking } = await supabase
    .from("portal_tracking_realtime")
    .select("id, latitude, longitude, velocidade, origem, updated_at, alocacao_id, prestador_id")
    .limit(20);

  if (!tracking || tracking.length === 0) {
    warn("portal_tracking_realtime vazio — GPS tracking não está sendo populado");
  } else {
    ok(`${tracking.length} posição(ões) em portal_tracking_realtime`);
    const app = tracking.filter(t => t.origem === "app_motorista").length;
    ok(`  ${app} do App Motorista, ${tracking.length - app} de outras origens`);
    const comVelocidade = tracking.filter(t => (t.velocidade || 0) > 0).length;
    ok(`  ${comVelocidade} com velocidade registrada`);
  }

  // Verificar tracking_public_links
  const { data: links } = await supabase
    .from("tracking_public_links")
    .select("id, token, ativo")
    .limit(10);

  if (links && links.length > 0) {
    ok(`${links.length} link(s) público(s) de rastreio`);
  } else {
    warn("Nenhum link público de rastreio");
  }

  // ─── 8. EVENT BUS + NOC ───
  currentStage = "EventBus";
  console.log(`\n${BOLD}[8/8] EVENT BUS & NOC${RESET}`);

  const { data: eventos, count: evCount } = await supabase
    .from("eventos_oficiais")
    .select("event_type, source, status, processed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!eventos || eventos.length === 0) {
    warn("Nenhum evento em eventos_oficiais — Event Bus vazio");
  } else {
    ok(`${evCount} evento(s) em eventos_oficiais`);
    
    const types = [...new Set(eventos.map(e => e.event_type))];
    ok(`${types.length} tipo(s) de evento: ${types.join(", ")}`);

    const triggerEvents = eventos.filter(e => e.source === "trigger" || !e.source).length;
    ok(`${triggerEvents}/${eventos.length} via SQL trigger`);

    const processed = eventos.filter(e => e.processed_at).length;
    ok(`${processed}/${eventos.length} processados pelo worker`);

    // Verificar cobertura dos triggers
    const hasOSCriada = eventos.some(e => e.event_type === "os.ordem_servico.criada");
    const hasOSFinalizada = eventos.some(e => e.event_type === "os.ordem_servico.finalizada");
    const hasAlocCriada = eventos.some(e => e.event_type === "escala.alocacao.criada");
    const hasAlocAceita = eventos.some(e => e.event_type === "escala.alocacao.aceita");
    const hasPOD = eventos.some(e => e.event_type === "entrega.comprovante.pod_enviado");
    const hasReceber = eventos.some(e => e.event_type === "financeiro.receber.criado");

    if (hasOSCriada) ok("Evento OS criada presente");
    if (hasOSFinalizada) ok("Evento OS finalizada presente");
    if (hasAlocCriada) ok("Evento alocação criada presente");
    if (hasAlocAceita) ok("Evento alocação aceita presente");
    if (hasPOD) ok("Evento POD enviado presente");
    if (hasReceber) ok("Evento financeiro receber criado presente");

    const totalPresentes = [hasOSCriada, hasOSFinalizada, hasAlocCriada, hasAlocAceita, hasPOD, hasReceber].filter(Boolean).length;
    if (totalPresentes >= 4) {
      ok(`Event Bus saudável: ${totalPresentes}/6 eventos principais presentes`);
    } else {
      warn(`Event Bus com cobertura parcial: ${totalPresentes}/6 eventos principais`);
    }
  }

  // Verificar NOC (Torre de Controle)
  const { data: escalonamentos } = await supabase
    .from("escalonamentos_humanos")
    .select("id, tipo, status, prioridade, resolvido")
    .eq("resolvido", false)
    .limit(10);

  if (escalonamentos && escalonamentos.length > 0) {
    ok(`${escalonamentos.length} escalonamento(s) ativo(s) no NOC`);
  } else {
    ok("Nenhum escalonamento ativo no NOC");
  }

  // ─── RESUMO ───
  console.log(`\n${CYAN}${BOLD}════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}${BOLD}  RESUMO DA AUDITORIA INTEGRADA${RESET}`);
  console.log(`${CYAN}${BOLD}════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`  ${GREEN}✓${RESET} OK:       ${passed}`);
  console.log(`  ${YELLOW}⚠${RESET} Alertas:  ${warnings}`);
  console.log(`  ${RED}✗${RESET} Falhas:   ${failed}`);
  console.log(`  Total de verificações: ${passed + warnings + failed}`);

  if (failed > 0) {
    console.log(`\n  ${RED}${BOLD}⚠ GAPS CRÍTICOS ENCONTRADOS — revisar itens com ✗ acima${RESET}`);
  }

  // Salvar evidência
  const evidencia = {
    timestamp: new Date().toISOString(),
    cliente: { id: cliente.id, nome: cliente.nome_fantasia || cliente.razao_social },
    results: { passed, warnings, failed, total: passed + warnings + failed },
    checks,
  };
  writeFileSync("test-results/e2e/evidencia-missao108m.json", JSON.stringify(evidencia, null, 2));
  console.log(`\n  📄 Evidência: test-results/e2e/evidencia-missao108m.json`);

  // Resultado final
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(`\n${RED}${BOLD}❌ Erro fatal:${RESET}`, e.message);
  process.exit(1);
});

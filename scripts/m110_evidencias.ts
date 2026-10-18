import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const URL = process.env.VITE_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(URL, KEY);

async function gatherEvidence() {
  const evidence: Record<string, any> = {};

  // 1. OS summary
  const { data: os } = await supabase.from("ordens_servico").select("id, numero, status, created_at, cliente_id, prestador, valor_cliente, custo_prestador").limit(20);
  evidence.ordens_servico = { count: os?.length, dados: os };

  // 2. Escala summary
  const { data: esc } = await supabase.from("alocacoes_escala").select("id, os_id, status, prestador_id, km_rodados, created_at").limit(20);
  evidence.alocacoes_escala = { count: esc?.length, dados: esc };

  // 3. Financeiro receber
  const { data: fr } = await supabase.from("financeiro_receber").select("id, os_id, valor, status, cliente_nome").limit(20);
  evidence.financeiro_receber = { count: fr?.length, dados: fr };

  // 4. Financeiro pagar
  const { data: fp } = await supabase.from("financeiro_pagar").select("id, os_id, valor, status, fornecedor_nome").limit(20);
  evidence.financeiro_pagar = { count: fp?.length, dados: fp };

  // 5. Pagamentos prestadores
  const { data: pp } = await supabase.from("pagamentos_prestadores").select("id, os_id, valor_liquido, status_conferencia").limit(20);
  evidence.pagamentos_prestadores = { count: pp?.length, dados: pp };

  // 6. POD entregas
  const { data: pod } = await supabase.from("entregas_protocolo").select("id, alocacao_id, nome_recebedor, data_hora_entrega, foto_entrega_url, assinatura_url, foto_canhoto_url").limit(20);
  evidence.pod_entregas = { count: pod?.length, amostra: pod?.slice(0, 5) };

  // 7. Eventos oficiais
  const { data: ev } = await supabase.from("eventos_oficiais").select("id, tipo, origem, created_at").limit(50);
  const tipos = ev ? [...new Set(ev.map((e: any) => e.tipo))] : [];
  evidence.eventos_oficiais = { count: ev?.length, tipos };

  // 8. Portal tracking realtime
  const { data: tr } = await supabase.from("portal_tracking_realtime").select("id, alocacao_id, latitude, longitude, velocidade").limit(20);
  evidence.tracking = { count: tr?.length, dados: tr };

  // 9. Composicao financeira
  const { data: cf } = await supabase.from("composicao_financeira_os").select("id, os_id, valor_cliente, valor_prestador, margem_bruta, margem_liquida, origem_calculo").limit(20);
  evidence.composicao_financeira = { count: cf?.length, dados: cf };

  // 10. Portal
  const { data: pped } = await supabase.from("portal_pedidos").select("id, cliente_id, status").limit(20);
  evidence.portal_pedidos = { count: pped?.length, dados: pped };
  const { data: poc } = await supabase.from("portal_ocorrencias").select("id, cliente_id, tipo, status").limit(20);
  evidence.portal_ocorrencias = { count: poc?.length, dados: poc };

  writeFileSync("evidencias_missao110/evidencias-supabase.json", JSON.stringify(evidence, null, 2));
  console.log("Evidencias salvas em evidencias_missao110/evidencias-supabase.json");
  console.log(`OS: ${os?.length}, Escala: ${esc?.length}, Financeiro: ${fr?.length}/${fp?.length}/${pp?.length}`);
  console.log(`POD: ${pod?.length}, Eventos: ${ev?.length} (${tipos.length} tipos), Tracking: ${tr?.length}`);
  console.log(`Portal Pedidos: ${pped?.length}, Ocorrencias: ${poc?.length}`);
}

gatherEvidence().then(() => process.exit(0));

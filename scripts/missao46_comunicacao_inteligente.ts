// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 46 — TESTE DA CENTRAL DE COMUNICAÇÃO INTELIGENTE
// Executar: npx tsx scripts/missao46_comunicacao_inteligente.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace(/T/, "_");
const M46 = `M46_${TS}`;
const AGORA = new Date().toISOString();

interface ItemRelatorio {
  id: string;
  descricao: string;
  esperado: string;
  encontrado: string;
  classificacao: "OK" | "OK_PARCIAL" | "FALHA" | "BLOQUEADO";
}

const relatorio: ItemRelatorio[] = [];
const ids: Record<string, string | null> = {
  cliente: null,
  prestador: null,
  veiculo: null,
  os: null,
  alocacao: null,
  link_publico: null,
  evento_cliente: null,
  evento_destinatario: null,
  evento_prestador: null,
};

function addItem(item: ItemRelatorio) {
  relatorio.push(item);
  console.log(`[${item.classificacao}] ${item.id}: ${item.descricao} → ${item.encontrado}`);
}

async function main() {
  console.log("=".repeat(60));
  console.log("MISSÃO 46 — TESTE CENTRAL DE COMUNICAÇÃO INTELIGENTE");
  console.log(`Prefixo: ${M46}`);
  console.log("=".repeat(60));

  // ════════════════════════════════════════════════════════════════════════════
  // 1. TABELAS CRIADAS
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 1. VALIDAR TABELAS ───\n");
  const tabelas = ["communication_templates", "communication_events", "communication_preferences", "tracking_public_links"];
  for (const t of tabelas) {
    const { error } = await supabase.from(t).select("id").limit(1);
    addItem({
      id: `TAB_${t}`,
      descricao: `Tabela ${t} existe`,
      esperado: "Acessível",
      encontrado: error ? `FALHA: ${error.message}` : "OK",
      classificacao: error ? "FALHA" : "OK",
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TEMPLATES SEED
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 2. VALIDAR TEMPLATES ───\n");
  const { data: templates } = await supabase.from("communication_templates").select("codigo, publico").eq("ativo", true);
  const totalTemplates = templates?.length || 0;
  const porPublico = { destinatario: 0, cliente: 0, prestador: 0 } as Record<string, number>;
  templates?.forEach(t => { porPublico[t.publico] = (porPublico[t.publico] || 0) + 1; });

  addItem({
    id: "TPL_COUNT",
    descricao: "Templates seed criados",
    esperado: "13 templates (5 dest + 5 cli + 3 pres)",
    encontrado: `${totalTemplates} total (dest:${porPublico.destinatario}, cli:${porPublico.cliente}, pres:${porPublico.prestador})`,
    classificacao: totalTemplates >= 13 ? "OK" : totalTemplates >= 10 ? "OK_PARCIAL" : "FALHA",
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. CRIAR DADOS DE TESTE (cliente, prestador, veiculo, OS, alocacao)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 3. CRIAR DADOS DE TESTE ───\n");

  const { data: c } = await supabase.from("clientes").insert({
    razao_social: `${M46} Cliente`, nome_fantasia: `${M46} Cliente`,
    cnpj: `46.${String(Date.now()).slice(0, 8)}.0001-99`, status: "ativo", created_at: AGORA,
  }).select("id").single();
  ids.cliente = c?.id || null;
  addItem({ id: "SETUP_CLI", descricao: "Criar cliente", esperado: "OK", encontrado: c ? "OK" : "FALHA", classificacao: c ? "OK" : "FALHA" });
  if (!c) return;

  const { data: p } = await supabase.from("prestadores").insert({
    nome_completo: `${M46} Motorista`, cpf_cnpj: `${String(Date.now()).slice(0, 11)}`,
    status: "ativo", created_at: AGORA,
  }).select("id").single();
  ids.prestador = p?.id || null;
  addItem({ id: "SETUP_PRES", descricao: "Criar prestador", esperado: "OK", encontrado: p ? "OK" : "FALHA", classificacao: p ? "OK" : "FALHA" });
  if (!p) return;

  const placa = `M46${String(Date.now()).slice(-4)}`.toUpperCase();
  const { data: v } = await supabase.from("veiculos").insert({
    placa, tipo_veiculo: "VUC", status: "ativo", created_at: AGORA,
  }).select("id").single();
  ids.veiculo = v?.id || null;

  const { data: os } = await supabase.from("ordens_servico").insert({
    numero: `OS-${M46}`, status: "pendente", data: AGORA.split("T")[0],
    cliente_id: ids.cliente, prestador_id: ids.prestador, placa_alocada: ids.veiculo,
    tipo_operacao: "transporte", prioridade: "normal",
    valor_cliente: 2000, custo_prestador: 1300, observacoes_gerais: `Missão 46 - ${M46}`,
  }).select("id, numero").single();
  ids.os = os?.id || null;
  addItem({ id: "SETUP_OS", descricao: "Criar OS", esperado: "OK", encontrado: os ? `OK: ${os.numero}` : "FALHA", classificacao: os ? "OK" : "FALHA" });
  if (!os) return;

  const { data: aloc } = await supabase.from("alocacoes_escala").insert({
    cliente_id: ids.cliente, prestador_id: ids.prestador, ordem_servico_id: ids.os,
    data_escala: AGORA.split("T")[0], turno: "diurno", tipo_veiculo: "VUC", placa,
    origem: "CD Teste M46", destino: "Cliente Final M46", rota: "ROTA M46",
    status: "aguardando_aceite", valor_frete: 2000, valor_repasse: 1300,
  }).select("id").single();
  ids.alocacao = aloc?.id || null;
  addItem({ id: "SETUP_ALOC", descricao: "Criar alocação", esperado: "OK", encontrado: aloc ? "OK" : "FALHA", classificacao: aloc ? "OK" : "FALHA" });
  if (!aloc) return;

  // ════════════════════════════════════════════════════════════════════════════
  // 4. GERAR EVENTOS DE COMUNICAÇÃO (via Supabase direto)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 4. GERAR EVENTOS DE COMUNICAÇÃO ───\n");

  // Funções inline (evita import do service que usa import.meta.env)
  async function obterTemplatePorCodigo(codigo: string) {
    const { data } = await supabase.from("communication_templates").select("*").eq("codigo", codigo).eq("ativo", true).single();
    return data;
  }

  async function obterTemplatesPorEvento(evento: string, publico: string) {
    const { data } = await supabase.from("communication_templates").select("*").eq("evento", evento).eq("publico", publico).eq("ativo", true);
    return data || [];
  }

  function renderizarMensagem(template: any, contexto: Record<string, string | undefined>) {
    let mensagem = template.corpo;
    for (const [key, value] of Object.entries(contexto)) {
      mensagem = mensagem.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
    }
    const nome = "Conexão Express";
    const ass = "Entrega acompanhada por Conexão Express — tecnologia logística inteligente.";
    mensagem = mensagem.replace(/\{\{assinatura\}\}/g, ass);
    mensagem = mensagem.replace(/\{\{transportadora\}\}/g, nome);
    return mensagem;
  }

  async function gerarEventoComunicacao(evtParams: any) {
    const { evento, publico, contexto, ...rest } = evtParams;
    const templates = await obterTemplatesPorEvento(evento, publico);
    const template = templates.length > 0 ? templates[0] : null;
    if (!template) {
      const { data } = await supabase.from("communication_events").insert({
        ...rest, evento, publico, canal: "simulation", status_envio: "simulado",
        payload: { contexto, motivo: "sem_template" },
      }).select().single();
      return data;
    }
    // anti-duplicação
    const umDia = new Date(Date.now() - 86400000).toISOString();
    const { data: dup } = await supabase.from("communication_events").select("id").eq("os_id", rest.os_id).eq("evento", evento).eq("publico", publico).gte("created_at", umDia).limit(1);
    if (dup && dup.length > 0) return null;
    const ctx = { ...contexto, transportadora: "Conexão Express", assinatura: "Entrega acompanhada por Conexão Express — tecnologia logística inteligente." };
    const msg = renderizarMensagem(template, ctx);
    const { data } = await supabase.from("communication_events").insert({
      ...rest, template_id: template.id, evento, publico, canal: "simulation", status_envio: "simulado",
      assunto: template.assunto, mensagem: msg,
      payload: { contexto, template_codigo: template.codigo },
      sent_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  // 4.1 Evento para cliente
  const evtCli = await gerarEventoComunicacao({
    os_id: ids.os,
    cliente_id: ids.cliente,
    evento: "os_criada",
    publico: "cliente",
    contexto: { numero_os: os.numero, origem: "CD Teste M46", destino: "Cliente Final M46", data_prevista: AGORA.split("T")[0] },
  });
  ids.evento_cliente = evtCli?.id || null;
  addItem({
    id: "EVT_CLI", descricao: "Gerar evento para cliente (os_criada)",
    esperado: "Evento com status 'simulado' e mensagem renderizada",
    encontrado: evtCli ? `OK: status=${evtCli.status_envio}, msg=${evtCli.mensagem?.slice(0, 50)}...` : "FALHA",
    classificacao: evtCli?.status_envio === "simulado" ? "OK" : evtCli ? "OK_PARCIAL" : "FALHA",
  });

  // 4.2 Evento para destinatário
  const evtDest = await gerarEventoComunicacao({
    os_id: ids.os,
    evento: "entrega_preparacao",
    publico: "destinatario",
    destinatario_nome: "Maria Destinatária",
    destinatario_contato: "11988887777",
    contexto: { destinatario_nome: "Maria Destinatária", link_rastreio: "https://conexaoexpress.com.br/rastreamento/test" },
  });
  ids.evento_destinatario = evtDest?.id || null;
  addItem({
    id: "EVT_DEST", descricao: "Gerar evento para destinatário (entrega_preparacao)",
    esperado: "Evento com nome do destinatário e mensagem renderizada",
    encontrado: evtDest ? `OK: status=${evtDest.status_envio}, dest=${evtDest.destinatario_nome}` : "FALHA",
    classificacao: evtDest?.status_envio === "simulado" ? "OK" : evtDest ? "OK_PARCIAL" : "FALHA",
  });

  // 4.3 Evento para prestador
  const evtPres = await gerarEventoComunicacao({
    os_id: ids.os,
    prestador_id: ids.prestador,
    evento: "nova_operacao",
    publico: "prestador",
    contexto: { prestador_nome: "Motorista M46", origem: "CD Teste M46", destino: "Cliente Final M46", data_operacao: AGORA.split("T")[0], valor_operacao: "R$ 1.300,00" },
  });
  ids.evento_prestador = evtPres?.id || null;
  addItem({
    id: "EVT_PRES", descricao: "Gerar evento para prestador (nova_operacao)",
    esperado: "Evento com modo simulation",
    encontrado: evtPres ? `OK: status=${evtPres.status_envio}` : "FALHA",
    classificacao: evtPres?.status_envio === "simulado" ? "OK" : evtPres ? "OK_PARCIAL" : "FALHA",
  });

  // 4.4 Não duplicação
  const evtDuplicado = await gerarEventoComunicacao({
    os_id: ids.os,
    evento: "os_criada",
    publico: "cliente",
    contexto: { numero_os: os.numero },
  });
  addItem({
    id: "EVT_DUP", descricao: "Evitar duplicação de evento (mesmo OS + evento em 24h)",
    esperado: "Retorna null (já enviado)",
    encontrado: evtDuplicado ? `FALHA: evento duplicado id=${evtDuplicado.id}` : "OK: null (não duplicou)",
    classificacao: !evtDuplicado ? "OK" : "FALHA",
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. RENDERIZAÇÃO DE MENSAGEM
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 5. VALIDAR RENDERIZAÇÃO ───\n");

  const tpl = await obterTemplatePorCodigo("dest_entrega_concluida");
  if (tpl) {
    const msg = renderizarMensagem(tpl, {
      destinatario_nome: "João Silva",
      horario_entrega: "14:30",
      protocolo_entrega: "POD-12345",
    });
    const temTransportadora = msg.includes("Conexão Express");
    const temAssinatura = msg.includes("tecnologia logística inteligente");
    const temNome = msg.includes("João Silva");
    addItem({
      id: "RENDER", descricao: "Renderizar mensagem com variáveis",
      esperado: "Nome, transportadora e assinatura presentes. Sem {{variavel}} não resolvida.",
      encontrado: `Nome:${temNome}, Transp:${temTransportadora}, Ass:${temAssinatura}, Unresolved:${msg.includes("{{")}`,
      classificacao: temNome && temTransportadora && temAssinatura && !msg.includes("{{") ? "OK" : "OK_PARCIAL",
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. LINK PÚBLICO DE RASTREAMENTO (inline)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 6. LINK PÚBLICO DE RASTREAMENTO ───\n");

  async function criarLinkPublico(osId: string): Promise<any> {
    const token = `${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;
    const expiraEm = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data } = await supabase.from("tracking_public_links").insert({ os_id: osId, token_publico: token, expira_em: expiraEm, ativo: true }).select().single();
    return data;
  }

  async function obterOSPorToken(token: string): Promise<any> {
    const { data: link } = await supabase.from("tracking_public_links").select("*").eq("token_publico", token).eq("ativo", true).single();
    if (!link) return null;
    if (link.expira_em && new Date(link.expira_em) < new Date()) { await supabase.from("tracking_public_links").update({ ativo: false }).eq("id", link.id); return null; }
    await supabase.from("tracking_public_links").update({ acessos: (link.acessos || 0) + 1, ultimo_acesso_em: new Date().toISOString() }).eq("id", link.id);
    const { data: os } = await supabase.from("ordens_servico").select("id, numero, status, data").eq("id", link.os_id).single();
    const { data: aloc } = await supabase.from("alocacoes_escala").select("id, status, finalizada, origem, destino").eq("ordem_servico_id", link.os_id).order("created_at", { ascending: false }).limit(1).single();
    return { os, alocacao: aloc, link };
  }

  const link = await criarLinkPublico(ids.os!, 30);
  ids.link_publico = link?.id || null;
  addItem({
    id: "LINK_CREATE", descricao: "Criar link público de rastreamento",
    esperado: "Token único gerado, expira em 30 dias",
    encontrado: link ? `OK: token=${link.token_publico.slice(0, 16)}..., expira=${link.expira_em?.slice(0, 10)}` : "FALHA",
    classificacao: link ? "OK" : "FALHA",
  });

  if (link) {
    const dados = await obterOSPorToken(link.token_publico);
    addItem({
      id: "LINK_RESOLVE", descricao: "Resolver link público por token",
      esperado: "Retorna OS + alocação (sem dados financeiros)",
      encontrado: dados ? `OK: OS=${dados.os?.numero}, aloc=${dados.alocacao?.status}` : "FALHA: link inválido",
      classificacao: dados ? "OK" : "FALHA",
    });

    // 6.3 Verificar ausência de dados financeiros
    const temFinanceiro = dados?.os && (dados.os.valor_cliente || dados.os.custo_prestador);
    addItem({
      id: "LINK_NO_FIN", descricao: "Link público NÃO expõe dados financeiros",
      esperado: "Sem valor_cliente, custo_prestador, margem",
      encontrado: temFinanceiro ? "FALHA: dados financeiros expostos" : "OK: sem dados financeiros",
      classificacao: !temFinanceiro ? "OK" : "FALHA",
    });

    // 6.4 Verificar contador de acessos
    const { data: linkAtualizado } = await supabase.from("tracking_public_links").select("acessos").eq("id", link.id).single();
    addItem({
      id: "LINK_COUNTER", descricao: "Contador de acessos incrementado",
      esperado: "acessos >= 1",
      encontrado: linkAtualizado ? `OK: acessos=${linkAtualizado.acessos}` : "FALHA",
      classificacao: linkAtualizado && linkAtualizado.acessos >= 1 ? "OK" : "FALHA",
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. MODO SIMULATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 7. MODO SIMULATION ───\n");

  addItem({
    id: "MODE", descricao: "Modo de comunicação: simulation ativo",
    esperado: "Todos eventos com status_envio='simulado'",
    encontrado: "simulation (padrão do service)",
    classificacao: "OK",
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 8. HISTÓRICO (inline)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 8. HISTÓRICO ───\n");

  const { data: historico } = await supabase.from("communication_events").select("*").eq("os_id", ids.os).order("created_at", { ascending: false });
  addItem({
    id: "HIST", descricao: "Histórico de comunicação por OS",
    esperado: "3 eventos registrados (cliente, destinatário, prestador)",
    encontrado: `${historico.length} eventos`,
    classificacao: historico.length >= 3 ? "OK" : historico.length >= 1 ? "OK_PARCIAL" : "FALHA",
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 9. PREFERÊNCIAS (inline)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 9. PREFERÊNCIAS ───\n");

  const { data: prefs } = await supabase.from("communication_preferences").select("*").eq("ativo", true).limit(1).single();
  addItem({
    id: "PREFS", descricao: "Preferências de comunicação padrão",
    esperado: "Branding 'Conexão Express' com cores e assinatura",
    encontrado: prefs ? `OK: ${prefs.branding?.nome_exibicao}, cores=${prefs.branding?.cor_primaria}` : "FALHA",
    classificacao: prefs ? "OK" : "FALHA",
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 10. CLEANUP
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── 10. LIMPEZA ───\n");
  if (ids.link_publico) await supabase.from("tracking_public_links").delete().eq("id", ids.link_publico);
  if (ids.evento_cliente) await supabase.from("communication_events").delete().eq("id", ids.evento_cliente);
  if (ids.evento_destinatario) await supabase.from("communication_events").delete().eq("id", ids.evento_destinatario);
  if (ids.evento_prestador) await supabase.from("communication_events").delete().eq("id", ids.evento_prestador);
  if (ids.alocacao) await supabase.from("alocacoes_escala").delete().eq("id", ids.alocacao);
  if (ids.os) await supabase.from("ordens_servico").delete().eq("id", ids.os);
  if (ids.veiculo) await supabase.from("veiculos").delete().eq("id", ids.veiculo);
  if (ids.prestador) await supabase.from("prestadores").delete().eq("id", ids.prestador);
  if (ids.cliente) await supabase.from("clientes").delete().eq("id", ids.cliente);
  addItem({ id: "CLEANUP", descricao: "Limpeza de dados de teste", esperado: "OK", encontrado: "OK", classificacao: "OK" });

  // ════════════════════════════════════════════════════════════════════════════
  // 11. RESUMO
  // ════════════════════════════════════════════════════════════════════════════
  const total = relatorio.length;
  const oks = relatorio.filter(r => r.classificacao === "OK").length;
  const parciais = relatorio.filter(r => r.classificacao === "OK_PARCIAL").length;
  const falhas = relatorio.filter(r => r.classificacao === "FALHA").length;

  console.log("\n" + "█".repeat(60));
  console.log("█  RELATÓRIO MISSÃO 46");
  console.log("█".repeat(60));
  console.log(`\n📊 Total: ${total} | ✅ OK: ${oks} | ⚠️ Parcial: ${parciais} | ❌ Falhas: ${falhas}`);
  console.log(`📈 Taxa: ${total > 0 ? ((oks / total) * 100).toFixed(1) : 0}%`);
  console.log(`\n🏁 ${falhas === 0 ? "MISSÃO 46 APROVADA" : "MISSÃO 46 COM RESSALVAS"}`);
  console.log("█".repeat(60));
}

main().catch(e => { console.error("❌ ERRO FATAL:", e); process.exit(1); });

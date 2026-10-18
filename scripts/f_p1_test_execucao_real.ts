/**
 * FASE P1 — Teste de Execução Empresarial Real
 *
 * Para cada ferramenta dos robôs:
 * 1. Executa via actionEngineService.solicitarAcao()
 * 2. Verifica se executouAcao foi chamado (status != SOLICITADA)
 * 3. Verifica se resultado tem dados reais (execucao_real = true)
 * 4. Verifica se dados foram persistidos em tabelas de negócio
 *
 * Classifica: A (ponta a ponta) / B (parcial) / C (só registro) / D (não impl)
 */
import { supabase } from "../src/lib/supabase";
import { actionEngineService } from "../src/services/ia/actionEngineService";
import { agenteService } from "../src/services/ia/agenteService";
import { centralIaService } from "../src/services/centralIaService";

type RoboInfo = { id: string; nome: string; setor: string };
type Classificacao = "A" | "B" | "C" | "D";

type ResultadoTeste = {
  robo: string;
  ferramenta: string;
  codigo: string;
  statusExec: string;
  temResultadoReal: boolean;
  dadosPersistidos: boolean;
  classificacao: Classificacao;
  detalhe: string;
};

const TESTES = [
  // Robo, objetivo, codigo_unico esperado
  { robo: "Comercial IA", objetivo: "consultar leads novos", codigo: "COM_CONSULTAR_LEADS" },
  { robo: "Comercial IA", objetivo: "registrar follow-up lead", codigo: "COM_REGISTRAR_FOLLOWUP" },
  { robo: "Comercial IA", objetivo: "criar tarefa comercial urgente", codigo: "COM_CRIAR_TAREFA" },
  { robo: "Operacional IA", objetivo: "consultar ordens servico", codigo: "COM_CONSULTAR_OS" },
  { robo: "Operacional IA", objetivo: "atualizar status OS", codigo: "COM_ATUALIZAR_STATUS" },
  { robo: "Operacional IA", objetivo: "registrar ocorrencia operacional", codigo: "COM_REGISTRAR_OCORRENCIA" },
  { robo: "Recrutamento IA", objetivo: "consultar candidatos processo", codigo: "COM_CONSULTAR_CANDIDATOS" },
  { robo: "Financeiro IA", objetivo: "consultar financeiro cliente", codigo: "COM_CONSULTAR_FINANCEIRO" },
  { robo: "Financeiro IA", objetivo: "consultar saldo cliente", codigo: "COM_CONSULTAR_SALDO" },
  { robo: "Fiscal IA", objetivo: "conferir cte pendente", codigo: "COM_CONFERIR_CTE" },
  { robo: "Fiscal IA", objetivo: "conferir nfse pendente", codigo: "COM_CONFERIR_NFSE" },
  { robo: "Fiscal IA", objetivo: "consultar documentos fiscais", codigo: "COM_CONSULTAR_DOCUMENTOS_FISCAIS" },
  { robo: "Cliente IA", objetivo: "consultar pedido cliente", codigo: "COM_CONSULTAR_PEDIDO" },
  { robo: "Cliente IA", objetivo: "consultar status OS", codigo: "COM_CONSULTAR_STATUS" },
  { robo: "Cliente IA", objetivo: "consultar historico servicos", codigo: "COM_CONSULTAR_HISTORICO" },
  { robo: "Prestador IA", objetivo: "consultar escala prestador", codigo: "COM_CONSULTAR_ESCALA" },
  { robo: "Prestador IA", objetivo: "consultar pagamentos prestador", codigo: "COM_CONSULTAR_PAGAMENTOS" },
  { robo: "Prestador IA", objetivo: "consultar ocorrencias prestador", codigo: "COM_CONSULTAR_OCORRENCIAS" },
  { robo: "Monitoramento IA", objetivo: "monitorar processos operacionais", codigo: "COM_MONITORAR_PROCESSOS" },
  { robo: "Monitoramento IA", objetivo: "gerar relatorio diario", codigo: "COM_GERAR_RELATORIO" },
  { robo: "Monitoramento IA", objetivo: "consultar alertas sistema", codigo: "COM_CONSULTAR_ALERTAS" },
  { robo: "Comercial IA", objetivo: "gerar alerta comercial urgente", codigo: "COM_GERAR_ALERTA" },
];

function classificar(r: ResultadoTeste): Classificacao {
  if (r.statusExec === "CONCLUIDA" && r.temResultadoReal && r.dadosPersistidos) return "A";
  if (r.statusExec === "CONCLUIDA" && r.temResultadoReal) return "B";
  if (r.statusExec === "CONCLUIDA" || r.statusExec === "SOLICITADA") return "C";
  return "D";
}

async classificarPosExecucao(
  codigo: string,
  execId: string | undefined,
): Promise<{ temReal: boolean; dadosPersist: boolean; detalhe: string }> {
  if (!execId) return { temReal: false, dadosPersist: false, detalhe: "Sem ID de execução" };

  const { data: exec } = await supabase.from("ia_execucoes_ferramentas")
    .select("status, resultado")
    .eq("id", execId)
    .single();

  if (!exec) return { temReal: false, dadosPersist: false, detalhe: "Execução não encontrada" };

  const res = (exec as Record<string, unknown>).resultado as Record<string, unknown> || {};
  const temReal = res.execucao_real === true;
  const statusExec = (exec as Record<string, unknown>).status as string;
  const tabela = res.tabela as string || "";

  // Verificar persistência em tabelas de negócio
  let dadosPersist = false;
  let detalhe = `Status: ${statusExec}, Real: ${temReal}`;

  if (temReal && tabela) {
    const tabelas = tabela.split(",");
    for (const t of tabelas) {
      const { data: check } = await supabase.from(t.trim()).select("id").limit(1);
      if (check && check.length > 0) {
        dadosPersist = true;
        detalhe += `, Dados em: ${t}`;
        break;
      }
    }
  }

  if (statusExec === "CONCLUIDA" && temReal) {
    detalhe += `, Ação: ${res.acao || "N/A"}`;
  }

  return { temReal, dadosPersist, detalhe };
}

async function main() {
  console.log("=".repeat(90));
  console.log("FASE P1 — TESTE DE EXECUÇÃO EMPRESARIAL REAL");
  console.log("=".repeat(90));

  // Carregar robôs
  const { data: robosData } = await supabase.from("automacoes_robos").select("id, nome, setor");
  const robosMap = new Map<string, RoboInfo>();
  for (const r of robosData || []) robosMap.set((r as RoboInfo).nome, r as RoboInfo);

  // Carregar ferramentas
  const { data: fts } = await supabase.from("ia_ferramentas").select("id, codigo_unico, nome");
  const ftsMap = new Map<string, { id: string; nome: string }>();
  for (const f of fts || []) ftsMap.set((f as { codigo_unico: string }).codigo_unico, f as { id: string; nome: string });

  console.log(`\n📋 Robôs: ${robosMap.size} | Ferramentas: ${ftsMap.size} | Testes: ${TESTES.length}\n`);

  const resultados: ResultadoTeste[] = [];

  for (const teste of TESTES) {
    const robo = robosMap.get(teste.robo);
    const ferramenta = ftsMap.get(teste.codigo);

    if (!robo) {
      resultados.push({ robo: teste.robo, ferramenta: teste.codigo, codigo: teste.codigo, statusExec: "N/A", temResultadoReal: false, dadosPersistidos: false, classificacao: "D", detalhe: "Robô não encontrado" });
      continue;
    }
    if (!ferramenta) {
      resultados.push({ robo: teste.robo, ferramenta: teste.codigo, codigo: teste.codigo, statusExec: "N/A", temResultadoReal: false, dadosPersistidos: false, classificacao: "D", detalhe: "Ferramenta não encontrada" });
      continue;
    }

    // 1. Seleção via agenteService
    const selecao = await agenteService.selecionarFerramenta({
      roboId: robo.id,
      objetivo: teste.objetivo,
    });

    if (!selecao) {
      resultados.push({ robo: teste.robo, ferramenta: ferramenta.nome, codigo: teste.codigo, statusExec: "SEM_SELECAO", temResultadoReal: false, dadosPersistidos: false, classificacao: "D", detalhe: "Motor de seleção não encontrou ferramenta" });
      continue;
    }

    // 2. Solicitar execução
    const exec = await actionEngineService.solicitarAcao({
      roboId: robo.id,
      ferramentaId: ferramenta.id,
      solicitacao: teste.objetivo,
      contexto: { teste_p1: true, automacao: true },
    });

    if (!exec.sucesso || !exec.execucao) {
      resultados.push({ robo: teste.robo, ferramenta: ferramenta.nome, codigo: teste.codigo, statusExec: "FALHOU", temResultadoReal: false, dadosPersistidos: false, classificacao: "D", detalhe: `Falha na solicitação: ${exec.motivo || "desconhecido"}` });
      continue;
    }

    // Aguardar processamento
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Verificar resultado
    const pos = await classificarPosExecucao(teste.codigo, exec.execucao.id);
    const status = await supabase.from("ia_execucoes_ferramentas").select("status").eq("id", exec.execucao.id).single();
    const statusExec = (status.data as Record<string, unknown> | null)?.status as string || "DESCONHECIDO";

    const r: ResultadoTeste = {
      robo: teste.robo,
      ferramenta: ferramenta.nome,
      codigo: teste.codigo,
      statusExec,
      temResultadoReal: pos.temReal,
      dadosPersistidos: pos.dadosPersist,
      classificacao: "C",
      detalhe: pos.detalhe,
    };
    r.classificacao = classificar(r);
    resultados.push(r);
  }

  // Relatório Final
  console.log("=".repeat(90));
  console.log("📊 RELATÓRIO FINAL — EXECUÇÃO EMPRESARIAL");
  console.log("=".repeat(90));

  const classA = resultados.filter((r) => r.classificacao === "A");
  const classB = resultados.filter((r) => r.classificacao === "B");
  const classC = resultados.filter((r) => r.classificacao === "C");
  const classD = resultados.filter((r) => r.classificacao === "D");

  console.log(`\n✅ A — Funciona ponta a ponta: ${classA.length}/${resultados.length}`);
  for (const r of classA) console.log(`   ✅ ${r.robo} → ${r.ferramenta}`);

  console.log(`\n🔶 B — Executa parcialmente: ${classB.length}/${resultados.length}`);
  for (const r of classB) console.log(`   🔶 ${r.robo} → ${r.ferramenta}: ${r.detalhe}`);

  console.log(`\n🔴 C — Apenas registra solicitação: ${classC.length}/${resultados.length}`);
  for (const r of classC) console.log(`   🔴 ${r.robo} → ${r.ferramenta}: ${r.detalhe}`);

  console.log(`\n⛔ D — Não implementada: ${classD.length}/${resultados.length}`);
  for (const r of classD) console.log(`   ⛔ ${r.robo} → ${r.ferramenta}: ${r.detalhe}`);

  const percReal = ((classA.length + classB.length) / resultados.length * 100).toFixed(1);
  console.log(`\n📈 Percentual de execução real: ${percReal}%`);
  console.log(`   Ponta a ponta (A): ${(classA.length / resultados.length * 100).toFixed(1)}%`);
  console.log(`   Parcial (B): ${(classB.length / resultados.length * 100).toFixed(1)}%`);
  console.log(`   Só registro (C): ${(classC.length / resultados.length * 100).toFixed(1)}%`);
  console.log(`   Não impl. (D): ${(classD.length / resultados.length * 100).toFixed(1)}%`);

  // Estatísticas do sistema
  const { data: totalExecs } = await supabase.from("ia_execucoes_ferramentas").select("status");
  const execs = (totalExecs || []) as { status: string }[];
  const concluidas = execs.filter((e) => e.status === "CONCLUIDA").length;
  const falhas = execs.filter((e) => e.status === "FALHOU").length;
  const pendentes = execs.filter((e) => ["SOLICITADA", "AGUARDANDO_APROVACAO", "APROVADA"].includes(e.status)).length;

  console.log(`\n📊 Estatísticas globais do sistema:`);
  console.log(`   Total execuções: ${execs.length}`);
  console.log(`   Concluídas: ${concluidas}`);
  console.log(`   Falhas: ${falhas}`);
  console.log(`   Pendentes: ${pendentes}`);

  // Registrar log centralizado
  await centralIaService.registrarLog({
    robo_id: null as unknown as string,
    acao: "f_p1_teste_execucao_real",
    entrada: { total_testes: TESTES.length },
    saida: { classe_a: classA.length, classe_b: classB.length, classe_c: classC.length, classe_d: classD.length, perc_real: percReal },
    status: "sucesso",
  });

  console.log("\n" + "=".repeat(90));
  console.log("TESTE CONCLUÍDO");
  console.log("=".repeat(90));
}

main().catch(console.error);

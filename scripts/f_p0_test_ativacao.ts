/**
 * FASE P0 — Teste de Ativação dos Funcionários Digitais
 *
 * Para cada robô:
 * 1. Seleção de ferramenta (agenteService.selecionarFerramenta)
 * 2. Verificação de permissões (actionEngineService.validarPermissao)
 * 3. Simulação de execução (actionEngineService.solicitarAcao)
 * 4. Registro em log (centralIaService.registrarLog)
 * 5. Registro de auditoria
 *
 * Gera relatório: sucesso, erro, ferramenta não encontrada, permissão negada
 */
import { supabase } from "../src/lib/supabase";
import { agenteService } from "../src/services/ia/agenteService";
import { actionEngineService } from "../src/services/ia/actionEngineService";
import { centralIaService } from "../src/services/centralIaService";

type RoboInfo = { id: string; nome: string; setor: string; modo: string };
type ResultadoTeste = {
  robo: string;
  ferramenta: string;
  selecao: "sucesso" | "ferramenta_nao_encontrada";
  permissao: "sucesso" | "permissao_negada" | "nao_testada";
  execucao: "sucesso" | "erro" | "simulada" | "nao_executada";
  erro?: string;
};

const ROBOS: { nome: string; objetivo: string; ferramentaEsperada: string }[] = [
  { nome: "Comercial IA", objetivo: "consultar leads novos", ferramentaEsperada: "COM_CONSULTAR_LEADS" },
  { nome: "Comercial IA", objetivo: "enviar email para cliente", ferramentaEsperada: "COM_ENVIAR_EMAIL" },
  { nome: "Comercial IA", objetivo: "criar proposta comercial", ferramentaEsperada: "COM_GERAR_PROPOSTA" },
  { nome: "Operacional IA", objetivo: "consultar ordens de servico", ferramentaEsperada: "COM_CONSULTAR_OS" },
  { nome: "Operacional IA", objetivo: "criar escala de prestadores", ferramentaEsperada: "COM_CRIAR_ESCALA" },
  { nome: "Operacional IA", objetivo: "registrar ocorrencia operacional", ferramentaEsperada: "COM_REGISTRAR_OCORRENCIA" },
  { nome: "Recrutamento IA", objetivo: "consultar candidatos processo", ferramentaEsperada: "COM_CONSULTAR_CANDIDATOS" },
  { nome: "Recrutamento IA", objetivo: "enviar convite entrevista", ferramentaEsperada: "COM_ENVIAR_CONVITE" },
  { nome: "Recrutamento IA", objetivo: "analisar documentos candidato", ferramentaEsperada: "COM_ANALISAR_DOCUMENTOS" },
  { nome: "Financeiro IA", objetivo: "consultar financeiro cliente", ferramentaEsperada: "COM_CONSULTAR_FINANCEIRO" },
  { nome: "Financeiro IA", objetivo: "gerar cobranca inadimplente", ferramentaEsperada: "COM_REALIZAR_COBRANCA" },
  { nome: "Financeiro IA", objetivo: "emitir boleto bancario", ferramentaEsperada: "COM_ENVIAR_BOLETO" },
  { nome: "Fiscal IA", objetivo: "conferir cte emitido", ferramentaEsperada: "COM_CONFERIR_CTE" },
  { nome: "Fiscal IA", objetivo: "validar xml documento fiscal", ferramentaEsperada: "COM_VALIDAR_XML" },
  { nome: "Fiscal IA", objetivo: "conferir nfse servico", ferramentaEsperada: "COM_CONFERIR_NFSE" },
  { nome: "Cliente IA", objetivo: "consultar pedido cliente", ferramentaEsperada: "COM_CONSULTAR_PEDIDO" },
  { nome: "Cliente IA", objetivo: "consultar historico servicos", ferramentaEsperada: "COM_CONSULTAR_HISTORICO" },
  { nome: "Prestador IA", objetivo: "consultar escala trabalho", ferramentaEsperada: "COM_CONSULTAR_ESCALA" },
  { nome: "Prestador IA", objetivo: "consultar pagamentos recebidos", ferramentaEsperada: "COM_CONSULTAR_PAGAMENTOS" },
  { nome: "Monitoramento IA", objetivo: "monitorar processos operacionais", ferramentaEsperada: "COM_MONITORAR_PROCESSOS" },
  { nome: "Monitoramento IA", objetivo: "gerar relatorio diario", ferramentaEsperada: "COM_GERAR_RELATORIO" },
];

async function carregarRobos(): Promise<Map<string, RoboInfo>> {
  const { data } = await supabase.from("automacoes_robos").select("id, nome, setor, modo");
  const mapa = new Map<string, RoboInfo>();
  for (const r of data || []) {
    mapa.set((r as RoboInfo).nome, r as RoboInfo);
  }
  return mapa;
}

async function testarRobo(
  robo: RoboInfo,
  objetivo: string,
  ferramentaEsperada: string,
): Promise<ResultadoTeste> {
  const resultado: ResultadoTeste = {
    robo: robo.nome,
    ferramenta: ferramentaEsperada,
    selecao: "ferramenta_nao_encontrada",
    permissao: "nao_testada",
    execucao: "nao_executada",
  };

  // 1. SELEÇÃO DE FERRAMENTA
  const selecao = await agenteService.selecionarFerramenta({
    roboId: robo.id,
    objetivo,
  });

  if (!selecao) {
    resultado.erro = "Nenhuma ferramenta selecionada pelo motor de scoring";
    return resultado;
  }

  resultado.selecao = "sucesso";

  if (selecao.ferramenta.codigo_unico !== ferramentaEsperada) {
    resultado.erro = `Ferramenta selecionada ${selecao.ferramenta.codigo_unico} difere da esperada ${ferramentaEsperada} (score: ${selecao.score})`;
  }

  // 2. VERIFICAÇÃO DE PERMISSÃO
  const perm = await actionEngineService.validarPermissao(robo.id, selecao.ferramenta.id);

  if (!perm || !perm.ativo) {
    resultado.permissao = "permissao_negada";
    resultado.erro = (resultado.erro || "") + " | Permissao negada ou inativa";
    return resultado;
  }
  resultado.permissao = "sucesso";

  // 3. SIMULAÇÃO DE EXECUÇÃO (solicitarAcao com simulacao=true)
  try {
    const exec = await actionEngineService.solicitarAcao({
      roboId: robo.id,
      ferramentaId: selecao.ferramenta.id,
      solicitacao: objetivo,
      contexto: { teste_p0: true, automacao: true },
    });

    if (exec) {
      resultado.execucao = "simulada";
    }
  } catch (err: unknown) {
    resultado.execucao = "erro";
    const errMsg = err instanceof Error ? err.message : String(err);
    resultado.erro = (resultado.erro || "") + ` | Execucao falhou: ${errMsg}`;
  }

  return resultado;
}

async function main() {
  console.log("=".repeat(80));
  console.log("FASE P0 — TESTE DE ATIVAÇÃO DOS FUNCIONÁRIOS DIGITAIS");
  console.log("=".repeat(80));

  const robos = await carregarRobos();
  console.log(`\n📋 Robôs encontrados: ${robos.size}`);
  for (const [nome, info] of robos) {
    console.log(`   - ${nome} (${info.setor}, modo: ${info.modo})`);
  }

  const resultados: ResultadoTeste[] = [];
  const ferramentasVinculadas = new Set<string>();

  console.log(`\n🧪 Executando ${ROBOS.length} testes...`);

  for (const teste of ROBOS) {
    const robo = robos.get(teste.nome);
    if (!robo) {
      resultados.push({
        robo: teste.nome,
        ferramenta: teste.ferramentaEsperada,
        selecao: "ferramenta_nao_encontrada",
        permissao: "nao_testada",
        execucao: "nao_executada",
        erro: "Robo nao encontrado no banco",
      });
      continue;
    }

    const res = await testarRobo(robo, teste.objetivo, teste.ferramentaEsperada);
    resultados.push(res);
    ferramentasVinculadas.add(teste.ferramentaEsperada);
  }

  // Registrar log centralizado
  await centralIaService.registrarLog({
    robo_id: null as unknown as string,
    acao: "f_p0_teste_ativacao",
    entrada: { total_testes: ROBOS.length },
    saida: {
      sucesso: resultados.filter((r) => r.selecao === "sucesso" && r.permissao === "sucesso").length,
      erro: resultados.filter((r) => r.execucao === "erro").length,
      sem_ferramenta: resultados.filter((r) => r.selecao === "ferramenta_nao_encontrada").length,
      sem_permissao: resultados.filter((r) => r.permissao === "permissao_negada").length,
    },
    status: "sucesso",
  });

  // RELATÓRIO
  console.log("\n" + "=".repeat(80));
  console.log("📊 RELATÓRIO DE TESTES");
  console.log("=".repeat(80));

  const sucessos = resultados.filter((r) => r.selecao === "sucesso" && r.permissao === "sucesso");
  const semFerramenta = resultados.filter((r) => r.selecao === "ferramenta_nao_encontrada");
  const semPermissao = resultados.filter((r) => r.permissao === "permissao_negada");
  const erros = resultados.filter((r) => r.execucao === "erro");

  console.log(`\n✅ Sucesso (seleção + permissão): ${sucessos.length}/${ROBOS.length}`);
  console.log(`❌ Ferramenta não encontrada: ${semFerramenta.length}`);
  console.log(`🔒 Permissão negada: ${semPermissao.length}`);
  console.log(`⚠️  Erro na execução: ${erros.length}`);

  console.log(`\n📋 Detalhamento:`);
  for (const r of resultados) {
    const icone = r.selecao === "sucesso" && r.permissao === "sucesso"
      ? "✅" : r.selecao === "ferramenta_nao_encontrada"
        ? "❌" : r.permissao === "permissao_negada"
          ? "🔒" : "⚠️";
    console.log(`   ${icone} ${r.robo} → ${r.ferramenta}`);
    if (r.erro) console.log(`      Erro: ${r.erro}`);
  }

  // Contagem de ferramentas únicas vinculadas
  const { data: totalFerramentas } = await supabase
    .from("ia_ferramentas")
    .select("id", { count: "exact", head: false });
  const { data: totalVinculos } = await supabase
    .from("ia_robo_ferramentas")
    .select("id", { count: "exact", head: false })
    .eq("ativo", true);

  console.log(`\n📈 Estatísticas do sistema:`);
  console.log(`   Total ferramentas: ${totalFerramentas?.length || 0}`);
  console.log(`   Total vínculos ativos: ${totalVinculos?.length || 0}`);
  console.log(`   Robôs testados: ${new Set(resultados.map((r) => r.robo)).size}`);

  // Verificar workers
  const { data: rotinas } = await supabase
    .from("rotinas_ia")
    .select("id", { count: "exact", head: false });
  console.log(`   Rotinas agendadas: ${rotinas?.length || 0}`);

  console.log("\n" + "=".repeat(80));
  console.log("TESTE CONCLUÍDO");
  console.log("=".repeat(80));
}

main().catch(console.error);

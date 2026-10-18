import { supabase } from "@/lib/supabase";
import { centralIaService, type AutomacaoRobo, type AutomacaoInstrucao, type IaConhecimento, type AutomacaoRegraOperacao, type AutomacaoGatilho, type AutoTarefa } from "@/services/centralIaService";

function gerarExecucaoId(): string {
  return crypto.randomUUID();
}

type StatusCandidato = "novo" | "triagem" | "documentacao" | "homologacao" | "aprovado" | "reprovado" | "inativo";

interface CandidatoRecrutamento {
  id: string;
  nome: string;
  nome_completo: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  veiculo: string | null;
  tipo_veiculo: string | null;
  tipo_carroceria: string | null;
  placa: string | null;
  experiencia_anos: number | null;
  como_conheceu: string | null;
  mensagem_livre: string | null;
  canal_captacao: string | null;
  stage: string;
  status: StatusCandidato;
  score: number | null;
  score_perfil: number | null;
  prioridade: string | null;
  prestador_id: string | null;
  created_at: string;
}

interface ContextoRecrutamento {
  candidato: CandidatoRecrutamento;
  robo: AutomacaoRobo;
  instrucao: AutomacaoInstrucao | null;
  conhecimentos: IaConhecimento[];
  regras: AutomacaoRegraOperacao[];
  gatilhos: AutomacaoGatilho[];
}

interface Recomendacao {
  recomendacao: "encaminhar_para_analise_humana" | "monitorar" | "arquivar";
  justificativa: string;
  pontos_observados: string[];
  necessita_aprovacao: boolean;
}

interface ResultadoDeteccao {
  execucao_id: string;
  candidato: CandidatoRecrutamento | null;
  robo: AutomacaoRobo | null;
  contexto: ContextoRecrutamento | null;
  recomendacao: Recomendacao | null;
  tarefa: AutoTarefa | null;
  etapas: { acao: string; status: string; erro?: string }[];
}

async function tarefaJaExiste(origemTipo: string, origemId: string, tipoTarefa: string): Promise<boolean> {
  const { data } = await supabase
    .from("automacoes_tarefas")
    .select("id")
    .eq("origem_tipo", origemTipo)
    .eq("origem_id", String(origemId))
    .eq("tipo_tarefa", tipoTarefa)
    .in("status", ["pendente", "em_execucao", "aguardando_aprovacao"])
    .limit(1);
  return (data?.length || 0) > 0;
}

export const roboRecrutamentoService = {
  async detectarNovoCandidato(candidatoId: string): Promise<ResultadoDeteccao> {
    const execucaoId = gerarExecucaoId();
    const etapas: ResultadoDeteccao["etapas"] = [];

    try {
      const { data: candidato } = await supabase
        .from("recrutamento_candidatos")
        .select("*")
        .eq("id", candidatoId)
        .single();

      if (!candidato) {
        throw new Error("Candidato não encontrado");
      }
      const candidatoData = candidato as CandidatoRecrutamento;
      etapas.push({ acao: "candidato_detectado", status: "sucesso" });

      const { data: robos } = await supabase
        .from("automacoes_robos")
        .select("*")
        .eq("setor", "Recrutamento")
        .limit(1);
      const roboData = (robos?.[0] || null) as AutomacaoRobo | null;

      if (!roboData) {
        throw new Error("Robô de Recrutamento não encontrado");
      }
      etapas.push({ acao: "robo_encontrado", status: "sucesso" });

      if (!roboData.ativo || roboData.status !== "ativo") {
        throw new Error("Robô de Recrutamento não está ativo");
      }
      etapas.push({ acao: "robo_validado", status: "sucesso" });

      await this.registrarLogs(roboData.id, null, "candidato_detectado", {
        execucao_id: execucaoId,
        candidato_id: candidatoData.id,
        nome: candidatoData.nome || candidatoData.nome_completo,
        status: candidatoData.stage || candidatoData.status,
      }, null, "info");

      const instrucao = await centralIaService.obterInstrucaoAtiva(roboData.id);
      const conhecimentos = await centralIaService.buscarConhecimentoValido(roboData.id);
      const regras = await centralIaService.buscarRegrasOperacaoValidas(roboData.id);
      const gatilhos = await centralIaService.buscarGatilhosAtivos(roboData.id, "novo_candidato");

      const contexto = this.montarContextoRecrutamento(candidatoData, roboData, instrucao, conhecimentos, regras, gatilhos);

      await this.registrarLogs(roboData.id, null, "contexto_montado", {
        execucao_id: execucaoId,
        candidato_id: candidatoData.id,
        instrucao_versao: instrucao?.versao || null,
        instrucao_nome: instrucao?.nome || null,
        conhecimentos_count: conhecimentos.length,
        conhecimentos_nomes: conhecimentos.map(c => c.titulo || c.pergunta).slice(0, 5),
        regras_count: regras.length,
        regras_descricoes: regras.map(r => r.descricao || r.nome).slice(0, 5),
        gatilhos_count: gatilhos.length,
        gatilhos_nomes: gatilhos.map(g => g.nome).slice(0, 5),
      }, null, "info");
      etapas.push({ acao: "contexto_montado", status: "sucesso" });

      const recomendacao = this.gerarRecomendacao(contexto);

      await this.registrarLogs(roboData.id, null, "recomendacao_gerada", {
        execucao_id: execucaoId,
        recomendacao: recomendacao.recomendacao,
        justificativa: recomendacao.justificativa,
        necessita_aprovacao: recomendacao.necessita_aprovacao,
      }, null, "info");
      etapas.push({ acao: "recomendacao_gerada", status: "sucesso" });

      let tarefa: AutoTarefa | null = null;

      if (recomendacao.recomendacao !== "arquivar") {
        tarefa = await this.criarTarefaAprovacao(candidatoData, roboData, recomendacao, execucaoId);
        if (tarefa) {
          await this.criarComunicacaoSimulada(candidatoData, roboData, tarefa.id, recomendacao, execucaoId);
        }
      }

      return {
        execucao_id: execucaoId,
        candidato: candidatoData,
        robo: roboData,
        contexto,
        recomendacao,
        tarefa,
        etapas,
      };
    } catch (err) {
      const erro = err instanceof Error ? err.message : "Erro desconhecido";
      etapas.push({ acao: "erro", status: "erro", erro });
      return { candidato: null, robo: null, contexto: null, recomendacao: null, tarefa: null, etapas: [...etapas, { acao: "execucao_id_gerado", status: "info" }] };
    }
  },

  montarContextoRecrutamento(
    candidato: CandidatoRecrutamento,
    robo: AutomacaoRobo,
    instrucao: AutomacaoInstrucao | null,
    conhecimentos: IaConhecimento[],
    regras: AutomacaoRegraOperacao[],
    gatilhos: AutomacaoGatilho[],
  ): ContextoRecrutamento {
    return { candidato, robo, instrucao, conhecimentos, regras, gatilhos };
  },

  gerarRecomendacao(contexto: ContextoRecrutamento): Recomendacao {
    const { candidato, robo, gatilhos } = contexto;
    const pontos_observados: string[] = [];

    pontos_observados.push(`Candidato: ${candidato.nome || candidato.nome_completo}`);
    pontos_observados.push(`Status atual: ${candidato.stage || candidato.status}`);
    if (candidato.cpf) pontos_observados.push("CPF informado");
    if (candidato.veiculo || candidato.tipo_veiculo) pontos_observados.push(`Tipo de veículo: ${candidato.veiculo || candidato.tipo_veiculo}`);
    if (candidato.regiao) pontos_observados.push(`Região: ${candidato.regiao}`);
    if (candidato.experiencia_anos != null) pontos_observados.push(`Experiência: ${candidato.experiencia_anos} anos`);
    if (candidato.cidade) pontos_observados.push(`Cidade: ${candidato.cidade}`);
    if (candidato.mensagem_livre) pontos_observados.push("Mensagem livre fornecida pelo candidato");

    pontos_observados.push(`Robô: ${robo.nome}`);
    pontos_observados.push(`Modo atual: ${robo.modo_atual || "seguro"}`);
    pontos_observados.push(`Exige aprovação humana: ${robo.exige_aprovacao_humana ? "Sim" : "Não"}`);

    if (contexto.instrucao) {
      pontos_observados.push(`Instrução ativa: v${contexto.instrucao.versao} (${contexto.instrucao.status})`);
    } else {
      pontos_observados.push("Nenhuma instrução publicada disponível");
    }

    if (contexto.conhecimentos.length > 0) {
      pontos_observados.push(`${contexto.conhecimentos.length} itens na base de conhecimento`);
    }
    if (contexto.regras.length > 0) {
      pontos_observados.push(`${contexto.regras.length} regras operacionais ativas`);
    }
    if (gatilhos.length > 0) {
      pontos_observados.push(`${gatilhos.length} gatilhos ativos para o evento novo_candidato`);
    }

    const necessita_aprovacao = robo.exige_aprovacao_humana !== false;

    const justificativa = necessita_aprovacao
      ? "Robô configurado para exigir aprovação humana. Encaminhando para análise do setor de Recrutamento."
      : "Candidato detectado. Monitorando conforme configuração do robô.";

    return {
      recomendacao: "encaminhar_para_analise_humana",
      justificativa,
      pontos_observados,
      necessita_aprovacao,
    };
  },

  async criarTarefaAprovacao(
    candidato: CandidatoRecrutamento,
    robo: AutomacaoRobo,
    recomendacao: Recomendacao,
    execucaoId: string,
  ): Promise<AutoTarefa | null> {
    if (await tarefaJaExiste("candidato", candidato.id, "analisar_candidato")) {
      await this.registrarLogs(robo.id, null, "tarefa_ja_existente", {
        execucao_id: execucaoId,
        candidato_id: candidato.id,
        tipo_tarefa: "analisar_candidato",
      }, null, "info");
      return null;
    }

    const titulo = `Analisar candidato - ${candidato.nome_completo}`;
    const descricao = [
      `Candidato detectado pelo robô ${robo.nome}.`,
      `Recomendação: ${recomendacao.recomendacao}.`,
      `Justificativa: ${recomendacao.justificativa}`,
    ].join("\n");

    const tarefa = await centralIaService.criarTarefa({
      robo_id: robo.id,
      setor: "Recrutamento",
      tipo_tarefa: "analisar_candidato",
      origem_tipo: "candidato",
      origem_id: candidato.id,
      titulo,
      descricao,
      prioridade: "normal",
      status: "pendente",
      payload: {
        execucao_id: execucaoId,
        candidato_id: candidato.id,
        nome: candidato.nome_completo,
        recomendacao: recomendacao.recomendacao,
        pontos_observados: recomendacao.pontos_observados,
        responsavel_humano_id: robo.responsavel_humano_id,
      },
    });

    if (!tarefa) return null;

    await centralIaService.criarAprovacao({
      tarefa_id: tarefa.id,
      tipo_aprovacao: "outro",
      conteudo_original: {
        execucao_id: execucaoId,
        origem: "robo_recrutamento",
        candidato_id: candidato.id,
        nome: candidato.nome_completo,
      },
      conteudo_sugerido: {
        acao_recomendada: recomendacao.recomendacao,
        justificativa: recomendacao.justificativa,
        pontos_observados: recomendacao.pontos_observados,
        necessita_aprovacao: recomendacao.necessita_aprovacao,
      },
    });

    await this.registrarLogs(robo.id, tarefa.id, "tarefa_criada", {
      execucao_id: execucaoId,
      candidato_id: candidato.id,
      tarefa_id: tarefa.id,
    }, null, "sucesso");

    return tarefa;
  },

  async criarComunicacaoSimulada(
    candidato: CandidatoRecrutamento,
    robo: AutomacaoRobo,
    tarefaId: string,
    recomendacao: Recomendacao,
    execucaoId: string,
  ): Promise<void> {
    const candidatoNome = candidato.nome_completo.split(" ")[0];
    const fallbackMsg = robo.mensagem_fallback || "Vou direcionar para o responsável pelo setor e já retorno com uma posição.";
    const assinatura = "Recrutamento Conexão Express";

    const conteudo = [
      `Olá ${candidatoNome}, tudo bem?`,
      ``,
      `Recebemos seu cadastro e estamos analisando suas informações.`,
      `Em breve nosso time de Recrutamento entrará em contato para os próximos passos.`,
      ``,
      `Atenciosamente,`,
      assinatura,
    ].join("\n");

    await supabase.from("comunicacoes_mensagens").insert({
      robo_id: robo.id,
      tarefa_id: tarefaId,
      origem_tipo: "candidato",
      origem_id: candidato.id,
      destinatario_tipo: "candidato",
      destinatario_nome: candidato.nome_completo,
      canal: "simulado",
      assunto: `Recrutamento - ${candidato.nome_completo}`,
      conteudo,
      status: "simulado",
      modo_seguro: true,
      provider_message_id: null,
      contexto: {
        execucao_id: execucaoId,
        fallback: fallbackMsg,
        setor: "Recrutamento",
        assinatura,
        recomendacao: recomendacao.recomendacao,
      },
    });

    await this.registrarLogs(robo.id, tarefaId, "simulacao_comunicacao", {
      execucao_id: execucaoId,
      candidato_id: candidato.id,
      tarefa_id: tarefaId,
    }, null, "info");
  },

  async registrarLogs(
    roboId: string | null,
    tarefaId: string | null,
    acao: string,
    entrada: Record<string, unknown> | null,
    saida: Record<string, unknown> | null,
    status: "sucesso" | "erro" | "info" | "aviso",
  ): Promise<void> {
    await centralIaService.registrarLog({
      robo_id: roboId || undefined,
      tarefa_id: tarefaId || undefined,
      acao,
      entrada: entrada || undefined,
      saida: saida || undefined,
      status,
    });
  },
};

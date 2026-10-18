import { supabase } from "@/lib/supabase";
import { centralIaService } from "../centralIaService";
import { comunicacaoGatewayService } from "@/services/comunicacao/comunicacaoGatewayService";
import { confirmarPedidoPortal } from "@/services/portalCliente/pedidosService";

interface DeteccaoResultado {
  regra: string;
  encontrados: number;
  tarefasCriadas: number;
  aprovacoesCriadas: number;
  logsCriados: number;
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

async function criarTarefaOperacional(
  roboId: string | null,
  tipoTarefa: string,
  origemTipo: string,
  origemId: string,
  titulo: string,
  descricao: string,
  payload: Record<string, unknown> = {},
  gerarMensagem = true,
  mensagemTexto?: string,
  assinatura?: string,
): Promise<{ criou: boolean; tarefaId?: string }> {
  if (await tarefaJaExiste(origemTipo, origemId, tipoTarefa)) {
    await centralIaService.registrarLog({
      robo_id: roboId,
      acao: "tarefa_ja_existente",
      entrada: { origem_tipo: origemTipo, origem_id: origemId, tipo_tarefa: tipoTarefa },
      status: "info",
    });
    return { criou: false };
  }

  const tarefa = await centralIaService.criarTarefa({
    robo_id: roboId,
    setor: "Operacional",
    tipo_tarefa: tipoTarefa,
    origem_tipo: origemTipo,
    origem_id: String(origemId),
    titulo,
    descricao,
    prioridade: "normal",
    status: "pendente",
    payload,
  });

  if (!tarefa) return { criou: false };

  if (gerarMensagem && mensagemTexto) {
    const setorNome = "Operacional";
    const assinaturaFinal = assinatura || "Operação Conexão Express";
    const fallbackMsg = "Vou direcionar para o responsável pelo setor e já retorno com uma posição.";
    const conteudo = `${mensagemTexto}\n\nAtenciosamente,\n${assinaturaFinal}`;

    const aprovacao = await centralIaService.criarAprovacao({
      tarefa_id: tarefa.id,
      tipo_aprovacao: "mensagem_prestador",
      conteudo_original: { origem_tipo: origemTipo, origem_id: origemId, tipo_tarefa: tipoTarefa },
      conteudo_sugerido: {
        destinatario_tipo: "prestador",
        mensagem: conteudo,
        assinatura: assinaturaFinal,
      },
    });

    await supabase.from("comunicacoes_mensagens").insert({
      robo_id: roboId,
      tarefa_id: tarefa.id,
      origem_tipo: origemTipo,
      origem_id: String(origemId),
      destinatario_tipo: "prestador",
      canal: "simulado",
      assunto: titulo,
      conteudo,
      status: "simulado",
      modo_seguro: true,
      contexto: { fallback: fallbackMsg, setor: setorNome, assinatura: assinaturaFinal },
    });
  }

  return { criou: true, tarefaId: tarefa.id };
}

function limparMensagem(texto: string): string {
  return texto
    .replace(/sou\s+um\s+robô/gi, "sou um assistente")
    .replace(/sou\s+uma\s+IA/gi, "sou um assistente digital")
    .replace(/sou\s+ia/gi, "sou um assistente digital")
    .replace(/sou\s+atendente\s+humano/gi, "faço parte da equipe");
}

const FALLBACK_MSG = "Vou direcionar para o responsável pelo setor e já retorno com uma posição.";

export const roboOperacionalService = {
  async detectarAceitesPendentes(roboId: string | null): Promise<DeteccaoResultado> {
    const minutos = 30;
    const limite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, created_at, data_escala, programado_para, metadata, prestadores!inner(nome, telefone)")
      .eq("status", "aguardando_aceite")
      .eq("aceite_prestador", false)
      .lt("created_at", limite)
      .limit(20);

    const encontrados = alocacoes?.length || 0;
    let tarefasCriadas = 0;

    for (const aloc of alocacoes || []) {
      const prestadorNome = (aloc as any).prestadores?.nome || "prestador";
      const msg = limparMensagem(
        `Olá, tudo bem? Aqui é a Operação Conexão Express. Consta uma programação pendente de confirmação no aplicativo. Por gentileza, verifique e confirme o aceite para seguirmos com a programação.`
      );
      const { criou } = await criarTarefaOperacional(
        roboId, "cobrar_aceite_prestador", "alocacao_escala", aloc.id,
        `Aceite pendente - ${prestadorNome}`,
        `Programação ${aloc.id} aguardando aceite há mais de ${minutos}min`,
        { prestador_id: aloc.prestador_id, prestador_nome: prestadorNome },
        true, msg
      );
      if (criou) tarefasCriadas++;
    }

    return { regra: "aceites_pendentes", encontrados, tarefasCriadas, aprovacoesCriadas: tarefasCriadas, logsCriados: encontrados };
  },

  async detectarOperacoesSemAtualizacao(roboId: string | null): Promise<DeteccaoResultado> {
    const minutos = 120;
    const limite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, status, updated_at, metadata, prestadores!inner(nome)")
      .in("status", ["aceita", "em_rota"])
      .lt("updated_at", limite)
      .limit(20);

    const encontrados = alocacoes?.length || 0;
    let tarefasCriadas = 0;

    for (const aloc of alocacoes || []) {
      const prestadorNome = (aloc as any).prestadores?.nome || "prestador";
      const msg = limparMensagem(
        `Olá, tudo bem? Aqui é a Operação Conexão Express. Precisamos de uma atualização da etapa atual da operação. Por gentileza, atualize o aplicativo ou nos informe a situação.`
      );
      const { criou } = await criarTarefaOperacional(
        roboId, "solicitar_atualizacao_operacao", "alocacao_escala", aloc.id,
        `Atualização pendente - ${prestadorNome}`,
        `Operação ${aloc.id} sem atualização há mais de ${minutos}min (status: ${aloc.status})`,
        { prestador_id: aloc.prestador_id, status_atual: aloc.status },
        true, msg
      );
      if (criou) tarefasCriadas++;
    }

    return { regra: "operacoes_sem_atualizacao", encontrados, tarefasCriadas, aprovacoesCriadas: tarefasCriadas, logsCriados: encontrados };
  },

  async detectarComprovantesPendentes(roboId: string | null): Promise<DeteccaoResultado> {
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, status, finalizada, data_finalizacao, comprovante_url, prestadores!inner(nome)")
      .in("status", ["concluida"])
      .eq("finalizada", true)
      .is("comprovante_url", null)
      .limit(20);

    const encontrados = alocacoes?.length || 0;
    let tarefasCriadas = 0;

    for (const aloc of alocacoes || []) {
      const prestadorNome = (aloc as any).prestadores?.nome || "prestador";
      const msg = limparMensagem(
        `Olá, tudo bem? Aqui é a Operação Conexão Express. Identificamos que o comprovante de entrega ainda está pendente. Por gentileza, envie a evidência pelo aplicativo para finalizarmos a operação.`
      );
      const { criou } = await criarTarefaOperacional(
        roboId, "cobrar_comprovante_entrega", "alocacao_escala", aloc.id,
        `Comprovante pendente - ${prestadorNome}`,
        `Alocação ${aloc.id} finalizada sem comprovante de entrega`,
        { prestador_id: aloc.prestador_id, prestador_nome: prestadorNome },
        true, msg
      );
      if (criou) tarefasCriadas++;
    }

    return { regra: "comprovantes_pendentes", encontrados, tarefasCriadas, aprovacoesCriadas: tarefasCriadas, logsCriados: encontrados };
  },

  async detectarPossiveisAtrasos(roboId: string | null): Promise<DeteccaoResultado> {
    const agora = new Date().toISOString();
    const { data: alocacoes } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, status, data_escala, horario_retorno_previsto, prestadores!inner(nome)")
      .in("status", ["aceita", "em_rota", "planejada"])
      .lt("data_escala", agora)
      .limit(20);

    const encontrados = alocacoes?.length || 0;
    let tarefasCriadas = 0;

    for (const aloc of alocacoes || []) {
      const prestadorNome = (aloc as any).prestadores?.nome || "prestador";
      const msg = limparMensagem(
        `Olá, tudo bem? Aqui é a Operação Conexão Express. Estamos acompanhando a operação e identificamos possível atraso. ${FALLBACK_MSG}`
      );
      const { criou } = await criarTarefaOperacional(
        roboId, "alerta_possivel_atraso", "alocacao_escala", aloc.id,
        `Possível atraso - ${prestadorNome}`,
        `Alocação ${aloc.id} com data_escala vencida e status não finalizado (${aloc.status})`,
        { prestador_id: aloc.prestador_id, status_atual: aloc.status },
        false, msg
      );
      if (criou) tarefasCriadas++;
    }

    return { regra: "possiveis_atrasos", encontrados, tarefasCriadas, aprovacoesCriadas: 0, logsCriados: encontrados };
  },

  async detectarPedidosClientePendentes(roboId: string | null): Promise<DeteccaoResultado> {
    const minutos = 60;
    const limite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
    const { data: pedidos } = await supabase
      .from("portal_pedidos")
      .select("id, cliente_id, status, created_at, clientes!inner(nome)")
      .in("status", ["enviado", "em_analise"])
      .is("os_vinculada_id", null)
      .lt("created_at", limite)
      .limit(20);

    const encontrados = pedidos?.length || 0;
    let tarefasCriadas = 0;
    let convertidos = 0;

    for (const ped of pedidos || []) {
      const clienteNome = (ped as any).clientes?.nome || "cliente";
      const clienteId = ped.cliente_id || "";

      // D10: Tentar conversão automática via fluxo oficial (idempotente)
      try {
        const clienteData = (ped as any).clientes || {};
        const clienteNomeCompleto = clienteData.razao_social || clienteData.nome || clienteNome;
        const resultado = await confirmarPedidoPortal(ped.id, clienteId, clienteNomeCompleto);
        if (resultado.sucesso) {
          convertidos++;
          await centralIaService.registrarLog({
            robo_id: roboId,
            acao: "pedido_convertido_automaticamente",
            entrada: { pedido_id: ped.id, cliente_id: clienteId },
            saida: { os_id: resultado.os_id, os_numero: resultado.os_numero },
            status: "sucesso",
          });
          continue; // Pedido convertido, não cria tarefa
        }
        // Falha na conversão — registrar e criar tarefa
        await centralIaService.registrarLog({
          robo_id: roboId,
          acao: "pedido_conversao_falhou",
          entrada: { pedido_id: ped.id, cliente_id: clienteId, erro: resultado.erro },
          status: "erro",
        });
      } catch (convErr: any) {
        await centralIaService.registrarLog({
          robo_id: roboId,
          acao: "pedido_conversao_excecao",
          entrada: { pedido_id: ped.id, erro: convErr.message },
          status: "erro",
        });
      }

      // Criar tarefa para revisão humana (só chega aqui se conversão falhou)
      const { criou } = await criarTarefaOperacional(
        roboId, "validar_pedido_cliente", "portal_pedido", ped.id,
        `Pedido pendente - ${clienteNome}`,
        `Pedido ${ped.id} aguardando validação há mais de ${minutos}min (status: ${ped.status}). Conversão automática falhou.`,
        { cliente_id: ped.cliente_id, status_pedido: ped.status },
        false
      );
      if (criou) tarefasCriadas++;
    }

    return { regra: "pedidos_cliente_pendentes", encontrados, tarefasCriadas, aprovacoesCriadas: 0, logsCriados: encontrados };
  },

  async auditarOperacao(roboId: string | null = null): Promise<{
    resultados: DeteccaoResultado[];
    totalTarefas: number;
    totalAprovacoes: number;
  }> {
    const robos = roboId
      ? [{ id: roboId }]
      : (await supabase.from("automacoes_robos").select("id").eq("setor", "Operacional").limit(1)).data || [];
    const rId = robos[0]?.id || null;

    const resultados = await Promise.all([
      this.detectarAceitesPendentes(rId),
      this.detectarOperacoesSemAtualizacao(rId),
      this.detectarComprovantesPendentes(rId),
      this.detectarPossiveisAtrasos(rId),
      this.detectarPedidosClientePendentes(rId),
    ]);

    const totalTarefas = resultados.reduce((s, r) => s + r.tarefasCriadas, 0);
    const totalAprovacoes = resultados.reduce((s, r) => s + r.aprovacoesCriadas, 0);

    await centralIaService.registrarLog({
      robo_id: rId,
      acao: "auditoria_operacional_completa",
      entrada: { resultados },
      saida: { total_tarefas: totalTarefas, total_aprovacoes: totalAprovacoes },
      status: "info",
    });

    return { resultados, totalTarefas, totalAprovacoes };
  },

  async executarRoboProducaoAssistida(roboId: string | null = null): Promise<{
    resultados: DeteccaoResultado[];
    totalTarefas: number;
    totalAprovacoes: number;
    totalEnviados: number;
    totalBloqueados: number;
    resumo: string;
  }> {
    const { resultados, totalTarefas, totalAprovacoes } = await this.auditarOperacao(roboId);
    const totalEncontrados = resultados.reduce((s, r) => s + r.encontrados, 0);
    let totalEnviados = 0;
    let totalBloqueados = 0;

    // Buscar aprovações pendentes para tentar envio
    const tiposMsg = ["cobrar_aceite_prestador", "solicitar_atualizacao_operacao", "cobrar_comprovante_entrega"];
    for (const resultado of resultados) {
      if (!tiposMsg.includes(resultado.regra)) continue;
      if (resultado.tarefasCriadas === 0) continue;
      const { data: aprovacoes } = await supabase
        .from("automacoes_aprovacoes")
        .select("id, tarefa_id, conteudo_sugerido, status, automacoes_tarefas!inner(origem_tipo, origem_id, payload)")
        .eq("status", "aprovado")
        .limit(5);
      for (const ap of aprovacoes || []) {
        const sugestao = (ap as any).conteudo_sugerido || {};
        const telefone = (ap as any).automacoes_tarefas?.payload?.telefone_prestador || "";
        const mensagem = (sugestao as any).mensagem || "";
        const origemTipo = (ap as any).automacoes_tarefas?.origem_tipo || "desconhecido";
        const origemId = (ap as any).automacoes_tarefas?.origem_id || "desconhecido";
        const result = await comunicacaoGatewayService.enviarWhatsAppControlado({
          telefone,
          mensagem,
          setor: "operacional",
          origem_tipo: origemTipo,
          origem_id: String(origemId),
          aprovacao_id: ap.id,
          tarefa_id: ap.tarefa_id,
          robo_id: roboId || undefined,
          destinatario_tipo: "prestador",
          ambiente: "producao_assistida",
        });
        if (result.sucesso) totalEnviados++;
        else totalBloqueados++;
      }
    }

    const linhas = resultados.map((r) =>
      `- ${r.regra.replace(/_/g, " ")}: ${r.encontrados} encontrados, ${r.tarefasCriadas} tarefas, ${r.aprovacoesCriadas} aprovações`
    );
    const resumo = [
      `=== PRODUÇÃO ASSISTIDA ===`,
      ...linhas,
      `---`,
      `Total: ${totalEncontrados} situações, ${totalTarefas} tarefas, ${totalAprovacoes} aprovações`,
      `Enviados: ${totalEnviados} | Bloqueados: ${totalBloqueados}`,
    ].join("\n");

    return { resultados, totalTarefas, totalAprovacoes, totalEnviados, totalBloqueados, resumo };
  },

  async executarRoboOperacionalDryRun(roboId: string | null = null): Promise<{
    resultados: DeteccaoResultado[];
    totalTarefas: number;
    totalAprovacoes: number;
    resumo: string;
  }> {
    const { resultados, totalTarefas, totalAprovacoes } = await this.auditarOperacao(roboId);
    const totalEncontrados = resultados.reduce((s, r) => s + r.encontrados, 0);

    const linhas = resultados.map((r) =>
      `- ${r.regra.replace(/_/g, " ")}: ${r.encontrados} encontrados, ${r.tarefasCriadas} tarefas, ${r.aprovacoesCriadas} aprovações`
    );
    const resumo = [
      `=== DRY-RUN ROBÔ OPERACIONAL ===`,
      ...linhas,
      `---`,
      `Total: ${totalEncontrados} situações, ${totalTarefas} tarefas, ${totalAprovacoes} aprovações`,
      `Nenhum disparo real foi realizado.`,
    ].join("\n");

    return { resultados, totalTarefas, totalAprovacoes, resumo };
  },
};

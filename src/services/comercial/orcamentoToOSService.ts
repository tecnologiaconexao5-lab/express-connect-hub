// ============================================================
// SERVIÇO: ORÇAMENTO → ORDEM DE SERVIÇO
// Converte orçamentos aprovados em ordens de serviço
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Orcamento } from "@/components/comercial/types";

export interface GerarOSResult {
  success: boolean;
  osId?: string;
  osNumero?: string;
  orcamentoAtualizado?: boolean;
  erro?: string;
}

// ─── Gerador de número OS (formato: OS-AAAAMM-NNNN) ─────────────────────────
const gerarNumeroOS = async (): Promise<string> => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const prefixo = `OS-${ano}${mes}-`;

  try {
    const { data } = await supabase
      .from("ordens_servico")
      .select("numero")
      .ilike("numero", `${prefixo}%`)
      .order("numero", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const ultimo = data[0].numero as string;
      const seq = parseInt(ultimo.replace(prefixo, ""), 10);
      if (!isNaN(seq)) {
        return `${prefixo}${String(seq + 1).padStart(4, "0")}`;
      }
    }
  } catch {
    // silencia erros de sequência e usa random
  }

  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefixo}${rand}`;
};

// ─── Aprovar orçamento ────────────────────────────────────────────────────────
export const aprovarOrcamento = async (
  orc: Orcamento
): Promise<{ success: boolean; erro?: string }> => {
  try {
    if (orc.status === "aprovado" || orc.status === "convertido" || orc.status === "convertido_em_os") {
      return { success: false, erro: "Orçamento já está aprovado ou convertido." };
    }

    const historicoAtualizado = [
      ...(orc.historico || []),
      {
        data: new Date().toLocaleString("pt-BR"),
        acao: "Orçamento aprovado pelo usuário",
        usuario: "Usuário atual",
      },
    ];

    const { error } = await supabase
      .from("orcamentos")
      .update({
        status: "aprovado",
        historico: historicoAtualizado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orc.id);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, erro: e.message || "Erro ao aprovar orçamento." };
  }
};

// ─── Verificar se OS já foi gerada ──────────────────────────────────────────
export const verificarOSJaGerada = async (
  orcamentoId: string
): Promise<{ jaGerada: boolean; osId?: string; osNumero?: string }> => {
  try {
    // Verifica pelo campo orcamento_id na OS (se existir)
    const { data: osByOrcId } = await supabase
      .from("ordens_servico")
      .select("id, numero")
      .eq("orcamento_id", orcamentoId)
      .limit(1)
      .maybeSingle();

    if (osByOrcId) {
      return { jaGerada: true, osId: osByOrcId.id, osNumero: osByOrcId.numero };
    }

    // Verifica no campo orcamento_origem (fallback)
    const { data: orcData } = await supabase
      .from("orcamentos")
      .select("numero, os_vinculada_id, os_vinculada_numero")
      .eq("id", orcamentoId)
      .single();

    if (orcData?.os_vinculada_id) {
      return {
        jaGerada: true,
        osId: orcData.os_vinculada_id,
        osNumero: orcData.os_vinculada_numero || "",
      };
    }

    return { jaGerada: false };
  } catch {
    return { jaGerada: false };
  }
};

// ─── Converter orçamento em OS ───────────────────────────────────────────────
export const gerarOSDoOrcamento = async (
  orc: Orcamento
): Promise<GerarOSResult> => {
  try {
    // 1. Verificar se já existe OS gerada
    if (orc.status === "convertido" || orc.status === "convertido_em_os") {
      return { success: false, erro: "Este orçamento já foi convertido em OS." };
    }

    // 2. Checar no banco também (segurança dupla)
    const check = await verificarOSJaGerada(orc.id);
    if (check.jaGerada) {
      return {
        success: false,
        erro: `OS já gerada: ${check.osNumero}`,
        osId: check.osId,
        osNumero: check.osNumero,
      };
    }

    // 3. Gerar número da OS
    const novoNumeroOS = await gerarNumeroOS();

    // 4. Mapear endereços do orçamento para o formato OS
    const enderecos = (orc.enderecos || []).map((end, idx) => ({
      sequencia: idx + 1,
      tipo: end.tipo as "coleta" | "entrega" | "retorno",
      nomeLocal: "",
      endereco: end.endereco || "",
      cep: end.cep || "",
      cidade: end.cidade || "",
      estado: end.uf || "",
      referencia: end.instrucoes || "",
      instrucoes: end.instrucoes || "",
      contato: end.contato || "",
      telefone: end.telefone || "",
      janelaInicio: end.janelaInicio || "",
      janelaFim: end.janelaFim || "",
      agendamento: false,
      statusPonto: "pendente" as const,
      observacoes: end.instrucoes || "",
    }));

    // 5. Mapear carga do orçamento
    const carga = {
      tipo: orc.carga?.refrigerado ? "Refrigerada" : "Seca",
      descricao: orc.carga?.descricao || "",
      volumes: orc.carga?.volumes || 0,
      peso: orc.carga?.peso || 0,
      cubagem: orc.carga?.cubagem || 0,
      pallets: orc.carga?.pallets || 0,
      valorDeclarado: orc.carga?.valorDeclarado || 0,
      qtdNotas: 0,
      refrigerada: orc.carga?.refrigerado || false,
      ajudante: orc.carga?.ajudante || false,
      fragil: orc.carga?.fragil || false,
      empilhavel: orc.carga?.empilhavel !== false,
      risco: orc.carga?.risco || false,
      perigosa: orc.carga?.perigosa || false,
      controlada: orc.carga?.controlada || false,
      conferencia: false,
      equipamento: "",
      condicao: "",
      comprimento: 0,
      largura: 0,
      altura: 0,
      pesoPorVolume: 0,
      temperaturaMinima: 0,
      temperaturaMaxima: 0,
      observacoesCarga: orc.carga?.observacoes || "",
    };

    // 6. Histórico inicial da OS
    const historicoOS = [
      {
        data: new Date().toISOString(),
        acao: `OS gerada automaticamente do orçamento ${orc.numero}`,
        status_novo: "rascunho",
        usuario: "Sistema",
      },
    ];

    // 7. Payload da OS (apenas campos seguros para o banco)
    const osPayload: Record<string, any> = {
      numero: novoNumeroOS,
      data: new Date().toISOString().split("T")[0],
      cliente: orc.cliente || "",
      unidade: orc.unidade || "",
      centro_custo: orc.centroCusto || "",
      tipo_operacao: orc.tipoOperacao || "Coleta e Entrega",
      modalidade: orc.modalidade || "esporadico",
      prioridade: orc.prioridade || "normal",
      status: "rascunho",
      responsavel: orc.responsavel || "",
      pedido_interno: orc.pedidoInterno || "",
      observacoes_gerais: orc.observacoesGerais || "",
      // Vínculo com orçamento
      orcamento_origem: orc.numero,
      // Financeiro herdado do orçamento
      valor_cliente: orc.valores?.valorFinal || 0,
      pedagio: orc.valores?.pedagio || 0,
      adicionais: orc.valores?.adicionais || 0,
      descontos: orc.valores?.descontos || 0,
      tabela_aplicada: orc.valores?.tabelaVinculada || "",
      custo_prestador: orc.valores?.custoEstimado || 0,
      // Veículo sugerido
      tipo_veiculo: orc.veiculo?.tipo || "",
      veiculo_subcategoria: orc.veiculo?.subcategoria || "",
      veiculo_carroceria: orc.veiculo?.carroceria || "",
      veiculo_termica: orc.carga?.refrigerado ? "refrigerado" : "seco",
      // Obrigações
      comprovante_obrigatorio: true,
      cte_obrigatorio: false,
      xml_obrigatorio: false,
      operacao_dedicada: false,
      is_reserva: false,
      retorno_obrigatorio: false,
      status_faturamento: "a faturar",
      status_pagamento: "a pagar",
      // Arrays JSONB
      enderecos,
      carga,
      historico: historicoOS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Tentar adicionar orcamento_id se a coluna existir
    osPayload.orcamento_id = orc.id;

    // 8. Inserir OS no banco
    const { data: novaOS, error: erroOS } = await supabase
      .from("ordens_servico")
      .insert([osPayload])
      .select("id, numero")
      .single();

    if (erroOS) {
      // Se falhou com orcamento_id (coluna não existe), tenta sem ela
      if (erroOS.message?.includes("orcamento_id") || erroOS.code === "42703") {
        delete osPayload.orcamento_id;
        const { data: novaOS2, error: erroOS2 } = await supabase
          .from("ordens_servico")
          .insert([osPayload])
          .select("id, numero")
          .single();
        if (erroOS2) throw erroOS2;
        if (!novaOS2) throw new Error("OS não retornada após inserção.");
        return await _finalizarConversao(orc, novaOS2.id, novaOS2.numero);
      }
      throw erroOS;
    }

    if (!novaOS) throw new Error("OS não retornada após inserção.");

    return await _finalizarConversao(orc, novaOS.id, novaOS.numero);
  } catch (e: any) {
    console.error("[gerarOSDoOrcamento] Erro:", e);
    return { success: false, erro: e.message || "Erro ao gerar OS." };
  }
};

// ─── Finaliza a conversão: atualiza orçamento com vínculo ────────────────────
const _finalizarConversao = async (
  orc: Orcamento,
  osId: string,
  osNumero: string
): Promise<GerarOSResult> => {
  const historicoAtualizado = [
    ...(orc.historico || []),
    {
      data: new Date().toLocaleString("pt-BR"),
      acao: `OS gerada automaticamente: ${osNumero}`,
      usuario: "Sistema",
    },
  ];

  const updatePayload: Record<string, any> = {
    status: "convertido",
    historico: historicoAtualizado,
    os_vinculada_numero: osNumero,
    updated_at: new Date().toISOString(),
  };

  // Tentar salvar os_vinculada_id (pode não existir na coluna)
  try {
    const { error: errOrc } = await supabase
      .from("orcamentos")
      .update({ ...updatePayload, os_vinculada_id: osId })
      .eq("id", orc.id);

    if (errOrc && (errOrc.message?.includes("os_vinculada_id") || errOrc.code === "42703")) {
      // Sem a coluna — salva sem ela
      await supabase
        .from("orcamentos")
        .update(updatePayload)
        .eq("id", orc.id);
    }
  } catch {
    // Silencia: a OS já foi criada, o vínculo é best-effort
  }

  return { success: true, osId, osNumero, orcamentoAtualizado: true };
};

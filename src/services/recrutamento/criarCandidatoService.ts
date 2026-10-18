import { supabase } from "@/lib/supabase";
import { roboRecrutamentoService } from "@/services/centralIa/roboRecrutamentoService";
import { centralIaService } from "@/services/centralIaService";

export interface CriarCandidatoInput {
  nome_completo: string;
  cpf?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  tipo_veiculo?: string;
  placa?: string;
  regiao?: string;
  tipo_carroceria?: string;
  mensagem_livre?: string;
  canal_captacao?: string;
  cidade?: string;
  uf?: string;
}

export interface CriarCandidatoResult {
  sucesso: boolean;
  candidatoId?: string;
  erro?: string;
}

async function verificarProcessamentoAnterior(candidatoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("automacoes_logs")
    .select("id")
    .eq("entrada->>candidato_id", candidatoId)
    .eq("acao", "candidato_detectado")
    .limit(1);
  return (data?.length || 0) > 0;
}

export const criarCandidatoService = {
  async criar(dados: CriarCandidatoInput): Promise<CriarCandidatoResult> {
    try {
      const { data, error } = await supabase
        .from("recrutamento_candidatos")
        .insert([{
          nome: dados.nome_completo,
          nome_completo: dados.nome_completo,
          cpf: dados.cpf?.replace(/\D/g, "") || null,
          telefone: dados.telefone || "",
          whatsapp: dados.whatsapp || "",
          email: dados.email || "",
          cidade: dados.cidade || null,
          uf: dados.uf || null,
          regiao: dados.regiao || null,
          veiculo: dados.tipo_veiculo || null,
          tipo_veiculo: dados.tipo_veiculo || null,
          placa: dados.placa || null,
          tipo_carroceria: dados.tipo_carroceria || null,
          mensagem_livre: dados.mensagem_livre || null,
          canal_captacao: dados.canal_captacao || "onboarding_app",
          status: "interessado",
          stage: "interesse_confirmado",
          data_entrada: new Date().toISOString().split("T")[0],
        }])
        .select("id")
        .single();

      if (error) {
        return { sucesso: false, erro: error.message };
      }

      if (!data) {
        return { sucesso: false, erro: "Erro ao criar candidato: nenhum retorno do banco" };
      }

      const candidatoId = data.id;

      this.processarCandidato(candidatoId);

      return { sucesso: true, candidatoId };
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao criar candidato";
      return { sucesso: false, erro: mensagem };
    }
  },

  async processarCandidato(candidatoId: string): Promise<void> {
    try {
      const jaProcessado = await verificarProcessamentoAnterior(candidatoId);
      if (jaProcessado) {
        return;
      }

      const resultado = await roboRecrutamentoService.detectarNovoCandidato(candidatoId);

      const ultimaEtapa = resultado.etapas[resultado.etapas.length - 1];
      const status = ultimaEtapa?.status === "erro" ? "erro" : "info";
      const acao = status === "erro" ? "falha_processamento" : "processamento_finalizado";

      await centralIaService.registrarLog({
        robo_id: resultado.robo?.id || null,
        tarefa_id: resultado.tarefa?.id || null,
        acao,
        entrada: {
          candidato_id: candidatoId,
          etapas: resultado.etapas,
          recomendacao: resultado.recomendacao?.recomendacao,
        },
        status,
        erro: ultimaEtapa?.erro || undefined,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
      await centralIaService.registrarLog({
        robo_id: null,
        tarefa_id: null,
        acao: "falha_processamento",
        entrada: { candidato_id: candidatoId },
        status: "erro",
        erro: mensagem,
      });
    }
  },
};

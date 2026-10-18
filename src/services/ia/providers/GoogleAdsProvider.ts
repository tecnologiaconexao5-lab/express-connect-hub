import type { IProvider, ProviderParams, ProviderResult, TestConnectionResult } from "./ProviderInterface";

export class GoogleAdsProvider implements IProvider {
  readonly nome = "Google Ads";
  readonly tipo = "OUTRO";
  readonly provedor = "Google Ads";

  async execute(params: ProviderParams): Promise<ProviderResult> {
    const { acao, payload } = params;

    try {
      switch (acao) {
        case "criar_campanha":
          return {
            sucesso: true,
            data: {
              status: "preparado",
              nome: payload.nome as string || "Campanha sem nome",
              orcamento: payload.orcamento_diario as number || 0,
              plataforma: "Google Ads",
              mensagem: `Campanha "${payload.nome as string || "sem nome"}" preparada. Requer aprovação humana antes da publicação.`,
              observacao: "Driver Google Ads será ativado com autenticação OAuth2 em versão futura.",
              campanhaSimulada: {
                nome: payload.nome,
                orcamentoDiario: payload.orcamento_diario,
                segmentacao: payload.segmentacao,
                dataInicio: payload.data_inicio,
              },
            },
          };

        case "criar_grupo_anuncios":
          return {
            sucesso: true,
            data: {
              status: "preparado",
              campanhaId: payload.campanhaId as string,
              nome: payload.nome as string || "Grupo sem nome",
              mensagem: `Grupo de anúncios "${payload.nome as string || "sem nome"}" preparado.`,
            },
          };

        case "criar_anuncio":
          return {
            sucesso: true,
            data: {
              status: "preparado",
              titulo: payload.titulo as string,
              descricao: (payload.descricao as string || "").slice(0, 90),
              url: payload.url_destino as string,
              mensagem: `Anúncio "${payload.titulo as string}" preparado para revisão.`,
            },
          };

        case "pausar_campanha":
          return {
            sucesso: true,
            data: {
              status: "pausado",
              campanhaId: payload.campanhaId as string,
              mensagem: `Campanha ${payload.campanhaId as string} pausada (simulado).`,
            },
          };

        case "obter_metricas":
          return {
            sucesso: true,
            data: {
              status: "simulado",
              metricas: {
                impressoes: 0,
                cliques: 0,
                ctr: 0,
                custo: 0,
                conversoes: 0,
                periodo: payload.periodo as string || "7d",
              },
              mensagem: "Métricas do Google Ads simuladas. Conecte-se à API para dados reais.",
            },
          };

        case "health_check":
          return { sucesso: true, data: { status: "disponivel", mensagem: "Provider Google Ads carregado." } };

        default:
          return { sucesso: false, erro: `Ação desconhecida para GoogleAds: ${acao}` };
      }
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : "Erro desconhecido no GoogleAdsProvider" };
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
    const hasClientId = !!(config?.client_id || import.meta.env.VITE_GOOGLE_ADS_CLIENT_ID);
    const hasClientSecret = !!(config?.client_secret || import.meta.env.VITE_GOOGLE_ADS_CLIENT_SECRET);
    const hasDevToken = !!(config?.developer_token || import.meta.env.VITE_GOOGLE_ADS_DEVELOPER_TOKEN);

    const configured = hasClientId && hasClientSecret && hasDevToken;
    return {
      ok: true,
      mensagem: configured
        ? "Credenciais Google Ads encontradas"
        : "Provider Google Ads carregado. Configure OAuth2 + Developer Token para ativar.",
    };
  }
}

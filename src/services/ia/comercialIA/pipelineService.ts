import { providerRegistry } from "./providers/ProviderRegistry";
import { antiDuplicidadeService } from "./antiDuplicidadeService";
import { enrichmentService } from "./enrichmentService";
import { scoringService } from "./scoringService";
import { centralIaService } from "@/services/centralIaService";
import type { EstrategiaHunter, IaConfigHunter, HunterConfig, ProspectDados } from "./types";
import type { ProspectBruto, ProviderResultado } from "./providers/HunterProvider";

export interface PipelineResultado {
  prospects_reais: ProspectBruto[];
  por_provider: Record<string, { encontrados: number; custo: number }>;
  total_encontrados: number;
  total_simulados: number;
  total_sem_chave: number;
  avisos: string[];
  erros: string[];
}

export const pipelineService = {
  async executar(config: HunterConfig, estrategia: EstrategiaHunter, iaConfig: IaConfigHunter): Promise<PipelineResultado> {
    const providersConfig = estrategia.providers;
    const ordemProviders = providersConfig?.ordem || ["manual", "mock", "web_search", "google_maps", "catalogo", "social_assistido"];

    const providers = providerRegistry.listarPorOrdem(ordemProviders, providersConfig as any);
    const parBusca = {
      segmentos: config.segmentos.length > 0 ? config.segmentos : (estrategia.segmentos_alvo || []),
      estados: config.estados.length > 0 ? config.estados : ["SP", "RJ", "MG"],
      palavrasChave: estrategia.palavras_chave_prospeccao || [],
      limite: config.max_prospeccoes_por_ciclo || estrategia?.limites?.prospeccoes_por_ciclo || 10,
    };

    const resultado: PipelineResultado = {
      prospects_reais: [],
      por_provider: {},
      total_encontrados: 0,
      total_simulados: 0,
      total_sem_chave: 0,
      avisos: [],
      erros: [],
    };

    const limiteTotal = parBusca.limite;

    for (const provider of providers) {
      if (resultado.prospects_reais.length >= limiteTotal) break;

      const limiteProvider = Math.min(
        provider.limites().por_ciclo,
        limiteTotal - resultado.prospects_reais.length
      );

      try {
        const res: ProviderResultado = await provider.buscarProspects(
          { ...parBusca, limite: limiteProvider },
          estrategia
        );

        resultado.por_provider[provider.id] = {
          encontrados: res.prospects.length,
          custo: res.custo_estimado,
        };

        if (res.status === "sem_chave") {
          resultado.total_sem_chave += res.prospects.length;
          resultado.avisos.push(`[${provider.nome}] ${res.erro || "Sem chave de API"}`);
          continue;
        }

        if (res.status === "nao_configurado") {
          resultado.avisos.push(`[${provider.nome}] ${res.aviso || "Nao configurado"}`);
          continue;
        }

        if (res.status === "simulado") {
          resultado.total_simulados += res.prospects.length;
          resultado.avisos.push(`[${provider.nome}] ${res.aviso || "Dados simulados"}`);
        }

        if (res.erro) {
          resultado.erros.push(`[${provider.nome}] ${res.erro}`);
        }
        if (res.aviso && res.status !== "simulado") {
          resultado.avisos.push(`[${provider.nome}] ${res.aviso}`);
        }

        const validos = this.filtrarProspectsValidos(res.prospects);
        resultado.prospects_reais.push(...validos);
        resultado.total_encontrados += validos.length;

      } catch (err: any) {
        resultado.erros.push(`[${provider.nome}] ${err.message}`);
      }
    }

    return resultado;
  },

  filtrarProspectsValidos(prospects: ProspectBruto[]): ProspectBruto[] {
    return prospects.filter(p => {
      if (!p.empresa || p.empresa.trim() === "" || p.empresa.startsWith("[")) return false;
      if (!p.cidade || p.cidade.trim() === "") return false;
      if (!p.estado || p.estado.trim() === "") return false;
      return true;
    });
  },

  validarOrigem(prospect: ProspectBruto): { valida: boolean; motivo?: string } {
    if (!prospect.provider_origem || prospect.provider_origem.trim() === "") {
      return { valida: false, motivo: "provider_origem vazio — origem nao identificavel" };
    }
    if (prospect.confianca_origem === "simulada") {
      return { valida: false, motivo: "Origem simulada — nao criar lead real" };
    }
    if (!prospect.fonte_nome || prospect.fonte_nome.trim() === "") {
      return { valida: false, motivo: "fonte_nome ausente — origem nao rastreavel" };
    }
    if (prospect.confianca_origem === "baixa" && !prospect.fonte_url) {
      return { valida: false, motivo: "Confianca baixa sem fonte_url — nao criar lead automatico" };
    }
    return { valida: true };
  },

  async enriquecerProspect(
    bruto: ProspectBruto,
    estrategia: EstrategiaHunter,
    iaConfig: IaConfigHunter
  ): Promise<ProspectDados> {
    if (bruto.confianca_origem === "simulada") {
      return {
        empresa: bruto.empresa,
        cidade: bruto.cidade, estado: bruto.estado,
        segmento: bruto.segmento || "Indefinido",
        site: bruto.site, telefone: bruto.telefone, whatsapp: bruto.whatsapp,
        email: bruto.email, endereco: bruto.endereco, cnpj: bruto.cnpj,
        necessidade_provavel: "Dado simulado — sem necessidade real",
        volume_estimado: "Medio",
        urgencia: "baixa", temperatura: "frio", probabilidade: 5,
        resumo_ia: `Prospect simulado via ${bruto.provider_origem}. Nao e um lead real.`,
        fonte: bruto.fonte_nome || bruto.provider_origem,
      };
    }

    const enriquecido = await enrichmentService.enriquecer({
      empresa: bruto.empresa, cidade: bruto.cidade, estado: bruto.estado,
      segmento: bruto.segmento, site: bruto.site, telefone: bruto.telefone,
      whatsapp: bruto.whatsapp, email: bruto.email, endereco: bruto.endereco,
      cnpj: bruto.cnpj,
    }, iaConfig);

    return {
      ...enriquecido,
      empresa: bruto.empresa,
      cidade: bruto.cidade,
      estado: bruto.estado,
      fonte: bruto.fonte_nome || bruto.provider_origem,
    };
  },
};

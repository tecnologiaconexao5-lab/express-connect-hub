import { proxyIaClient } from "@/services/ia/proxyIaClient";
import type { ProspectDados, IaConfigHunter } from "./types";

export const enrichmentService = {
  async enriquecer(prospect: Partial<ProspectDados>, iaConfig?: IaConfigHunter): Promise<ProspectDados> {
    const provider = iaConfig?.provider || "groq";
    const model = iaConfig?.model || "llama-3.1-8b-instant";
    const temperature = iaConfig?.temperature_enriquecimento ?? 0.5;
    const maxTokens = iaConfig?.max_tokens_enriquecimento ?? 1500;

    const prompt = `Voce e um assistente de enriquecimento de dados comerciais. Uma empresa foi identificada e voce precisa enriquecer os dados dela para prospeccao.

Empresa: ${prospect.empresa || "Nao informada"}
Cidade: ${prospect.cidade || "Nao informada"}
Estado: ${prospect.estado || "Nao informado"}
Segmento: ${prospect.segmento || "Nao informado"}
Site: ${prospect.site || "Nao informado"}

Com base no nome da empresa, cidade, estado e segmento, enriqueca com dados REALISTAS e PLAUSIVEIS para uma empresa brasileira deste segmento.

Retorne APENAS UM JSON valido sem formatacao markdown:
{
  "empresa": "Nome completo da empresa",
  "cidade": "Cidade",
  "estado": "Sigla do estado (SP, RJ, MG, etc)",
  "segmento": "Segmento de atuacao",
  "endereco": "Endereco comercial plausivel",
  "site": "URL do site",
  "telefone": "Telefone comercial com DDD",
  "whatsapp": "WhatsApp com DDD",
  "email": "Email comercial provavel",
  "responsavel_nome": "Nome do provavel responsavel (diretor ou gerente de logistica/suprimentos)",
  "responsavel_cargo": "Cargo do responsavel",
  "linkedin": "URL do LinkedIn corporativo",
  "instagram": "URL do Instagram corporativo",
  "facebook": "URL do Facebook corporativo",
  "cnpj": "CNPJ formatado (XX.XXX.XXX/XXXX-XX) — gere um CNPJ valido aleatorio",
  "necessidade_provavel": "Descricao da necessidade logistica provavel para esta empresa",
  "volume_estimado": "Volume estimado de entregas (Baixo/Medio/Alto)",
  "fonte": "Fonte da prospeccao"
}`;

    const resultado = await proxyIaClient.executar({
      provider, model, prompt, temperature, max_tokens: maxTokens,
    });

    if (resultado.sucesso) {
      try {
        const jsonMatch = resultado.resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as ProspectDados;
        }
      } catch {
        // fallback
      }
    }

    return {
      empresa: prospect.empresa || "",
      cidade: prospect.cidade || "",
      estado: prospect.estado || "",
      segmento: prospect.segmento || "",
      necessidade_provavel: "Necessidade logistica nao especificada",
      volume_estimado: "Medio",
      urgencia: "media",
      temperatura: "morno",
      probabilidade: 30,
      resumo_ia: "Dados nao enriquecidos",
      fonte: "IA",
    };
  },
};

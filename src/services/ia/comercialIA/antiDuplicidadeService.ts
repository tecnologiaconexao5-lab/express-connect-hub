import { supabase } from "@/lib/supabase";
import type { EstrategiaHunter } from "./types";

export interface VerificacaoDuplicidade {
  duplicado: boolean;
  tipo?: "lead" | "resultado" | "contato" | "empresa" | "cnpj" | "dominio" | "telefone" | "email";
  registro_existente?: {
    id: string;
    tabela: string;
    empresa: string;
    estagio?: string;
    status?: string;
  };
  detalhes?: string;
}

export const antiDuplicidadeService = {
  async verificarDuplicidade(
    dados: {
      empresa?: string;
      cnpj?: string;
      email?: string;
      telefone?: string;
      site?: string;
    },
    estrategia?: EstrategiaHunter
  ): Promise<VerificacaoDuplicidade> {
    const antiConfig = estrategia?.anti_duplicidade;
    if (antiConfig && !antiConfig.ativo) {
      return { duplicado: false };
    }

    const criterios = antiConfig?.criterios || ["empresa", "cnpj", "email", "telefone", "dominio"];
    const checks: Promise<VerificacaoDuplicidade | null>[] = [];

    if (dados.empresa && criterios.includes("empresa")) {
      checks.push(this.verificarEmpresa(dados.empresa, antiConfig));
    }
    if (dados.cnpj && criterios.includes("cnpj")) {
      checks.push(this.verificarCNPJ(dados.cnpj));
    }
    if (dados.email && criterios.includes("email")) {
      checks.push(this.verificarEmail(dados.email));
    }
    if (dados.telefone && criterios.includes("telefone")) {
      checks.push(this.verificarTelefone(dados.telefone));
    }
    if (dados.site && criterios.includes("dominio")) {
      checks.push(this.verificarDominio(dados.site));
    }

    const results = await Promise.all(checks);
    for (const r of results) {
      if (r?.duplicado) return r;
    }

    return { duplicado: false };
  },

  async verificarEmpresa(nome: string, antiConfig?: { check_crm_leads?: boolean; check_resultados_anteriores?: boolean }): Promise<VerificacaoDuplicidade | null> {
    if (antiConfig?.check_crm_leads !== false) {
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("id, empresa, estagio")
        .ilike("empresa", `%${nome}%`)
        .limit(1);
      if (leads && leads.length > 0) {
        return { duplicado: true, tipo: "lead", registro_existente: { id: leads[0].id, tabela: "crm_leads", empresa: leads[0].empresa, estagio: leads[0].estagio } };
      }
    }

    if (antiConfig?.check_resultados_anteriores !== false) {
      const { data: resultados } = await supabase
        .from("comercial_hunter_resultados")
        .select("id, empresa, status")
        .ilike("empresa", `%${nome}%`)
        .limit(1);
      if (resultados && resultados.length > 0) {
        return { duplicado: true, tipo: "resultado", registro_existente: { id: resultados[0].id, tabela: "comercial_hunter_resultados", empresa: resultados[0].empresa, status: resultados[0].status } };
      }
    }

    return null;
  },

  async verificarCNPJ(cnpj: string): Promise<VerificacaoDuplicidade | null> {
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length < 14) return null;
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, empresa, estagio")
      .eq("cnpj", limpo)
      .limit(1);
    if (leads && leads.length > 0) {
      return { duplicado: true, tipo: "cnpj", registro_existente: { id: leads[0].id, tabela: "crm_leads", empresa: leads[0].empresa, estagio: leads[0].estagio }, detalhes: `CNPJ ${cnpj} ja cadastrado como lead` };
    }
    return null;
  },

  async verificarEmail(email: string): Promise<VerificacaoDuplicidade | null> {
    if (!email) return null;
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, empresa, estagio")
      .eq("email", email.toLowerCase())
      .limit(1);
    if (leads && leads.length > 0) {
      return { duplicado: true, tipo: "email", registro_existente: { id: leads[0].id, tabela: "crm_leads", empresa: leads[0].empresa, estagio: leads[0].estagio } };
    }
    return null;
  },

  async verificarTelefone(telefone: string): Promise<VerificacaoDuplicidade | null> {
    if (!telefone) return null;
    const limpo = telefone.replace(/\D/g, "");
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, empresa, estagio")
      .or(`telefone.ilike.%${limpo}%,whatsapp.ilike.%${limpo}%`)
      .limit(1);
    if (leads && leads.length > 0) {
      return { duplicado: true, tipo: "telefone", registro_existente: { id: leads[0].id, tabela: "crm_leads", empresa: leads[0].empresa, estagio: leads[0].estagio } };
    }
    return null;
  },

  async verificarDominio(site: string): Promise<VerificacaoDuplicidade | null> {
    if (!site) return null;
    const dominio = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, empresa, estagio")
      .ilike("proposta_url", `%${dominio}%`)
      .limit(1);
    if (leads && leads.length > 0) {
      return { duplicado: true, tipo: "dominio", registro_existente: { id: leads[0].id, tabela: "crm_leads", empresa: leads[0].empresa, estagio: leads[0].estagio } };
    }
    return null;
  },
};

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, Users, KanbanSquare, MessageSquare,
  FileText, BarChart2, Bell, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Lead, LEADS_MOCK, calcularProbabilidade } from "./crmTypes";
import CrmDashboard from "./CrmDashboard";
import CrmPipeline from "./CrmPipeline";
import CrmLeadsTable from "./CrmLeadsTable";
import CrmComunicacao from "./CrmComunicacao";
import CrmPropostas from "./CrmPropostas";
import CrmRelatorios from "./CrmRelatorios";
import AgendaComercial from "./AgendaComercial";

// ─── Mapeador: linha do banco → Lead (tipo frontend) ──────────
const fromCrmLeadRow = (item: any): Lead => ({
  id: item.id,
  empresa: item.empresa || "",
  nomeContato: item.nome_contato || "",
  telefone: item.telefone || "",
  whatsapp: item.whatsapp || item.telefone || "",
  email: item.email || "",
  segmento: item.segmento || "",
  regiao: item.regiao || "",
  origem: item.origem || "outro",
  responsavel: item.responsavel || "",
  tipoServico: item.tipo_servico || "",
  estagio: item.estagio || "lead_novo",
  urgencia: item.urgencia || "media",
  temperatura: item.temperatura || "frio",
  valorEstimadoMensal: Number(item.valor_estimado_mensal) || 0,
  probabilidadeFechamento: Number(item.probabilidade_fechamento) || 10,
  qtdVeiculos: item.qtd_veiculos || 0,
  tiposVeiculo: item.tipos_veiculo || [],
  regioes: item.regioes || [],
  volumeMensal: item.volume_mensal || 0,
  timeline: Array.isArray(item.timeline) ? item.timeline.map((t: any) => ({
    ...t,
    data: new Date(t.data || t.created_at || Date.now()),
  })) : [],
  lembretes: Array.isArray(item.lembretes) ? item.lembretes.map((l: any) => ({
    ...l,
    data: new Date(l.data || Date.now()),
  })) : [],
  criadoEm: new Date(item.created_at || Date.now()),
  atualizadoEm: new Date(item.updated_at || Date.now()),
  diasNaEtapa: item.dias_na_etapa || 0,
  motivoPerda: item.motivo_perda,
  descricaoPerda: item.descricao_perda,
  propostaUrl: item.proposta_url,
  propostaEnviadaEm: item.proposta_enviada_em ? new Date(item.proposta_enviada_em) : undefined,
  propostaVisualizacoes: item.proposta_visualizacoes || 0,
});

// ─── Mapeador: Lead → payload para o banco ────────────────────
const toCrmLeadRow = (lead: Lead): Record<string, any> => ({
  empresa: lead.empresa,
  nome_contato: lead.nomeContato,
  telefone: lead.telefone,
  whatsapp: lead.whatsapp,
  email: lead.email,
  segmento: lead.segmento,
  regiao: lead.regiao,
  origem: lead.origem,
  responsavel: lead.responsavel,
  tipo_servico: lead.tipoServico,
  estagio: lead.estagio,
  urgencia: lead.urgencia,
  temperatura: lead.temperatura,
  valor_estimado_mensal: lead.valorEstimadoMensal,
  probabilidade_fechamento: lead.probabilidadeFechamento,
  qtd_veiculos: lead.qtdVeiculos || 0,
  tipos_veiculo: lead.tiposVeiculo || [],
  regioes: lead.regioes || [],
  volume_mensal: lead.volumeMensal || 0,
  timeline: (lead.timeline || []).map(t => ({ ...t, data: t.data instanceof Date ? t.data.toISOString() : t.data })),
  lembretes: (lead.lembretes || []).map(l => ({ ...l, data: l.data instanceof Date ? l.data.toISOString() : l.data })),
  dias_na_etapa: lead.diasNaEtapa || 0,
  motivo_perda: lead.motivoPerda,
  descricao_perda: lead.descricaoPerda,
  proposta_url: lead.propostaUrl,
  proposta_enviada_em: lead.propostaEnviadaEm?.toISOString() || null,
  proposta_visualizacoes: lead.propostaVisualizacoes || 0,
  updated_at: new Date().toISOString(),
});

export default function CrmBase() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [usandoBanco, setUsandoBanco] = useState(false);

  useEffect(() => {
    carregarLeads();
  }, []);

  // ─── Carregar leads: tenta crm_leads, fallback para leads (marketing) e mock
  const carregarLeads = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Tentar tabela crm_leads (nova)
      const { data: crmData, error: crmError } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (!crmError && crmData !== null) {
        setUsandoBanco(true);
        if (crmData.length > 0) {
          setLeads(crmData.map(fromCrmLeadRow));
        } else {
          // Banco vazio — inicializar com dados mock migrados automaticamente
          console.log("[CRM] Banco crm_leads vazio. Carregando mock sem persistir.");
          setLeads(LEADS_MOCK);
        }
        return;
      }

      // 2. Fallback: tabela leads (marketing antiga)
      if (crmError?.code === "42P01") {
        console.warn("[CRM] Tabela crm_leads não existe ainda. Usando mock.");
      } else {
        console.warn("[CRM] Erro ao carregar crm_leads:", crmError?.message);
      }

      // Tenta carregar da tabela leads (legado)
      const { data: legacyData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (legacyData && legacyData.length > 0) {
        const leadsLegacy: Lead[] = legacyData.map((item: any) => ({
          id: item.id,
          empresa: item.empresa || item.nome || "",
          nomeContato: item.nome || "",
          telefone: item.telefone || "",
          whatsapp: item.telefone || "",
          email: item.email || "",
          segmento: item.tipo_lead || "Outro",
          regiao: "",
          origem: item.origem || "outro",
          responsavel: item.responsavel || "Não atribuído",
          tipoServico: item.tipo_lead || "",
          estagio: "lead_novo" as const,
          urgencia: "media" as const,
          temperatura: "frio" as const,
          valorEstimadoMensal: 0,
          probabilidadeFechamento: 10,
          timeline: [],
          lembretes: [],
          criadoEm: new Date(item.created_at),
          atualizadoEm: new Date(item.created_at),
          diasNaEtapa: 0,
        }));
        setLeads([...LEADS_MOCK, ...leadsLegacy]);
      } else {
        // 3. Último fallback: mock
        setLeads(LEADS_MOCK);
      }
    } catch (e: any) {
      console.error("[CRM] Erro geral:", e.message);
      setLeads(LEADS_MOCK);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Persistir alterações de leads no banco ───────────────────
  const handleLeadsChange = useCallback(async (novosLeads: Lead[]) => {
    setLeads(novosLeads);

    if (!usandoBanco) return; // Se está usando mock, não persiste

    // Detectar lead alterado (diff simples pelo updated_at)
    const leadAlterado = novosLeads.find(nl => {
      const original = leads.find(l => l.id === nl.id);
      return !original || original.estagio !== nl.estagio ||
        original.temperatura !== nl.temperatura ||
        original.timeline?.length !== nl.timeline?.length;
    });

    if (!leadAlterado) return;

    try {
      const payload = toCrmLeadRow(leadAlterado);

      // Se ID parece ser mock (número puro), inserir como novo
      const isMockId = /^\d+$/.test(leadAlterado.id);

      if (isMockId) {
        const { data, error } = await supabase
          .from("crm_leads")
          .insert([{ ...payload, created_at: new Date().toISOString() }])
          .select("id")
          .single();
        if (!error && data) {
          // Atualiza o ID local com o UUID real
          setLeads(prev => prev.map(l => l.id === leadAlterado.id ? { ...l, id: data.id } : l));
        }
        if (error) console.error("[CRM] Erro ao inserir lead:", error.message);
      } else {
        const { error } = await supabase
          .from("crm_leads")
          .update(payload)
          .eq("id", leadAlterado.id);
        if (error) console.error("[CRM] Erro ao atualizar lead:", error.message);
      }
    } catch (e: any) {
      console.error("[CRM] Erro ao persistir:", e.message);
    }
  }, [leads, usandoBanco]);

  // ─── Salvar novo lead no banco ────────────────────────────────
  const handleSalvarNovoLead = useCallback(async (lead: Lead): Promise<Lead> => {
    if (!usandoBanco) {
      setLeads(prev => [...prev, lead]);
      toast.success("Lead cadastrado (modo offline)!");
      return lead;
    }

    try {
      const payload = toCrmLeadRow(lead);
      const { data, error } = await supabase
        .from("crm_leads")
        .insert([{ ...payload, created_at: new Date().toISOString() }])
        .select("*")
        .single();

      if (error) throw error;

      // Registrar histórico
      if (data) {
        await supabase.from("crm_historico").insert([{
          lead_id: data.id,
          tipo: "lead_criado",
          titulo: "Lead cadastrado no CRM",
          descricao: `Empresa: ${lead.empresa} | Contato: ${lead.nomeContato}`,
          metadata: { origem: lead.origem, estagio: lead.estagio },
          created_at: new Date().toISOString(),
        }]);

        const leadSalvo = fromCrmLeadRow(data);
        setLeads(prev => [leadSalvo, ...prev]);
        toast.success("Lead cadastrado e salvo no Supabase!");
        return leadSalvo;
      }
    } catch (e: any) {
      console.error("[CRM] Erro ao salvar lead:", e.message);
      toast.error("Erro ao salvar lead. Tente novamente.");
    }

    // Fallback local
    setLeads(prev => [...prev, lead]);
    return lead;
  }, [usandoBanco]);

  const handleAbrirLead = (lead: Lead) => {
    setActiveTab("pipeline");
  };

  return (
    <div className="space-y-2">
      {/* Indicador de modo */}
      {!loading && (
        <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium ${usandoBanco ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          <span>
            {usandoBanco
              ? `✅ CRM conectado ao Supabase — ${leads.length} lead(s)`
              : `⚠️ Modo offline — Execute a migration SQL para conectar ao banco`}
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={carregarLeads}>
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg w-full overflow-x-auto">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5 whitespace-nowrap">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs gap-1.5 whitespace-nowrap">
            <KanbanSquare className="w-3.5 h-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs gap-1.5 whitespace-nowrap">
            <Users className="w-3.5 h-3.5" /> Gestão de Leads
          </TabsTrigger>
          <TabsTrigger value="comunicacao" className="text-xs gap-1.5 whitespace-nowrap">
            <MessageSquare className="w-3.5 h-3.5" /> Comunicação
          </TabsTrigger>
          <TabsTrigger value="propostas" className="text-xs gap-1.5 whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" /> Propostas
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="text-xs gap-1.5 whitespace-nowrap">
            <BarChart2 className="w-3.5 h-3.5" /> Relatórios IA
          </TabsTrigger>
          <TabsTrigger value="atividades" className="text-xs gap-1.5 whitespace-nowrap">
            <Bell className="w-3.5 h-3.5" /> Agenda
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="dashboard" className="m-0">
            <CrmDashboard leads={leads} onAbrirLead={handleAbrirLead} />
          </TabsContent>

          <TabsContent value="pipeline" className="m-0">
            <CrmPipeline
              leads={leads}
              onLeadsChange={handleLeadsChange}
              onSalvarNovoLead={handleSalvarNovoLead}
              usandoBanco={usandoBanco}
            />
          </TabsContent>

          <TabsContent value="leads" className="m-0">
            <CrmLeadsTable leads={leads} onAbrirLead={handleAbrirLead} />
          </TabsContent>

          <TabsContent value="comunicacao" className="m-0">
            <CrmComunicacao leads={leads} />
          </TabsContent>

          <TabsContent value="propostas" className="m-0">
            <CrmPropostas />
          </TabsContent>

          <TabsContent value="relatorios" className="m-0">
            <CrmRelatorios leads={leads} />
          </TabsContent>

          <TabsContent value="atividades" className="m-0">
            <AgendaComercial />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

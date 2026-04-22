import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, Users, KanbanSquare, MessageSquare,
  FileText, BarChart2, Bell, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Lead, LEADS_MOCK } from "./crmTypes";
import CrmDashboard from "./CrmDashboard";
import CrmPipeline from "./CrmPipeline";
import CrmLeadsTable from "./CrmLeadsTable";
import CrmComunicacao from "./CrmComunicacao";
import CrmPropostas from "./CrmPropostas";
import CrmRelatorios from "./CrmRelatorios";
// Mantém as abas antigas para retrocompatibilidade
import CrmAtividades from "./CrmAtividades";

interface LeadMarketing {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
  origem: string;
  campanha_id: string;
  tipo_lead: string;
  status: string;
  responsavel: string;
  created_at: string;
}

export default function CrmBase() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leads, setLeads] = useState<Lead[]>(LEADS_MOCK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLeadsMarketing();
  }, []);

  const carregarLeadsMarketing = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar leads marketing:", error);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const leadsMarketing: Lead[] = data.map((item: LeadMarketing) => ({
          id: item.id,
          empresa: item.empresa || item.nome,
          nomeContato: item.nome,
          telefone: item.telefone || "",
          whatsapp: item.telefone || "",
          email: item.email || "",
          segmento: item.tipo_lead || "Outro",
          regiao: "",
          origem: (item.origem as any) || "outro",
          responsavel: item.responsavel || "Não atribuído",
          tipoServico: item.tipo_lead || "Outro",
          estagio: "lead_novo",
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

        setLeads((prev) => [...prev, ...leadsMarketing]);
      }
    } catch (error) {
      console.error("Erro ao carregar leads marketing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirLead = (lead: Lead) => {
    setActiveTab("pipeline");
    // Pipeline vai abrir o detalhe — por ora apenas muda de aba
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* TabsList horizontal scrollável */}
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg w-full overflow-x-auto">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5 whitespace-nowrap">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs gap-1.5 whitespace-nowrap">
            <KanbanSquare className="w-3.5 h-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs gap-1.5 whitespace-nowrap">
            <Users className="w-3.5 h-3.5" />
            Gestão de Leads
          </TabsTrigger>
          <TabsTrigger value="comunicacao" className="text-xs gap-1.5 whitespace-nowrap">
            <MessageSquare className="w-3.5 h-3.5" />
            Comunicação
          </TabsTrigger>
          <TabsTrigger value="propostas" className="text-xs gap-1.5 whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" />
            Propostas
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="text-xs gap-1.5 whitespace-nowrap">
            <BarChart2 className="w-3.5 h-3.5" />
            Relatórios IA
          </TabsTrigger>
          <TabsTrigger value="atividades" className="text-xs gap-1.5 whitespace-nowrap">
            <Bell className="w-3.5 h-3.5" />
            Agenda
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="dashboard" className="m-0">
            <CrmDashboard leads={leads} onAbrirLead={handleAbrirLead} />
          </TabsContent>

          <TabsContent value="pipeline" className="m-0">
            <CrmPipeline leads={leads} onLeadsChange={setLeads} />
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
            <CrmAtividades />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

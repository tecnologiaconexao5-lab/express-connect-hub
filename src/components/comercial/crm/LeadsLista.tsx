import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Plus, Mail, MessageCircle, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { propostaService } from "@/services/comercial/propostaService";

export default function LeadsLista() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao carregar leads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLeads();
  }, []);

  const handleGerarProposta = async (lead: any) => {
    toast.info("Gerando proposta com IA...");
    try {
      const prop = await propostaService.gerarPropostaAutomatica(lead, "São Paulo", "Rio de Janeiro", "VAN");
      toast.success(`Proposta de R$ ${prop.valorSugerido.toFixed(2)} gerada e enviada via WhatsApp/Email!`);
      // Update DB if real
      if (lead.id.length > 5) {
        await supabase.from("crm_leads").update({ status: "proposta" }).eq("id", lead.id);
        carregarLeads();
      }
    } catch (e) {
      toast.error("Falha ao gerar proposta automática.");
    }
  };

  const handleConverterEmOS = async (lead: any) => {
    toast.info("Convertendo em OS...");
    try {
      const resp = await propostaService.converterEmOS("PROP-001", lead);
      toast.success(`Convertido! ${resp.numeroOS} gerada com sucesso e cliente notificado.`);
      // Update DB
      if (lead.id.length > 5) {
        await supabase.from("crm_leads").update({ status: "fechado" }).eq("id", lead.id);
        carregarLeads();
      }
    } catch(e) {
      toast.error("Falha ao converter OS.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "novo": return "bg-blue-100 text-blue-700";
      case "proposta": return "bg-yellow-100 text-yellow-700";
      case "fechado": return "bg-green-100 text-green-700";
      case "perdido": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">Gestão de Leads (Automação CRM)</CardTitle>
        <Button size="sm"><Plus className="w-4 h-4 mr-2"/>Novo Lead</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações Rápidas (IA)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
              ) : leads.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
              ) : leads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell className="font-semibold">{lead.nome}</TableCell>
                  <TableCell>{lead.empresa}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3"/> {lead.telefone}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {lead.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{lead.origem}</TableCell>
                  <TableCell><Badge variant="outline" className={getStatusColor(lead.status)}>{lead.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleGerarProposta(lead)} title="Gerar Proposta via IA" className="h-8">
                        <FileText className="w-3 h-3 mr-1" /> Proposta IA
                      </Button>
                      <Button size="sm" variant="default" onClick={() => handleConverterEmOS(lead)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Converter OS
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

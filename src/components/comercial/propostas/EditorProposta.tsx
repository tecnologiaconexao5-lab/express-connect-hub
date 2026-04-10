import { useState } from "react";
import { ArrowLeft, Save, Copy, FileText, Briefcase, LayoutTemplate, Settings2, PlusCircle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface EditorPropostaProps {
  proposta: any;
  modo: "novo_modelo" | "nova_personalizada" | "editar";
  onBack: () => void;
}

export default function EditorProposta({ proposta, modo, onBack }: EditorPropostaProps) {
  const isPersonalizada = modo === "nova_personalizada" || (proposta && proposta.tipo === "personalizada");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titulo: proposta?.titulo || "",
    subtitulo: proposta?.subtitulo || "",
    cliente: proposta?.cliente || "",
    segmento: proposta?.segmento || "",
    tipoServico: proposta?.tipoServico || "",
    introducao: proposta?.introducao || "A Express Connect apresenta esta proposta focada em eficiência logística, redução de custos e rastreabilidade ponta a ponta.",
    escopo: proposta?.escopo || "- Coleta diária em CD central.\n- Distribuição fracionada D+1.\n- Seguro de carga completo.",
    condicoes: proposta?.condicoes || "- Faturamento quinzenal (D+15).\n- Impostos inclusos (ICMS/ISS).\n- Tabela sujeita a reajuste anual por IGPM.",
    observacoes: proposta?.observacoes || "Proposta válida por 15 dias corridos.",
  });

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(modo === "novo_modelo" ? "Modelo salvo na biblioteca!" : "Proposta salva com sucesso!");
      onBack();
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5 text-slate-600" /></Button>
             <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                   {modo === "novo_modelo" && <><LayoutTemplate className="w-5 h-5 text-blue-600"/> Criando Novo Modelo Base</>}
                   {modo === "nova_personalizada" && <><Briefcase className="w-5 h-5 text-emerald-600"/> Gerando Proposta Personalizada</>}
                   {modo === "editar" && <><FileText className="w-5 h-5 text-slate-600"/> Editando {proposta?.tipo === "modelo" ? "Modelo" : "Proposta"}</>}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                   {isPersonalizada ? (
                     <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Personalizada para Cliente</Badge>
                   ) : (
                     <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Modelo Oficial / Padrão</Badge>
                   )}
                   {proposta && <span className="text-xs text-muted-foreground">Última edição: hoje</span>}
                </div>
             </div>
          </div>
          <div className="flex gap-2">
             <Button variant="outline"><Copy className="w-4 h-4 mr-2"/> Duplicar</Button>
             <Button onClick={handleSave} className="bg-primary shadow-sm" disabled={loading}>
               {loading ? "Salvando..." : <><Save className="w-4 h-4 mr-2"/> Salvar Versão</>}
             </Button>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
             {/* BLOCO 1 - CABEÇALHO */}
             <Card className="shadow-sm border-t-2 border-t-slate-800">
               <CardHeader className="pb-3 border-b bg-slate-50/50"><CardTitle className="text-base">1. Cabeçalho & Identificação</CardTitle></CardHeader>
               <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <Label>Título Oficial da Proposta</Label>
                    <Input 
                      placeholder="Ex: Proposta Comercial de Distribuição Local" 
                      value={formData.titulo}
                      onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                      className="font-bold text-lg"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label>Subtítulo / Chamada</Label>
                    <Input 
                      value={formData.subtitulo}
                      onChange={(e) => setFormData({...formData, subtitulo: e.target.value})}
                    />
                  </div>
                  {isPersonalizada && (
                    <div className="md:col-span-2 space-y-1 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                      <Label className="text-emerald-800 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5"/> Cliente Vinculado (CRM)</Label>
                      <Select value={formData.cliente} onValueChange={(v) => setFormData({...formData, cliente: v})}>
                         <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione um cliente da base" /></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="Amazon Logística">Amazon Logística</SelectItem>
                            <SelectItem value="Química ABC">Química ABC</SelectItem>
                            <SelectItem value="Mercado Livre">Mercado Livre</SelectItem>
                         </SelectContent>
                      </Select>
                      <p className="text-[10px] text-emerald-600/80 mt-1">Ao vincular, as variáveis do sistema puxarão os dados automaticamente.</p>
                    </div>
                  )}
               </CardContent>
             </Card>

             {/* BLOCO 2 - ESTRUTURA METADADOS */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-t-2 border-t-slate-300">
                  <CardContent className="pt-4 space-y-4">
                     <div className="space-y-1">
                       <Label>Segmento de Mercado</Label>
                       <Input value={formData.segmento} onChange={(e) => setFormData({...formData, segmento: e.target.value})}/>
                     </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-t-2 border-t-slate-300">
                  <CardContent className="pt-4 space-y-4">
                     <div className="space-y-1">
                       <Label>Tipo de Serviço Principal</Label>
                       <Input value={formData.tipoServico} onChange={(e) => setFormData({...formData, tipoServico: e.target.value})}/>
                     </div>
                  </CardContent>
                </Card>
             </div>

             {/* BLOCO 3 - CORPO DA PROPOSTA (BLOCO A BLOCO DE TEXTO) */}
             <Card className="shadow-sm border-t-2 border-t-blue-500">
               <CardHeader className="pb-3 border-b bg-slate-50/50">
                 <CardTitle className="text-base flex justify-between items-center">
                    2. Estrutura Textual & Escopo
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600"><Settings2 className="w-3.5 h-3.5 mr-1"/> Variáveis Inteligentes</Button>
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-4 space-y-6">
                  <div className="space-y-2">
                     <div className="flex justify-between items-end">
                        <Label className="text-slate-700 font-bold">Introdução / Apresentação</Label>
                     </div>
                     <Textarea rows={3} className="resize-none font-sans" value={formData.introducao} onChange={(e) => setFormData({...formData, introducao: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-slate-700 font-bold">Escopo Operacional & Serviços Inclusos</Label>
                     <Textarea rows={4} className="font-mono text-sm resize-none border-blue-200 focus-visible:ring-blue-500 bg-blue-50/30" value={formData.escopo} onChange={(e) => setFormData({...formData, escopo: e.target.value})} />
                  </div>
               </CardContent>
             </Card>

             {/* BLOCO 4 - VALORES E CONDIÇÕES */}
             <Card className="shadow-sm border-t-2 border-t-orange-500">
               <CardHeader className="pb-3 border-b bg-slate-50/50"><CardTitle className="text-base">3. Condições Comerciais</CardTitle></CardHeader>
               <CardContent className="pt-4 space-y-6">
                  <div className="space-y-2">
                     <Label className="text-slate-700 font-bold">Condições de Faturamento & Reajuste</Label>
                     <Textarea rows={3} className="font-mono text-sm resize-none" value={formData.condicoes} onChange={(e) => setFormData({...formData, condicoes: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-slate-700 font-bold">Observações de Prazo / Validade</Label>
                     <Input value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} />
                  </div>
               </CardContent>
             </Card>

          </div>

          <div className="lg:col-span-1 space-y-4">
             {/* SIDEBAR WIDGETS */}
             <Card className="bg-slate-50 border-none shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Assistente de IA</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                   <p className="text-xs text-slate-500">Deixe a inteligência artificial revisar o escopo e melhorar o texto comercial para causar maior impacto.</p>
                   <Button variant="outline" size="sm" className="w-full text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"><PlusCircle className="w-3 h-3 mr-1"/> Melhorar Texto c/ IA</Button>
                </CardContent>
             </Card>
             
             <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vínculos & CRM</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                   <div className="border rounded bg-slate-50 p-2 opacity-60 flex flex-col items-center py-4 text-center">
                      <Briefcase className="w-6 h-6 text-slate-400 mb-1" />
                      <p className="text-xs font-semibold">Tabela de Valores</p>
                      <p className="text-[10px] text-slate-500 mt-1">Nenhuma tabela vinculada. Ela será anexada ao PDF em anexo final.</p>
                   </div>
                </CardContent>
             </Card>
          </div>
       </div>
    </div>
  );
}

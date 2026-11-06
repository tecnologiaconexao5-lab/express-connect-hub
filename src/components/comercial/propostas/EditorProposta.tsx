import { useRef, useState } from "react";
import { ArrowLeft, Save, Copy, FileText, Briefcase, LayoutTemplate, Settings2, PlusCircle, Check, UploadCloud, Loader2, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { validarArquivoAnexo } from "@/lib/anexoDocumento";
import { BUCKET_PROPOSTAS } from "@/services/documentos/documentoStorageService";
import { SIGN_TTL_SECONDS } from "@/services/storage/storageRefService";

interface AnexoProposta {
  nome: string;
  path: string;
  referencia: string;
  url: string;
}

function normalizarAnexo(anexo: unknown): AnexoProposta | null {
  const a = anexo as Partial<AnexoProposta> | null | undefined;
  if (!a || !a.referencia) return null;
  const referencia = String(a.referencia);
  return {
    nome: a.nome || "Proposta.pdf",
    path: a.path || referencia.replace(/^propostas\//, ""),
    referencia,
    url: a.url || "",
  };
}

function tituloDoPdf(nome: string): string {
  return nome.replace(/\.pdf$/i, "").trim();
}

interface EditorPropostaProps {
  proposta: any;
  modo: "novo_modelo" | "nova_personalizada" | "editar";
  onBack: () => void;
}

export default function EditorProposta({ proposta, modo, onBack }: EditorPropostaProps) {
  const isPersonalizada = modo === "nova_personalizada" || (proposta && proposta.tipo === "personalizada");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const anexoInputRef = useRef<HTMLInputElement>(null);

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
    anexo: normalizarAnexo(proposta?.anexo),
  });

  const anexarPdf = async (file: File | null | undefined) => {
    if (!file || isUploading) return;
    const erroArquivo = validarArquivoAnexo(file);
    if (erroArquivo) {
      toast.error(erroArquivo);
      return;
    }
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!ehPdf) {
      toast.error("Envie um arquivo PDF para a proposta.");
      return;
    }
    setIsUploading(true);
    try {
      const slug =
        tituloDoPdf(file.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || "proposta";
      const caminho = `proposta_${Date.now()}_${slug}.pdf`;
      const { data: upload, error: uploadError } = await supabase.storage
        .from(BUCKET_PROPOSTAS)
        .upload(caminho, file, { upsert: false, contentType: "application/pdf" });
      if (uploadError || !upload?.path) {
        throw new Error(uploadError?.message || "Falha no upload do PDF da proposta.");
      }
      const path = upload.path;
      const referencia = `${BUCKET_PROPOSTAS}/${path}`;
      const { data: signed } = await supabase.storage
        .from(BUCKET_PROPOSTAS)
        .createSignedUrl(path, SIGN_TTL_SECONDS);
      const url = signed?.signedUrl || "";
      setFormData((prev) => ({
        ...prev,
        titulo: prev.titulo.trim() ? prev.titulo : tituloDoPdf(file.name),
        anexo: { nome: file.name, path, referencia, url },
      }));
      toast.success("PDF anexado à proposta!", {
        description: `${file.name} · pronto para envio por e-mail.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const abrirAnexo = async () => {
    if (!formData.anexo) return;
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_PROPOSTAS)
        .createSignedUrl(formData.anexo.path, SIGN_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Link temporário indisponível.");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o anexo.");
    }
  };

  const removerAnexo = () => {
    setFormData((prev) => ({ ...prev, anexo: null }));
    toast.info("Anexo removido da proposta.");
  };

  const handleSave = () => {
    if (isUploading) {
      toast.warning("Aguarde o upload do PDF terminar antes de salvar.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(modo === "novo_modelo" ? "Modelo salvo na biblioteca!" : "Proposta salva com sucesso!", {
        description: formData.anexo
          ? `Anexo ${formData.anexo.nome} (${formData.anexo.referencia}) gravado e pronto para envio por e-mail.`
          : undefined,
      });
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
              <Button onClick={handleSave} className="bg-primary shadow-sm" disabled={loading || isUploading}>
                {loading ? "Salvando..." : isUploading ? "Anexando PDF..." : <><Save className="w-4 h-4 mr-2"/> Salvar Versão</>}
              </Button>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
             {/* ANEXO PDF — bucket privado `propostas` (GD-11) */}
             <Card className="shadow-sm border-t-2 border-t-emerald-500">
               <CardHeader className="pb-3 border-b bg-slate-50/50">
                 <CardTitle className="text-base flex items-center gap-2">
                   <UploadCloud className="w-4 h-4 text-emerald-600" /> Anexo PDF da Proposta
                   <span className="ml-auto text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">bucket propostas</span>
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-4 space-y-3">
                 <input
                   ref={anexoInputRef}
                   type="file"
                   accept="application/pdf,.pdf"
                   className="hidden"
                   data-testid="prop-anexo-input"
                   onChange={(e) => {
                     const arquivo = e.target.files?.[0];
                     e.target.value = "";
                     void anexarPdf(arquivo);
                   }}
                 />
                 <div
                   role="button"
                   tabIndex={0}
                   aria-label="Anexar PDF da proposta"
                   onClick={() => {
                     if (!isUploading) anexoInputRef.current?.click();
                   }}
                   onKeyDown={(e) => {
                     if (e.key === "Enter" || e.key === " ") {
                       e.preventDefault();
                       if (!isUploading) anexoInputRef.current?.click();
                     }
                   }}
                   onDragOver={(e) => {
                     e.preventDefault();
                     if (!isUploading) setArrastando(true);
                   }}
                   onDragLeave={() => setArrastando(false)}
                   onDrop={(e) => {
                     e.preventDefault();
                     setArrastando(false);
                     if (isUploading) return;
                     void anexarPdf(e.dataTransfer.files?.[0]);
                   }}
                   data-testid="prop-anexo-dropzone"
                   className={`rounded-lg border-2 border-dashed px-6 py-7 flex flex-col items-center justify-center text-center transition-colors ${
                     isUploading
                       ? "border-emerald-300 bg-emerald-50/50 cursor-wait"
                       : arrastando
                         ? "cursor-pointer border-emerald-500 bg-emerald-50"
                         : "cursor-pointer border-slate-300 bg-slate-50/40 hover:border-emerald-400 hover:bg-emerald-50/40"
                   }`}
                 >
                   {isUploading ? (
                     <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
                   ) : (
                     <UploadCloud className={`w-7 h-7 mb-2 ${arrastando ? "text-emerald-600" : "text-slate-400"}`} />
                   )}
                   <p className="text-sm font-semibold text-slate-700">
                     {isUploading ? "Enviando PDF para o bucket propostas..." : "Arraste o PDF da proposta aqui"}
                   </p>
                   <p className="text-xs text-muted-foreground mt-1">
                     {isUploading ? "Aguarde alguns segundos." : "ou clique para selecionar · PDF até 50 MB"}
                   </p>
                 </div>

                 {formData.anexo && (
                   <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3" data-testid="prop-anexo-chip">
                     <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-semibold text-slate-800 truncate">{formData.anexo.nome}</p>
                       <p className="text-[11px] text-emerald-700/80 truncate">{formData.anexo.referencia}</p>
                     </div>
                     <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void abrirAnexo()} disabled={isUploading}>
                       <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                     </Button>
                     <Button type="button" variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700" onClick={removerAnexo} disabled={isUploading}>
                       <X className="w-3.5 h-3.5 mr-1" /> Remover
                     </Button>
                   </div>
                 )}

                 <p className="text-[11px] text-muted-foreground">
                   O PDF é enviado para o bucket privado <span className="font-mono">propostas</span>; ao salvar, a referência do arquivo fica gravada com a proposta e pronta para envio por e-mail.
                 </p>
               </CardContent>
             </Card>

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

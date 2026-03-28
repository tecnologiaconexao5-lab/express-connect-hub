import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileSignature, Download, Loader2, Edit3, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ContratoPrestadorModal({
  open,
  onOpenChange,
  prestador
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  prestador: any
}) {
  const [loading, setLoading] = useState(false);
  const [modelos] = useState([
    { id: "1", nome: "Contrato Padrão Autônomo (ANTT)", tipo: "autonomo", conteudo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE AUTÔNOMO DE CARGAS\n\nCONTRATANTE: MENTORS LOGISTICA E TRANSPORTES LTDA\n\nCONTRATADO(A): {{prestador_nome}}\nCPF/CNPJ: {{prestador_cpf}}\nVEÍCULO PLACA: {{veiculo_placa}}\nCHAVE PIX: {{prestador_pix}}\n\nDATA: {{data_atual}}\n\nCláusula 1 - O CONTRATADO compromete-se a...", isDefault: true },
    { id: "2", nome: "Contrato Frota Agregada Mensal", tipo: "agregado", conteudo: "CONTRATO DE AGREGAMENTO COMERCIAL\n\nCONTRATANTE: MENTORS LOGISTICA E TRANSPORTES LTDA\n\nAgregado: {{prestador_nome}}\nCPF/CNPJ: {{prestador_cpf}}\nPlaca Associada: {{veiculo_placa}}\nPIX: {{prestador_pix}}\n\nData de Assinatura: {{data_atual}}\n\nDeclara o Contratado estar ciente das regras vigentes...", isDefault: false },
    { id: "3", nome: "Termo de Parceria Eventual", tipo: "esporadico", conteudo: "TERMO DE COMPROMISSO EVENTUAL\n\nParceiro: {{prestador_nome}}\nDocumento: {{prestador_cpf}}\nPlaca: {{veiculo_placa}}\nConta para pagamento: {{prestador_pix}}\n\nData: {{data_atual}}...", isDefault: false }
  ]);
  
  const [selectedModelo, setSelectedModelo] = useState("");
  const [content, setContent] = useState("");
  const [editMode, setEditMode] = useState(false);

  const modelosFiltrados = modelos.filter(m => m.tipo === prestador?.tipoParceiro || !prestador?.tipoParceiro);

  const handleSelectModelo = (modeloId: string) => {
    setSelectedModelo(modeloId);
    const mod = modelos.find(m => m.id === modeloId);
    if (!mod) return;

    let parsed = mod.conteudo;
    parsed = parsed.replace(/{{prestador_nome}}/g, prestador?.nomeCompleto || prestador?.nomeFantasia || "NOME NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_cpf}}/g, prestador?.cpfCnpj || "CPF/CNPJ NÃO INFORMADO");
    // Get first veiculo placa
    const placa = (prestador?.veiculos && prestador.veiculos.length > 0) ? prestador.veiculos[0].placa : "PLACA NÃO INFORMADA";
    parsed = parsed.replace(/{{veiculo_placa}}/g, placa);
    parsed = parsed.replace(/{{prestador_pix}}/g, prestador?.chavePix || "PIX NÃO INFORMADO");
    parsed = parsed.replace(/{{empresa_nome}}/g, "MENTORS LOGISTICA E TRANSPORTES LTDA");
    parsed = parsed.replace(/{{data_atual}}/g, new Date().toLocaleDateString("pt-BR"));

    setContent(parsed);
    setEditMode(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Cria a pseudo-impressão para "baixar" e já salva em supabase mock
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
               <title>Contrato - ${prestador?.nomeCompleto}</title>
               <style>
                 body { font-family: Arial, sans-serif; padding: 40px; white-space: pre-wrap; line-height: 1.6; }
                 h1 { font-size: 16px; text-align: center; margin-bottom: 20px; }
               </style>
            </head>
            <body onload="window.print();window.close()">${content}</body>
          </html>
        `);
        printWindow.document.close();
      } else {
        // Fallback for popup blockers
        const blob = new Blob([content], {type: "text/plain;charset=utf-8"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Contrato_${prestador?.nomeCompleto?.replace(/\\s/g, '_')}.txt`;
        link.click();
      }

      // Mock save to supabase
      const { error } = await supabase.from('prestadores').update({
        status: 'aprovado',
        observacoesTorre: (prestador?.observacoesTorre || '') + `\n[SISTEMA] Contrato ${modelos.find(m => m.id === selectedModelo)?.nome} gerado e ativo em ${new Date().toLocaleDateString()}.`
      }).eq('id', prestador.id);
      
      if(error) console.error(error);
      
      toast.success("Contrato gerado, salvo em Storage e vinculado com sucesso!");
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="w-5 h-5 text-primary"/> Gerar Contrato Automatizado</DialogTitle>
          <DialogDescription>
            Criação de vínculo jurídico para {prestador?.nomeCompleto} ({prestador?.tipoParceiro})
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4 overflow-hidden py-2">
           <div className="shrink-0 space-y-2">
              <p className="text-sm font-bold text-slate-700">Selecione o Modelo Base</p>
              <Select value={selectedModelo} onValueChange={handleSelectModelo}>
                 <SelectTrigger><SelectValue placeholder="Escolha um modelo inteligente..."/></SelectTrigger>
                 <SelectContent>
                    {modelosFiltrados.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                    {modelosFiltrados.length === 0 && <SelectItem value="0" disabled>Nenhum modelo para este perfil</SelectItem>}
                 </SelectContent>
              </Select>
           </div>

           {content && (
              <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-slate-50 relative">
                 <div className="flex justify-between items-center p-2 border-b bg-white">
                    <span className="text-xs font-bold text-slate-500 uppercase">Preview Inteligente do Documento</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditMode(!editMode)}>
                       {editMode ? <><Save className="w-3.5 h-3.5"/> Prender Edição</> : <><Edit3 className="w-3.5 h-3.5"/> Editar antes de gerar</>}
                    </Button>
                 </div>
                 {editMode ? (
                   <Textarea 
                     className="flex-1 border-0 rounded-none resize-none bg-white p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-0" 
                     value={content} 
                     onChange={e => setContent(e.target.value)}
                   />
                 ) : (
                   <div className="flex-1 p-6 overflow-y-auto font-serif text-sm bg-white m-2 shadow-sm whitespace-pre-wrap leading-relaxed">
                      {content}
                   </div>
                 )}
              </div>
           )}
           {!content && (
              <div className="flex-1 border-2 border-dashed rounded-md flex items-center justify-center text-slate-400 p-8 text-center text-sm">
                 Selecione um modelo no topo para iniciar a mesclagem automática com os dados cadastrais.
              </div>
           )}
        </div>
        
        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!content || loading} onClick={handleGenerate} className="gap-2 focus:ring-2 focus:ring-offset-2">
             {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
             Gerar & Ativar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

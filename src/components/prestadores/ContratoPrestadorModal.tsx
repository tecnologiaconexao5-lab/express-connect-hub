import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileSignature, Download, Loader2, Edit3, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";

const EMPRESA_NOME = "Conexão Express Transportes LTDA";
const EMPRESA_CNPJ = "42.796.040/0001-31";

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
    { id: "1", nome: "Contrato Padrão Autônomo (ANTT)", tipo: "autonomo", conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE AUTÔNOMO DE CARGAS

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

CONTRATADO(A): {{prestador_nome}}
CPF: {{prestador_cpf}}
RG: {{prestador_rg}}
ENDEREÇO: {{prestador_rua}}, {{prestador_numero}} - {{prestador_bairro}}, {{prestador_cidade}}/{{prestador_estado}} - CEP: {{prestador_cep}}
TELEFONE: {{prestador_telefone}}
WHATSAPP: {{prestador_whatsapp}}
E-MAIL: {{prestador_email}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

DADOS PARA PAGAMENTO:
Chave PIX: {{prestador_pix}}
Banco: {{prestador_banco}}

VALORES:
Valor Diária: {{valor_diaria}}
Valor KM: {{valor_km}}

DATA: {{data_atual}}

O presente contrato tem como objeto a prestação de serviços de transporte de cargas pelo Contratado, utilizando veículo próprio ou agregado, em regime de execução autônoma, nos termos da Lei 11.442/2007 (ANTT).

{{empresa_nome}} se compromete a pagar ao Contratado os valores acordados nas condições especificadas acima.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}
CNPJ: {{empresa_cnpj}}                       CPF: {{prestador_cnpj}}`, isDefault: true },
    { id: "2", nome: "Contrato Frota Agregada Mensal", tipo: "agregado", conteudo: `CONTRATO DE AGREGAMENTO COMERCIAL

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

AGREGADO: {{prestador_nome}}
CPF: {{prestador_cpf}}
ENDEREÇO: {{prestador_rua}}, {{prestador_numero}} - {{prestador_bairro}}, {{prestador_cidade}}/{{prestador_estado}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

DATA: {{data_atual}}

O Contratado declara ter conhecimento integral das normas internas da Contratante e se compromete a seguir rigorosamente os procedimentos operacionais estabelecidos.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}`, isDefault: false },
    { id: "3", nome: "Termo de Parceria Eventual", tipo: "esporadico", conteudo: `TERMO DE COMPROMISSO EVENTUAL

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

PARCEIRO: {{prestador_nome}}
CPF: {{prestador_cpf}}
VEÍCULO: {{veiculo_placa}}
CONTATO: {{prestador_telefone}} / {{prestador_whatsapp}}

DATA: {{data_atual}}

O parceiro acima identificado declara interesse em realizar operações de transporte de forma esporádica, mediante as condições comerciais acordadas em cada operação.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}`, isDefault: false },
    { id: "4", nome: "Contrato CLT", tipo: "clt", conteudo: `CONTRATO DE TRABALHO – CLT

EMPREGADOR: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

EMPREGADO: {{prestador_nome}}
CPF: {{prestador_cpf}}
RG: {{prestador_rg}}
ENDEREÇO: {{prestador_rua}}, {{prestador_numero}} - {{prestador_bairro}}, {{prestador_cidade}}/{{prestador_estado}}

FUNÇÃO: Motorista de Transporte de Cargas
SALÁRIO: {{valor_diaria}} (diaria)

DATA: {{data_atual}}

{{empresa_nome}}
_______________________________________
{{empresa_nome}}

{{prestador_nome}}
_______________________________________
EMPREGADO`, isDefault: false }
  ]);
  
  const [selectedModelo, setSelectedModelo] = useState("");
  const [content, setContent] = useState("");
  const [editMode, setEditMode] = useState(false);

  const modelosFiltrados = modelos.filter(m => m.tipo === prestador?.tipoParceiro || !prestador?.tipoParceiro);

  const getPrimeiroVeiculo = () => {
    if (prestador?.veiculos && prestador.veiculos.length > 0) {
      return prestador.veiculos[0];
    }
    return { placa: "PLACA NÃO INFORMADA", modelo: "MODELO NÃO INFORMADO", tipoVeiculo: "VEÍCULO NÃO INFORMADO" };
  };

  const handleSelectModelo = (modeloId: string) => {
    setSelectedModelo(modeloId);
    const mod = modelos.find(m => m.id === modeloId);
    if (!mod) return;

    const veiculo = getPrimeiroVeiculo();
    const endereco = prestador?.endereco || {};

    let parsed = mod.conteudo;
    parsed = parsed.replace(/{{prestador_nome}}/g, prestador?.nomeCompleto || prestador?.nomeFantasia || "NOME NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_cpf}}/g, prestador?.cpfCnpj || "CPF NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_cnpj}}/g, prestador?.cpfCnpj || "");
    parsed = parsed.replace(/{{prestador_rg}}/g, prestador?.rgIe || "RG NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_telefone}}/g, prestador?.telefone || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_whatsapp}}/g, prestador?.whatsapp || prestador?.telefone || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_email}}/g, prestador?.email || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_rua}}/g, endereco?.rua || endereco?.logradouro || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_numero}}/g, endereco?.numero || "S/N");
    parsed = parsed.replace(/{{prestador_bairro}}/g, endereco?.bairro || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_cidade}}/g, endereco?.cidade || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_estado}}/g, endereco?.estado || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_cep}}/g, endereco?.cep || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_pix}}/g, prestador?.chavePix || "NÃO INFORMADO");
    parsed = parsed.replace(/{{prestador_banco}}/g, prestador?.banco || "NÃO INFORMADO");
    parsed = parsed.replace(/{{veiculo_placa}}/g, veiculo.placa);
    parsed = parsed.replace(/{{veiculo_modelo}}/g, veiculo.modelo);
    parsed = parsed.replace(/{{veiculo_tipo}}/g, veiculo.tipoVeiculo);
    parsed = parsed.replace(/{{valor_diaria}}/g, prestador?.valorDiaria ? `R$ ${prestador.valorDiaria}` : "A DEFINIR");
    parsed = parsed.replace(/{{valor_km}}/g, prestador?.valorKm ? `R$ ${prestador.valorKm}` : "A DEFINIR");
    parsed = parsed.replace(/{{empresa_nome}}/g, EMPRESA_NOME);
    parsed = parsed.replace(/{{empresa_cnpj}}/g, EMPRESA_CNPJ);
    parsed = parsed.replace(/{{data_atual}}/g, new Date().toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' }));

    setContent(parsed);
    setEditMode(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let y = 20;
      
      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(EMPRESA_NOME, pageWidth / 2, y, { align: "center" });
      y += 10;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`CNPJ: ${EMPRESA_CNPJ}`, pageWidth / 2, y, { align: "center" });
      y += 15;
      
      // Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const titulo = modelos.find(m => m.id === selectedModelo)?.nome || "CONTRATO";
      doc.text(titulo.toUpperCase(), pageWidth / 2, y, { align: "center" });
      y += 15;
      
      // Content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(content, maxWidth);
      
      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 6;
      }
      
      // Footer
      y += 20;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(8);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")}`, margin, y);
      
      // Save
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Download
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `Contrato_${prestador?.nomeCompleto?.replace(/\s/g, '_')}.pdf`;
      link.click();
      
      // Mock save to supabase
      const { error } = await supabase.from('prestadores').update({
        status: 'aprovado',
        observacoesTorre: (prestador?.observacoesTorre || '') + `\n[SISTEMA] Contrato ${modelos.find(m => m.id === selectedModelo)?.nome} gerado e ativo em ${new Date().toLocaleDateString()}.`
      }).eq('id', prestador.id);
      
      if(error) console.error(error);
      
      toast.success("Contrato gerado em PDF e salvo com sucesso!");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
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

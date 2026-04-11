import React, { useState } from "react";
import { Receipt, FileText, Download, Printer, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLogo } from "@/hooks/useLogo";
import { toast } from "sonner";

export default function ReciboRapido() {
  const { config, getNomeFantasia, shouldShowLogo } = useLogo();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reciboParams, setReciboParams] = useState({
    tipoFavorecido: "prestador",
    nome: "",
    cpfCnpj: "",
    valor: 0,
    descricao: "",
    formaPagamento: "dinheiro",
    dataEmissao: new Date().toISOString().split('T')[0]
  });

  const handleGerarRecibo = async () => {
    try {
      setIsSubmitting(true);
      if (!reciboParams.nome.trim()) {
        toast.error("Preencha o nome do favorecido.");
        return;
      }
      if (!reciboParams.valor || reciboParams.valor <= 0) {
        toast.error("O valor do recibo deve ser maior que zero.");
        return;
      }
      if (!reciboParams.descricao.trim()) {
        toast.error("Adicione a descrição referente ao recibo.");
        return;
      }

      await new Promise(res => setTimeout(res, 800)); // Simulando API

      toast.success("Recibo gerado com sucesso!");
      setReciboParams({
        tipoFavorecido: "prestador",
        nome: "",
        cpfCnpj: "",
        valor: 0,
        descricao: "",
        formaPagamento: "dinheiro",
        dataEmissao: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      console.error("Erro ao gerar recibo", e);
      toast.error("Ocorreu um erro ao gerar o recibo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLimpar = () => {
    setReciboParams({
      tipoFavorecido: "prestador",
      nome: "",
      cpfCnpj: "",
      valor: 0,
      descricao: "",
      formaPagamento: "dinheiro",
      dataEmissao: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
             <Receipt className="w-6 h-6 text-primary" />
             Novo Recibo Rápido
          </h2>
          <p className="text-sm text-muted-foreground">Emissão ágil e profissional de recibos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulário */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-card">
             <CardTitle className="text-base">Dados do Recibo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label>Tipo de Favorecido</Label>
                  <Select value={reciboParams.tipoFavorecido} onValueChange={(v) => setReciboParams({...reciboParams, tipoFavorecido: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="cliente">Cliente</SelectItem>
                       <SelectItem value="prestador">Prestador</SelectItem>
                       <SelectItem value="fornecedor">Fornecedor</SelectItem>
                       <SelectItem value="outro">Outro (Avulso)</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label>Buscar Cadastro</Label>
                  <Input placeholder="Digite para buscar (opcional)..." className="mt-1 bg-muted/50" />
               </div>
             </div>

             <div>
               <Label>Nome Completo / Razão Social *</Label>
               <Input placeholder="Nome impresso no recibo..." className="mt-1" value={reciboParams.nome} onChange={(e) => setReciboParams({...reciboParams, nome: e.target.value})} />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>CPF / CNPJ</Label>
                 <Input placeholder="000.000.000-00" className="mt-1" value={reciboParams.cpfCnpj} onChange={(e) => setReciboParams({...reciboParams, cpfCnpj: e.target.value})} />
               </div>
               <div>
                 <Label>Valor (R$) *</Label>
                 <Input placeholder="0,00" type="number" className="mt-1 font-mono text-lg font-semibold text-primary" value={reciboParams.valor || ""} onChange={(e) => setReciboParams({...reciboParams, valor: Number(e.target.value)})} />
               </div>
             </div>

             <div>
               <Label>Referente a (Descrição dos serviços/produtos) *</Label>
               <Textarea placeholder="Ex: Pagamento referente aos serviços de transporte da OS-1029..." className="mt-1 h-24 resize-none" value={reciboParams.descricao} onChange={(e) => setReciboParams({...reciboParams, descricao: e.target.value})} />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={reciboParams.formaPagamento} onValueChange={(v) => setReciboParams({...reciboParams, formaPagamento: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="dinheiro">Dinheiro</SelectItem>
                       <SelectItem value="pix">PIX</SelectItem>
                       <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                       <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label>Data de Emissão</Label>
                  <Input type="date" value={reciboParams.dataEmissao} onChange={(e) => setReciboParams({...reciboParams, dataEmissao: e.target.value})} className="mt-1" />
               </div>
             </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
             <Button variant="outline" className="text-muted-foreground mr-auto" onClick={handleLimpar} disabled={isSubmitting}>Limpar Formulário</Button>
             <Button className="bg-primary shadow-md gap-2" onClick={handleGerarRecibo} disabled={isSubmitting}>{isSubmitting ? "Gerando..." : <><CheckCircle2 className="w-4 h-4"/> Confirmar e Gerar</>}</Button>
          </CardFooter>
        </Card>

        {/* Pré-visualização do Recibo */}
        <Card className="bg-muted/30 border border-dashed border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
              Pré-visualização do Documento
              <div className="flex gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7 text-slate-500"><Printer className="w-3.5 h-3.5"/></Button>
                <Button size="icon" variant="outline" className="h-7 w-7 text-slate-500"><Download className="w-3.5 h-3.5"/></Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <div className="w-full max-w-sm bg-white rounded-lg shadow border p-6 font-sans text-slate-800 scale-95 transform origin-top">
               <div className="text-center border-b pb-4 mb-4">
                  {shouldShowLogo('recibosPdf') && config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="w-[100px] h-auto object-contain mx-auto mb-2" />
                  ) : (
                    <div className="w-[100px] h-[40px]bg-slate-100 flex items-center justify-center mx-auto mb-2 text-xs font-bold text-slate-400">[LOGO AQUI]</div>
                  )}
                  <h3 className="font-bold text-xl uppercase tracking-widest text-slate-700">RECIBO</h3>
                  <p className="text-sm text-slate-500">Nº 202604-0012</p>
               </div>
               <div className="bg-slate-100 p-3 rounded-md mb-6 text-center">
                 <p className="text-sm text-slate-600 font-semibold">Valor</p>
                 <p className="text-2xl font-bold text-slate-800 tracking-tight">R$ <span className="font-mono">{reciboParams.valor ? reciboParams.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "---,--"}</span></p>
               </div>
               <div className="space-y-4 text-sm leading-relaxed mb-12">
                  <p className="text-justify leading-7">
                    Recebemos de <strong className="border-b border-dotted border-slate-400 inline-block px-2 align-bottom min-w-[200px] text-center">{reciboParams.nome || "______________________"}</strong>,<br/>
                    inscrito(a) no CPF/CNPJ <strong className="border-b border-dotted border-slate-400 inline-block px-2 align-bottom min-w-[150px] text-center">{reciboParams.cpfCnpj || "________________"}</strong>, 
                    a importância supra referente a <strong className="border-b border-dotted border-slate-400 inline-block w-full align-bottom mt-2 min-h-[24px] text-center">{reciboParams.descricao.substring(0, 80) || ""} {reciboParams.descricao.length > 80 ? "..." : ""}</strong>.
                  </p>
                  <p>Por ser verdade, firmo o presente aos <span className="font-semibold">{new Date(reciboParams.dataEmissao + "T12:00:00").toLocaleDateString("pt-BR")}</span>.</p>
               </div>
               <div className="text-center pt-8 border-t border-slate-300">
                  <div className="border-b border-slate-800 w-3/4 mx-auto mb-2"></div>
                  <p className="text-xs font-semibold">{getNomeFantasia()}</p>
                  <p className="text-[10px] text-slate-500">Emissor do Recibo</p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

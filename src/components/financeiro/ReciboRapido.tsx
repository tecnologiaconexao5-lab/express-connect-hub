import React from "react";
import { Receipt, FileText, Download, Printer, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLogo } from "@/hooks/useLogo";

export default function ReciboRapido() {
  const { config, getNomeFantasia, shouldShowLogo } = useLogo();
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
                  <Select defaultValue="prestador">
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
                  <Input placeholder="Digite o nome..." className="mt-1 bg-muted/50" />
               </div>
             </div>

             <div>
               <Label>Nome Completo / Razão Social</Label>
               <Input placeholder="Nome impresso no recibo..." className="mt-1" />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>CPF / CNPJ</Label>
                 <Input placeholder="000.000.000-00" className="mt-1" />
               </div>
               <div>
                 <Label>Valor (R$)</Label>
                 <Input placeholder="0,00" type="number" className="mt-1 font-mono text-lg font-semibold text-primary" />
               </div>
             </div>

             <div>
               <Label>Referente a (Descrição dos serviços/produtos)</Label>
               <Textarea placeholder="Ex: Pagamento referente aos serviços de transporte da OS-1029..." className="mt-1 h-24 resize-none" />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label>Forma de Pagamento</Label>
                  <Select defaultValue="dinheiro">
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
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="mt-1" />
               </div>
             </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
             <Button variant="outline" className="text-muted-foreground mr-auto">Limpar Formulário</Button>
             <Button className="bg-primary shadow-md gap-2"><CheckCircle2 className="w-4 h-4"/> Confirmar e Gerar</Button>
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
                 <p className="text-2xl font-bold text-slate-800 tracking-tight">R$ <span className="font-mono">---,--</span></p>
               </div>
               <div className="space-y-4 text-sm leading-relaxed mb-12">
                  <p className="text-justify">
                    Recebemos de <strong className="border-b border-dotted border-slate-400 inline-block w-48 align-bottom"></strong>,<br/>
                    inscrito(a) no CPF/CNPJ <strong className="border-b border-dotted border-slate-400 inline-block w-32 align-bottom"></strong>, 
                    a importância supra de <span className="italic text-slate-500 text-xs">(valor por extenso)</span> referente a <strong className="border-b border-dotted border-slate-400 inline-block w-full align-bottom mt-2"></strong>.
                  </p>
                  <p>Por ser verdade, firmo o presente.</p>
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

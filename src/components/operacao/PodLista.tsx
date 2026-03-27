import { useState } from "react";
import { FileCheck, Search, Download, ShieldCheck, Camera, CheckCircle, AlertTriangle, Upload, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const PodLista = () => {
   return (
     <div className="space-y-4">
       <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
         <div className="flex gap-2 flex-1 w-full max-w-2xl">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Buscar Comprovante/DACTE via OS, Motorista, Nota..." className="pl-9 h-10 w-full" />
           </div>
           <Button variant="outline" className="h-10 text-slate-600 border-dashed">Por Cliente</Button>
           <Button variant="outline" className="h-10 text-slate-600 border-dashed">Pendentes API</Button>
         </div>
         <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"><Upload className="w-4 h-4 mr-2" /> Upload em Lote CTe / Scanner</Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Detalhe Mock 1 */}
         <Card className="border-t-4 border-t-green-500 shadow-sm relative overflow-hidden">
            <CardContent className="p-0">
               <div className="flex md:flex-row flex-col h-full bg-slate-50 relative">
                  <div className="w-full md:w-1/3 bg-slate-200 border-r flex items-center justify-center p-4 min-h-[160px] relative overflow-hidden">
                     <span className="text-[10px] font-bold text-slate-400 absolute top-2 left-2 uppercase">Canhoto Original</span>
                     <img src="https://images.unsplash.com/photo-1628126235206-5260b9ea6441?auto=format&fit=crop&q=80&w=200&h=300" alt="Assinatura Borrada Fake" className="opacity-90 grayscale shadow hover:scale-110 hover:grayscale-0 transition cursor-pointer" />
                     <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-white text-[9px] text-center backdrop-blur">Geo: -23.5505, -46.6333<br/>14:32:01 — via App Parceiro</div>
                  </div>
                  <div className="w-full md:w-2/3 p-4 flex flex-col justify-between space-y-3 bg-white">
                     <div>
                       <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold text-slate-800 text-lg">OS-10450-3200</h4>
                         <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200"><CheckCircle className="w-3 h-3 mr-1"/> Validado (OK)</Badge>
                       </div>
                       <p className="text-xs text-muted-foreground mb-1"><span className="font-bold text-slate-600">Entregador:</span> Marcos Veículos</p>
                       <p className="text-xs text-muted-foreground mb-1"><span className="font-bold text-slate-600">Cliente Destino:</span> Embraer S.A (Matriz)</p>
                       <p className="text-xs text-muted-foreground"><span className="font-bold text-slate-600">Recebedor:</span> José Pereira (Portaria Sul) — Doc: Rg 12.444.111-X</p>
                     </div>
                     <div className="pt-2 border-t flex items-center justify-end gap-2">
                       <Button size="sm" variant="outline" className="h-8 text-[10px]"><Eye className="w-3 h-3 mr-1"/> Ver Full</Button>
                       <Button size="sm" variant="ghost" className="h-8 text-[10px] text-blue-600"><Download className="w-3 h-3 mr-1"/> Exportar PDF</Button>
                     </div>
                  </div>
               </div>
            </CardContent>
         </Card>

         {/* Detalhe Mock 2 */}
         <Card className="border-t-4 border-t-orange-500 shadow-sm relative overflow-hidden">
            <CardContent className="p-0">
               <div className="flex md:flex-row flex-col h-full bg-slate-50 relative">
                  <div className="w-full md:w-1/3 bg-slate-100 border-r flex items-center justify-center p-4 min-h-[160px] relative overflow-hidden flex-col gap-2">
                     <Camera className="w-8 h-8 text-slate-300"/>
                     <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Aguardando Envio de Imagem<br/>(Motorista Offline)</span>
                  </div>
                  <div className="w-full md:w-2/3 p-4 flex flex-col justify-between space-y-3 bg-white">
                     <div>
                       <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold text-slate-800 text-lg">OS-202610-8802</h4>
                         <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200"><AlertTriangle className="w-3 h-3 mr-1"/> Pendente</Badge>
                       </div>
                       <p className="text-xs text-muted-foreground mb-1"><span className="font-bold text-slate-600">Entregador:</span> Carlos Silva Agregado</p>
                       <p className="text-xs text-muted-foreground mb-1"><span className="font-bold text-slate-600">Cliente Destino:</span> Indústria ABC Paulista</p>
                       <p className="text-xs text-orange-600 bg-orange-50 p-1.5 rounded border border-orange-100 mt-2 font-medium">Motorista clicou em "Finalizar" mas sem anexo devido Falta de Sinal de 4G. Aguardando App Sinconizar Baixa Central.</p>
                     </div>
                     <div className="pt-2 border-t flex items-center gap-2">
                       <Button size="sm" className="h-8 text-[10px] bg-blue-600 hover:bg-blue-700 flex-1"><ShieldCheck className="w-3 h-3 mr-1"/> Forçar Baixa s/ Foto</Button>
                       <Button size="sm" variant="outline" className="h-8 text-[10px] text-red-600 hover:bg-red-50"><AlertTriangle className="w-3 h-3 mr-1"/> Gerar Problema</Button>
                     </div>
                  </div>
               </div>
            </CardContent>
         </Card>
         
       </div>
     </div>
   );
};

export default PodLista;

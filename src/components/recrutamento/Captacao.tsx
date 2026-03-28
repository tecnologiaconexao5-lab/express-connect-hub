import { useState } from "react";
import { Copy, Plus, MapPin, Truck, Smartphone, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function Captacao() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2"><QrCode className="w-5 h-5"/> Página Pública de Captura</CardTitle>
            <CardDescription>Compartilhe o link abaixo no WhatsApp, Facebook ou cole o QR Code nas docas para receber cadastros de novos motoristas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex gap-2">
                <Input readOnly value="https://conexoexpress.app/cadastro-prestador" className="bg-white text-slate-600 font-mono text-xs"/>
                <Button onClick={() => toast.success("Link copiado! Coloque nas suas redes sociais.")}><Copy className="w-4 h-4 mr-2"/> Copiar</Button>
             </div>
             <div className="bg-blue-50 text-blue-800 p-3 rounded text-xs">Aviso de Resposta Automática Ativado: O Candidato receberá um WhatsApp confirmando a entrada imediata na fila de triagem.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-slate-500"/> Entrada Rápida Interna</CardTitle>
            <CardDescription>Cadastre ativamente um motorista captado no telefone ou rua.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="grid grid-cols-2 gap-3">
               <div><p className="text-xs font-bold mb-1">Nome</p><Input className="h-8 text-xs"/></div>
               <div><p className="text-xs font-bold mb-1">WhatsApp</p><Input className="h-8 text-xs"/></div>
             </div>
             <div className="grid grid-cols-3 gap-3">
               <div><p className="text-xs font-bold mb-1">Tipo de Veículo</p><Input className="h-8 text-xs"/></div>
               <div><p className="text-xs font-bold mb-1">Cidade/UF Base</p><Input className="h-8 text-xs"/></div>
               <div><p className="text-xs font-bold mb-1">Experiência</p><Input className="h-8 text-xs" placeholder="Ex: 5 Anos"/></div>
             </div>
             <Button variant="outline" className="w-full text-xs font-bold gap-2 mt-2 bg-slate-50" onClick={() => toast.success("Candidato salvo com Status Interessado.")}><Plus className="w-4 h-4"/> Salvar na Fila de Talentos</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Link as LinkIcon, Mail, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  codigoRastreio: string;
}

export default function CompartilharRastreioModal({ codigoRastreio }: Props) {
  const link = `https://conexaoexpress.com.br/t/${codigoRastreio}`;
  const wpText = `Acompanhe a sua entrega em tempo real através da Conexão Express Transportes!\n📦 Cód: ${codigoRastreio}\n\nAcesse: ${link}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(wpText)}`, '_blank');
  };

  const openEmail = () => {
    window.open(`mailto:?subject=Acompanhe seu pedido ${codigoRastreio}&body=${encodeURIComponent(wpText)}`, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
          <LinkIcon className="w-4 h-4" /> Compartilhar Rastreio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Rastreamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
           <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border rounded-xl gap-2">
             <div className="w-32 h-32 bg-white border shadow-sm p-2 rounded-lg flex items-center justify-center relative">
                <QrCode className="w-24 h-24 text-slate-800" />
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] rounded-lg"></div>
             </div>
             <p className="text-xs text-muted-foreground mt-2 font-medium">Escaneie com a câmera do celular</p>
           </div>
           
           <div className="space-y-2">
             <Label>Link Público</Label>
             <div className="flex items-center gap-2">
               <Input readOnly value={link} className="bg-muted font-mono text-sm" />
               <Button variant="secondary" onClick={copyToClipboard}><Copy className="w-4 h-4"/></Button>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
             <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-semibold flex gap-2" onClick={openWhatsApp}>
               <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
             </Button>
             <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold flex gap-2" onClick={openEmail}>
               <Mail className="w-4 h-4" /> Enviar por E-mail
             </Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Send, Mail, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { enviarDocumentosFiscaisCliente } from "@/services/fiscal/focusService";

interface EnviarDocumentosClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctes: any[];
  romaneioNumero?: string;
  loteId?: string;
  clienteNome?: string;
}

export default function EnviarDocumentosClienteModal({ open, onOpenChange, ctes, romaneioNumero, loteId, clienteNome }: EnviarDocumentosClienteModalProps) {
  const [destinatarios, setDestinatarios] = useState("");
  const [cc, setCc] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const resetForm = () => {
    const destDefault = ctes[0]?.metadata?.email_cliente?.destinatarios?.[0] || "";
    setDestinatarios(destDefault);
    setAssunto(`Documentos fiscais CT-e — ${romaneioNumero ? `Romaneio ${romaneioNumero}` : loteId ? `Lote ${loteId}` : ""} — ${clienteNome || "Cliente"}`);
    setMensagem(`Prezados,\n\nSegue em anexo os documentos fiscais.\n\nRomaneio: ${romaneioNumero || "N/A"}\nQuantidade de CT-es: ${ctes.length}\nCliente: ${clienteNome || "N/A"}\n\nFicamos a disposicao para qualquer duvida.\n\nAtenciosamente,\nConexao Express`);
    setCc("");
    setResultado(null);
  };

  const handleOpen = (open: boolean) => {
    if (open) resetForm();
    onOpenChange(open);
  };

  const autorizados = ctes.filter((c) => c.status === "autorizado");
  const comXml = autorizados.filter((c) => c.metadata?.documentos_storage?.xml?.salvo);
  const comDacte = autorizados.filter((c) => c.metadata?.documentos_storage?.dacte?.salvo);
  const completos = autorizados.filter((c) => c.metadata?.documentos_storage?.xml?.salvo && c.metadata?.documentos_storage?.dacte?.salvo);
  const bloqueados = ctes.filter((c) => c.status !== "autorizado" || !c.metadata?.documentos_storage?.xml?.salvo || !c.metadata?.documentos_storage?.dacte?.salvo);

  const handleEnviar = async () => {
    if (!destinatarios.trim()) { toast.error("Informe pelo menos um destinatario."); return; }
    if (completos.length === 0) { toast.error("Nenhum CT-e com XML e DACTE salvos."); return; }

    setEnviando(true);
    try {
      const res = await enviarDocumentosFiscaisCliente({
        cteIds: completos.map((c) => c.id),
        destinatarios: destinatarios.split(",").map((s) => s.trim()).filter(Boolean),
        cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
        assunto,
        mensagem,
        romaneioNumero,
        loteId,
      });
      setResultado(res);
      if (res?.ok) toast.success(res.mensagem || "Envio registrado.");
      else toast.warning(res?.erro || res?.mensagem || "Verifique a configuracao.");
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviando(false); }
  };

  const handleMarcarManual = async () => {
    if (completos.length === 0) { toast.error("Nenhum CT-e completo."); return; }
    setEnviando(true);
    try {
      const res = await enviarDocumentosFiscaisCliente({
        cteIds: completos.map((c) => c.id),
        destinatarios: ["manual@registro.local"],
        assunto: assunto || "Envio manual registrado",
        mensagem: mensagem || "Envio manual fora do sistema.",
        romaneioNumero,
        loteId,
      });
      setResultado(res);
      toast.success("Registro manual salvo.");
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Enviar Documentos ao Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-4 gap-2">
            <Mini label="CT-es" value={ctes.length} />
            <Mini label="Autorizados" value={autorizados.length} color="text-green-600" />
            <Mini label="Completos" value={completos.length} color="text-green-600" />
            <Mini label="Bloqueados" value={bloqueados.length} color="text-red-600" />
          </div>

          {bloqueados.length > 0 && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{bloqueados.length} CT-es bloqueados. Apenas CT-es autorizados com XML e DACTE salvos serao enviados.</span>
            </div>
          )}

          <div>
            <Label className="text-xs">Destinatarios * (separados por virgula)</Label>
            <Input value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="cliente@exemplo.com" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">CC (opcional)</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="copia@exemplo.com" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Assunto</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} className="text-sm" />
          </div>

          <ScrollArea className="h-[150px] border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">CT-e</th><th className="p-2 text-center">Status</th><th className="p-2 text-center">XML</th><th className="p-2 text-center">DACTE</th><th className="p-2 text-left">Anexos</th></tr></thead>
              <tbody className="divide-y">
                {ctes.map((c) => {
                  const ds = c.metadata?.documentos_storage || {};
                  const xmlOk = ds.xml?.salvo;
                  const dacteOk = ds.dacte?.salvo;
                  return (
                    <tr key={c.id} className={xmlOk && dacteOk && c.status === "autorizado" ? "bg-green-50" : "bg-red-50"}>
                      <td className="p-2 font-medium">{c.numero || "S/N"}</td>
                      <td className="p-2 text-center"><Badge className={c.status === "autorizado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{c.status}</Badge></td>
                      <td className="p-2 text-center">{xmlOk ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                      <td className="p-2 text-center">{dacteOk ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                      <td className="p-2 text-[10px]">{xmlOk && dacteOk ? "XML + DACTE" : xmlOk ? "Apenas XML" : dacteOk ? "Apenas DACTE" : "Nenhum"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>

          {resultado && (
            <div className={`p-3 border rounded-lg text-sm ${resultado.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {resultado.mensagem || resultado.erro}
              {!resultado.envio_real && resultado.ok && (
                <p className="text-xs mt-1 text-amber-600">Configure FISCAL_EMAIL_WEBHOOK nos Supabase Secrets para envio real.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancelar</Button>
          <Button variant="ghost" size="sm" onClick={handleMarcarManual} disabled={enviando || completos.length === 0}>
            Marcar como enviado
          </Button>
          <Button onClick={handleEnviar} disabled={enviando || completos.length === 0 || !destinatarios.trim()} className="bg-blue-600 hover:bg-blue-700">
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar Documentos ({completos.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-2 rounded-lg border bg-slate-50 text-center">
      <p className={`text-lg font-bold ${color || ""}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

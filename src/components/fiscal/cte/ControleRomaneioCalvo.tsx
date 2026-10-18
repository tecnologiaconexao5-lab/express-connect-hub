import { useState, useEffect } from "react";
import { FileText, AlertTriangle, CheckCircle2, XCircle, Layers, Loader2, Mail, Clock, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { diagnosticarRomaneioCalvo, listarRomaneiosCalvo, parseEnderecoParaFormulario, type RomaneioCalvoDiagnostico, type RomaneioCalvoDiagnosticoItem } from "@/services/fiscal/romaneioCalvoService";

interface ControleRomaneioCalvoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusRomaneioLabel: Record<string, string> = {
  importado: "Importado",
  com_pendencias: "Com Pendencias",
  pronto_para_gerar_cte: "Pronto para CT-e",
  ctes_gerados: "CT-es Gerados",
  enviado_focus: "Enviado Focus",
  parcialmente_autorizado: "Parcial. Autorizado",
  autorizado: "Autorizado",
  com_rejeicoes: "Com Rejeicoes",
  documentos_salvos: "Documentos Salvos",
  concluido: "Concluido",
};

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function ControleRomaneioCalvo({ open, onOpenChange }: ControleRomaneioCalvoProps) {
  const [romaneios, setRomaneios] = useState<{ numero_romaneio: string; status: string; total_nfes: number; cliente: string; layout: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState<RomaneioCalvoDiagnostico | null>(null);
  const [romaneioSelecionado, setRomaneioSelecionado] = useState("");
  const [editEndereco, setEditEndereco] = useState<{ nfe: string; logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string; docId: string } | null>(null);
  const [savingEndereco, setSavingEndereco] = useState(false);

  const carregarRomaneios = async () => {
    setLoading(true);
    try {
      const lista = await listarRomaneiosCalvo();
      setRomaneios(lista);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) carregarRomaneios(); }, [open]);

  const abrirRomaneio = async (numero: string) => {
    setLoading(true); setRomaneioSelecionado(numero); setDiagnostico(null);
    try {
      const diag = await diagnosticarRomaneioCalvo(numero);
      setDiagnostico(diag);
      if (!diag) toast.error("Romaneio nao encontrado.");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const abrirEditarEndereco = (item: RomaneioCalvoDiagnosticoItem) => {
    // Construir texto completo para parse
    const partes = [
      item.endereco_pdf || "",
      item.municipio_entrega_pdf ? item.municipio_entrega_pdf : "",
      item.uf_entrega_pdf ? `/${item.uf_entrega_pdf}` : "",
      item.cep_entrega_pdf ? `CEP ${item.cep_entrega_pdf}` : "",
    ].filter(Boolean).join(" ");
    
    const parsed = parseEnderecoParaFormulario(partes);
    
    setEditEndereco({
      nfe: item.numero_nfe || "",
      logradouro: parsed.logradouro || item.endereco_pdf || "",
      numero: parsed.numero || "",
      complemento: "",
      bairro: parsed.bairro || "",
      municipio: parsed.municipio || item.municipio_entrega_pdf || "",
      uf: parsed.uf || item.uf_entrega_pdf || "SP",
      cep: parsed.cep || item.cep_entrega_pdf || "",
      docId: item.cte_id || "",
    });
  };

  const handleSalvarEndereco = async () => {
    if (!editEndereco) return;

    // Validacao
    if (!editEndereco.municipio || editEndereco.municipio.length < 3) {
      toast.error("Municipio deve ter pelo menos 3 letras."); return;
    }
    if (editEndereco.municipio.toUpperCase() === "SP") {
      toast.error("Municipio nao pode ser 'SP'. Informe o municipio correto."); return;
    }
    if (!editEndereco.uf || !/^[A-Z]{2}$/.test(editEndereco.uf)) {
      toast.error("UF deve ter exatamente 2 letras."); return;
    }
    if (!editEndereco.logradouro || editEndereco.logradouro.length < 5) {
      toast.error("Logradouro deve ter pelo menos 5 caracteres."); return;
    }
    if (!editEndereco.numero) {
      toast.error("Numero e obrigatorio (use S/N se nao houver)."); return;
    }
    if (!editEndereco.cep || editEndereco.cep.replace(/\D/g, "").length < 8) {
      toast.error("CEP deve ter 8 digitos."); return;
    }
    if (!editEndereco.bairro) {
      toast.error("Bairro e obrigatorio."); return;
    }
    setSavingEndereco(true);
    try {
      // Buscar documento vinculado pelo numero NF-e
      const { data: docs } = await supabase.from("fiscal_documentos_vinculados").select("id, metadata").eq("numero", editEndereco.nfe).limit(1);
      if (docs && docs.length > 0) {
        const meta = docs[0].metadata || {};
        const novoEndereco = {
          logradouro: editEndereco.logradouro || null,
          numero: editEndereco.numero || null,
          complemento: editEndereco.complemento || null,
          bairro: editEndereco.bairro || null,
          municipio: editEndereco.municipio || null,
          uf: editEndereco.uf || null,
          cep: editEndereco.cep || null,
          codigo_ibge: null,
        };
        await supabase.from("fiscal_documentos_vinculados").update({
          metadata: { ...meta, endereco_real_entrega: novoEndereco, fonte_endereco_entrega: "manual", pendente_conferencia_endereco: false },
        }).eq("id", docs[0].id);
      }
      toast.success("Endereco conferido e salvo.");
      setEditEndereco(null);
      if (romaneioSelecionado) await abrirRomaneio(romaneioSelecionado);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingEndereco(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-600" />
            Controle de Romaneios
          </DialogTitle>
        </DialogHeader>

        {loading && <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>}

        {!diagnostico ? (
          <div className="space-y-3 py-2">
            {romaneios.length === 0 && !loading ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Nenhum romaneio importado.</p>
                <p className="text-xs mt-1">Importe um PDF de romaneio e selecione o cliente/layout desejado.</p>
              </div>
            ) : (
              <div className="divide-y border rounded-md">
                {romaneios.map((r) => (
                  <div key={r.numero_romaneio} className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer" onClick={() => abrirRomaneio(r.numero_romaneio)}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-orange-500" />
                      <div>
                        <span className="font-medium">Romaneio {r.numero_romaneio}</span>
                        <p className="text-xs text-muted-foreground">{r.total_nfes} NF-es · Cliente: {r.cliente} · Layout: {r.layout}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => { setDiagnostico(null); setRomaneioSelecionado(""); }}>
              ← Voltar para lista
            </Button>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Badge variant="outline" className="font-mono text-sm">Romaneio {diagnostico.numero_romaneio}</Badge>
                <span className="text-sm text-muted-foreground ml-2">Cliente: {diagnostico.cliente}</span>
                <Badge variant="outline" className="text-xs ml-2">Layout: Calvo</Badge>
              </div>
              <Badge className={diagnostico.status_romaneio === "concluido" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                {statusRomaneioLabel[diagnostico.status_romaneio] || diagnostico.status_romaneio}
              </Badge>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <Mini label="Itens PDF" value={diagnostico.total_itens_pdf} color="text-blue-600" bg="bg-blue-50" />
              <Mini label="XMLs Cruzados" value={diagnostico.total_xmls_cruzados} color="text-green-600" bg="bg-green-50" />
              <Mini label="XMLs Faltando" value={diagnostico.total_xmls_faltando} color="text-red-600" bg="bg-red-50" />
              <Mini label="CT-es Gerados" value={diagnostico.total_ctes_gerados} color="text-blue-600" bg="bg-blue-50" />
              <Mini label="Autorizados" value={diagnostico.total_autorizados} color="text-green-600" bg="bg-green-50" />
              <Mini label="Rejeitados" value={diagnostico.total_rejeitados} color="text-red-600" bg="bg-red-50" />
              <Mini label="Processando" value={diagnostico.total_processando} color="text-amber-600" bg="bg-amber-50" />
              <Mini label="Docs Salvos" value={diagnostico.total_documentos_salvos} color="text-purple-600" bg="bg-purple-50" />
              <Mini label="Fora Romaneio" value={diagnostico.total_xmls_fora_romaneio} color="text-slate-600" bg="bg-slate-50" />
              <Mini label="Prox. Acao" value={diagnostico.proxima_acao.replace(/_/g, " ")} color="text-indigo-600" bg="bg-indigo-50" />
            </div>

            {diagnostico.total_xmls_faltando > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Existem {diagnostico.total_xmls_faltando} NF-es no romaneio sem XML importado. Gere CT-es apenas dos XMLs cruzados ou importe os faltantes.
              </div>
            )}

            <ScrollArea className="h-[350px] border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">NF-e</th>
                    <th className="p-2 text-left">Destinatario</th>
                    <th className="p-2">Caixas</th>
                    <th className="p-2">Municipio PDF</th>
                    <th className="p-2 text-left">End. PDF</th>
                    <th className="p-2 text-center">XML</th>
                    <th className="p-2 text-center">CT-e</th>
                    <th className="p-2 text-center">Docs</th>
                    <th className="p-2 text-center">Email</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {diagnostico.itens.map((item, i) => (
                    <tr key={i} className={item.xml_faltando ? "bg-red-50" : "hover:bg-slate-50"}>
                      <td className="p-2 font-medium">{item.numero_nfe || "S/N"}</td>
                      <td className="p-2 max-w-[100px] truncate">{item.nome_destinatario || "-"}</td>
                      <td className="p-2 text-center">{item.caixas || "-"}</td>
                      <td className="p-2 text-center">{item.municipio_entrega_pdf ? `${item.municipio_entrega_pdf}/${item.uf_entrega_pdf || ""}` : "-"}</td>
                      <td className="p-2 max-w-[120px] truncate text-[10px]">{item.endereco_pdf || "-"}</td>
                      <td className="p-2 text-center">
                        {item.xml_faltando ? <Badge className="bg-red-100 text-red-700 text-[10px]">XML faltando</Badge> :
                          item.xml_fora_romaneio ? <Badge className="bg-amber-100 text-amber-700 text-[10px]">Fora romaneio</Badge> :
                          <Badge className="bg-green-100 text-green-700 text-[10px]">XML cruzado</Badge>}
                      </td>
                      <td className="p-2 text-center">
                        {item.cte_id ? <Badge className="bg-blue-100 text-blue-700 text-[10px]">{item.cte_numero || "CT-e"}</Badge> : "-"}
                      </td>
                      <td className="p-2 text-center">
                        {item.xml_cte_salvo && item.dacte_salvo ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> :
                          item.xml_cte_salvo || item.dacte_salvo ? <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" /> : "-"}
                      </td>
                      <td className="p-2 text-center">
                        {item.cte_id ? (
                          item.enviado_cliente ? <Mail className="w-4 h-4 text-green-500 mx-auto" title="Enviado" /> :
                          <Clock className="w-4 h-4 text-slate-400 mx-auto" title="Pendente" />
                        ) : "-"}
                      </td>
                      <td className="p-2">
                        {item.bloqueios.length > 0 ? (
                          <div>
                            <span className="text-red-600 text-[10px]">{item.bloqueios.join("; ")}</span>
                          </div>
                        ) : item.proxima_acao === "concluido" ? (
                          <span className="text-green-600 text-[10px]">OK</span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">{item.proxima_acao.replace(/_/g, " ")}</span>
                        )}
                        {(item.proxima_acao === "conferir_endereco" || item.bloqueios.some((b) => b.includes("Endereco") || b.includes("Destino"))) && item.xml_importado && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-1 mt-0.5" onClick={() => abrirEditarEndereco(item)}>
                            <Pencil className="w-3 h-3 mr-0.5" />Conferir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal Edicao Endereco */}
      <Dialog open={!!editEndereco} onOpenChange={(o) => { if (!o) setEditEndereco(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Conferir Endereco Real — NF-e {editEndereco?.nfe}
            </DialogTitle>
          </DialogHeader>
          {editEndereco && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={editEndereco.logradouro} onChange={(e) => setEditEndereco((p) => ({ ...p!, logradouro: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Numero</Label>
                    <Input value={editEndereco.numero} onChange={(e) => setEditEndereco((p) => ({ ...p!, numero: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Complemento</Label>
                    <Input value={editEndereco.complemento} onChange={(e) => setEditEndereco((p) => ({ ...p!, complemento: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={editEndereco.bairro} onChange={(e) => setEditEndereco((p) => ({ ...p!, bairro: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Municipio *</Label>
                    <Input value={editEndereco.municipio} onChange={(e) => setEditEndereco((p) => ({ ...p!, municipio: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">UF *</Label>
                    <Input value={editEndereco.uf} onChange={(e) => setEditEndereco((p) => ({ ...p!, uf: e.target.value.toUpperCase() }))} maxLength={2} className="h-8 text-sm uppercase" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">CEP</Label>
                  <Input value={editEndereco.cep} onChange={(e) => setEditEndereco((p) => ({ ...p!, cep: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEndereco(null)}>Cancelar</Button>
            <Button onClick={handleSalvarEndereco} disabled={savingEndereco}>
              {savingEndereco ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salvar Conferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Mini({ label, value, color, bg }: { label: string; value: any; color: string; bg: string }) {
  return (
    <div className={`p-2 rounded-lg border ${bg}`}>
      <p className={`text-sm font-bold ${color}`}>{typeof value === "number" ? value : value}</p>
      <p className={`text-[10px] ${color} opacity-70`}>{label}</p>
    </div>
  );
}

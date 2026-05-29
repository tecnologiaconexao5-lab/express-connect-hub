import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, FileText, History, Code, SearchX, Download, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import MdfeTimeline from "./MdfeTimeline";

interface MdfeDetailsProps {
  mdfe: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function MdfeDetails({ mdfe, open, onOpenChange, defaultTab = "resumo" }: MdfeDetailsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (open && mdfe?.id && activeTab === "logs") {
      fetchLogs();
    }
  }, [open, mdfe?.id, activeTab]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("fiscal_logs")
        .select("*")
        .eq("documento_tipo", "MDFE")
        .eq("documento_id", mdfe.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!mdfe) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Autorizado":
      case "Encerrado":
        return <Badge className="bg-green-50 text-green-700 border-green-200">{status}</Badge>;
      case "Rejeitado":
      case "Cancelado":
        return <Badge className="bg-red-50 text-red-700 border-red-200">{status}</Badge>;
      case "Em Processamento":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">{status}</Badge>;
      case "Rascunho":
      default:
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">{status || "Rascunho"}</Badge>;
    }
  };

  const metadata = mdfe.metadata || {};
  const placa = mdfe.veiculo_placa || metadata.veiculo_placa;
  const motorista = mdfe.motorista_nome || metadata.motorista_nome;
  const ufOrigem = mdfe.uf_origem || metadata.uf_origem;
  const ufDestino = mdfe.uf_destino || metadata.uf_destino;
  const valorCarga = mdfe.valor || metadata.valor_carga || 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-full sm:w-[600px] rounded-none">
        <DrawerHeader className="border-b bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Truck className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold">
                  MDF-e Nº {mdfe.numero || "Não gerado"}
                </DrawerTitle>
                <DrawerDescription className="text-xs font-mono mt-1 text-slate-500">
                  {mdfe.chave_acesso || "Chave de acesso pendente"}
                </DrawerDescription>
              </div>
            </div>
            <div>
              {getStatusBadge(mdfe.status)}
            </div>
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100/50">
              <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
              <TabsTrigger value="xml" className="text-xs">XML</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* ABA: RESUMO */}
            <TabsContent value="resumo" className="mt-0 space-y-6">
              {mdfe.motivo_rejeicao && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex gap-3 items-start">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-red-800">Motivo da Rejeição</h4>
                    <p className="text-sm text-red-700 mt-1">{mdfe.motivo_rejeicao}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</h4>
                  <div className="font-medium">{getStatusBadge(mdfe.status)}</div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data de Emissão</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {mdfe.data_emissao ? new Date(mdfe.data_emissao).toLocaleString() : "-"}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {mdfe.clientes?.nome_fantasia || mdfe.clientes?.razao_social || "Não vinculado"}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">OS Vinculada</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {mdfe.ordens_servico?.numero || "Nenhuma OS"}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Filial Responsável</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {mdfe.filiais?.nome || "-"}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Protocolo SEFAZ</h4>
                  <div className="text-sm font-mono text-slate-800 break-all">
                    {mdfe.protocolo || "-"}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">UF Origem / Destino</h4>
                  <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    {ufOrigem || "-"} <span className="text-slate-400 text-xs">→</span> {ufDestino || "-"}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor da Carga</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {fmtFin(valorCarga)}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Veículo (Placa)</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {placa || "-"}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motorista</h4>
                  <div className="text-sm font-medium text-slate-800">
                    {motorista || "-"}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ABA: TIMELINE */}
            <TabsContent value="timeline" className="mt-0">
              <MdfeTimeline mdfeId={mdfe.id} />
            </TabsContent>

            {/* ABA: XML */}
            <TabsContent value="xml" className="mt-0 h-full">
              {mdfe.xml_url ? (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-lg text-center h-full">
                  <div className="bg-green-100 p-4 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">XML Autorizado</h3>
                  <p className="text-sm text-slate-600 mb-6 max-w-sm">O arquivo XML deste manifesto eletrônico foi gerado e autorizado com sucesso.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm" onClick={() => window.open(mdfe.xml_url, "_blank")}>
                      <Code className="w-4 h-4 mr-2" /> Download XML
                    </Button>
                    {mdfe.pdf_url && (
                      <Button variant="outline" onClick={() => window.open(mdfe.pdf_url, "_blank")}>
                        <FileText className="w-4 h-4 mr-2" /> Imprimir DAMDFE
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200 mt-4 h-full">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <SearchX className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">XML Indisponível</p>
                  <p className="text-xs mt-1 text-slate-500 text-center max-w-[250px]">O arquivo XML ainda não foi gerado ou o MDF-e não foi autorizado.</p>
                </div>
              )}
            </TabsContent>

            {/* ABA: LOGS */}
            <TabsContent value="logs" className="mt-0">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm">Buscando logs de integração...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <div className="bg-slate-100 p-3 rounded-full mb-3">
                    <History className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Nenhum log técnico encontrado.</p>
                  <p className="text-xs mt-1 text-slate-500">Comunicações com APIs (Focus NFe) serão listadas aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] overflow-hidden">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                        <span className="text-purple-400 font-bold">[{log.level || "INFO"}] {log.acao}</span>
                        <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="break-all whitespace-pre-wrap text-slate-400 max-h-40 overflow-y-auto custom-scrollbar">
                        {log.mensagem}
                        {log.payload && (
                          <div className="mt-2 text-slate-500 border-t border-slate-800 pt-2">
                            Payload: {JSON.stringify(log.payload, null, 2)}
                          </div>
                        )}
                        {log.resposta && (
                          <div className="mt-2 text-green-700/80 border-t border-slate-800 pt-2">
                            Resposta: {JSON.stringify(log.resposta, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        <DrawerFooter className="border-t pt-4 pb-6 bg-slate-50">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Fechar Painel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Download, Terminal, Info, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import CteTimeline from "./CteTimeline";
import { Badge } from "@/components/ui/badge";

interface CteDetailsProps {
  cte: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function CteDetails({ cte, open, onOpenChange, defaultTab = "resumo" }: CteDetailsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (open && cte?.id) {
      fetchLogs();
    } else {
      setLogs([]);
    }
  }, [open, cte]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("fiscal_logs")
        .select("*")
        .eq("entidade_tipo", "CTE")
        .eq("entidade_id", cte.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!cte) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:max-w-[600px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">CT-e {cte.numero || "S/N"}</SheetTitle>
              <SheetDescription className="font-mono text-xs mt-1">
                {cte.chave_acesso || "Chave não gerada"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 border-b">
            <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0 gap-6">
              <TabsTrigger value="resumo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <Info className="w-4 h-4 mr-2" /> Resumo
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <History className="w-4 h-4 mr-2" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="xml" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> XML / DACTE
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 shadow-none">
                <Terminal className="w-4 h-4 mr-2" /> Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* Aba Resumo */}
            <TabsContent value="resumo" className="m-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Status Atual</span>
                  <div>
                    <Badge variant="outline" className="font-medium bg-slate-50">{cte.status || "Rascunho"}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Data de Emissão</span>
                  <div className="text-sm font-medium">
                    {cte.data_emissao ? new Date(cte.data_emissao).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Valor Total</span>
                  <div className="text-sm font-medium">{fmtFin(cte.valor)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Protocolo</span>
                  <div className="text-sm font-mono">{cte.protocolo || "-"}</div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Cliente (Tomador)</span>
                  <div className="text-sm font-medium">
                    {cte.clientes?.nome_fantasia || cte.clientes?.razao_social || "Não vinculado"}
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Ordem de Serviço</span>
                  <div className="text-sm font-medium">
                    {cte.ordens_servico?.numero || "Nenhuma OS vinculada"}
                  </div>
                </div>
                {cte.motivo_rejeicao && (
                  <div className="col-span-2 space-y-1 mt-2 p-3 bg-red-50 border border-red-100 rounded-md">
                    <span className="text-xs font-semibold text-red-700">Motivo da Rejeição / Cancelamento</span>
                    <div className="text-sm text-red-600">{cte.motivo_rejeicao}</div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Aba Timeline */}
            <TabsContent value="timeline" className="m-0">
              <CteTimeline cteId={cte.id} />
            </TabsContent>

            {/* Aba XML */}
            <TabsContent value="xml" className="m-0 space-y-4">
              {cte.xml_url || cte.pdf_url ? (
                <div className="flex flex-col gap-3">
                  {cte.xml_url && (
                    <Button variant="outline" className="justify-start h-12">
                      <Download className="w-4 h-4 mr-3 text-orange-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Download XML Autorizado</span>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{cte.xml_url}</span>
                      </div>
                    </Button>
                  )}
                  {cte.pdf_url && (
                    <Button variant="outline" className="justify-start h-12">
                      <Download className="w-4 h-4 mr-3 text-red-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Download DACTE (PDF)</span>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{cte.pdf_url}</span>
                      </div>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground">
                  <FileSpreadsheet className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Arquivos não disponíveis</p>
                  <p className="text-xs text-center mt-1 max-w-[250px]">O XML e o DACTE estarão disponíveis aqui após a autorização do documento na Sefaz.</p>
                </div>
              )}
            </TabsContent>

            {/* Aba Logs */}
            <TabsContent value="logs" className="m-0 space-y-4">
              {loadingLogs ? (
                <div className="text-sm text-center text-muted-foreground p-4">Buscando logs de integração...</div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Terminal className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Nenhum log técnico encontrado</p>
                  <p className="text-xs mt-1">Requisições via Focus NFe aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-slate-950 text-slate-300 p-3 rounded-md text-xs font-mono overflow-hidden">
                      <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                        <span className={`font-semibold ${log.status_code >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                          [{log.status_code || "INFO"}] {log.acao}
                        </span>
                        <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {log.request && <div><span className="text-slate-500">REQ:</span> {JSON.stringify(log.request)}</div>}
                        {log.response && <div className="text-slate-400"><span className="text-slate-500">RES:</span> {JSON.stringify(log.response)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

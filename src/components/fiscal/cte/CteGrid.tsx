import { useState, useMemo } from "react";
import {
  FileSpreadsheet, Eye, Printer, Download, Search, History,
  ChevronLeft, ChevronRight, Send, RefreshCw, Layers, ListChecks,
  FileText, MapPin, AlertTriangle, Filter, CheckCircle2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CteGridProps {
  ctes: any[];
  loading: boolean;
  onAction?: (action: string, cte: any) => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

const ITEMS_PER_PAGE = 15;

export default function CteGrid({ ctes, loading, onAction }: CteGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todas");
  const [pendenciaFilter, setPendenciaFilter] = useState("todas");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCtes = useMemo(() => {
    return ctes.filter((cte) => {
      const meta = cte.metadata || {};

      if (statusFilter !== "todos" && cte.status !== statusFilter) return false;
      if (origemFilter === "os" && !cte.ordem_servico_id) return false;
      if (origemFilter === "romaneio" && meta.origem_cte !== "romaneio_faturamento") return false;
      if (pendenciaFilter === "com_pendencia" && meta.pronto_para_emissao !== false) return false;
      if (pendenciaFilter === "sem_pendencia" && meta.pronto_para_emissao === false) return false;
      if (pendenciaFilter === "cfop_pendente") {
        const validacoes = meta.validacoes_pendentes || [];
        if (!validacoes.some((v: any) => v.campo === "carga.cfop" || v.mensagem?.includes("CFOP"))) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const numero = cte.numero?.toLowerCase() || "";
        const chave = cte.chave_acesso?.toLowerCase() || "";
        const tomador = (cte.clientes?.nome_fantasia || cte.clientes?.razao_social || meta.tomador_nome || meta.cliente_nome || meta.payload_focus?.tomador?.nome || "").toLowerCase();
        const romaneio = (meta.romaneio_numero || "").toLowerCase();
        const nfe = (meta.nfe_numero || "").toLowerCase();
        const destino = (meta.payload_focus?.destino?.cidade || meta.endereco_real_entrega_usado?.municipio || "").toLowerCase();
        const os = cte.ordens_servico?.numero?.toLowerCase() || "";

        return numero.includes(term) || chave.includes(term) || tomador.includes(term)
          || romaneio.includes(term) || nfe.includes(term) || destino.includes(term) || os.includes(term);
      }

      return true;
    });
  }, [ctes, searchTerm, statusFilter, origemFilter, pendenciaFilter]);

  const totalPages = Math.ceil(filteredCtes.length / ITEMS_PER_PAGE) || 1;
  const paginatedCtes = filteredCtes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAction = (action: string, cte: any) => {
    if (onAction) onAction(action, cte);
    else toast.info(`Ação "${action}" para o CT-e ${cte.numero || ""} em desenvolvimento.`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Autorizado": case "Encerrado":
        return <Badge className="bg-green-50 text-green-700 border-green-200" variant="outline">{status}</Badge>;
      case "Rejeitado": case "Cancelado":
        return <Badge className="bg-red-50 text-red-700 border-red-200" variant="outline">{status}</Badge>;
      case "processando": case "Em Processamento":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200" variant="outline">{status}</Badge>;
      case "erro_emissao":
        return <Badge className="bg-red-50 text-red-700 border-red-200" variant="outline">Erro Emissao</Badge>;
      case "rascunho":
      default:
        return <Badge className="bg-gray-50 text-gray-700 border-gray-200" variant="outline">{status || "Rascunho"}</Badge>;
    }
  };

  const isRomaneioCalvo = (meta: any) => {
    return meta.origem_cte === "romaneio_faturamento" && meta.romaneio_numero;
  };

  const getTomadorDisplay = (cte: any) => {
    const meta = cte.metadata || {};
    const nome = cte.clientes?.nome_fantasia
      || cte.clientes?.razao_social
      || meta.tomador_nome
      || meta.cliente_nome
      || meta.payload_focus?.tomador?.nome;
    if (nome) return nome;
    if (isRomaneioCalvo(meta)) return "CALVO COML IMP. E EXP. LTDA.";
    return "-";
  };

  const getOrigemDisplay = (cte: any) => {
    const meta = cte.metadata || {};
    const pf = meta.payload_focus || {};
    let origemCidade = pf.origem?.cidade || meta.origem_municipio || "";
    let origemUf = pf.origem?.uf || meta.origem_uf || "";
    if (!origemCidade && isRomaneioCalvo(meta)) {
      origemCidade = "GUARULHOS";
      origemUf = "SP";
    }

    if (cte.ordem_servico_id) {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-green-50 text-green-700 text-[10px]">OS {cte.ordens_servico?.numero || cte.ordem_servico_id?.slice(0, 8)}</Badge>
          {origemCidade && <span className="text-[10px] text-slate-600">{origemCidade}{origemUf ? `/${origemUf}` : ""}</span>}
        </div>
      );
    }
    if (meta.origem_cte === "romaneio_faturamento") {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-blue-50 text-blue-700 text-[10px]">Romaneio</Badge>
          {origemCidade && <span className="text-[10px] text-slate-600">{origemCidade}{origemUf ? `/${origemUf}` : ""}</span>}
        </div>
      );
    }
    return <span className="text-xs text-slate-400">-</span>;
  };

  const getPendenciasDisplay = (cte: any) => {
    const meta = cte.metadata || {};
    const validacoes = meta.validacoes_pendentes || [];
    const erros = validacoes.filter((v: any) => v.severidade === "erro");
    if (erros.length === 0) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[10px] text-red-600">{erros.length}</span>
      </div>
    );
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4 pt-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Conhecimentos de Transporte
          </CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <div className="relative w-full md:w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar CT-e, NF-e, romaneio..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-background text-xs h-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[120px] bg-background h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="processando">Processando</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="erro_emissao">Erro Emissao</SelectItem>
                <SelectItem value="Autorizado">Autorizado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={(v) => { setOrigemFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px] bg-background h-8 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas origens</SelectItem>
                <SelectItem value="os">Com OS</SelectItem>
                <SelectItem value="romaneio">Romaneio/Faturamento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pendenciaFilter} onValueChange={(v) => { setPendenciaFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px] bg-background h-8 text-xs"><SelectValue placeholder="Pendências" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="sem_pendencia">Sem pendência</SelectItem>
                <SelectItem value="com_pendencia">Com pendência</SelectItem>
                <SelectItem value="cfop_pendente">CFOP pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Nº CT-e</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Romaneio</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">NF-e</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Tomador</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Origem</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Destino</TableHead>
                <TableHead className="font-semibold text-right whitespace-nowrap text-xs">Valor</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-xs">Status</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap text-xs">Pend.</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginatedCtes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48 text-center bg-blue-50/50">
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-6 rounded-lg border border-dashed border-blue-200 bg-white shadow-sm max-w-lg mx-auto">
                      <div className="bg-blue-100 p-3 rounded-full mb-4"><FileSpreadsheet className="w-8 h-8 text-blue-600" /></div>
                      <p className="text-lg font-semibold text-blue-900 mb-1">Central Fiscal Enterprise (CT-e)</p>
                      <p className="text-sm mb-4">Nenhum CT-e encontrado.</p>
                      {searchTerm || statusFilter !== "todos" ? (
                        <p className="text-xs mt-2 text-orange-600 font-medium">Tente remover os filtros.</p>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCtes.map((c, i) => {
                  const meta = c.metadata || {};
                  const destino = meta.payload_focus?.destino?.cidade || meta.endereco_real_entrega_usado?.municipio || "-";
                  const destinoUf = meta.payload_focus?.destino?.uf || meta.endereco_real_entrega_usado?.uf || "";
                  const validacoes = meta.validacoes_pendentes || [];
                  const erros = validacoes.filter((v: any) => v.severidade === "erro");
                  const temErro = erros.length > 0;

                  return (
                    <TableRow key={c.id || i} className={`hover:bg-muted/30 transition-colors ${temErro ? "bg-red-50/30" : ""}`}>
                      <TableCell className="font-semibold text-blue-700 whitespace-nowrap text-xs">{c.numero || "S/N"}</TableCell>
                      <TableCell className="text-xs">
                        {meta.romaneio_numero ? (
                          <Badge variant="outline" className="text-[10px] font-mono">{meta.romaneio_numero}</Badge>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {meta.nfe_numero || <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[120px] truncate" title={getTomadorDisplay(c)}>
                        {getTomadorDisplay(c)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{getOrigemDisplay(c)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {destino !== "-" ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{destino}{destinoUf ? `/${destinoUf}` : ""}</span>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap text-xs">{fmtFin(c.valor || 0)}</TableCell>
                      <TableCell className="whitespace-nowrap">{getStatusBadge(c.status)}</TableCell>
                      <TableCell className="text-center">{getPendenciasDisplay(c)}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Detalhes" onClick={() => handleAction("Detalhes", c)}><Eye className="w-3.5 h-3.5" /></Button>
                          {meta.payload_focus && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Prévia" onClick={() => handleAction("Previa", c)}><Printer className="w-3.5 h-3.5" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Eventos" onClick={() => handleAction("Eventos", c)}><History className="w-3.5 h-3.5" /></Button>
                          {c.status === "rascunho" && meta.pronto_para_emissao && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Enviar Focus" onClick={() => handleAction("EnviarFocus", c)}><Send className="w-3.5 h-3.5" /></Button>
                          )}
                          {["processando", "rejeitado", "erro_emissao"].includes(c.status) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Consultar Focus" onClick={() => handleAction("ConsultarFocus", c)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                          )}
                          {(meta.rateio?.lote_id || meta.lote_id) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600" title="Assistente Lote" onClick={() => handleAction("AssistenteLote", c)}><ListChecks className="w-3.5 h-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredCtes.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a{" "}
              <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCtes.length)}</span> de{" "}
              <span className="font-medium">{filteredCtes.length}</span> registros
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="text-xs font-medium">Página {currentPage} de {totalPages}</div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

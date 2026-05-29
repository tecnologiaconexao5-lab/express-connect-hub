import { useState, useMemo } from "react";
import { FileSpreadsheet, Eye, Printer, Download, Search, History, ChevronLeft, ChevronRight } from "lucide-react";
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

const ITEMS_PER_PAGE = 10;

export default function CteGrid({ ctes, loading, onAction }: CteGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCtes = useMemo(() => {
    return ctes.filter((cte) => {
      // Filtro de status
      if (statusFilter !== "todos" && cte.status !== statusFilter) return false;
      
      // Filtro de busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const numero = cte.numero?.toLowerCase() || "";
        const chave = cte.chave_acesso?.toLowerCase() || "";
        const tomador = cte.clientes?.nome_fantasia?.toLowerCase() || cte.clientes?.razao_social?.toLowerCase() || "";
        const os = cte.ordens_servico?.numero?.toLowerCase() || "";
        
        return numero.includes(term) || chave.includes(term) || tomador.includes(term) || os.includes(term);
      }
      
      return true;
    });
  }, [ctes, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredCtes.length / ITEMS_PER_PAGE) || 1;
  const paginatedCtes = filteredCtes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAction = (action: string, cte: any) => {
    if (onAction) {
      onAction(action, cte);
    } else {
      toast.info(`Ação "${action}" para o CT-e ${cte.numero || ""} em desenvolvimento.`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Autorizado":
      case "Encerrado":
        return <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" variant="outline">{status}</Badge>;
      case "Rejeitado":
      case "Cancelado":
        return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100" variant="outline">{status}</Badge>;
      case "Em Processamento":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" variant="outline">{status}</Badge>;
      case "Rascunho":
      default:
        return <Badge className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100" variant="outline">{status || "Rascunho"}</Badge>;
    }
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4 pt-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Conhecimentos de Transporte
          </CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar CT-e, chave, OS..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-background"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Em Processamento">Em Processamento</SelectItem>
                <SelectItem value="Autorizado">Autorizado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
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
                <TableHead className="font-semibold whitespace-nowrap">Nº CT-e</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Tomador (Cliente)</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">OS Vinculada</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data Emissão</TableHead>
                <TableHead className="font-semibold text-right whitespace-nowrap">Valor</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Carregando registros...
                  </TableCell>
                </TableRow>
              ) : paginatedCtes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center bg-blue-50/50">
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-6 rounded-lg border border-dashed border-blue-200 bg-white shadow-sm max-w-lg mx-auto">
                      <div className="bg-blue-100 p-3 rounded-full mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-lg font-semibold text-blue-900 mb-1">Central Fiscal Enterprise (CT-e)</p>
                      <p className="text-sm mb-4">Nenhum Conhecimento de Transporte encontrado no banco de dados real.</p>
                      <div className="bg-slate-50 p-3 text-xs text-slate-500 rounded border border-slate-100 w-full">
                        ℹ️ <strong>Nota Visual:</strong> Os botões de ação ("Ver Detalhes", "XML/DACTE", "Eventos Fiscais" e "Download") aparecerão individualmente em cada linha da tabela assim que houver registros.
                      </div>
                      {searchTerm || statusFilter !== "todos" ? (
                        <p className="text-xs mt-4 text-orange-600 font-medium">Tente remover os filtros para ver resultados.</p>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCtes.map((c, i) => (
                  <TableRow key={c.id || i} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-blue-700 whitespace-nowrap">{c.numero || "-"}</TableCell>
                    <TableCell className="text-sm font-medium">
                      <div className="flex flex-col">
                        <span>{c.clientes?.nome_fantasia || c.clientes?.razao_social || "-"}</span>
                        {c.chave_acesso && (
                          <span className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]" title={c.chave_acesso}>
                            Chave: {c.chave_acesso}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {c.ordens_servico?.numero || "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {c.data_emissao ? new Date(c.data_emissao).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{fmtFin(c.valor || 0)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Ver Detalhes" onClick={() => handleAction("Detalhes", c)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" title="Visualizar XML" onClick={() => handleAction("XML", c)}>
                          <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-100" title="Imprimir DACTE" onClick={() => handleAction("DACTE", c)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" title="Eventos Fiscais" onClick={() => handleAction("Eventos", c)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="Baixar Arquivos" onClick={() => handleAction("Download", c)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Paginação */}
        {!loading && filteredCtes.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCtes.length)}</span> de <span className="font-medium">{filteredCtes.length}</span> registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-xs font-medium">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

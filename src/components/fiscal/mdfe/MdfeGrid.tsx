import { useState, useMemo } from "react";
import { Truck, Eye, Printer, Download, Search, History, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface MdfeGridProps {
  mdfes: any[];
  loading: boolean;
  onAction?: (action: string, mdfe: any) => void;
}

const ITEMS_PER_PAGE = 10;

export default function MdfeGrid({ mdfes, loading, onAction }: MdfeGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredMdfes = useMemo(() => {
    return mdfes.filter((mdfe) => {
      // Filtro de status
      if (statusFilter !== "todos" && mdfe.status !== statusFilter) return false;
      
      // Filtro de busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const numero = mdfe.numero?.toLowerCase() || "";
        const chave = mdfe.chave_acesso?.toLowerCase() || "";
        const motorista = mdfe.motorista_nome?.toLowerCase() || "";
        const veiculo = mdfe.veiculo_placa?.toLowerCase() || "";
        const uf = mdfe.uf_destino?.toLowerCase() || "";
        
        return numero.includes(term) || chave.includes(term) || motorista.includes(term) || veiculo.includes(term) || uf.includes(term);
      }
      
      return true;
    });
  }, [mdfes, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredMdfes.length / ITEMS_PER_PAGE) || 1;
  const paginatedMdfes = filteredMdfes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAction = (action: string, mdfe: any) => {
    if (onAction) {
      onAction(action, mdfe);
    } else {
      toast.info(`Ação "${action}" para o MDF-e ${mdfe.numero || ""} em desenvolvimento.`);
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
      case "Aberto":
      default:
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" variant="outline">{status || "Aberto"}</Badge>;
    }
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4 pt-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Manifestos de Documentos Fiscais
          </CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar MDF-e, chave, placa..."
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
                <SelectItem value="Aberto">Aberto (Rascunho)</SelectItem>
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
                <TableHead className="font-semibold whitespace-nowrap">Nº MDF-e</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Origem / Destino</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Veículo / Motorista</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data Emissão</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Carregando manifestos...
                  </TableCell>
                </TableRow>
              ) : paginatedMdfes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Truck className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">Nenhum MDF-e encontrado.</p>
                      {searchTerm || statusFilter !== "todos" ? (
                        <p className="text-xs mt-1">Tente remover os filtros para ver mais resultados.</p>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMdfes.map((c, i) => (
                  <TableRow key={c.id || i} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-purple-700 whitespace-nowrap">
                      {c.numero || "-"}
                      {c.chave_acesso && (
                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]" title={c.chave_acesso}>
                          {c.chave_acesso}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{c.uf_origem || "N/A"}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span>{c.uf_destino || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{c.veiculo_placa || "Sem placa"}</span>
                        <span className="text-muted-foreground truncate max-w-[150px]">{c.motorista_nome || "Sem motorista"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {c.data_emissao ? new Date(c.data_emissao).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" title="Ver Detalhes" onClick={() => handleAction("Detalhes", c)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" title="Visualizar XML" onClick={() => handleAction("XML", c)}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-100" title="Imprimir DAMDFE" onClick={() => handleAction("DAMDFE", c)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Eventos Fiscais" onClick={() => handleAction("Eventos", c)}>
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
        {!loading && filteredMdfes.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredMdfes.length)}</span> de <span className="font-medium">{filteredMdfes.length}</span> registros
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

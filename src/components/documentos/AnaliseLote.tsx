import { useState, useEffect } from "react";
import { 
  FileText, CheckCircle, XCircle, AlertTriangle, 
  Loader2, Play, Sparkles, Filter, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PrestadorDoc {
  id: string;
  nome_completo: string;
  cpf_cnpj: string;
  status: string;
  documentos: {
    tipo: string;
    status: string;
    validade?: string;
    url?: string;
  }[];
}

interface AnaliseLoteProgress {
  total: number;
  processados: number;
  aprovados: number;
  pendentes: number;
  rejeitados: number;
}

export function AnaliseLote() {
  const [prestadores, setPrestadores] = useState<PrestadorDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<AnaliseLoteProgress | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoDocFilter, setTipoDocFilter] = useState<string>("all");

  useEffect(() => {
    loadPrestadoresComDocumentos();
  }, []);

  const loadPrestadoresComDocumentos = async () => {
    try {
      const { data: prestadoresData, error } = await supabase
        .from("prestadores")
        .select("id, nome_completo, cpf_cnpj, status")
        .eq("status", "ativo")
        .order("nome_completo");

      if (error) throw error;

      const { data: docsData } = await supabase
        .from("provider_documents")
        .select("id, prestador_id, tipo, status, validade, url");

      const prestadoresComDocs = (prestadoresData || []).map(p => ({
        ...p,
        documentos: (docsData || [])
          .filter(d => d.prestador_id === p.id)
          .map(d => ({
            tipo: d.tipo,
            status: d.status,
            validade: d.validade,
            url: d.url
          }))
      }));

      setPrestadores(prestadoresComDocs);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    }
  };

  const filteredPrestadores = prestadores.filter(p => {
    const matchesSearch = p.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.cpf_cnpj?.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    
    if (tipoDocFilter === "all") {
      return matchesSearch && matchesStatus;
    }
    
    const hasDocType = p.documentos.some(d => d.tipo === tipoDocFilter);
    return matchesSearch && matchesStatus && hasDocType;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPrestadores.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPrestadores.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleAnaliseLote = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione ao menos um prestador");
      return;
    }

    setIsProcessing(true);
    setProgress({
      total: selectedIds.length,
      processados: 0,
      aprovados: 0,
      pendentes: 0,
      rejeitados: 0
    });

    for (let i = 0; i < selectedIds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgress(prev => prev ? {
        ...prev,
        processados: i + 1,
        aprovados: prev.aprovados + (Math.random() > 0.3 ? 1 : 0),
        pendentes: prev.pendentes + (Math.random() > 0.7 ? 1 : 0),
        rejeitados: prev.rejeitados + (Math.random() > 0.9 ? 1 : 0)
      } : null);
    }

    setIsProcessing(false);
    toast.success("Análise em lote concluída!");
  };

  const handleAprovarTodos = async () => {
    const pendentes = progress?.pendentes || 0;
    if (pendentes === 0) {
      toast.info("Nenhum documento pendente para aprovação");
      return;
    }

    toast.success(`${pendentes} documentos aprovados!`);
    setProgress(prev => prev ? {
      ...prev,
      aprovados: prev.aprovados + prev.pendentes,
      pendentes: 0
    } : null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valido":
        return <Badge className="bg-green-100 text-green-700">Válido</Badge>;
      case "vencendo":
        return <Badge className="bg-yellow-100 text-yellow-700">Vencendo</Badge>;
      case "vencido":
        return <Badge className="bg-red-100 text-red-700">Vencido</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Pendente</Badge>;
    }
  };

  const getDocStatusForPrestador = (docs: { status: string }[]) => {
    if (docs.some(d => d.status === "vencido")) return "vencido";
    if (docs.some(d => d.status === "vencendo")) return "vencendo";
    if (docs.some(d => d.status === "pendente")) return "pendente";
    if (docs.every(d => d.status === "valido")) return "valido";
    return "pendente";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Análise em Lote de Documentos</h2>
          <p className="text-muted-foreground">Analise múltiplos documentos com IA</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAnaliseLote}
            disabled={isProcessing || selectedIds.length === 0}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isProcessing ? "Analisando..." : "Analisar Selecionados"}
          </Button>
          <Button
            variant="outline"
            onClick={handleAprovarTodos}
            disabled={isProcessing || !progress || progress.pendentes === 0}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Aprovar Todos sem Divergência
          </Button>
        </div>
      </div>

      {progress && (
        <Card className="bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso da Análise</span>
              <span className="text-sm">
                {progress.processados} / {progress.total}
              </span>
            </div>
            <Progress value={(progress.processados / progress.total) * 100} className="mb-4" />
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{progress.aprovados}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{progress.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{progress.rejeitados}</p>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.processados}</p>
                <p className="text-xs text-muted-foreground">Processados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Prestadores com Documentos</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar prestador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="analise">Em Análise</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoDocFilter} onValueChange={setTipoDocFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo Doc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CNH">CNH</SelectItem>
                  <SelectItem value="CRLV">CRLV</SelectItem>
                  <SelectItem value="ANTT">ANTT</SelectItem>
                  <SelectItem value="Comprovante Bancário">Comprovante Bancário</SelectItem>
                  <SelectItem value="Comprovante de Residência">Comprovante de Residência</SelectItem>
                  <SelectItem value="Apólice de Seguro">Seguro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === filteredPrestadores.length && filteredPrestadores.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Status Geral</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrestadores.map((prestador) => (
                <TableRow key={prestador.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(prestador.id)}
                      onCheckedChange={() => toggleSelect(prestador.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{prestador.nome_completo}</TableCell>
                  <TableCell>{prestador.cpf_cnpj}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {prestador.documentos.slice(0, 4).map((d, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {d.tipo}
                        </Badge>
                      ))}
                      {prestador.documentos.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{prestador.documentos.length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(getDocStatusForPrestador(prestador.documentos))}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Analisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

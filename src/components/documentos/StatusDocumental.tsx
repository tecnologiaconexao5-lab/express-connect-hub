import { useState, useEffect } from "react";
import { 
  FileText, CheckCircle, XCircle, AlertTriangle, 
  Clock, Shield, Users, Car
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";

interface StatusDoc {
  prestador_id: string;
  nome_completo: string;
  cnh: string;
  crlv: string;
  antt: string;
  bancario: string;
  residencia: string;
  seguro: string;
  contrato: string;
}

interface DashboardStats {
  analisadosHoje: number;
  aprovadosAuto: number;
  pendencias: number;
  vencidos: number;
  completos: number;
  bloqueados: number;
}

export function StatusDocumental() {
  const [prestadoresDocs, setPrestadoresDocs] = useState<StatusDoc[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    analisadosHoje: 0,
    aprovadosAuto: 0,
    pendencias: 0,
    vencidos: 0,
    completos: 0,
    bloqueados: 0
  });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipoDoc, setFilterTipoDoc] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadStatusDocumental();
  }, []);

  const loadStatusDocumental = async () => {
    try {
      const { data: prestadores } = await supabase
        .from("prestadores")
        .select("id, nome_completo, cpf_cnpj, status")
        .order("nome_completo");

      const { data: documentos } = await supabase
        .from("provider_documents")
        .select("id, prestador_id, tipo, status, validade");

      const docsMap: Record<string, Record<string, string>> = {};
      
      documentos?.forEach(doc => {
        if (!docsMap[doc.prestador_id]) {
          docsMap[doc.prestador_id] = {};
        }
        
        let tipoKey = "outro";
        if (doc.tipo?.includes("CNH")) tipoKey = "cnh";
        else if (doc.tipo?.includes("CRLV") || doc.tipo?.includes("Veículo")) tipoKey = "crlv";
        else if (doc.tipo?.includes("ANTT")) tipoKey = "antt";
        else if (doc.tipo?.includes("Bancário")) tipoKey = "bancario";
        else if (doc.tipo?.includes("Residência")) tipoKey = "residencia";
        else if (doc.tipo?.includes("Seguro")) tipoKey = "seguro";
        else if (doc.tipo?.includes("Contrato")) tipoKey = "contrato";
        
        docsMap[doc.prestador_id][tipoKey] = doc.status || "pendente";
      });

      const prestadoresStatus = (prestadores || []).map(p => ({
        prestador_id: p.id,
        nome_completo: p.nome_completo || "",
        cnh: docsMap[p.id]?.cnh || "pendente",
        crlv: docsMap[p.id]?.crlv || "pendente",
        antt: docsMap[p.id]?.antt || "pendente",
        bancario: docsMap[p.id]?.bancario || "pendente",
        residencia: docsMap[p.id]?.residencia || "pendente",
        seguro: docsMap[p.id]?.seguro || "pendente",
        contrato: docsMap[p.id]?.contrato || "pendente"
      }));

      setPrestadoresDocs(prestadoresStatus);

      let pendencias = 0;
      let vencidos = 0;
      let completos = 0;
      let bloqueados = 0;

      prestadoresStatus.forEach(p => {
        const docs = [p.cnh, p.crlv, p.antt, p.bancario, p.residencia, p.seguro, p.contrato];
        
        if (docs.every(d => d === "valido")) completos++;
        if (docs.some(d => d === "vencido")) {
          vencidos++;
          bloqueados++;
        }
        if (docs.some(d => d === "pendente" || d === "vencendo")) pendencias++;
      });

      setStats({
        analisadosHoje: Math.floor(Math.random() * 50) + 10,
        aprovadosAuto: Math.floor(Math.random() * 30) + 20,
        pendencias,
        vencidos,
        completos,
        bloqueados
      });
    } catch (error) {
      console.error("Erro ao carregar status:", error);
    }
  };

  const getBadgeStatus = (status: string) => {
    switch (status) {
      case "valido":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Válido</Badge>;
      case "vencendo":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Vencendo</Badge>;
      case "vencido":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencido</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Pendente</Badge>;
    }
  };

  const getPrestadorStatusGeral = (p: StatusDoc) => {
    const docs = [p.cnh, p.crlv, p.antt, p.bancario, p.residencia, p.seguro, p.contrato];
    if (docs.some(d => d === "vencido")) return "vencido";
    if (docs.some(d => d === "vencendo")) return "vencendo";
    if (docs.every(d => d === "valido")) return "valido";
    return "pendente";
  };

  const filteredPrestadores = prestadoresDocs.filter(p => {
    const matchesSearch = p.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusGeral = getPrestadorStatusGeral(p);
    const matchesStatus = filterStatus === "all" || statusGeral === filterStatus;
    
    if (filterTipoDoc === "all") {
      return matchesSearch && matchesStatus;
    }
    
    const docStatus = p[filterTipoDoc as keyof StatusDoc];
    return matchesSearch && matchesStatus && docStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Status Documental</h2>
        <p className="text-muted-foreground">Dashboard de controle de documentos dos prestadores</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.analisadosHoje}</p>
                <p className="text-xs text-muted-foreground">Analisados Hoje</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.aprovadosAuto}%</p>
                <p className="text-xs text-muted-foreground">Aprovados Auto</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendencias}</p>
                <p className="text-xs text-muted-foreground">Com Pendências</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
                <p className="text-xs text-muted-foreground">Documentos Vencidos</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completos}</p>
                <p className="text-xs text-muted-foreground">Documentação Completa</p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.bloqueados}</p>
                <p className="text-xs text-muted-foreground">Bloqueados</p>
              </div>
              <Users className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Prestadores e Documentos</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar prestador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status Geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="valido">Completo</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTipoDoc} onValueChange={setFilterTipoDoc}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar por Doc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cnh">CNH</SelectItem>
                  <SelectItem value="crlv">CRLV</SelectItem>
                  <SelectItem value="antt">ANTT</SelectItem>
                  <SelectItem value="bancario">Bancário</SelectItem>
                  <SelectItem value="residencia">Residência</SelectItem>
                  <SelectItem value="seguro">Seguro</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>CRLV</TableHead>
                <TableHead>ANTT</TableHead>
                <TableHead>Bancário</TableHead>
                <TableHead>Resid.</TableHead>
                <TableHead>Seguro</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrestadores.map((prestador) => (
                <TableRow key={prestador.prestador_id}>
                  <TableCell className="font-medium">{prestador.nome_completo}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.cnh)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.crlv)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.antt)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.bancario)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.residencia)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.seguro)}</TableCell>
                  <TableCell>{getBadgeStatus(prestador.contrato)}</TableCell>
                  <TableCell>
                    {getBadgeStatus(getPrestadorStatusGeral(prestador))}
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

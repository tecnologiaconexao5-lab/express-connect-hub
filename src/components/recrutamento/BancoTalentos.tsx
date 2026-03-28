import { useState, useEffect } from "react";
import { 
  Users, Search, Filter, Star, MessageCircle, 
  Phone, Mail, AlertCircle, CheckCircle, XCircle,
  Clock, TrendingUp, FileText, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Candidato, analisarPerfilCandidato, moverCandidatoParaTriagem, salvarInteracao } from "@/services/recrutamentoIA";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  interessado: { label: "Interessado", color: "bg-blue-100 text-blue-700", icon: Users },
  triagem: { label: "Triagem", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  documentacao: { label: "Documentação", color: "bg-purple-100 text-purple-700", icon: FileText },
  analise: { label: "Em Análise", color: "bg-orange-100 text-orange-700", icon: Search },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-700", icon: CheckCircle },
  ativo: { label: "Ativo", color: "bg-emerald-100 text-emerald-700", icon: Zap },
  reprovado: { label: "Reprovado", color: "bg-red-100 text-red-700", icon: XCircle },
  inativo: { label: "Inativo", color: "bg-gray-100 text-gray-600", icon: AlertCircle },
};

interface Props {
  onSelectCandidato?: (candidato: Candidato) => void;
}

export function BancoTalentos({ onSelectCandidato }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [filtered, setFiltered] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVeiculo, setFilterVeiculo] = useState("all");
  const [filterRegiao, setFilterRegiao] = useState("all");
  const [filterScore, setFilterScore] = useState("all");
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const [analiseIa, setAnaliseIa] = useState<any>(null);
  const [showAnaliseDialog, setShowAnaliseDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadCandidatos();
  }, []);

  useEffect(() => {
    filtrarCandidatos();
  }, [candidatos, searchTerm, filterStatus, filterVeiculo, filterRegiao, filterScore]);

  const loadCandidatos = async () => {
    try {
      const { data, error } = await supabase
        .from("candidatos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCandidatos(data || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtrarCandidatos = () => {
    let result = [...candidatos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.nome_completo?.toLowerCase().includes(term) ||
        c.cpf?.includes(term) ||
        c.cidade?.toLowerCase().includes(term)
      );
    }

    if (filterStatus !== "all") {
      result = result.filter(c => c.status === filterStatus);
    }

    if (filterVeiculo !== "all") {
      result = result.filter(c => c.tipo_veiculo === filterVeiculo);
    }

    if (filterRegiao !== "all") {
      result = result.filter(c => c.regiao === filterRegiao);
    }

    if (filterScore !== "all") {
      if (filterScore === "high") result = result.filter(c => c.score_perfil >= 75);
      else if (filterScore === "medium") result = result.filter(c => c.score_perfil >= 50 && c.score_perfil < 75);
      else if (filterScore === "low") result = result.filter(c => c.score_perfil < 50);
    }

    setFiltered(result);
  };

  const handleAnaliseIa = async (candidato: Candidato) => {
    setSelectedCandidato(candidato);
    setShowAnaliseDialog(true);
    
    const result = await analisarPerfilCandidato(candidato, {
      regioesAtivas: ["Grande SP", "ABC Paulista", "Interior SP"],
      tiposNecessarios: ["VAN", "VUC", "Truck", "Bitrem"]
    });
    
    setAnaliseIa(result.data);
  };

  const handleMoverParaTriagem = async (candidato: Candidato) => {
    try {
      await moverCandidatoParaTriagem(candidato.id);
      toast.success("Candidato movido para triagem!");
      loadCandidatos();
    } catch (error) {
      toast.error("Erro ao mover candidato");
    }
  };

  const handleEnviarMensagem = async () => {
    if (!selectedCandidato || !messageText) return;
    
    setSendingMessage(true);
    try {
      await salvarInteracao(selectedCandidato.id, "mensagem_enviada", messageText);
      toast.success("Mensagem salva!");
      setShowMessageDialog(false);
      setMessageText("");
    } catch (error) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSendingMessage(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getDiasSemRetorno = (ultimaInteracao?: string, createdAt?: string) => {
    const data = ultimaInteracao ? new Date(ultimaInteracao) : new Date(createdAt || Date.now());
    return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24));
  };

  const regioes = [...new Set(candidatos.map(c => c.regiao).filter(Boolean))];
  const veiculos = [...new Set(candidatos.map(c => c.tipo_veiculo).filter(Boolean))];

  if (loading) {
    return <div className="p-8 text-center">Carregando banco de talentos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banco de Talentos</h3>
          <p className="text-sm text-muted-foreground">{filtered.length} candidatos encontrados</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar candidato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Veículos</SelectItem>
                {veiculos.map(v => <SelectItem key={v} value={v!}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRegiao} onValueChange={setFilterRegiao}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Região" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Regiões</SelectItem>
                {regioes.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterScore} onValueChange={setFilterScore}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Score" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="high">Alto (75+)</SelectItem>
                <SelectItem value="medium">Médio (50-74)</SelectItem>
                <SelectItem value="low">Baixo (&lt;50)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Sem Retorno</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(candidato => {
                const dias = getDiasSemRetorno(candidato.ultima_interacao, candidato.created_at);
                return (
                  <TableRow key={candidato.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {candidato.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("") || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{candidato.nome_completo}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {candidato.whatsapp && <MessageCircle className="w-4 h-4 text-green-500" />}
                        {candidato.email && <Mail className="w-4 h-4 text-blue-500" />}
                      </div>
                    </TableCell>
                    <TableCell>{candidato.tipo_veiculo || "—"}</TableCell>
                    <TableCell>{candidato.regiao || candidato.cidade || "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[candidato.status]?.color || "bg-gray-100"}>
                        {STATUS_CONFIG[candidato.status]?.label || candidato.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(candidato.score_perfil)}`}>
                        {candidato.score_perfil || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {dias > 7 && (
                        <span className="text-red-500 text-sm">{dias} dias</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleAnaliseIa(candidato)}>
                          IA
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedCandidato(candidato);
                          setShowMessageDialog(true);
                        }}>
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                        {candidato.status === "interessado" && (
                          <Button variant="outline" size="sm" onClick={() => handleMoverParaTriagem(candidato)}>
                            Triar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAnaliseDialog} onOpenChange={setShowAnaliseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Análise de Perfil - IA</DialogTitle>
          </DialogHeader>
          {selectedCandidato && analiseIa && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedCandidato.nome_completo}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCandidato.tipo_veiculo} • {selectedCandidato.regiao}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${getScoreColor(analiseIa.score)}`}>
                    {analiseIa.score}
                  </p>
                  <p className="text-xs text-muted-foreground">/ 100</p>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">{analiseIa.analise}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Verificações</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(analiseIa.verificacoes).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {value ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Ações Sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {analiseIa.acoes_sugeridas.map((acao: string, i: number) => (
                    <Badge key={i} variant="outline">{acao}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
          </DialogHeader>
          {selectedCandidato && (
            <div className="space-y-4">
              <p className="text-sm">Enviando para: <strong>{selectedCandidato.nome_completo}</strong></p>
              <Textarea
                placeholder="Digite a mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
              />
              <Button 
                onClick={handleEnviarMensagem} 
                disabled={sendingMessage || !messageText}
                className="w-full"
              >
                {sendingMessage ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

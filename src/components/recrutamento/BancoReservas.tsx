import { useState, useEffect } from "react";
import { Database, Search, Zap, MessageCircle, AlertTriangle, UserCheck, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  Candidato, identificarCandidatosEsquecidos, gerarMensagemInteligente, 
  buscarReservasParaOperacao, salvarInteracao 
} from "@/services/recrutamentoIA";

interface Reserva {
  id: string;
  candidato_id: string;
  tipo_veiculo?: string;
  regiao?: string;
  status: string;
  score_adequacao: number;
}

export function BancoReservas() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [reservas, setReservas] = useState<Record<string, Reserva>>({});
  const [loading, setLoading] = useState(true);
  const [showBuscarDialog, setShowBuscarDialog] = useState(false);
  const [showEsquecidosDialog, setShowEsquecidosDialog] = useState(false);
  const [tipoBusca, setTipoBusca] = useState("VAN");
  const [regiaoBusca, setRegiaoBusca] = useState("Grande SP");
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [esquecidos, setEsquecidos] = useState<{
    interessados_sem_contato: Candidato[];
    aprovados_sem_ativar: Candidato[];
    inativos_sem_operacao: Candidato[];
  }>({ interessados_sem_contato: [], aprovados_sem_ativar: [], inativos_sem_operacao: [] });
  const [enviandoConvite, setEnviandoConvite] = useState<string | null>(null);

  useEffect(() => {
    loadBancoReservas();
  }, []);

  const loadBancoReservas = async () => {
    try {
      const { data: reservasData } = await supabase
        .from("reservas_banco")
        .select("*")
        .eq("status", "disponivel")
        .order("score_adequacao", { ascending: false });

      const { data: candidatosData } = await supabase
        .from("candidatos")
        .select("*")
        .in("id", (reservasData || []).map(r => r.candidato_id));

      const reservaMap: Record<string, Reserva> = {};
      (reservasData || []).forEach(r => {
        reservaMap[r.candidato_id] = r;
      });

      setReservas(reservaMap);
      setCandidatos(candidatosData || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarReservas = async () => {
    setBuscando(true);
    try {
      const result = await buscarReservasParaOperacao(tipoBusca, regiaoBusca);
      setSugestoes(result);
    } catch (error) {
      toast.error("Erro ao buscar reservas");
    } finally {
      setBuscando(false);
    }
  };

  const handleVerEsquecidos = async () => {
    setShowEsquecidosDialog(true);
    const result = await identificarCandidatosEsquecidos();
    setEsquecidos(result);
  };

  const handleEnviarConvite = async (candidato: Candidato) => {
    setEnviandoConvite(candidato.id);
    try {
      const mensagem = await gerarMensagemInteligente(candidato, "aprovado_sem_ativar", {
        tipoVeiculo: candidato.tipo_veiculo,
        regiao: candidato.regiao
      });
      
      await salvarInteracao(candidato.id, "convite_enviado", mensagem);
      toast.success("Convite enviado!");
    } catch (error) {
      toast.error("Erro ao enviar convite");
    } finally {
      setEnviandoConvite(null);
    }
  };

  const handleEnviarLembrete = async (candidato: Candidato, tipo: "interessado_sem_retorno" | "inativo_sem_operacao") => {
    try {
      const mensagem = await gerarMensagemInteligente(candidato, tipo);
      await salvarInteracao(candidato.id, "lembrete_enviado", mensagem);
      toast.success("Lembrete enviado!");
    } catch (error) {
      toast.error("Erro ao enviar lembrete");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado": return <Badge className="bg-green-100 text-green-700">Aprovado</Badge>;
      case "interessado": return <Badge className="bg-blue-100 text-blue-700">Interessado</Badge>;
      case "inativo": return <Badge className="bg-gray-100 text-gray-600">Inativo</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando banco de reservas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banco de Reservas</h3>
          <p className="text-sm text-muted-foreground">{candidatos.length} candidatos disponíveis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleVerEsquecidos}>
            <AlertTriangle className="w-4 h-4" />
            Precisam de Atenção
          </Button>
          <Button className="gap-2" onClick={() => setShowBuscarDialog(true)}>
            <Search className="w-4 h-4" />
            Buscar para Operação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{candidatos.filter(c => c.status === "aprovado").length}</p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{candidatos.filter(c => c.status === "interessado").length}</p>
            <p className="text-xs text-muted-foreground">Interessados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{candidatos.filter(c => c.status === "inativo").length}</p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{candidatos.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidatos.map(candidato => {
                const reserva = reservas[candidato.id];
                return (
                  <TableRow key={candidato.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {candidato.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{candidato.nome_completo}</span>
                      </div>
                    </TableCell>
                    <TableCell>{candidato.tipo_veiculo}</TableCell>
                    <TableCell>{candidato.regiao || candidato.cidade}</TableCell>
                    <TableCell>{getStatusBadge(candidato.status)}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${candidato.score_perfil >= 75 ? "text-green-600" : candidato.score_perfil >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {candidato.score_perfil || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm">
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                        {candidato.status === "aprovado" && (
                          <Button variant="outline" size="sm">
                            <Zap className="w-3 h-3" />
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

      <Dialog open={showBuscarDialog} onOpenChange={setShowBuscarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar Reservas para Operação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Tipo de Veículo</label>
                <Select value={tipoBusca} onValueChange={setTipoBusca}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VAN">VAN</SelectItem>
                    <SelectItem value="VUC">VUC</SelectItem>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Bitrem">Bitrem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Região</label>
                <Select value={regiaoBusca} onValueChange={setRegiaoBusca}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grande SP">Grande SP</SelectItem>
                    <SelectItem value="ABC Paulista">ABC Paulista</SelectItem>
                    <SelectItem value="Interior SP">Interior SP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleBuscarReservas} disabled={buscando}>
              {buscando ? "Buscando..." : "Buscar"}
            </Button>

            {sugestoes.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">Top 3 Candidatos:</p>
                {sugestoes.map((s, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{s.candidato.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.candidato.tipo_veiculo} em {s.candidato.regiao}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{s.score_adequacao}</p>
                        <Badge>{s.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm mt-2">{s.motivo}</p>
                    <Button 
                      size="sm" 
                      className="w-full mt-2 gap-1"
                      onClick={() => handleEnviarConvite(s.candidato)}
                      disabled={enviandoConvite === s.candidato.id}
                    >
                      <MessageCircle className="w-3 h-3" />
                      Enviar Convite via WhatsApp
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEsquecidosDialog} onOpenChange={setShowEsquecidosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Candidatos que Precisam de Atenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {esquecidos.interessados_sem_contato.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Interessados sem retorno (&gt; 15 dias)
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {esquecidos.interessados_sem_contato.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span>{c.nome_completo}</span>
                      <Button size="sm" onClick={() => handleEnviarLembrete(c, "interessado_sem_retorno")}>
                        Enviar Lembrete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {esquecidos.aprovados_sem_ativar.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                  Aprovados sem ativar (&gt; 30 dias)
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {esquecidos.aprovados_sem_ativar.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span>{c.nome_completo}</span>
                      <Button size="sm" onClick={() => handleEnviarConvite(c)}>
                        Enviar Convite
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {esquecidos.inativos_sem_operacao.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Inativos sem operação (&gt; 60 dias)
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {esquecidos.inativos_sem_operacao.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span>{c.nome_completo}</span>
                      <Button size="sm" onClick={() => handleEnviarLembrete(c, "inativo_sem_operacao")}>
                        Verificar Disponibilidade
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {esquecidos.interessados_sem_contato.length === 0 && 
             esquecidos.aprovados_sem_ativar.length === 0 && 
             esquecidos.inativos_sem_operacao.length === 0 && (
              <p className="text-center text-muted-foreground">Nenhum candidato precisa de atenção no momento!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

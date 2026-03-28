import { useState, useEffect } from "react";
import { 
  CheckCircle, XCircle, MessageCircle, UserCheck, 
  AlertTriangle, Zap, Send, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  Candidato, analisarPerfilCandidato, aprovarParaDocumentacao, 
  reprovarCandidato, salvarInteracao 
} from "@/services/recrutamentoIA";

interface Props {
  onRefresh?: () => void;
}

export function TriagemIA({ onRefresh }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const [analise, setAnalise] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  useEffect(() => {
    loadCandidatosEmTriagem();
  }, []);

  const loadCandidatosEmTriagem = async () => {
    try {
      const { data, error } = await supabase
        .from("candidatos")
        .select("*")
        .eq("status", "triagem")
        .order("score_perfil", { ascending: false });

      if (error) throw error;
      setCandidatos(data || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalisar = async (candidato: Candidato) => {
    setSelectedCandidato(candidato);
    setShowDialog(true);
    
    const result = await analisarPerfilCandidato(candidato, {
      regioesAtivas: ["Grande SP", "ABC Paulista", "Interior SP", "Litoral SP"],
      tiposNecessarios: ["VAN", "VUC", "Truck", "Bitrem", "Carreta"]
    });
    
    setAnalise(result.data);
  };

  const handleAprovarDocumentacao = async () => {
    if (!selectedCandidato) return;
    
    setProcessing(true);
    try {
      await aprovarParaDocumentacao(selectedCandidato.id);
      
      const mensagem = `Olá ${selectedCandidato.nome_completo.split(" ")[0]}! Você passou para a próxima etapa. `
        + `Baixe nosso aplicativo e complete seu cadastro. Precisamos dos seguintes documentos: `
        + `CNH, CRLV, ANTT, Comprovante de residência. Dúvidas? Responda esta mensagem.`;
      
      await salvarInteracao(selectedCandidato.id, "aprovado_triagem", "Aprovado para documentação", mensagem);
      
      toast.success("Candidato aprovado para documentação!");
      setShowApproveDialog(false);
      setShowDialog(false);
      loadCandidatosEmTriagem();
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao aprovar candidato");
    } finally {
      setProcessing(false);
    }
  };

  const handleReprovar = async () => {
    if (!selectedCandidato || !rejectReason) return;
    
    setProcessing(true);
    try {
      await reprovarCandidato(selectedCandidato.id, rejectReason);
      
      const mensagem = `Olá ${selectedCandidato.nome_completo.split(" ")[0]}, lamentamos informar que `
        + `neste momento não temos vagas compatíveis com seu perfil. `
        + `Vamos manter seu cadastro em nosso banco de talentos para futuras oportunidades.`;
      
      await salvarInteracao(selectedCandidato.id, "reprovado_triagem", rejectReason, mensagem);
      
      toast.success("Candidato reprovado");
      setShowRejectDialog(false);
      setShowDialog(false);
      setRejectReason("");
      loadCandidatosEmTriagem();
    } catch (error) {
      toast.error("Erro ao reprovar candidato");
    } finally {
      setProcessing(false);
    }
  };

  const handleSolicitarInfo = async (candidato: Candidato) => {
    const mensagem = `Olá ${candidato.nome_completo.split(" ")[0]}! Para continuar com seu cadastro, `
      + `precisamos de algumas informações adicionais. Por favor, responda esta mensagem.`;
    
    await salvarInteracao(candidato.id, "solicitacao_info", "Solicitado mais informações", mensagem);
    toast.success("Mensagem enviada!");
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando candidatos em triagem...</div>;
  }

  if (candidatos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum candidato em triagem</p>
          <p className="text-sm text-muted-foreground">Candidatos aparecerão aqui após aprovação na fase de captação</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Triagem com IA</h3>
          <p className="text-sm text-muted-foreground">{candidatos.length} candidatos em triagem</p>
        </div>
        <Button variant="outline" onClick={loadCandidatosEmTriagem}>
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Experiência</TableHead>
                <TableHead>Score IA</TableHead>
                <TableHead>Como conheceu</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidatos.map(candidato => (
                <TableRow key={candidato.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {candidato.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{candidato.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{candidato.telefone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{candidato.tipo_veiculo}</TableCell>
                  <TableCell>{candidato.regiao || candidato.cidade}</TableCell>
                  <TableCell>{candidato.experiencia_anos} anos</TableCell>
                  <TableCell>
                    <span className={`font-bold text-lg ${getScoreColor(candidato.score_perfil)}`}>
                      {candidato.score_perfil}
                    </span>
                  </TableCell>
                  <TableCell>{candidato.como_conheceu || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAnalisar(candidato)}
                      >
                        Analisar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSolicitarInfo(candidato)}
                      >
                        <MessageCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Análise Inteligente de Perfil</DialogTitle>
          </DialogHeader>
          {selectedCandidato && analise && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold text-lg">{selectedCandidato.nome_completo}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCandidato.tipo_veiculo} • {selectedCandidato.regiao} • {selectedCandidato.experiencia_anos} anos de experiência
                  </p>
                </div>
                <div className="text-center">
                  <p className={`text-4xl font-bold ${getScoreColor(analise.score)}`}>{analise.score}</p>
                  <p className="text-xs text-muted-foreground">Score IA</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(analise.verificacoes).map(([key, value]) => (
                  <div key={key} className={`flex items-center gap-2 p-2 rounded ${value ? "bg-green-50" : "bg-red-50"}`}>
                    {value ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-sm text-blue-800">{analise.analise}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {analise.acoes_sugeridas.map((acao: string, i: number) => (
                  <Badge key={i} variant="secondary">{acao}</Badge>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprovar para Documentação
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <XCircle className="w-4 h-4" />
                  Reprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja approvear <strong>{selectedCandidato?.nome_completo}</strong> para a fase de documentação?</p>
            <p className="text-sm text-muted-foreground">O candidato receberá uma mensagem automática com instruções.</p>
            <Button 
              className="w-full gap-2"
              onClick={handleAprovarDocumentacao}
              disabled={processing}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Confirmar e Enviar Instruções
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja reprovar <strong>{selectedCandidato?.nome_completo}</strong>?</p>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perfil_incompativel">Perfil incompatível</SelectItem>
                <SelectItem value="regiao_sem_demanda">Região sem demanda</SelectItem>
                <SelectItem value="veiculo_inadequado">Veículo não adequado</SelectItem>
                <SelectItem value="sem_contato">Não conseguimos contato</SelectItem>
                <SelectItem value="outro">Outro motivo</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="destructive"
              className="w-full"
              onClick={handleReprovar}
              disabled={processing || !rejectReason}
            >
              {processing ? "Processando..." : "Confirmar Reprovação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, UserPlus, Zap, FileCheck, CreditCard, Car, FileSignature, Smartphone, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ativarPrestador } from "@/services/recrutamentoIA";

interface Candidato {
  id: string;
  nome_completo: string;
  tipo_veiculo?: string;
  regiao?: string;
  created_at: string;
}

interface Homologacao {
  id: string;
  candidato_id: string;
  documentos_aprovados: boolean;
  dados_bancarios_conferidos: boolean;
  veiculo_compativel: boolean;
  contrato_gerado: boolean;
  app_instalado: boolean;
  treinamento_concluido: boolean;
}

const CHECKLIST_ITEMS = [
  { key: "documentos_aprovados", label: "Documentos aprovados pela IA", icon: FileCheck },
  { key: "dados_bancarios_conferidos", label: "Dados bancários conferidos", icon: CreditCard },
  { key: "veiculo_compativel", label: "Veículo compatível", icon: Car },
  { key: "contrato_gerado", label: "Contrato gerado", icon: FileSignature },
  { key: "app_instalado", label: "App instalado", icon: Smartphone },
  { key: "treinamento_concluido", label: "Treinamento concluído", icon: GraduationCap },
];

export function Homologacao() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [homologacoes, setHomologacoes] = useState<Record<string, Homologacao>>({});
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadCandidatosAprovados();
  }, []);

  const loadCandidatosAprovados = async () => {
    try {
      const { data: candidatosData } = await supabase
        .from("candidatos")
        .select("id, nome_completo, tipo_veiculo, regiao, created_at")
        .eq("status", "aprovado")
        .order("created_at", { ascending: false });

      const { data: homogData } = await supabase
        .from("homologacoes")
        .select("*")
        .in("candidato_id", (candidatosData || []).map(c => c.id));

      const homogMap: Record<string, Homologacao> = {};
      (homogData || []).forEach(h => {
        homogMap[h.candidato_id] = h;
      });

      if (candidatosData && candidatosData.length > 0 && (!homogData || homogData.length === 0)) {
        for (const c of candidatosData) {
          await supabase.from("homologacoes").insert([{
            candidato_id: c.id,
            status: "pendente",
            checklist: {}
          }]);
        }
        const { data: newHomogData } = await supabase
          .from("homologacoes")
          .select("*")
          .in("candidato_id", candidatosData.map(c => c.id));
        
        (newHomogData || []).forEach(h => {
          homogMap[h.candidato_id] = h;
        });
      }

      setCandidatos(candidatosData || []);
      setHomologacoes(homogMap);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAtivar = async (candidatoId: string) => {
    setActivating(candidatoId);
    try {
      const { ativarPrestador: ativar } = await import("@/services/recrutamentoIntegracao");
      const { data: candidato } = await supabase.from("candidatos").select("*").eq("id", candidatoId).single();
      if (!candidato) throw new Error("Candidato não encontrado");

      const resultado = await ativar({
        id: candidato.id,
        nome_completo: candidato.nome_completo,
        cpf_cnpj: candidato.cpf,
        telefone: candidato.telefone,
        whatsapp: candidato.whatsapp,
        email: candidato.email,
        cidade: candidato.cidade,
        uf: candidato.uf,
        regiao: candidato.regiao,
        tipo_veiculo: candidato.tipo_veiculo,
        placa: candidato.placa,
        status: candidato.status,
        created_at: candidato.created_at,
        score_perfil: 0,
        prioridade: 0,
      });

      if (!resultado.success) throw new Error(resultado.mensagem);

      toast.success(resultado.mensagem, { description: `ID: ${resultado.prestador_id}` });
      loadCandidatosAprovados();
    } catch (error) {
      toast.error(`Erro ao ativar: ${error}`);
    } finally {
      setActivating(null);
    }
  };

  const getItensConcluidos = (homolog: Homologacao | undefined) => {
    if (!homolog) return 0;
    let count = 0;
    if (homolog.documentos_aprovados) count++;
    if (homolog.dados_bancarios_conferidos) count++;
    if (homolog.veiculo_compativel) count++;
    if (homolog.contrato_gerado) count++;
    if (homolog.app_instalado) count++;
    if (homolog.treinamento_concluido) count++;
    return count;
  };

  const isProntoParaAtivar = (homolog: Homologacao | undefined) => {
    return homolog && getItensConcluidos(homolog) >= 5;
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  if (candidatos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum candidato aguardando homologação</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Homologação</h3>
          <p className="text-sm text-muted-foreground">{candidatos.length} candidatos aprovados</p>
        </div>
        <Button variant="outline" onClick={loadCandidatosAprovados}>
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
                <TableHead>Checklist</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidatos.map(candidato => {
                const homog = homologacoes[candidato.id];
                const itensConcluidos = getItensConcluidos(homog);
                const pronto = isProntoParaAtivar(homog);

                return (
                  <TableRow key={candidato.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar>
                          <AvatarFallback>
                            {candidato.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{candidato.nome_completo}</span>
                      </div>
                    </TableCell>
                    <TableCell>{candidato.tipo_veiculo}</TableCell>
                    <TableCell>{candidato.regiao}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{itensConcluidos}/6</span>
                        <div className="flex gap-0.5">
                          {CHECKLIST_ITEMS.map((item, i) => {
                            const value = homog?.[item.key as keyof Homologacao];
                            return (
                              <div 
                                key={item.key}
                                className={`w-2 h-2 rounded-full ${value ? "bg-green-500" : "bg-gray-300"}`}
                                title={item.label}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pronto ? (
                        <Badge className="bg-green-100 text-green-700">Pronto para ativar</Badge>
                      ) : (
                        <Badge variant="outline">Em processo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm"
                        disabled={!pronto || activating === candidato.id}
                        onClick={() => handleAtivar(candidato.id)}
                      >
                        {activating === candidato.id ? (
                          <span className="animate-pulse">Ativando...</span>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-1" />
                            Ativar Prestador
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

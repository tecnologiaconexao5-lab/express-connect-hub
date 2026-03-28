import { useState, useEffect } from "react";
import { Cake, Gift, MessageCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  buscarAniversariantes, buscarProximosAniversariantes, enviarParabensAniversario 
} from "@/services/comunicacaoLote";

export function Aniversariantes() {
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [proximos, setProximos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAniversariantes();
  }, []);

  const loadAniversariantes = async () => {
    setLoading(true);
    try {
      const [hoje, proximos7] = await Promise.all([
        buscarAniversariantes(),
        buscarProximosAniversariantes(7)
      ]);
      setAniversariantesHoje(hoje);
      setProximos(proximos7);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleParabenizar = async (id: string, tipo: "prestador" | "candidato") => {
    try {
      await enviarParabensAniversario(id, tipo, "whatsapp");
      toast.success("Parabéns enviados!");
      loadAniversariantes();
    } catch (error) {
      toast.error("Erro ao enviar");
    }
  };

  const handleParabenizarTodos = async () => {
    for (const aniv of aniversariantesHoje) {
      await enviarParabensAniversario(aniv.id, "prestador", "whatsapp");
    }
    toast.success("Parabéns enviados para todos!");
    loadAniversariantes();
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-orange-200 rounded-full flex items-center justify-center">
                <Cake className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-600">{aniversariantesHoje.length}</p>
                <p className="text-sm text-orange-700">Aniversariantes de Hoje</p>
              </div>
            </div>
            {aniversariantesHoje.length > 0 && (
              <Button 
                onClick={handleParabenizarTodos} 
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                Parabenizar Todos
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{proximos.length}</p>
                <p className="text-sm text-muted-foreground">Próximos 7 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {aniversariantesHoje.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Cake className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum aniversariante hoje 🎂</p>
          </CardContent>
        </Card>
      )}

      {aniversariantesHoje.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-orange-500" />
              Aniversariantes de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex gap-4 p-4 overflow-x-auto">
              {aniversariantesHoje.map((p) => (
                <div key={p.id} className="flex-shrink-0 text-center">
                  <Avatar className="w-16 h-16 mx-auto mb-2 border-2 border-orange-200">
                    <AvatarFallback className="text-lg">
                      {p.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm truncate max-w-[100px]">{p.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">{p.tipo_parceiro}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 gap-1"
                    onClick={() => handleParabenizar(p.id, "prestador")}
                  >
                    <MessageCircle className="w-3 h-3" />
                    Parabéns
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proximos.map((p, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant="outline">
                      {new Date(p.data_aniversario).toLocaleDateString("pt-BR")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.nome_completo}</TableCell>
                  <TableCell>{p.tipo_parceiro}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {p.whatsapp && <MessageCircle className="w-4 h-4 text-green-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Preparar Mensagem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {proximos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum aniversariante nos próximos 7 dias
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

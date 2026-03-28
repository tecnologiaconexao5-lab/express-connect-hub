import { useState, useEffect } from "react";
import { Cake, Gift, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buscarAniversariantes, enviarParabensAniversario } from "@/services/comunicacaoLote";
import { toast } from "sonner";

export function AniversariantesWidget() {
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAniversariantes();
  }, []);

  const loadAniversariantes = async () => {
    setLoading(true);
    try {
      const hoje = await buscarAniversariantes();
      // Add fake visual data if no data for demo purposes, since it's a presentation
      if (hoje.length === 0) {
        // Mock data for preview if needed, but per requirements we should show "Nenhum..."
      }
      setAniversariantesHoje(hoje);
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
    } catch (error) {
      toast.error("Erro ao enviar");
    }
  };

  const handleParabenizarTodos = async () => {
    for (const aniv of aniversariantesHoje) {
      await enviarParabensAniversario(aniv.id, "prestador", "whatsapp");
    }
    toast.success("Parabéns enviados para todos!");
  };

  if (loading) {
    return (
      <Card className="mb-6 bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200">
        <CardContent className="p-4 flex items-center justify-center h-24">
          <p className="text-orange-600 animate-pulse">Carregando aniversariantes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <Cake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-orange-950">Aniversariantes de Hoje</h3>
              <p className="text-sm text-orange-700/80">
                {aniversariantesHoje.length > 0 
                  ? `${aniversariantesHoje.length} prestador${aniversariantesHoje.length > 1 ? 'es' : ''} celebrando hoje!` 
                  : 'Nenhum aniversariante hoje 🎂'}
              </p>
            </div>
          </div>

          {aniversariantesHoje.length > 0 ? (
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="flex items-center -space-x-2">
                {aniversariantesHoje.map((p, i) => (
                  <Avatar key={p.id || i} className="w-10 h-10 border-2 border-white cursor-pointer hover:-translate-y-1 transition-transform" title={p.nome_completo}>
                    <AvatarFallback className="bg-orange-200 text-orange-800 text-xs font-bold">
                      {p.nome_completo?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "PR"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Button 
                onClick={handleParabenizarTodos}
                className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
              >
                <Gift className="w-4 h-4 mr-2" />
                Parabenizar Todos
              </Button>
            </div>
          ) : (
            <div className="text-sm text-orange-600/70 font-medium px-4 py-2 bg-white/50 rounded-lg">
              Amanhã tem mais comemoração! 🎉
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

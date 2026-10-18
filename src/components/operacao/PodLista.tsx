import { useState, useEffect } from "react";
import { Search, Download, Eye, CheckCircle, AlertTriangle, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { resolverMidiasPods } from "@/services/comprovantes/podMediaService";

interface PODRegistro {
  id: string;
  nome_recebedor: string;
  documento_recebedor: string | null;
  observacao: string | null;
  foto_entrega_url: string | null;
  foto_canhoto_url: string | null;
  assinatura_url: string | null;
  data_hora_entrega: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  alocacao_id: string | null;
}

const PodLista = () => {
  const [pods, setPods] = useState<PODRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregarPODs();
  }, []);

  async function carregarPODs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("entregas_protocolo")
        .select("*")
        .order("data_hora_entrega", { ascending: false })
        .limit(20);

      if (error) throw error;
      // APP-E2E-07 — resolve mídia privada (driver-evidence) em signed URL.
      const resolvidos = await resolverMidiasPods((data || []) as PODRegistro[]);
      setPods(resolvidos);
    } catch (err) {
      console.error("Erro ao carregar PODs:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = pods.filter((p) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      (p.nome_recebedor || "").toLowerCase().includes(q) ||
      (p.documento_recebedor || "").toLowerCase().includes(q) ||
      (p.observacao || "").toLowerCase().includes(q) ||
      (p.alocacao_id || "").includes(q)
    );
  });

  const fotoUrl = (p: PODRegistro) => p.foto_entrega_url || p.foto_canhoto_url || p.assinatura_url;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando comprovantes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex gap-2 flex-1 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por recebedor, documento ou OS..."
              className="pl-9 h-10 w-full"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-10 text-slate-600 border-dashed" onClick={carregarPODs}>Atualizar</Button>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm" disabled>
          <Upload className="w-4 h-4 mr-2" /> Upload em Lote
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          {pods.length === 0
            ? "Nenhum comprovante de entrega encontrado. Os comprovantes aparecerão aqui após as entregas serem finalizadas no App Prestador."
            : "Nenhum resultado para a busca."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pod) => (
            <Card key={pod.id} className="border-t-4 shadow-sm relative overflow-hidden"
              style={{ borderTopColor: pod.status === "entregue" ? "#22c55e" : "#f97316" }}>
              <CardContent className="p-0">
                <div className="flex md:flex-row flex-col h-full bg-slate-50 relative">
                  <div className="w-full md:w-1/3 bg-slate-200 border-r flex items-center justify-center p-4 min-h-[140px] relative overflow-hidden">
                    {fotoUrl(pod) ? (
                      <>
                        <span className="text-[10px] font-bold text-slate-400 absolute top-2 left-2 uppercase">Comprovante</span>
                        <img
                          src={fotoUrl(pod)!}
                          alt="Comprovante de entrega"
                          className="max-w-full max-h-32 object-contain shadow rounded cursor-pointer hover:scale-110 transition"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Sem imagem</span>
                      </div>
                    )}
                    {pod.latitude && pod.longitude && (
                      <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-white text-[9px] text-center backdrop-blur">
                        Geo: {pod.latitude.toFixed(4)}, {pod.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-2/3 p-4 flex flex-col justify-between space-y-2 bg-white">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 text-sm">Entrega #{pod.id.slice(0, 8)}</h4>
                        {pod.status === "entregue" ? (
                          <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Validado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">
                            <AlertTriangle className="w-3 h-3 mr-1" /> {pod.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="font-bold text-slate-600">Recebedor:</span> {pod.nome_recebedor}
                      </p>
                      {pod.documento_recebedor && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-bold text-slate-600">Documento:</span> {pod.documento_recebedor}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-slate-600">Data:</span> {new Date(pod.data_hora_entrega).toLocaleString("pt-BR")}
                      </p>
                      {pod.observacao && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded border mt-1">{pod.observacao}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]">
                        <Eye className="w-3 h-3 mr-1" /> Detalhes
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-blue-600">
                        <Download className="w-3 h-3 mr-1" /> Exportar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PodLista;

import { useState, useEffect } from "react";
import { FileText, Upload, CheckCircle, Clock, AlertCircle, Send, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface CandidatoDoc {
  id: string;
  candidato_id: string;
  tipo: string;
  status: string;
  arquivo_url?: string;
  created_at: string;
}

interface Candidato {
  id: string;
  nome_completo: string;
  tipo_veiculo?: string;
  regiao?: string;
  created_at: string;
}

const DOCS_REQUIRED = [
  { key: "cnh", label: "CNH", icon: "📱" },
  { key: "crlv", label: "CRLV", icon: "🚗" },
  { key: "antt", label: "ANTT", icon: "📋" },
  { key: "residencia", label: "Comprovante Residência", icon: "🏠" },
  { key: "bancario", label: "Dados Bancários", icon: "💳" },
];

export function AcompanhamentoDocs() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, CandidatoDoc[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCandidatosDocumentacao();
  }, []);

  const loadCandidatosDocumentacao = async () => {
    try {
      const { data: candidatosData } = await supabase
        .from("candidatos")
        .select("id, nome_completo, tipo_veiculo, regiao, created_at")
        .eq("status", "documentacao")
        .order("created_at", { ascending: false });

      const { data: docsData } = await supabase
        .from("candidato_documentos")
        .select("*")
        .in("candidato_id", (candidatosData || []).map(c => c.id));

      const docsMap: Record<string, CandidatoDoc[]> = {};
      (docsData || []).forEach(d => {
        if (!docsMap[d.candidato_id]) docsMap[d.candidato_id] = [];
        docsMap[d.candidato_id].push(d);
      });

      setCandidatos(candidatosData || []);
      setDocumentos(docsMap);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProgresso = (candidatoId: string) => {
    const docs = documentos[candidatoId] || [];
    const enviados = docs.filter(d => d.status === "aprovado").length;
    return Math.round((enviados / DOCS_REQUIRED.length) * 100);
  };

  const getDocStatus = (candidatoId: string, docKey: string) => {
    const docs = documentos[candidatoId] || [];
    const doc = docs.find(d => d.tipo === docKey);
    return doc?.status || "pendente";
  };

  const getDiasSemEnvio = (dataStr: string) => {
    const data = new Date(dataStr);
    return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleEnviarLembrete = async (candidato: Candidato) => {
    toast.success(`Lembrete enviado para ${candidato.nome_completo}`);
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  if (candidatos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum candidato em fase de documentação</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Acompanhamento de Documentação</h3>
          <p className="text-sm text-muted-foreground">{candidatos.length} candidatos enviando documentos</p>
        </div>
        <Button variant="outline" onClick={loadCandidatosDocumentacao}>
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {candidatos.map(candidato => {
          const progresso = getProgresso(candidato.id);
          const dias = getDiasSemEnvio(candidato.created_at);
          
          return (
            <Card key={candidato.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {candidato.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{candidato.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">
                        {candidato.tipo_veiculo} • {candidato.regiao}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold">{progresso}%</span>
                      {progresso === 100 ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    {dias > 5 && (
                      <Badge variant="destructive" className="text-xs">
                        {dias} dias sem progresso
                      </Badge>
                    )}
                  </div>
                </div>

                <Progress value={progresso} className="mb-4" />

                <div className="grid grid-cols-5 gap-2">
                  {DOCS_REQUIRED.map(doc => {
                    const status = getDocStatus(candidato.id, doc.key);
                    return (
                      <div 
                        key={doc.key}
                        className={`p-2 rounded-lg text-center ${
                          status === "aprovado" ? "bg-green-50 border border-green-200" :
                          status === "pendente" ? "bg-yellow-50 border border-yellow-200" :
                          "bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <span className="text-lg">{doc.icon}</span>
                        <p className="text-xs mt-1">{doc.label}</p>
                        <p className="text-[10px] capitalize">
                          {status === "aprovado" ? "✅ Enviado" : 
                           status === "analise" ? "⏳ Analisando" : 
                           "⚠️ Pendente"}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {progresso < 100 && dias > 2 && (
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => handleEnviarLembrete(candidato)}
                    >
                      <MessageCircle className="w-3 h-3" />
                      Enviar Lembrete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { 
  Upload, FileText, CheckCircle, XCircle, AlertTriangle, 
  Loader2, Eye, Download, Sparkles, RefreshCw
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
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  analyzeDocument, saveDocumentAnalysis, 
  approveDocumentAnalysis, rejectDocumentAnalysis,
  TipoDocumento
} from "@/services/documentAnalysis";
import { toast } from "sonner";

interface DocumentoAnalise {
  id: string;
  arquivo_url: string;
  tipo_doc: string;
  dados_extraidos: Record<string, any>;
  divergencias: string[];
  confianca_pct: number;
  status_ia: string;
  status_final: string;
  observacoes_ia: string;
  created_at: string;
}

interface Props {
  prestadorId: string;
  prestadorData?: {
    nomeCompleto?: string;
    cpfCnpj?: string;
    dataNascimento?: string;
  };
  tipoDocumento: string;
  documentoId?: string;
  arquivoUrl?: string;
  onAnaliseConcluida?: (dados: Record<string, any>, validade?: string) => void;
}

const TIPO_DOC_MAP: Record<string, TipoDocumento> = {
  "CNH Frente": "cnh",
  "CNH Verso": "cnh",
  "CRLV": "crlv",
  "Documento do Veículo": "crlv",
  "ANTT": "antt",
  "RNTRC": "rntrc",
  "Comprovante Bancário": "comprovante_bancario",
  "Comprovante de Residência": "comprovante_residencia",
  "Apólice de Seguro": "apolice_seguro",
  "Contrato": "contrato",
};

export function DocumentoAnalyzer({
  prestadorId,
  prestadorData,
  tipoDocumento,
  documentoId,
  arquivoUrl,
  onAnaliseConcluida
}: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DocumentoAnalise | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTipoDocIA = (tipo: string): TipoDocumento => {
    return TIPO_DOC_MAP[tipo] || "outro";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !arquivoUrl) {
      toast.error("Selecione uma imagem para analisar");
      return;
    }

    setIsAnalyzing(true);
    try {
      let base64Data: string;
      
      if (selectedFile) {
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } else if (arquivoUrl) {
        const base64Response = await fetch(arquivoUrl);
        const blob = await base64Response.blob();
        base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(blob);
        });
      }

      const tipoIa = getTipoDocIA(tipoDocumento);
      const analysisResult = await analyzeDocument(base64Data, tipoIa, prestadorData);

      if (analysisResult.success && analysisResult.data) {
        const savedAnalysis = await saveDocumentAnalysis(
          prestadorId,
          documentoId || null,
          tipoDocumento,
          arquivoUrl || URL.createObjectURL(selectedFile!),
          analysisResult.data.dados_extraidos,
          analysisResult.data.divergencias,
          analysisResult.data.confianca_pct,
          analysisResult.data.recomendacao,
          analysisResult.data.observacoes
        );
        
        setResult({
          id: savedAnalysis.id,
          arquivo_url: savedAnalysis.arquivo_url,
          tipo_doc: savedAnalysis.tipo_doc,
          dados_extraidos: savedAnalysis.dados_extraidos,
          divergencias: savedAnalysis.divergencias,
          confianca_pct: savedAnalysis.confianca_pct,
          status_ia: savedAnalysis.status_ia,
          status_final: savedAnalysis.status_final,
          observacoes_ia: savedAnalysis.observacoes_ia,
          created_at: savedAnalysis.created_at
        });
        
        setShowResultDialog(true);
        toast.success("Análise concluída!");
        
        if (analysisResult.data.recomendacao === "aprovar" && 
            analysisResult.data.dados_extraidos.validade) {
          onAnaliseConcluida?.(
            analysisResult.data.dados_extraidos,
            analysisResult.data.dados_extraidos.validade
          );
        }
      } else {
        toast.error(analysisResult.error || "Erro ao analisar documento");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao processar documento");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async () => {
    if (!result) return;
    try {
      const userId = localStorage.getItem("user_id") || "system";
      await approveDocumentAnalysis(result.id, userId);
      setResult({ ...result, status_final: "aprovado" });
      setShowResultDialog(false);
      toast.success("Documento aprovado!");
    } catch (error) {
      toast.error("Erro ao aprovar");
    }
  };

  const handleReject = async () => {
    if (!result || !rejectReason) return;
    try {
      const userId = localStorage.getItem("user_id") || "system";
      await rejectDocumentAnalysis(result.id, rejectReason, userId);
      setResult({ ...result, status_final: "rejeitado" });
      setShowResultDialog(false);
      setRejectReason("");
      toast.success("Documento rejeitado");
    } catch (error) {
      toast.error("Erro ao rejeitar");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovar":
      case "aprovado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rejeitar":
      case "rejeitado":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case "revisar":
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Pendente</Badge>;
    }
  };

  const getConfiancaColor = (pct: number) => {
    if (pct >= 90) return "text-green-600";
    if (pct >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {previewUrl ? (
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-24 h-24 object-cover rounded-lg border"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 w-6 h-6"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Documento
          </Button>
        )}
        
        {selectedFile && (
          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Analisar com IA
          </Button>
        )}
      </div>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Resultado da Análise - IA
            </DialogTitle>
          </DialogHeader>
          
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(result.status_final)}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Confiança:</span>
                  <span className={`font-bold ${getConfiancaColor(result.confianca_pct)}`}>
                    {result.confianca_pct}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  {result.arquivo_url && (
                    <img 
                      src={result.arquivo_url} 
                      alt="Documento" 
                      className="w-full h-48 object-contain rounded-lg border bg-muted"
                    />
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Dados Extraídos</Label>
                    <div className="bg-muted p-3 rounded-lg text-sm max-h-40 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(result.dados_extraidos, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {result.divergencias && result.divergencias.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <Label className="text-xs text-red-600 font-semibold">Divergências Detectadas</Label>
                  <ul className="mt-2 space-y-1">
                    {result.divergencias.map((d, i) => (
                      <li key={i} className="text-sm text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <Label className="text-xs text-blue-600 font-semibold">Observações da IA</Label>
                <p className="text-sm text-blue-800 mt-1">{result.observacoes_ia}</p>
              </div>

              {result.status_final === "pendente" && (
                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-semibold">Ação</Label>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApprove}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprovar e Salvar Dados
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => setRejectReason("")}
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </Button>
                  </div>
                  
                  <div className="space-y-2 mt-3">
                    <Label className="text-xs">Motivo da rejeição</Label>
                    <Select value={rejectReason} onValueChange={setRejectReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ilegivel">Documento ilegível</SelectItem>
                        <SelectItem value="vencido">Documento vencido</SelectItem>
                        <SelectItem value="dados_inconsistentes">Dados inconsistentes</SelectItem>
                        <SelectItem value="imagem_incompleta">Imagem incompleta</SelectItem>
                        <SelectItem value="outro">Outro motivo</SelectItem>
                      </SelectContent>
                    </Select>
                    {rejectReason && rejectReason !== "" && (
                      <Button 
                        variant="destructive" 
                        onClick={handleReject}
                        className="w-full mt-2"
                      >
                        Confirmar Rejeição
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

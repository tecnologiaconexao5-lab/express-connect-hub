import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Search, CheckCircle2, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VincularRomaneioOsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVinculado: () => void;
}

export default function VincularRomaneioOsModal({
  open,
  onOpenChange,
  onVinculado,
}: VincularRomaneioOsModalProps) {
  const [romaneioBusca, setRomaneioBusca] = useState("");
  const [romaneios, setRomaneios] = useState<string[]>([]);
  const [romaneioSelecionado, setRomaneioSelecionado] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [oss, setOss] = useState<any[]>([]);
  const [osSelecionada, setOsSelecionada] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [vinculados, setVinculados] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);

  useEffect(() => {
    if (open) {
      carregarRomaneios();
      carregarOss();
      setRomaneioSelecionado(null);
      setDocumentos([]);
      setOsSelecionada(null);
      setVinculados(0);
      setTotalDocs(0);
    }
  }, [open]);

  const carregarRomaneios = async () => {
    try {
      const { data } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("metadata->romaneio_numero")
        .not("metadata->romaneio_numero", "is", null);

      if (data) {
        const numeros = [...new Set(
          data
            .map((d: any) => d.romaneio_numero)
            .filter(Boolean)
            .filter((n: string) => n.trim().length > 0)
        )].sort((a: string, b: string) => b.localeCompare(a));
        setRomaneios(numeros as string[]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar romaneios:", err);
    }
  };

  const carregarOss = async () => {
    try {
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, numero, cliente, status")
        .order("created_at", { ascending: false })
        .limit(50);

      setOss(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar OSs:", err);
    }
  };

  const buscarDocumentos = async (romaneioNumero: string) => {
    setBuscando(true);
    setRomaneioSelecionado(romaneioNumero);
    setDocumentos([]);
    setVinculados(0);
    setTotalDocs(0);

    try {
      const { data } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("id, numero, emitente_nome, metadata, ordem_servico_id, status")
        .filter("metadata->>romaneio_numero", "eq", romaneioNumero)
        .order("numero", { ascending: true });

      setDocumentos(data || []);
      setTotalDocs(data?.length || 0);

      const jaVinculados = data?.filter((d: any) => d.ordem_servico_id).length || 0;
      setVinculados(jaVinculados);
    } catch (err: any) {
      toast.error("Erro ao buscar documentos: " + err.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleVincular = async () => {
    if (!romaneioSelecionado || !osSelecionada || documentos.length === 0) return;

    setVinculando(true);
    let sucessos = 0;
    const erros: string[] = [];

    for (const doc of documentos) {
      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .update({
          ordem_servico_id: osSelecionada,
          status: "vinculado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (error) {
        erros.push(`NF-e ${doc.numero}: ${error.message}`);
      } else {
        sucessos++;
      }
    }

    setVinculados(sucessos);

    if (erros.length > 0) {
      toast.error(`${erros.length} erro(s): ${erros.slice(0, 3).join("; ")}`);
    }

    toast.success(`${sucessos}/${documentos.length} NF-es vinculadas à OS!`);
    setVinculando(false);
    onVinculado();

    if (sucessos === documentos.length) {
      setTimeout(() => onOpenChange(false), 800);
    }
  };

  const romaneiosFiltrados = romaneioBusca
    ? romaneios.filter((r) => r.includes(romaneioBusca))
    : romaneios;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            Vincular Romaneio à OS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Passo 1: Selecionar romaneio */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              1. Selecione o romaneio
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar romaneio (ex: 340612)"
                value={romaneioBusca}
                onChange={(e) => setRomaneioBusca(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[150px] overflow-y-auto">
              {romaneiosFiltrados.map((num) => (
                <Button
                  key={num}
                  variant={romaneioSelecionado === num ? "default" : "outline"}
                  size="sm"
                  className="text-xs justify-start"
                  onClick={() => buscarDocumentos(num)}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {num}
                </Button>
              ))}
              {romaneiosFiltrados.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-4 py-2">
                  Nenhum romaneio encontrado.
                </p>
              )}
            </div>
          </div>

          {/* Passo 2: Listar documentos */}
          {romaneioSelecionado && (
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  2. Documentos do romaneio {romaneioSelecionado}
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {totalDocs} NF-es
                  </Badge>
                  {vinculados > 0 && (
                    <Badge className="bg-green-50 text-green-700 text-xs">
                      {vinculados} vinculadas
                    </Badge>
                  )}
                </div>
              </div>

              {buscando ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {documentos.map((doc) => {
                    const meta = doc.metadata || {};
                    const fonte = meta.fonte_endereco_entrega || "xml";
                    const pendente = meta.pendente_conferencia_endereco !== false;
                    const enderecoOk = fonte !== "xml" && !pendente;
                    const endereco = meta.endereco_completo || "(sem endereco)";
                    const jaVinculado = !!doc.ordem_servico_id;

                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between text-xs p-2 rounded ${
                          jaVinculado ? "bg-green-50" : "bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-medium">
                            {doc.numero || "S/N"}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              fonte === "manual" || fonte === "romaneio"
                                ? "bg-green-50 text-green-700"
                                : fonte === "xml"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100"
                            }`}
                          >
                            {fonte === "romaneio"
                              ? "Romaneio"
                              : fonte === "manual"
                              ? "Manual"
                              : "XML"}
                          </Badge>
                          {pendente && (
                            <Badge className="bg-red-50 text-red-600 text-[10px]">
                              Pendente
                            </Badge>
                          )}
                          <span
                            className={`truncate max-w-[250px] ${
                              enderecoOk ? "text-green-700" : "text-slate-400"
                            }`}
                          >
                            {enderecoOk ? endereco : "Endereco nao conferido"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {jaVinculado ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <span className="text-amber-500 text-[10px]">
                              Aguardando
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Passo 3: Selecionar OS */}
          {romaneioSelecionado && documentos.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                3. Selecione a OS
              </label>
              <Select
                value={osSelecionada || ""}
                onValueChange={setOsSelecionada}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha uma OS..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
                      <Input
                        placeholder="Filtrar OS..."
                        className="pl-7 h-8 text-xs"
                        onChange={(e) => {
                          const filtro = e.target.value.toLowerCase();
                          const items = document.querySelectorAll(
                            "[data-os-item]"
                          );
                          items.forEach((item: any) => {
                            const texto =
                              item.textContent?.toLowerCase() || "";
                            item.style.display = texto.includes(filtro)
                              ? ""
                              : "none";
                          });
                        }}
                      />
                    </div>
                  </div>
                  {oss.map((os) => (
                    <SelectItem
                      key={os.id}
                      value={os.id}
                      data-os-item
                    >
                      <span className="font-mono text-xs font-medium">
                        {os.numero}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {os.cliente || ""} — {os.status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleVincular}
            disabled={
              !romaneioSelecionado ||
              !osSelecionada ||
              documentos.length === 0 ||
              vinculando
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {vinculando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            {vinculando
              ? "Vinculando..."
              : `Vincular ${documentos.length} NF-es à OS`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

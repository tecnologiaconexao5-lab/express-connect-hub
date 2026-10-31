// ============================================================
// Portal do Prestador — Execução da OS (App do Motorista)
// Check-in com GPS, POD (foto + assinatura) e baixa final.
// ============================================================

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadFotoPOD } from "@/services/podService";
import {
  finalizarOSComPOD,
  registrarChegadaMotorista,
  type OportunidadeRedeMobile,
} from "@/services/portal-prestador/redeOportunidadesService";

const COORDS_FALLBACK = { latitude: -23.5614, longitude: -46.6559 };

function obterPosicaoAtual(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(COORDS_FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(COORDS_FALLBACK),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

async function dataUrlParaArquivo(dataUrl: string, nome: string): Promise<File> {
  const resposta = await fetch(dataUrl);
  const blob = await resposta.blob();
  return new File([blob], nome, { type: blob.type || "image/png" });
}

export default function ExecucaoOSDialog({
  oportunidade,
  open,
  onOpenChange,
  onFinalizada,
}: {
  oportunidade: OportunidadeRedeMobile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalizada?: () => void;
}) {
  const [chegadaEm, setChegadaEm] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [registrandoChegada, setRegistrandoChegada] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temTraco, setTemTraco] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizada, setFinalizada] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const limparEstado = useCallback(() => {
    setChegadaEm(null);
    setCoords(null);
    setFotoUrl(null);
    setAssinaturaUrl(null);
    setTemTraco(false);
    setFinalizada(false);
  }, []);

  const handleChegada = async () => {
    if (!oportunidade || registrandoChegada) return;
    setRegistrandoChegada(true);
    try {
      const posicao = await obterPosicaoAtual();
      await registrarChegadaMotorista({
        osId: oportunidade.osId || oportunidade.id,
        latitude: posicao.latitude,
        longitude: posicao.longitude,
      });
      setCoords(posicao);
      setChegadaEm(new Date().toISOString());
      toast.success("Chegada registrada!", {
        description: `GPS capturado em ${posicao.latitude.toFixed(5)}, ${posicao.longitude.toFixed(5)}.`,
      });
    } catch (error) {
      toast.error("Não foi possível registrar a chegada.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRegistrandoChegada(false);
    }
  };

  const handleFoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setFotoUrl(String(leitor.result || ""));
    leitor.readAsDataURL(arquivo);
    event.target.value = "";
  };

  const posicaoCanvas = (evento: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((evento.clientX - rect.left) / rect.width) * canvas.width,
      y: ((evento.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const iniciarTraco = (evento: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = posicaoCanvas(evento);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDesenhando(true);
    setTemTraco(true);
  };

  const desenharTraco = (evento: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !desenhando) return;
    const pos = posicaoCanvas(evento);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAssinaturaUrl(null);
    setTemTraco(false);
  };

  const confirmarAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setAssinaturaUrl(canvas.toDataURL("image/png"));
    toast.success("Assinatura registrada!");
  };

  const handleFinalizar = async () => {
    if (!oportunidade) return;
    if (!fotoUrl || !assinaturaUrl) {
      toast.error("Envie a foto do comprovante e confirme a assinatura.");
      return;
    }
    setFinalizando(true);
    try {
      const osId = oportunidade.osId || oportunidade.id;
      const [urlFoto, urlAssinatura] = await Promise.all([
        uploadFotoPOD(await dataUrlParaArquivo(fotoUrl, "pod-foto.png"), `os-mobile/${osId}`),
        uploadFotoPOD(await dataUrlParaArquivo(assinaturaUrl, "pod-assinatura.png"), `os-mobile/${osId}`),
      ]);

      await finalizarOSComPOD({
        osId,
        fotoEntregaUrl: urlFoto || fotoUrl,
        assinaturaUrl: urlAssinatura || assinaturaUrl,
        recebedor: "Recebedor App E2E",
        observacao: "Baixa realizada pelo App do Motorista",
      });

      setFinalizada(true);
      onFinalizada?.();
      toast.success("OS finalizada com sucesso!", {
        description: "POD (foto + assinatura) enviado para a Torre de Controle.",
      });
    } catch (error) {
      toast.error("Não foi possível finalizar a OS.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setFinalizando(false);
    }
  };

  const fechar = (aberto: boolean) => {
    if (!aberto) limparEstado();
    onOpenChange(aberto);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            OS em Andamento
          </DialogTitle>
          <DialogDescription>
            {oportunidade?.osNumero || oportunidade?.osId || "—"} · {oportunidade?.origem} →{" "}
            {oportunidade?.destino}
          </DialogDescription>
        </DialogHeader>

        {finalizada ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="text-base font-black text-emerald-800">OS finalizada com sucesso</p>
            <p className="text-xs font-semibold text-emerald-700">
              POD enviado · foto do comprovante + assinatura digital
            </p>
            <Button variant="outline" className="mt-2 w-full" onClick={() => fechar(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Check-in no local
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Captura o GPS do motorista para a Torre de Controle.
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-10 shrink-0 gap-2 bg-primary text-primary-foreground"
                  disabled={Boolean(chegadaEm) || registrandoChegada}
                  onClick={() => void handleChegada()}
                >
                  {registrandoChegada ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {chegadaEm ? "Chegada registrada" : "Cheguei no local"}
                </Button>
              </div>
              {chegadaEm && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700">
                  ✅ {new Date(chegadaEm).toLocaleTimeString("pt-BR")} · GPS{" "}
                  {coords?.latitude.toFixed(5)}, {coords?.longitude.toFixed(5)}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <Camera className="h-3.5 w-3.5" /> Foto do comprovante de entrega
              </Label>
              <input
                type="file"
                accept="image/*"
                data-testid="pod-foto-input"
                onChange={handleFoto}
                className="block w-full rounded-lg border border-border bg-background p-2 text-xs"
              />
              {fotoUrl && (
                <img
                  src={fotoUrl}
                  alt="Comprovante de entrega"
                  className="mt-2 h-32 w-full rounded-xl object-cover"
                />
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Pencil className="h-3.5 w-3.5" /> Assinatura do recebedor
                </Label>
                <div className="flex gap-1">
                  {temTraco && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1 bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-700"
                      onClick={confirmarAssinatura}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Confirmar assinatura
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={limparAssinatura}
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border-2 border-border bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  onMouseDown={iniciarTraco}
                  onMouseMove={desenharTraco}
                  onMouseUp={() => setDesenhando(false)}
                  onMouseLeave={() => setDesenhando(false)}
                  className="h-32 w-full touch-none cursor-crosshair"
                />
                {!temTraco && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/50">
                    Assine aqui
                  </span>
                )}
              </div>
              {assinaturaUrl && (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Assinatura registrada
                </p>
              )}
            </div>

            <Button
              type="button"
              className="h-12 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!chegadaEm || !fotoUrl || !assinaturaUrl || finalizando}
              onClick={() => void handleFinalizar()}
            >
              {finalizando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {finalizando ? "Finalizando OS..." : "Finalizar OS"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

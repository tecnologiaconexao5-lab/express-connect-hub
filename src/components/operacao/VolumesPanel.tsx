import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Barcode,
  ClipboardList,
  Download,
  FileUp,
  Loader2,
  Package,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  atualizarStatusVolume,
  baixarManifestoCSV,
  calcularContadores,
  EVENTO_VOLUME_LABEL,
  gerarVolumesAutomaticos,
  importarCodigosCliente,
  listarMovimentacoesVolume,
  listarVolumesOS,
  STATUS_VOLUME_LABEL,
  STATUS_VOLUME_TONE,
  urlAssinadaEvidencia,
  type OSVolume,
  type OSVolumeStatus,
  type VolumeMovimentacao,
} from "@/services/volumesService";
import { formatarDataHoraBR } from "@/lib/formatDates";

interface VolumesPanelProps {
  ordemServicoId?: string | null;
  numeroOS?: string | null;
  quantidadeSugerida?: number;
  pesoTotalKg?: number | null;
  cubagemTotalM3?: number | null;
  readOnly?: boolean;
}

const STATUS_OPCOES: OSVolumeStatus[] = [
  "aguardando_coleta",
  "coletado",
  "em_transito",
  "entregue",
  "recusado_parcial",
  "em_devolucao",
  "devolvido_base",
  "divergente",
];

function fmtDataHora(valor?: string | null): string {
  if (!valor) return "—";
  try {
    return formatarDataHoraBR(valor);
  } catch {
    return new Date(valor).toLocaleString("pt-BR");
  }
}

export default function VolumesPanel({
  ordemServicoId,
  numeroOS,
  quantidadeSugerida = 0,
  pesoTotalKg,
  cubagemTotalM3,
  readOnly = false,
}: VolumesPanelProps) {
  const [volumes, setVolumes] = useState<OSVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<OSVolumeStatus | "todos">("todos");
  const [gerarOpen, setGerarOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const [custodiaVolume, setCustodiaVolume] = useState<OSVolume | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<VolumeMovimentacao[]>([]);
  const [custodiaLoading, setCustodiaLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [gerarQtd, setGerarQtd] = useState(String(quantidadeSugerida || 0));
  const [importTexto, setImportTexto] = useState("");
  const [salvandoStatusId, setSalvandoStatusId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!ordemServicoId) {
      setVolumes([]);
      return;
    }
    setLoading(true);
    try {
      setVolumes(await listarVolumesOS(ordemServicoId));
    } finally {
      setLoading(false);
    }
  }, [ordemServicoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setGerarQtd(String(quantidadeSugerida || 0));
  }, [quantidadeSugerida]);

  const contadores = useMemo(() => calcularContadores(volumes), [volumes]);

  const volumesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return volumes.filter((v) => {
      if (filtroStatus !== "todos" && v.status_atual !== filtroStatus) return false;
      if (!termo) return true;
      return [v.codigo_barras, v.qr_code, v.descricao, v.sku, v.lote, v.recebedor_nome]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo));
    });
  }, [volumes, busca, filtroStatus]);

  async function handleGerar() {
    if (!ordemServicoId) return;
    const qtd = Math.floor(Number(gerarQtd) || 0);
    if (qtd <= 0) {
      toast.error("Informe a quantidade de volumes a gerar.");
      return;
    }
    setGerando(true);
    try {
      const resultado = await gerarVolumesAutomaticos({
        ordemServicoId,
        numeroOS,
        quantidade: qtd,
        pesoTotalKg: pesoTotalKg ?? null,
        cubagemTotalM3: cubagemTotalM3 ?? null,
      });
      toast.success(`${resultado.inseridos} volume(s) gerado(s) com etiquetas e QR Code.`);
      setGerarOpen(false);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar os volumes.");
    } finally {
      setGerando(false);
    }
  }

  async function handleImportar() {
    if (!ordemServicoId) return;
    if (!importTexto.trim()) {
      toast.error("Cole os códigos do cliente ou selecione um arquivo CSV.");
      return;
    }
    setImportando(true);
    try {
      const resultado = await importarCodigosCliente({ ordemServicoId, texto: importTexto });
      toast.success(
        `${resultado.inseridos} código(s) importado(s); ${resultado.atualizados} atualizado(s); ${resultado.ignorados} já existente(s).`,
      );
      setImportarOpen(false);
      setImportTexto("");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar os códigos.");
    } finally {
      setImportando(false);
    }
  }

  async function handleArquivo(file: File | null) {
    if (!file) return;
    try {
      const texto = await file.text();
      setImportTexto(texto);
      toast.info("Arquivo carregado. Revise os códigos e confirme a importação.");
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  }

  async function handleStatus(volume: OSVolume, status: OSVolumeStatus) {
    setSalvandoStatusId(volume.id);
    try {
      await atualizarStatusVolume({
        volumeId: volume.id,
        ordemServicoId: volume.ordem_servico_id,
        status,
        observacao: `Status atualizado no TMS para ${STATUS_VOLUME_LABEL[status]}`,
      });
      toast.success(`Volume ${volume.codigo_barras || volume.id} atualizado para ${STATUS_VOLUME_LABEL[status]}.`);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o status.");
    } finally {
      setSalvandoStatusId(null);
    }
  }

  async function registrarApresentacao(volume: OSVolume) {
    setSalvandoStatusId(volume.id);
    try {
      await atualizarStatusVolume({
        volumeId: volume.id,
        ordemServicoId: volume.ordem_servico_id,
        status: "coletado",
        observacao: "Registrar apresentação — conferência na coleta (TMS)",
      });
      toast.success("Apresentação registrada na coleta.");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a apresentação.");
    } finally {
      setSalvandoStatusId(null);
    }
  }

  async function abrirCustodia(volume: OSVolume) {
    setCustodiaVolume(volume);
    setCustodiaLoading(true);
    try {
      setMovimentacoes(await listarMovimentacoesVolume(volume.id));
    } finally {
      setCustodiaLoading(false);
    }
  }

  if (!ordemServicoId) {
    return (
      <Card className="border-dashed border-2 border-slate-200 shadow-none">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="rounded-xl bg-slate-100 p-3">
            <Barcode className="w-6 h-6 text-slate-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Manifesto Digital de Carga</p>
            <p className="text-sm text-muted-foreground">
              Salve a OS para gerar etiquetas, importar códigos do cliente e acompanhar a cadeia de custódia dos volumes.
            </p>
          </div>
          <Badge variant="secondary">Aguardando gravação da OS</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/60 border-b pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Manifesto Digital de Carga
              {numeroOS && <Badge variant="outline" className="ml-1 font-mono">{numeroOS}</Badge>}
            </CardTitle>
            <CardDescription>
              Volumes individuais, etiquetas QR Code, conferência e cadeia de custódia da operação.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEtiquetasOpen(true)} disabled={volumes.length === 0}>
              <Printer className="w-4 h-4 mr-1.5" /> Imprimir etiquetas
            </Button>
            <Button size="sm" variant="outline" onClick={() => baixarManifestoCSV(volumes, numeroOS)} disabled={volumes.length === 0}>
              <Download className="w-4 h-4 mr-1.5" /> Exportar manifesto
            </Button>
            {!readOnly && (
              <>
                <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
                  <FileUp className="w-4 h-4 mr-1.5" /> Importar códigos
                </Button>
                <Button size="sm" onClick={() => setGerarOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Gerar etiquetas/volumes
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <ContadorBox label="Previstos" valor={contadores.previstos} tone="bg-slate-50 text-slate-800 border-slate-200" />
          <ContadorBox label="Conferidos na coleta" valor={contadores.conferidosColeta} tone="bg-sky-50 text-sky-800 border-sky-200" />
          <ContadorBox label="Entregues" valor={contadores.entregues} tone="bg-emerald-50 text-emerald-800 border-emerald-200" />
          <ContadorBox label="Pendentes" valor={contadores.pendentes} tone="bg-amber-50 text-amber-800 border-amber-200" />
          <ContadorBox label="Em devolução" valor={contadores.emDevolucao} tone="bg-orange-50 text-orange-800 border-orange-200" />
          <ContadorBox label="Divergentes" valor={contadores.divergentes} tone="bg-red-50 text-red-800 border-red-200" alerta={contadores.divergentes > 0} />
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, SKU, lote ou recebedor..."
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as OSVolumeStatus | "todos")}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_VOLUME_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando manifesto...
          </div>
        ) : volumes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum volume individual cadastrado. Gere as etiquetas automaticamente ou importe os códigos do cliente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código / QR</TableHead>
                  <TableHead>Descrição / SKU</TableHead>
                  <TableHead>Lote / Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recebedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumesFiltrados.map((volume) => (
                  <TableRow key={volume.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="rounded-md border bg-white p-1">
                          <QRCodeSVG value={volume.qr_code || volume.codigo_barras || volume.id} size={34} />
                        </div>
                        <span className="font-mono text-xs font-semibold">{volume.codigo_barras || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{volume.descricao || "—"}</p>
                      {volume.sku && <p className="text-[11px] text-muted-foreground">SKU: {volume.sku}</p>}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{volume.lote || "—"}</p>
                      {volume.data_validade && (
                        <p className="text-[11px] text-muted-foreground">Validade: {volume.data_validade}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_VOLUME_TONE[volume.status_atual]}>
                        {STATUS_VOLUME_LABEL[volume.status_atual]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{volume.recebedor_nome || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Select
                          value={volume.status_atual}
                          onValueChange={(v) => void handleStatus(volume, v as OSVolumeStatus)}
                          disabled={readOnly || salvandoStatusId === volume.id}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPCOES.map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_VOLUME_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!readOnly && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => void registrarApresentacao(volume)}
                            disabled={salvandoStatusId === volume.id}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Registrar apresentação
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void abrirCustodia(volume)}>
                          <History className="w-3.5 h-3.5 mr-1" /> Custódia
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Gerar volumes */}
      <Dialog open={gerarOpen} onOpenChange={setGerarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar etiquetas e volumes</DialogTitle>
            <DialogDescription>
              Gera códigos únicos no padrão VOL-OS-000 e QR Code para impressão (folha ou etiqueta térmica).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantidade de volumes</Label>
              <Input type="number" min={1} value={gerarQtd} onChange={(e) => setGerarQtd(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              A OS possui {quantidadeSugerida || 0} volume(s) informado(s) na carga. Os volumes já existentes são preservados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGerarOpen(false)} disabled={gerando}>Cancelar</Button>
            <Button onClick={() => void handleGerar()} disabled={gerando}>
              {gerando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Gerar etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar códigos */}
      <Dialog open={importarOpen} onOpenChange={setImportarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar códigos do cliente</DialogTitle>
            <DialogDescription>
              Cole a lista ou envie um CSV. Formato por linha: <span className="font-mono">codigo;sku;lote;AAAA-MM-DD;descricao</span> (campos após o código são opcionais).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Arquivo CSV/TXT</Label>
              <Input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void handleArquivo(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Códigos</Label>
              <Textarea
                rows={8}
                value={importTexto}
                onChange={(e) => setImportTexto(e.target.value)}
                placeholder={"CX-0001;SKU-10;LOTE-A;2027-01-31;Caixa 1\nCX-0002\nCX-0003;SKU-12"}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportarOpen(false)} disabled={importando}>Cancelar</Button>
            <Button onClick={() => void handleImportar()} disabled={importando}>
              {importando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Importar códigos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etiquetas */}
      <Dialog open={etiquetasOpen} onOpenChange={setEtiquetasOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Etiquetas de volumes</DialogTitle>
            <DialogDescription>
              {volumes.length} etiqueta(s). Use a impressão do navegador para folha A4 ou etiqueta térmica.
            </DialogDescription>
          </DialogHeader>
          <div className="no-print flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEtiquetasOpen(false)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .volumes-etiquetas-print, .volumes-etiquetas-print * { visibility: visible !important; }
              .volumes-etiquetas-print { position: absolute !important; left: 0; top: 0; width: 100%; background: #fff; padding: 8mm; }
              .volumes-etiquetas-print .etiqueta { break-inside: avoid; page-break-inside: avoid; }
              .no-print { display: none !important; }
            }
          `}</style>
          <div className="volumes-etiquetas-print grid grid-cols-2 md:grid-cols-3 gap-3">
            {volumes.map((volume) => (
              <div key={volume.id} className="etiqueta border rounded-lg p-3 flex gap-3 items-center bg-white">
                <QRCodeSVG value={volume.qr_code || volume.codigo_barras || volume.id} size={92} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Conexão Express</p>
                  <p className="font-mono font-bold text-xs break-all">{volume.codigo_barras || volume.id}</p>
                  {numeroOS && <p className="text-[10px] text-slate-600">OS: {numeroOS}</p>}
                  {volume.sku && <p className="text-[10px] text-slate-600">SKU: {volume.sku}</p>}
                  {volume.lote && <p className="text-[10px] text-slate-600">Lote: {volume.lote}</p>}
                  {volume.data_validade && <p className="text-[10px] text-slate-600">Validade: {volume.data_validade}</p>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Custódia */}
      <Dialog open={!!custodiaVolume} onOpenChange={(open) => { if (!open) setCustodiaVolume(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Cadeia de custódia
            </DialogTitle>
            <DialogDescription>
              {custodiaVolume?.codigo_barras} · {STATUS_VOLUME_LABEL[custodiaVolume?.status_atual || "aguardando_coleta"]}
            </DialogDescription>
          </DialogHeader>
          {custodiaLoading ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando movimentações...</div>
          ) : movimentacoes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
          ) : (
            <div className="space-y-3">
              {movimentacoes.map((mov) => (
                <MovimentacaoItem key={mov.id} mov={mov} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContadorBox({ label, valor, tone, alerta }: { label: string; valor: number; tone: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
        {alerta && <AlertTriangle className="w-3.5 h-3.5" />}
      </div>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}

function MovimentacaoItem({ mov }: { mov: VolumeMovimentacao }) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    if (mov.foto_path) {
      void urlAssinadaEvidencia(mov.foto_path).then((url) => { if (ativo) setFotoUrl(url); });
    }
    return () => { ativo = false; };
  }, [mov.foto_path]);

  return (
    <div className="rounded-lg border p-3 flex gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{EVENTO_VOLUME_LABEL[mov.tipo_evento] || mov.tipo_evento}</p>
          <span className="text-xs text-muted-foreground">{fmtDataHora(mov.registrado_em)}</span>
        </div>
        {mov.observacao && <p className="text-xs text-slate-600 mt-1">{mov.observacao}</p>}
        <div className="flex flex-wrap items-center gap-3 mt-1.5">
          {mov.latitude != null && mov.longitude != null && (
            <a
              className="text-[11px] text-blue-600 underline"
              href={`https://www.google.com/maps?q=${mov.latitude},${mov.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver GPS ({Number(mov.latitude).toFixed(5)}, {Number(mov.longitude).toFixed(5)})
            </a>
          )}
          {fotoUrl && (
            <a className="text-[11px] text-blue-600 underline" href={fotoUrl} target="_blank" rel="noreferrer">
              Ver foto
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

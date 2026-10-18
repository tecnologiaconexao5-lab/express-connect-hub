import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck, Download, Eye, Camera, Signature, User, Calendar, Truck,
  MapPin, Clock, FileText, AlertCircle, CheckCircle2, X, ChevronDown, ChevronUp,
  Copy, ExternalLink, Search, Filter, RefreshCw, Image, FileDown, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PortalEmptyState, PortalDrawerPOD, PortalComparacaoEntregas } from "@/components/portal-cliente";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import type { ComprovanteResumo } from "@/services/portalCliente/portalClienteService";

interface ComprovanteCardProps {
  comp: ComprovanteResumo;
  onVer: (c: ComprovanteResumo) => void;
  onDownload: (c: ComprovanteResumo) => void;
  compararMode?: boolean;
  selected?: boolean;
  onToggleSelecao?: (id: number) => void;
}

interface EntregaDashboardProps {
  comp: ComprovanteResumo;
  compararMode?: boolean;
  selected?: boolean;
  onToggleSelecao?: (id: number) => void;
}

interface PortalComprovantesPremiumProps {
  comprovantes: ComprovanteResumo[];
  loading: boolean;
  onRefresh: () => void;
}

const fmtDataHora = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtData = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const calcEntregaScore = (comp: ComprovanteResumo) => {
  const checks = {
    foto: !!(comp.foto_entrega_url || comp.foto_canhoto_url),
    assinatura: !!comp.assinatura_url,
    recebedor: !!comp.nome_recebedor,
    documento: !!comp.documento_recebedor,
    horario: !!comp.data_entrega,
    canhoto: !!comp.foto_canhoto_url,
  };
  const ok = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  return { score: Math.round((ok / total) * 100), checks, ok, total };
};

const EntregaDashboard = memo(function EntregaDashboard({ comp, compararMode, selected, onToggleSelecao }: EntregaDashboardProps) {
  const { score, checks } = calcEntregaScore(comp);
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  return (
    <div className="px-4 pt-3 pb-1 bg-gradient-to-r from-[#F8FAFC] to-white border-b border-[#E5E7EB]/50">
      <div className="flex items-stretch gap-2">
        {compararMode && (
          <div className={`w-8 rounded-lg flex items-center justify-center text-base font-black border-2 flex-shrink-0 ${selected ? "bg-[#F97316] text-white border-[#F97316]" : "bg-white text-slate-300 border-slate-200"}`}>
            {selected ? "✓" : ""}
          </div>
        )}
        <div className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`text-xs font-black ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {score}%
          </div>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(s => (
              <span key={s} className={`text-[9px] ${s <= stars ? "text-amber-400" : "text-slate-200"}`}>★</span>
            ))}
          </div>
        </div>
        <Badge className={`text-[9px] px-2 py-0 rounded-full border font-bold ${
          score >= 80 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
          score >= 50 ? "bg-amber-50 text-amber-600 border-amber-200" :
          "bg-red-50 text-red-600 border-red-200"
        }`}>
          {score >= 80 ? "Excelente" : score >= 50 ? "Parcial" : "Incompleto"}
        </Badge>
        </div>
      </div>
    </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-medium">
        {[
          { key: "foto", label: "Foto" },
          { key: "canhoto", label: "Canhoto" },
          { key: "assinatura", label: "Assinatura" },
          { key: "recebedor", label: "Recebedor" },
          { key: "documento", label: "Documento" },
          { key: "horario", label: "Data/Hora" },
        ].map(({ key, label }) => {
          const ok = checks[key as keyof typeof checks];
          return (
            <span key={key} className={`inline-flex items-center gap-0.5 ${ok ? "text-emerald-600" : "text-slate-300"}`}>
              {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
});

const ComprovanteCard = memo(function ComprovanteCard({ comp, onVer, onDownload, compararMode, selected, onToggleSelecao }: ComprovanteCardProps) {
  const temFoto = !!(comp.foto_entrega_url || comp.foto_canhoto_url);
  const temAssinatura = !!comp.assinatura_url;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer ${selected ? "border-[#F97316] ring-2 ring-[#F97316]/20" : "border-[#E5E7EB] hover:border-[#F97316]/50 hover:shadow-lg"}`}
      onClick={() => compararMode && onToggleSelecao?.(comp.id)}
    >
      <EntregaDashboard comp={comp} compararMode={compararMode} selected={selected} onToggleSelecao={onToggleSelecao} />
      {comp.foto_entrega_url && (
        <div
          className="h-32 bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${comp.foto_entrega_url})` }}
          onClick={() => window.open(comp.foto_entrega_url!, "_blank")}
        />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#F97316]" />
            <span className="text-sm font-bold text-[#111827]">{comp.titulo || "OS"}</span>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-500/5 text-emerald-600 border-emerald-200">
            {comp.tipo}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-[#64748B]">
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{comp.nome_recebedor || "Não informado"}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtData(comp.data_entrega)}</span>
          {comp.documento_recebedor && (
            <span className="flex items-center gap-1 col-span-2"><FileText className="w-3 h-3" />{comp.documento_recebedor}</span>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 bg-white border-[#E5E7EB] text-[#475569] rounded-full text-xs" onClick={() => onVer(comp)}>
            <Eye className="w-3 h-3 mr-1" />Ver
          </Button>
          <Button size="sm" variant="outline" className="flex-1 bg-white border-[#E5E7EB] text-[#475569] rounded-full text-xs" onClick={() => onDownload(comp)}>
            <Download className="w-3 h-3 mr-1" />Baixar
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

export default function PortalComprovantesPremium({ comprovantes, loading, onRefresh }: PortalComprovantesPremiumProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ComprovanteResumo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIndex, setDrawerIndex] = useState(0);
  const [compararMode, setCompararMode] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [filtroOS, setFiltroOS] = useState("");
  const [filtroDest, setFiltroDest] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todas");

  const filtered = useMemo(() => {
    return comprovantes.filter(c => {
      if (filtroOS && !c.titulo?.toLowerCase().includes(filtroOS.toLowerCase())) return false;
      if (filtroDest && !c.nome_recebedor?.toLowerCase().includes(filtroDest.toLowerCase())) return false;
      if (filtroPeriodo !== "todas") {
        const d = c.data_entrega ? new Date(c.data_entrega) : null;
        if (!d) return false;
        const hoje = new Date();
        const dias = {
          "7dias": 7, "30dias": 30, "90dias": 90
        }[filtroPeriodo] || 0;
        if (dias > 0) {
          const limite = new Date(hoje);
          limite.setDate(limite.getDate() - dias);
          if (d < limite) return false;
        }
      }
      return true;
    });
  }, [comprovantes, filtroOS, filtroDest, filtroPeriodo]);

  const handleVer = useCallback((comp: ComprovanteResumo) => {
    const idx = filtered.findIndex(c => c.id === comp.id);
    setDrawerIndex(idx >= 0 ? idx : 0);
    setSelected(comp);
    setDrawerOpen(true);
  }, [filtered]);

  const handleNavigate = useCallback((index: number) => {
    const comp = filtered[index];
    if (comp) {
      setDrawerIndex(index);
      setSelected(comp);
    }
  }, [filtered]);

  const handleDownloadIndividual = useCallback((comp: ComprovanteResumo) => {
    const fotos = [comp.foto_entrega_url, comp.foto_canhoto_url, comp.assinatura_url].filter(Boolean) as string[];
    if (fotos.length > 0) {
      fotos.forEach(url => window.open(url, "_blank"));
      toast({ title: "Download iniciado", description: `${fotos.length} arquivo(s) aberto(s)` });
      return;
    }
    gerarPDFProfissional({
      titulo: `Comprovante ${comp.titulo || "OS"}`,
      subtitulo: `Recebedor: ${comp.nome_recebedor || "N/I"} | ${fmtData(comp.data_entrega)}`,
      colunas: ["Campo", "Valor"],
      linhas: [
        ["OS", comp.titulo || "N/I"],
        ["Tipo", comp.tipo],
        ["Recebedor", comp.nome_recebedor || "Não informado"],
        ["Documento", comp.documento_recebedor || "Não informado"],
        ["Data", fmtDataHora(comp.data_entrega)],
        ["Observação", comp.observacao || "—"],
      ],
    });
    toast({ title: "PDF gerado", description: "Comprovante exportado em PDF" });
  }, [toast]);

  const filteredSelected = useMemo(() => filtered.filter(c => selecionados.has(c.id)), [filtered, selecionados]);

  const toggleSelecao = useCallback((id: number) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }, []);

  const handleCompararClick = useCallback(() => {
    if (compararMode) {
      setCompararMode(false);
      setSelecionados(new Set());
    } else {
      setCompararMode(true);
    }
  }, [compararMode]);

  const handleBaixarTodos = useCallback(async () => {
    if (filtered.length === 0) {
      toast({ title: "Nada a exportar", description: "Nenhum comprovante disponível" });
      return;
    }
    const linhas = filtered.map(c => [
      c.titulo || "N/I", c.tipo,
      c.nome_recebedor || "N/I",
      c.documento_recebedor || "N/I",
      fmtDataHora(c.data_entrega),
      c.observacao || "—"
    ]);
    await gerarPDFProfissional({
      titulo: "Comprovantes de Entrega",
      subtitulo: `${filtered.length} registro(s)`,
      colunas: ["OS", "Tipo", "Recebedor", "Documento", "Data/Hora", "Observação"],
      linhas,
      orientacao: "landscape",
    });
    toast({ title: "Relatório gerado", description: `${filtered.length} comprovante(s) exportados` });
  }, [filtered, toast]);

  const totalComFotos = useMemo(() => comprovantes.filter(c => c.foto_entrega_url || c.foto_canhoto_url).length, [comprovantes]);
  const totalComAssinatura = useMemo(() => comprovantes.filter(c => c.assinatura_url).length, [comprovantes]);
  const totalFotos = useMemo(() => comprovantes.reduce((acc, c) => acc + [c.foto_entrega_url, c.foto_canhoto_url, c.assinatura_url].filter(Boolean).length, 0), [comprovantes]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (comprovantes.length === 0) {
    return (
      <PortalEmptyState
        type="sem-resultado"
        title="Nenhum comprovante disponível"
        description="Assim que uma entrega for concluída, fotos, assinatura e protocolo aparecerão aqui."
        actionLabel="Atualizar"
        onAction={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-[#F97316]" />
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Total</p>
                <p className="text-2xl font-black text-[#111827]">{comprovantes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Com Fotos</p>
                <p className="text-2xl font-black text-[#111827]">{totalComFotos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Signature className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Com Assinatura</p>
                <p className="text-2xl font-black text-[#111827]">{totalComAssinatura}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Downloads</p>
                <p className="text-2xl font-black text-[#111827]">{totalFotos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg text-[#111827]">Comprovantes de Entrega</CardTitle>
              <p className="text-sm text-[#64748B]">Fotos, assinaturas, canhotos e protocolos</p>
            </div>
            <div className="flex gap-2">
              <Button variant={compararMode ? "default" : "outline"} className={`rounded-xl ${compararMode ? "bg-[#F97316] hover:bg-[#EA580C] text-white" : "border-[#E5E7EB] text-[#475569]"}`} onClick={handleCompararClick}>
                <BarChart3 className="w-4 h-4 mr-2" /> {compararMode ? "Cancelar" : "Comparar"}
              </Button>
              <Button variant="outline" className="rounded-xl border-[#E5E7EB] text-[#475569]" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
              <Button variant="outline" className="rounded-xl border-[#E5E7EB] text-[#475569]" onClick={handleBaixarTodos}>
                <FileDown className="w-4 h-4 mr-2" /> Baixar Todos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Buscar OS..." className="rounded-xl bg-white border-[#E5E7EB]" value={filtroOS} onChange={e => setFiltroOS(e.target.value)} />
            <Input placeholder="Destinatário..." className="rounded-xl bg-white border-[#E5E7EB]" value={filtroDest} onChange={e => setFiltroDest(e.target.value)} />
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="rounded-xl bg-white border-[#E5E7EB]"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                <SelectItem value="90dias">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <PortalEmptyState type="sem-resultado" title="Nenhum resultado" description="Tente ajustar os filtros" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((comp) => (
                  <ComprovanteCard key={comp.id} comp={comp} onVer={handleVer} onDownload={handleDownloadIndividual} compararMode={compararMode} selected={selecionados.has(comp.id)} onToggleSelecao={toggleSelecao} />
                ))}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {compararMode && filteredSelected.length >= 2 && (
        <div className="rounded-2xl border border-[#F97316]/30 overflow-hidden shadow-lg">
          <PortalComparacaoEntregas comprovantes={filteredSelected} onClose={() => { setCompararMode(false); setSelecionados(new Set()); }} />
        </div>
      )}

      {compararMode && filteredSelected.length < 2 && filteredSelected.length > 0 && (
        <div className="text-center py-4 bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB]">
          <p className="text-xs text-[#64748B] font-medium">Selecione mais {2 - filteredSelected.length} entrega(s) para comparar (máx. 4)</p>
        </div>
      )}

      <PortalDrawerPOD
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        comprovante={selected}
        allComprovantes={filtered}
        currentIndex={drawerIndex}
        onNavigate={handleNavigate}
        onRefresh={onRefresh}
      />
    </div>
  );
}

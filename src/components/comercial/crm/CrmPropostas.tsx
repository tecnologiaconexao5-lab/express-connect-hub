import { useState } from "react";
import {
  FileText, Plus, Link, Upload, Download, Eye, Trash2, Search,
  BookOpen, Star, Tag, ExternalLink, Copy, Calendar, Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PropostaModelo, SEGMENTOS } from "./crmTypes";

const MODELOS_MOCK: PropostaModelo[] = [
  {
    id: "1", nome: "Proposta Carga Dedicada Premium", segmento: "Industrial", versao: "v2.1",
    descricao: "Modelo completo para clientes industriais com frota dedicada, SLA de 24h e rastreamento.",
    linkUrl: "#", criadoEm: new Date(2026, 2, 1)
  },
  {
    id: "2", nome: "Proposta E-commerce Last Mile", segmento: "E-commerce", versao: "v1.3",
    descricao: "Template otimizado para e-commerces com foco em last mile, janelas de entrega e devoluções.",
    linkUrl: "#", criadoEm: new Date(2026, 2, 15)
  },
  {
    id: "3", nome: "Proposta Carga Fracionada", segmento: "Retail / Varejo", versao: "v3.0",
    descricao: "Modelo para clientes de varejo com tabelas de carga fracionada e política de coleta.",
    pdfUrl: "#", linkUrl: "#", criadoEm: new Date(2026, 3, 1)
  },
  {
    id: "4", nome: "Proposta Farmacêutica Refrigerada", segmento: "Farmacêutico", versao: "v1.0",
    descricao: "Proposta especial para transporte de medicamentos com cadeia de frio e rastreabilidade RDC.",
    pdfUrl: "#", linkUrl: "#", criadoEm: new Date(2026, 3, 5)
  },
];

const FOLLOW_UP_CONFIG = [
  { dia: 1, mensagem: "Boa tarde, {nome}! Passando para confirmar o recebimento da nossa proposta. Qualquer dúvida, estou à disposição.", canal: "WhatsApp" },
  { dia: 3, mensagem: "Olá, {nome}! Já tive a oportunidade de revisar nossa proposta? Posso agendar uma ligação de 15 minutos para esclarecer pontos?", canal: "E-mail" },
  { dia: 5, mensagem: "{nome}, quero garantir que você não perca as condições especiais que preparei para a {empresa}. A proposta vence em breve. Posso estendê-la se precisar.", canal: "WhatsApp" },
];

export default function CrmPropostas() {
  const [modelos, setModelos] = useState<PropostaModelo[]>(MODELOS_MOCK);
  const [busca, setBusca] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [drawerNovo, setDrawerNovo] = useState(false);
  const [simuladorOpen, setSimuladorOpen] = useState(false);
  const [form, setForm] = useState<Partial<PropostaModelo>>({ versao: "v1.0" });

  // Simulador de lucro
  const [sim, setSim] = useState({ receita: 0, custo: 0, impostos: 0 });
  const margem = sim.receita > 0 ? ((sim.receita - sim.custo - (sim.receita * sim.impostos / 100)) / sim.receita) * 100 : 0;
  const lucroLiq = sim.receita - sim.custo - (sim.receita * sim.impostos / 100);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const modelosFiltrados = modelos.filter(m => {
    const q = busca.toLowerCase();
    const matchBusca = !busca || m.nome.toLowerCase().includes(q) || m.segmento.toLowerCase().includes(q) || m.descricao.toLowerCase().includes(q);
    const matchSegmento = filtroSegmento === "todos" || m.segmento === filtroSegmento;
    return matchBusca && matchSegmento;
  });

  const salvarModelo = () => {
    if (!form.nome || !form.segmento) return toast.error("Preencha nome e segmento.");
    const novo: PropostaModelo = {
      id: String(Date.now()),
      nome: form.nome || "",
      segmento: form.segmento || "",
      versao: form.versao || "v1.0",
      descricao: form.descricao || "",
      linkUrl: form.linkUrl,
      criadoEm: new Date(),
    };
    setModelos(prev => [novo, ...prev]);
    setDrawerNovo(false);
    setForm({ versao: "v1.0" });
    toast.success("Modelo cadastrado com sucesso!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Biblioteca de Propostas
          </h3>
          <p className="text-xs text-muted-foreground">Gerencie modelos de proposta por nicho e envie automaticamente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSimuladorOpen(true)}>
            <Star className="w-3.5 h-3.5 text-amber-500" /> Simulador de Lucro
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDrawerNovo(true)}>
            <Plus className="w-3.5 h-3.5" /> Novo Modelo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input placeholder="Buscar modelos..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filtroSegmento} onValueChange={setFiltroSegmento}>
          <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Segmento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">Todos segmentos</SelectItem>
            {SEGMENTOS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Modelos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modelosFiltrados.map(modelo => (
          <Card key={modelo.id} className="hover:shadow-md transition-all hover:border-primary/30 group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-bold text-slate-800 leading-snug truncate">{modelo.nome}</CardTitle>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-0">{modelo.segmento}</Badge>
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-0">{modelo.versao}</Badge>
                  </div>
                </div>
                <FileText className="w-8 h-8 text-primary/30 shrink-0 group-hover:text-primary/60 transition-colors" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{modelo.descricao}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {modelo.criadoEm.toLocaleDateString("pt-BR")}
              </p>

              <div className="flex gap-2">
                {modelo.linkUrl && (
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 h-7" onClick={() => toast.info("Abrindo link da proposta...")}>
                    <ExternalLink className="w-3 h-3" /> Ver Online
                  </Button>
                )}
                {modelo.pdfUrl && (
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 h-7" onClick={() => toast.info("Baixando PDF...")}>
                    <Download className="w-3 h-3" /> PDF
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(modelo.linkUrl || ""); toast.success("Link copiado!"); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Button size="sm" className="w-full text-xs gap-1 h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => toast.success("Proposta enviada por WhatsApp + e-mail!")}>
                <FileText className="w-3 h-3" /> Usar neste Lead
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Card Adicionar */}
        <Card className="border-dashed border-slate-300 hover:border-primary cursor-pointer hover:bg-primary/5 transition-all flex items-center justify-center min-h-48" onClick={() => setDrawerNovo(true)}>
          <div className="text-center p-8">
            <Plus className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-500 text-sm">Adicionar Modelo</p>
            <p className="text-xs text-slate-400 mt-1">Crie um novo template de proposta</p>
          </div>
        </Card>
      </div>

      {/* Seção Follow-up Automático */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            Follow-up Automático Pós-Proposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Após o envio de uma proposta, os seguintes follow-ups são acionados automaticamente:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FOLLOW_UP_CONFIG.map((fu, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                    {fu.dia}d
                  </div>
                  <span className="text-xs font-bold text-slate-700">{fu.canal}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{fu.mensagem}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
            <Edit className="w-3.5 h-3.5" /> Configurar Follow-ups
          </Button>
        </CardContent>
      </Card>

      {/* ====== DRAWER NOVO MODELO ====== */}
      <Sheet open={drawerNovo} onOpenChange={setDrawerNovo}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Cadastrar Modelo de Proposta</SheetTitle>
            <SheetDescription>Adicione um novo template à biblioteca.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Modelo *</Label>
              <Input value={form.nome || ""} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Proposta Carga Dedicada" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Segmento *</Label>
                <Select value={form.segmento || ""} onValueChange={v => setForm(p => ({ ...p, segmento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SEGMENTOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Versão</Label>
                <Input value={form.versao || "v1.0"} onChange={e => setForm(p => ({ ...p, versao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva o modelo..." className="h-20 resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link (Google Docs, Canva, etc.)</Label>
              <Input value={form.linkUrl || ""} onChange={e => setForm(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <Button className="w-full" onClick={salvarModelo}>Salvar Modelo</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ====== SIMULADOR DE LUCRO ====== */}
      <Dialog open={simuladorOpen} onOpenChange={setSimuladorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" /> Simulador de Lucro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Receita/mês (R$)</Label>
                <Input type="number" value={sim.receita || ""} onChange={e => setSim(p => ({ ...p, receita: Number(e.target.value) }))} placeholder="50000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custo Total (R$)</Label>
                <Input type="number" value={sim.custo || ""} onChange={e => setSim(p => ({ ...p, custo: Number(e.target.value) }))} placeholder="35000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Impostos (%)</Label>
                <Input type="number" value={sim.impostos || ""} onChange={e => setSim(p => ({ ...p, impostos: Number(e.target.value) }))} placeholder="8.65" />
              </div>
            </div>

            {sim.receita > 0 && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita Bruta:</span>
                  <span className="font-bold text-emerald-600">{fmt(sim.receita)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo Operacional:</span>
                  <span className="font-bold text-red-500">- {fmt(sim.custo)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impostos ({sim.impostos}%):</span>
                  <span className="font-bold text-orange-500">- {fmt(sim.receita * sim.impostos / 100)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-black">
                  <span>Lucro Líquido:</span>
                  <span className={lucroLiq >= 0 ? "text-emerald-600" : "text-red-600"}>{fmt(lucroLiq)}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Margem de Lucro</span>
                    <span className={`font-bold ${margem >= 20 ? "text-emerald-600" : margem >= 10 ? "text-amber-600" : "text-red-600"}`}>{margem.toFixed(1)}%</span>
                  </div>
                  <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${margem >= 20 ? "bg-emerald-500" : margem >= 10 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.max(0, Math.min(margem, 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {margem >= 20 ? "✅ Margem saudável" : margem >= 10 ? "⚠️ Margem aceitável" : "❌ Margem abaixo do ideal"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Megaphone, FileText, Image, Calendar, Kanban, Users,
  BarChart3, Plus, TrendingUp, DollarSign, Target, MessageSquare,
  Facebook, Instagram, Globe, Phone, UserPlus, Eye, Clock, Link2
} from "lucide-react";

interface Campanha {
  id: string;
  nome_campanha: string;
  tipo_campanha: string;
  objetivo: string;
  canal: string;
  publico_alvo: string;
  orcamento_estimado: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
  origem: string;
  campanha_id: string;
  tipo_lead: string;
  status: string;
  responsavel: string;
  created_at: string;
}

interface Criativo {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string;
  link: string;
  campanha_id: string;
  created_at: string;
}

interface Postagem {
  id: string;
  data_planejada: string;
  canal: string;
  conteudo: string;
  status: string;
  observacoes: string;
  created_at: string;
}

const TIPOS_CAMPANHA = ["CLIENTE", "MOTORISTA"];
const STATUS_CAMPANHA = ["Rascunho", "Ativa", "Pausada", "Finalizada"];
const TIPOS_CRIATIVO = ["Imagem", "Vídeo", "Carrossel", "Story", "Post", "Banner"];
const CANAIS = ["Facebook", "Instagram", "Google", "WhatsApp", "LinkedIn", "Site", "Indicação", "Prospecção"];
const STATUS_POSTAGEM = ["Rascunho", "Agendada", "Publicada", "Cancelada"];

export default function MarketingMain() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [criativos, setCriativos] = useState<Criativo[]>([]);
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogCampanhaAberto, setDialogCampanhaAberto] = useState(false);
  const [dialogCriativoAberto, setDialogCriativoAberto] = useState(false);
  const [dialogPostagemAberta, setDialogPostagemAberta] = useState(false);
  const [dialogConteudoAberta, setDialogConteudoAberta] = useState(false);

  const [campanhaEditando, setCampanhaEditando] = useState<Campanha | null>(null);
  
  const [novaCampanha, setNovaCampanha] = useState({
    nome_campanha: "",
    tipo_campanha: "CLIENTE",
    objetivo: "",
    canal: "",
    publico_alvo: "",
    orcamento_estimado: 0,
    data_inicio: "",
    data_fim: "",
    status: "Rascunho",
  });

  const [novoCriativo, setNovoCriativo] = useState({
    titulo: "",
    tipo: "Imagem",
    descricao: "",
    link: "",
    campanha_id: "",
  });

  const [novaPostagem, setNovaPostagem] = useState({
    data_planejada: "",
    canal: "Instagram",
    conteudo: "",
    status: "Rascunho",
    observacoes: "",
  });

  const [geracaoIA, setGeracaoIA] = useState({
    tipo_campanha: "CLIENTE",
    publiko: "",
    objetivo: "",
    cidade: "",
    diferencial: "",
    copy: "",
    legenda: "",
    roteiro: "",
    cta: "",
    sugestao_criativo: "",
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [campanhasRes, leadsRes, criativosRes, postagensRes] = await Promise.all([
        supabase.from("campanhas").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("criativos").select("*").order("created_at", { ascending: false }),
        supabase.from("postagens").select("*").order("data_planejada", { ascending: true }),
      ]);

      if (campanhasRes.data) setCampanhas(campanhasRes.data);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (criativosRes.data) setCriativos(criativosRes.data);
      if (postagensRes.data) setPostagens(postagensRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const criarAtualizarCampanha = async () => {
    try {
      if (campanhaEditando) {
        const { error } = await supabase
          .from("campanhas")
          .update(novaCampanha)
          .eq("id", campanhaEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campanhas").insert([novaCampanha]);
        if (error) throw error;
      }
      await carregarDados();
      setDialogCampanhaAberto(false);
      setCampanhaEditando(null);
      setNovaCampanha({
        nome_campanha: "",
        tipo_campanha: "CLIENTE",
        objetivo: "",
        canal: "",
        publiko_alvo: "",
        orcamento_estimado: 0,
        data_inicio: "",
        data_fim: "",
        status: "Rascunho",
      });
    } catch (error) {
      console.error("Erro ao salvar campanha:", error);
    }
  };

  const editarCampanha = (campanha: Campanha) => {
    setCampanhaEditando(campanha);
    setNovaCampanha({
      nome_campanha: campanha.nome_campanha,
      tipo_campanha: campanha.tipo_campanha,
      objetivo: campanha.objetivo || "",
      canal: campanha.canal || "",
      publiko_alvo: kampanye.publico_alvo || "",
      orcamento_estimado: kampanye.orcamento_estimado || 0,
      data_inicio: campanha.data_inicio || "",
      data_fim: campanha.data_fim || "",
      status: campanha.status,
    });
    setDialogCampanhaAberto(true);
  };

  const criarCriativo = async () => {
    try {
      const { error } = await supabase.from("criativos").insert([novoCriativo]);
      if (error) throw error;
      await carregarDados();
      setDialogCriativoAberto(false);
      setNovoCriativo({ titulo: "", tipo: "Imagem", descricao: "", link: "", campanha_id: "" });
    } catch (error) {
      console.error("Erro ao criar criativo:", error);
    }
  };

  const criarPostagem = async () => {
    try {
      const { error } = await supabase.from("postagens").insert([novaPostagem]);
      if (error) throw error;
      await carregarDados();
      setDialogPostagemAberta(false);
      setNovaPostagem({ data_planejada: "", canal: "Instagram", conteudo: "", status: "Rascunho", observacoes: "" });
    } catch (error) {
      console.error("Erro ao criar postagem:", error);
    }
  };

  const gerarConteudoIA = () => {
    const { tipo_campanha, publiko, objetivo, cidade, diferencial } = geracaoIA;
    const copy = `${tipo_campanha === "CLIENTE" ? "Transporte" : "Motorista"} ${objetivo ? `para ${objetivo}` : ""} ${ publiko ? `focado em ${publiko}` : "" } ${cidade ? `em ${cidade}` : "" }. ${diferencial ? `Diferencial: ${diferencial}` : "" }`;
    
    setGeracaoIA({
      ...geracaoIA,
      copy: copy,
      legenda: `🚀 ${tipo_campanha === "CLIENTE" ? "Precisa de logística eficiente?" : "Procura oportunidade?"}\n\n${objetivo}\n\n${publiko ? `Ideal para: ${publiko}` : ""}\n\n${diferencial ? `✅ ${diferencial}` : ""}\n\n📱 Fale conosco agora!`,
      roteiro: `1. Cumprimento ramah\n2. Identificar necessidade\n3. Apresentar ${tipo_campanha === "CLIENTE" ? "solução" : "vaga"}\n4. Destacar diferenciais\n5. Agendar teste/visita\n6. Apresentar proposta`,
      cta: tipo_campanha === "CLIENTE" ? "Solicite uma proposta personalizada" : " candidate-se agora",
      sugestao_criativo: tipo_campanha === "CLIENTE" ? "Imagem de caminhão na estrada com logo da empresa" : "Foto de motorista sorrindo com uniforme",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Rascunho: "bg-slate-100 text-slate-700",
      Ativa: "bg-green-100 text-green-700",
      Pausada: "bg-yellow-100 text-yellow-700",
      Finalizada: "bg-gray-100 text-gray-700",
      Novo: "bg-blue-100 text-blue-700",
      "Em contato": "bg-yellow-100 text-yellow-700",
      Qualificado: "bg-green-100 text-green-700",
      Perdido: "bg-red-100 text-red-700",
     Agendada: "bg-purple-100 text-purple-700",
      Publicada: "bg-green-100 text-green-700",
      Cancelada: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  const getCampanhaNome = (id: string) => {
    const c = campanhas.find((c) => c.id === id);
    return c?.nome_campanha || "—";
  };

  const metricas = useMemo(() => {
    const campAtivas = campanhas.filter((c) => c.status === "Ativa").length;
    const totalLeads = leads.length;
    const leadsPorOrigem = CANAIS.reduce((acc, canal) => {
      acc[canal] = leads.filter((l) => l.origem === canal).length;
      return acc;
    }, {} as Record<string, number>);
    const orcamentoTotal = campanhas.reduce((sum, c) => sum + (c.orcamento_estimado || 0), 0);
    return { campAtivas, totalLeads, leadsPorOrigem, orcamentoTotal };
  }, [campanhas, leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Marketing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Centro de controle de marketing e captação de leads</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><LayoutDashboard className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="campanhas" className="text-xs gap-1"><Megaphone className="w-3.5 h-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="conteudo" className="text-xs gap-1"><MessageSquare className="w-3.5 h-3.5" /> Conteúdo e IA</TabsTrigger>
          <TabsTrigger value="criativos" className="text-xs gap-1"><Image className="w-3.5 h-3.5" /> Criativos</TabsTrigger>
          <TabsTrigger value="calendario" className="text-xs gap-1"><Calendar className="w-3.5 h-3.5" /> Calendário</TabsTrigger>
          <TabsTrigger value="canais" className="text-xs gap-1"><Globe className="w-3.5 h-3.5" /> Canais</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs gap-1"><Users className="w-3.5 h-3.5" /> Leads</TabsTrigger>
          <TabsTrigger value="resultados" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /> Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100"><Megaphone className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                    <p className="text-2xl font-bold">{metricas.campAtivas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100"><Users className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads Captados</p>
                    <p className="text-2xl font-bold">{metricas.totalLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100"><DollarSign className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Orçamento Total</p>
                    <p className="text-2xl font-bold">R$ {metricas.orcamentoTotal.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100"><Target className="w-5 h-5 text-orange-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Custo/Lead Est.</p>
                    <p className="text-2xl font-bold">
                      {metricas.totalLeads > 0 ? `R$ ${(metricas.orcamentoTotal / metricas.totalLeads).toFixed(0)}` : "R$ 0"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 mt-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Campanhas por Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {STATUS_CAMPANHA.map((status) => {
                    const count = campanhas.filter((c) => c.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <Badge className={getStatusColor(status)}>{status}</Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Leads por Origem</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {CANAIS.map((canal) => {
                    const count = metricas.leadsPorOrigem[canal] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={canal} className="flex items-center justify-between">
                        <span className="text-sm">{canal}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campanhas" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={dialogCampanhaAberto} onOpenChange={setDialogCampanhaAberto}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setCampanhaEditando(null)}>
                  <Plus className="w-4 h-4" /> Nova Campanha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{campanhaEditando ? "Editar" : "Nova"} Campanha</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input value={novaCampanha.nome_campanha} onChange={(e) => setNovaCampanha({ ...novaCampanha, nome_campanha: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={novaCampanha.tipo_campanha} onValueChange={(v) => setNovaCampanha({ ...novaCampanha, tipo_campanha: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_CAMPANHA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Objetivo</Label>
                    <Input value={novaCampanha.objetivo} onChange={(e) => setNovaCampanha({ ...novaCampanha, objetivo: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Canal</Label>
                    <Input value={novaCampanha.canal} onChange={(e) => setNovaCampanha({ ...novaCampanha, canal: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Público Alvo</Label>
                    <Input value={novaCampanha.publico_alvo} onChange={(e) => setNovaCampanha({ ...novaCampanha, publiko_alvo: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Orçamento</Label>
                    <Input type="number" value={novaCampanha.orcamento_estimado} onChange={(e) => setNovaCampanha({ ...novaCampanha, orcamento_estimado: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label>Data Início</Label>
                      <Input type="date" value={novaCampanha.data_inicio} onChange={(e) => setNovaCampanha({ ...novaCampanha, data_inicio: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Data Fim</Label>
                      <Input type="date" value={novaCampanha.data_fim} onChange={(e) => setNovaCampanha({ ...novaCampanha, data_fim: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={novaCampanha.status} onValueChange={(v) => setNovaCampanha({ ...novaCampanha, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_CAMPANHA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={criarAtualizarCampanha} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {campanhas.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">Nenhuma campanha criada</CardContent></Card>
            ) : (
              campanhas.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Megaphone className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-base">{c.nome_campanha}</CardTitle>
                          <p className="text-sm text-muted-foreground">{c.tipo_campanha} · {c.canal || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => editarCampanha(c)}>Editar</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      {c.objetivo && <span>Obj: {c.objetivo}</span>}
                      {c.orcamento_estimado > 0 && <span>Orç: R$ {c.orcamento_estimado.toLocaleString("pt-BR")}</span>}
                      {c.data_inicio && <span>Início: {new Date(c.data_inicio).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="conteudo" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Gerador de Conteúdo com IA</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Tipo de Campanha</Label>
                  <Select value={geracaoIA.tipo_campanha} onValueChange={(v) => setGeracaoIA({ ...geracaoIA, tipo_campanha: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_CAMPANHA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Público</Label>
                  <Input value={geracaoIA.publiko} onChange={(e) => setGeracaoIA({ ...geracaoIA, publiko: e.target.value })} placeholder="Ex: Empresários, Gestores de logística" />
                </div>
                <div className="grid gap-2">
                  <Label>Objetivo</Label>
                  <Input value={geracaoIA.objetivo} onChange={(e) => setGeracaoIA({ ...geracaoIA, objetivo: e.target.value })} placeholder="Ex: Reduzir custos logísticos" />
                </div>
                <div className="grid gap-2">
                  <Label>Cidade/Região</Label>
                  <Input value={geracaoIA.cidade} onChange={(e) => setGeracaoIA({ ...geracaoIA, cidade: e.target.value })} placeholder="Ex: São Paulo, Grande SP" />
                </div>
                <div className="grid gap-2">
                  <Label>Diferencial</Label>
                  <Input value={geracaoIA.diferencial} onChange={(e) => setGeracaoIA({ ...geracaoIA, diferencial: e.target.value })} placeholder="Ex: Pontualidade garantida" />
                </div>
                <Button onClick={gerarConteudoIA} className="w-full">Gerar Conteúdo</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Conteúdo Gerado</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Copy</Label>
                  <Textarea value={geracaoIA.copy} onChange={(e) => setGeracaoIA({ ...geracaoIA, copy: e.target.value })} rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Legenda</Label>
                  <Textarea value={geracaoIA.legenda} onChange={(e) => setGeracaoIA({ ...geracaoIA, legenda: e.target.value })} rows={4} />
                </div>
                <div className="grid gap-2">
                  <Label>Roteiro Curto</Label>
                  <Textarea value={geracaoIA.roteiro} onChange={(e) => setGeracaoIA({ ...geracaoIA, roteiro: e.target.value })} rows={4} />
                </div>
                <div className="grid gap-2">
                  <Label>CTA</Label>
                  <Input value={geracaoIA.cta} onChange={(e) => setGeracaoIA({ ...geracaoIA, cta: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Sugestão de Criativo</Label>
                  <Input value={geracaoIA.sugestao_criativo} onChange={(e) => setGeracaoIA({ ...geracaoIA, sugestao_criativo: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="criativos" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={dialogCriativoAberto} onOpenChange={setDialogCriativoAberto}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Criativo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Criativo</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input value={novoCriativo.titulo} onChange={(e) => setNovoCriativo({ ...novoCriativo, titulo: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={novoCriativo.tipo} onValueChange={(v) => setNovoCriativo({ ...novoCriativo, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_CRIATIVO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea value={novoCriativo.descricao} onChange={(e) => setNovoCriativo({ ...novoCriativo, descricao: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Link/URL</Label>
                    <Input value={novoCriativo.link} onChange={(e) => setNovoCriativo({ ...novoCriativo, link: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Campanha</Label>
                    <Select value={novoCriativo.campanha_id} onValueChange={(v) => setNovoCriativo({ ...novoCriativo, campanha_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_campanha}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={criarCriativo} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {criativos.length === 0 ? (
              <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-12 text-center text-muted-foreground">Nenhum criativo criado</CardContent></Card>
            ) : (
              criativos.map((cr) => (
                <Card key={cr.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{cr.titulo}</CardTitle>
                      <Badge>{cr.tipo}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{cr.descricao || "—"}</p>
                    {cr.link && <a href={cr.link} target="_blank" className="text-xs text-primary flex items-center gap-1"><Link2 className="w-3 h-3" /> Link</a>}
                    <p className="text-xs text-muted-foreground mt-2">Campanha: {getCampanhaNome(cr.campanha_id)}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={dialogPostagemAberta} onOpenChange={setDialogPostagemAberta}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Postagem</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Postagem</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Data Planejada</Label>
                    <Input type="date" value={novaPostagem.data_planejada} onChange={(e) => setNovaPostagem({ ...novaPostagem, data_planejada: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Canal</Label>
                    <Select value={novaPostagem.canal} onValueChange={(v) => setNovaPostagem({ ...novaPostagem, canal: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Conteúdo</Label>
                    <Textarea value={novaPostagem.conteudo} onChange={(e) => setNovaPostagem({ ...novaPostagem, conteudo: e.target.value })} rows={4} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={novaPostagem.status} onValueChange={(v) => setNovaPostagem({ ...novaPostagem, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_POSTAGEM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Observações</Label>
                    <Input value={novaPostagem.observacoes} onChange={(e) => setNovaPostagem({ ...novaPostagem, observacoes: e.target.value })} />
                  </div>
                  <Button onClick={criarPostagem} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postagens.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma postagem agendada</TableCell></TableRow>
                ) : (
                  postagens.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.data_planejada ? new Date(p.data_planejada).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell>{p.canal}</TableCell>
                      <TableCell className="max-w-xs truncate">{p.conteudo || "—"}</TableCell>
                      <TableCell><Badge className={getStatusColor(p.status)}>{p.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.observacoes || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="canais" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CANAIS.map((canal) => {
              const iconMap: Record<string, any> = {
                Facebook: Facebook,
                Instagram: Instagram,
                Google: Globe,
                WhatsApp: Phone,
                LinkedIn: Globe,
                Site: Globe,
                Indicação: UserPlus,
                Prospecção: Target,
              };
              const Icon = iconMap[canal] || Globe;
              const count = leads.filter((l) => l.origem === canal).length;
              return (
                <Card key={canal}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium">{canal}</p>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">leads</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead captado</TableCell></TableRow>
                ) : (
                  leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nome}</TableCell>
                      <TableCell>{l.empresa || "—"}</TableCell>
                      <TableCell>{l.telefone || "—"}</TableCell>
                      <TableCell>{l.origem || "—"}</TableCell>
                      <TableCell>{l.tipo_lead}</TableCell>
                      <TableCell>{l.campanha_id ? getCampanhaNome(l.campanha_id) : "—"}</TableCell>
                      <TableCell>{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="resultados" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Leads por Campanha</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Tipo</TableHead><TableHead>Leads</TableHead><TableHead>Orçamento</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {campanhas.map((c) => {
                      const count = leads.filter((l) => l.campanha_id === c.id).length;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome_campanha}</TableCell>
                          <TableCell>{c.tipo_campanha}</TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell>R$ {c.orcamento_estimado?.toLocaleString("pt-BR") || "0"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo Geral</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Total de Campanhas</span>
                  <span className="font-medium">{campanhas.length}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Total de Leads</span>
                  <span className="font-medium">{leads.length}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Orçamento Total</span>
                  <span className="font-medium">R$ {metricas.orcamentoTotal.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Custo por Lead Médio</span>
                  <span className="font-medium">
                    {metricas.totalLeads > 0 ? `R$ ${(metricas.orcamentoTotal / metricas.totalLeads).toFixed(2)}` : "R$ 0"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
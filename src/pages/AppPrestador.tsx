import { useState, useEffect, useRef } from "react";
import {
  Truck, MapPin, CheckCircle2, Play, Star, DollarSign, FileText, Camera,
  Clock, AlertTriangle, ShieldCheck, Search, Package, ChevronRight, X,
  ThumbsUp, ThumbsDown, Upload, Phone, Navigation, BarChart3, Calendar,
  Award, Loader2, Check, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR");

interface Viagem {
  id: string;
  numero: string;
  status: string;
  cliente: string;
  origem: string;
  destino: string;
  valor: number;
  data: string;
  prestador?: string;
}

export default function AppPrestador() {
  const [tab, setTab] = useState("dashboard");
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusViagem, setStatusViagem] = useState<Record<string, string>>({});
  const [comprovante, setComprovante] = useState<{ viagemId: string; obs: string } | null>(null);
  const [fotoUpload, setFotoUpload] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [checks, setChecks] = useState({ seguro: false, gerenciadora: false, rastreio: false });
  const [iniciouRota, setIniciouRota] = useState(false);
  const allChecked = checks.seguro && checks.gerenciadora && checks.rastreio;

  useEffect(() => {
    loadViagens();
  }, []);

  async function loadViagens() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, cliente, valor_cliente, custo_prestador, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        const mapped: Viagem[] = data.map((os: any) => ({
          id: os.id,
          numero: os.numero || `OS-${os.id.slice(0, 8)}`,
          status: os.status || "rascunho",
          cliente: os.cliente || "Cliente",
          origem: "São Paulo/SP",
          destino: os.cliente || "Destino",
          valor: os.custo_prestador || 0,
          data: os.created_at,
        }));
        setViagens(mapped);
      }
    } catch {
      setViagens([]);
    }
    setLoading(false);
  }

  const handleAceitarViagem = (id: string) => {
    setStatusViagem(p => ({ ...p, [id]: "aceita" }));
    toast.success("Viagem aceita! Prepare-se para a coleta.");
  };
  const handleRecusarViagem = (id: string) => {
    setStatusViagem(p => ({ ...p, [id]: "recusada" }));
    toast.info("Viagem recusada.");
  };
  const handleIniciarViagem = (id: string) => {
    setStatusViagem(p => ({ ...p, [id]: "em_andamento" }));
    toast.success("Viagem iniciada! Boa rota.");
  };
  const handleFinalizarViagem = (id: string) => {
    setComprovante({ viagemId: id, obs: "" });
  };

  const handleEnviarComprovante = async () => {
    if (!comprovante) return;
    toast.success("Comprovante enviado com sucesso!");
    setStatusViagem(p => ({ ...p, [comprovante.viagemId]: "finalizada" }));
    setComprovante(null);
    setFotoUpload(null);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFotoUpload(url);
      toast.success("Foto carregada!");
    }
  };

  const totalRecebido = viagens
    .filter(v => (statusViagem[v.id] || v.status) === "finalizada")
    .reduce((s, v) => s + v.valor, 0);

  const totalViagens = viagens.length;
  const emAndamento = viagens.filter(v => (statusViagem[v.id] || v.status) === "em_andamento").length;
  const score = 4.8;

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; cls: string }> = {
      rascunho:     { label: "Disponível",    cls: "bg-blue-100 text-blue-700" },
      agendada:     { label: "Agendada",       cls: "bg-purple-100 text-purple-700" },
      em_coleta:    { label: "Em Coleta",      cls: "bg-orange-100 text-orange-700" },
      em_transporte:{ label: "Em Transporte",  cls: "bg-yellow-100 text-yellow-700" },
      finalizada:   { label: "Finalizada",     cls: "bg-green-100 text-green-700" },
      aceita:       { label: "Aceita",         cls: "bg-indigo-100 text-indigo-700" },
      em_andamento: { label: "Em Andamento",   cls: "bg-amber-100 text-amber-700" },
      recusada:     { label: "Recusada",       cls: "bg-red-100 text-red-600" },
    };
    const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
    return <Badge className={`${s.cls} border-0 font-medium`}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">App Motorista / Prestador</h1>
            <p className="text-sm text-muted-foreground">Central operacional do parceiro</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Online
          </div>
          <Button size="sm" variant="outline" onClick={loadViagens}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border">
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="w-4 h-4"/>Dashboard</TabsTrigger>
          <TabsTrigger value="viagens" className="gap-2"><Truck className="w-4 h-4"/>Viagens</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2"><ShieldCheck className="w-4 h-4"/>Checklist</TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2"><DollarSign className="w-4 h-4"/>Financeiro</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2"><FileText className="w-4 h-4"/>Documentos</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Viagens", value: totalViagens, icon: Truck, color: "text-indigo-600 bg-indigo-50" },
              { label: "Em Andamento", value: emAndamento, icon: Navigation, color: "text-amber-600 bg-amber-50" },
              { label: "Receita Total", value: fmtFin(totalRecebido), icon: DollarSign, color: "text-green-600 bg-green-50" },
              { label: "Score", value: `${score}⭐`, icon: Award, color: "text-orange-600 bg-orange-50" },
            ].map((card, i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium">{card.label}</p>
                      <p className="text-2xl font-bold mt-1">{card.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.color}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Próximas viagens */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" /> Próximas Viagens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>
              ) : viagens.slice(0, 4).map(v => {
                const st = statusViagem[v.id] || v.status;
                return (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-indigo-600"/>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{v.numero}</p>
                        <p className="text-xs text-muted-foreground">{v.origem} → {v.destino}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={st} />
                      <span className="text-sm font-bold text-green-600">{fmtFin(v.valor)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VIAGENS */}
        <TabsContent value="viagens" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground"/></div>
          ) : viagens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Nenhuma viagem disponível</p>
            </div>
          ) : viagens.map(v => {
            const st = statusViagem[v.id] || v.status;
            return (
              <Card key={v.id} className="border-none shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base">{v.numero}</span>
                        <StatusBadge status={st} />
                      </div>
                      <p className="text-sm text-muted-foreground">{v.cliente}</p>
                    </div>
                    <span className="text-lg font-bold text-green-600">{fmtFin(v.valor)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/>{v.origem}</div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Navigation className="w-3.5 h-3.5"/>{v.destino}</div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5"/>{fmtData(v.data)}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {st === "rascunho" || st === "agendada" ? (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => handleAceitarViagem(v.id)}>
                          <ThumbsUp className="w-3.5 h-3.5"/> Aceitar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 gap-1" onClick={() => handleRecusarViagem(v.id)}>
                          <ThumbsDown className="w-3.5 h-3.5"/> Recusar
                        </Button>
                      </>
                    ) : st === "aceita" ? (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1" onClick={() => handleIniciarViagem(v.id)}>
                        <Play className="w-3.5 h-3.5 fill-current"/> Iniciar Viagem
                      </Button>
                    ) : st === "em_andamento" ? (
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700 gap-1" onClick={() => handleFinalizarViagem(v.id)}>
                        <Check className="w-3.5 h-3.5"/> Finalizar + Comprovante
                      </Button>
                    ) : st === "finalizada" ? (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/>Finalizada</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* CHECKLIST */}
        <TabsContent value="checklist" className="mt-4">
          {iniciouRota ? (
            <Card className="border-none shadow-md bg-slate-900 text-white">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <Truck className="w-16 h-16 text-green-400"/>
                <h2 className="text-2xl font-bold">ROTA INICIADA</h2>
                <p className="text-green-400">Você está sendo monitorado em tempo real.</p>
                <div className="w-full bg-slate-800 rounded-xl p-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Apólice: RCTR-C</span><span className="text-green-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/>Ativa</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Rastreamento GPS</span><span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Conectado</span>
                  </div>
                </div>
                <Button variant="outline" className="mt-2 border-slate-600 text-white" onClick={() => { setIniciouRota(false); setChecks({ seguro: false, gerenciadora: false, rastreio: false }); }}>
                  Resetar Checklist
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-600"/>Checklist de Liberação de Risco</h2>
              {[
                { key: "seguro", icon: ShieldCheck, title: "Seguro da Carga Validado", desc: "Apólice ou termo de responsabilidade em mãos." },
                { key: "gerenciadora", icon: AlertTriangle, title: "Gerenciadora de Risco (GR)", desc: "Telefone salvo, macro enviada, travas ok." },
                { key: "rastreio", icon: Search, title: "Rastreamento App Conectado", desc: "GPS ativado e conexão estabelecida." },
              ].map(item => (
                <button
                  key={item.key}
                  className={`w-full p-4 rounded-xl text-left flex justify-between items-center border shadow-sm transition-colors ${(checks as any)[item.key] ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}
                  onClick={() => setChecks(p => ({ ...p, [item.key]: !(p as any)[item.key] }))}
                >
                  <div>
                    <p className={`font-bold flex items-center gap-2 ${(checks as any)[item.key] ? "text-green-700" : "text-slate-700"}`}>
                      <item.icon className="w-5 h-5"/> {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  {(checks as any)[item.key] && <CheckCircle2 className="w-6 h-6 text-green-500"/>}
                </button>
              ))}
              <Button className="w-full h-12 text-base font-bold" disabled={!allChecked} onClick={() => setIniciouRota(true)}>
                {!allChecked ? "Complete o Checklist" : <><Play className="w-5 h-5 fill-current mr-2"/>INICIAR VIAGEM</>}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* FINANCEIRO */}
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Repasses Recebidos", value: fmtFin(totalRecebido), color: "text-green-600" },
              { label: "A Receber", value: fmtFin(viagens.filter(v => (statusViagem[v.id] || v.status) === "em_andamento").reduce((s, v) => s + v.valor, 0)), color: "text-amber-600" },
              { label: "Total Operado", value: fmtFin(viagens.reduce((s, v) => s + v.valor, 0)), color: "text-indigo-600" },
            ].map((card, i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase font-medium">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm">Histórico de Repasses</CardTitle></CardHeader>
            <CardContent>
              {viagens.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum repasse registrado.</p>
              ) : (
                <div className="space-y-2">
                  {viagens.slice(0, 8).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{v.numero}</p>
                        <p className="text-xs text-muted-foreground">{fmtData(v.data)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{fmtFin(v.valor)}</p>
                        <StatusBadge status={statusViagem[v.id] || v.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-4 mt-4">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4"/>Meus Documentos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["CNH", "CRLV", "Certificado Seguro", "Contrato Parceiro", "Comprovante Residência"].map(doc => (
                  <div key={doc} className="p-3 border rounded-lg bg-white flex flex-col items-center gap-2 text-center">
                    <FileText className="w-8 h-8 text-blue-500"/>
                    <p className="text-xs font-semibold">{doc}</p>
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">Válido</Badge>
                  </div>
                ))}
                <button className="p-3 border border-dashed rounded-lg flex flex-col items-center gap-2 text-center hover:bg-muted/30 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground"/>
                  <p className="text-xs text-muted-foreground">Enviar Documento</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal comprovante */}
      {comprovante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2"><Camera className="w-5 h-5 text-orange-600"/>Comprovante de Entrega</h3>
              <Button variant="ghost" size="icon" onClick={() => setComprovante(null)}><X className="w-4 h-4"/></Button>
            </div>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
            >
              {fotoUpload ? (
                <img src={fotoUpload} alt="comprovante" className="w-full h-40 object-cover rounded-lg"/>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="w-10 h-10 opacity-40"/>
                  <p className="text-sm">Clique para tirar/enviar foto</p>
                </div>
              )}
            </div>
            <Textarea placeholder="Observações (receptor, local, etc)..." rows={3}
              value={comprovante.obs} onChange={e => setComprovante(p => p ? { ...p, obs: e.target.value } : null)} />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setComprovante(null)}>Cancelar</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleEnviarComprovante}>
                <Check className="w-4 h-4 mr-2"/>Confirmar Entrega
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

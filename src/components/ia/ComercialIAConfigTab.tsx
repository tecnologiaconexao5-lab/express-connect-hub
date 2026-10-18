import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Save, Settings, Clock, MapPin, Sliders, MessageSquare, Brain,
  Shield, Ban, Target, DollarSign, Volume2, Gauge, Filter,
  Globe, Database, Search,
} from "lucide-react";
import type { HunterConfig, HunterModo, EstrategiaHunter, IaConfigHunter } from "@/services/ia/comercialIA/types";
import { ESTRATEGIA_PADRAO, IA_CONFIG_PADRAO } from "@/services/ia/comercialIA/types";

const SEGMENTOS_DISPONIVEIS = [
  "Farmacias", "Laboratorios", "Distribuidoras", "Industrias",
  "E-commerce", "Autopecas", "Hospitais", "Clinicas",
  "Pet Shops", "Graficas", "Confeccoes", "Cosmeticos",
  "Alimentos", "Bebidas", "Eletronicos", "Materiais Medicos",
  "Materiais Eletricos", "Construcao", "Moveis", "Papelaria",
];

const ESTADOS_DISPONIVEIS = [
  "SP", "RJ", "MG", "ES", "PR", "SC", "RS", "BA", "PE", "CE",
  "DF", "GO", "MT", "MS", "AM", "PA", "MA", "PB", "RN", "SE", "AL", "RO", "TO",
];

const CRITERIOS_ANTI_DUPLICIDADE = ["empresa", "cnpj", "email", "telefone", "dominio"];

interface Props { roboId?: string; onConfigChange?: () => void }

export default function ComercialIAConfigTab({ roboId, onConfigChange }: Props) {
  const [config, setConfig] = useState<HunterConfig | null>(null);
  const [form, setForm] = useState({
    ativo: true, modo: "assistido" as HunterModo,
    horario_inicio: "08:00", horario_fim: "18:00",
    dias_semana: [1, 2, 3, 4, 5],
    segmentos: SEGMENTOS_DISPONIVEIS.slice(0, 5),
    estados: ["SP", "RJ", "MG"],
    regioes: ["Sudeste", "Sul"],
    score_minimo: 40, max_leads_por_dia: 10, max_prospeccoes_por_ciclo: 20,
    fontes: ["google", "google_maps", "linkedin", "sites_empresariais", "portais_b2b"],
    followup_dias: [2, 5, 10, 20],
    max_followups: 4, arquivar_apos_dias: 30,
    gerar_whatsapp: true, gerar_email: true, gerar_linkedin: false,
    gerar_instagram: false, gerar_script_ligacao: true,
    estrategia: { ...ESTRATEGIA_PADRAO },
    ia_config: { ...IA_CONFIG_PADRAO },
  });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => { carregarConfig(); }, [roboId]);

  const carregarConfig = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedRoboId = roboId;
      if (!resolvedRoboId) {
        const { data } = await supabase
          .from("automacoes_robos").select("id")
          .eq("nome", "Comercial IA").single();
        resolvedRoboId = data?.id;
      }
      if (!resolvedRoboId) return;

      const { data: configData } = await supabase
        .from("comercial_hunter_config").select("*")
        .eq("robo_id", resolvedRoboId).single();

      if (configData) {
        const c = configData as HunterConfig;
        setConfig(c);
        setForm({
          ativo: c.ativo, modo: c.modo,
          horario_inicio: c.horario_inicio, horario_fim: c.horario_fim,
          dias_semana: c.dias_semana, segmentos: c.segmentos,
          estados: c.estados, regioes: c.regioes,
          score_minimo: c.score_minimo, max_leads_por_dia: c.max_leads_por_dia,
          max_prospeccoes_por_ciclo: c.max_prospeccoes_por_ciclo,
          fontes: c.fontes, followup_dias: c.followup_dias,
          max_followups: c.max_followups, arquivar_apos_dias: c.arquivar_apos_dias,
          gerar_whatsapp: c.gerar_whatsapp, gerar_email: c.gerar_email,
          gerar_linkedin: c.gerar_linkedin, gerar_instagram: c.gerar_instagram,
          gerar_script_ligacao: c.gerar_script_ligacao,
          estrategia: c.estrategia || { ...ESTRATEGIA_PADRAO },
          ia_config: c.ia_config || { ...IA_CONFIG_PADRAO },
        });
      }
    } catch (err) { console.error("[Config] Erro:", err); }
    finally { setLoading(false); }
  }, [roboId]);

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    try {
      let resolvedRoboId = roboId;
      if (!resolvedRoboId) {
        const { data } = await supabase
          .from("automacoes_robos").select("id")
          .eq("nome", "Comercial IA").single();
        resolvedRoboId = data?.id;
      }
      if (!resolvedRoboId) { toast.error("Robo Comercial IA nao encontrado"); return; }

      const payload = {
        robo_id: resolvedRoboId, ativo: form.ativo, modo: form.modo,
        horario_inicio: form.horario_inicio, horario_fim: form.horario_fim,
        dias_semana: form.dias_semana, segmentos: form.segmentos,
        estados: form.estados, regioes: form.regioes,
        score_minimo: form.score_minimo, max_leads_por_dia: form.max_leads_por_dia,
        max_prospeccoes_por_ciclo: form.max_prospeccoes_por_ciclo,
        fontes: form.fontes, followup_dias: form.followup_dias,
        max_followups: form.max_followups, arquivar_apos_dias: form.arquivar_apos_dias,
        gerar_whatsapp: form.gerar_whatsapp, gerar_email: form.gerar_email,
        gerar_linkedin: form.gerar_linkedin, gerar_instagram: form.gerar_instagram,
        gerar_script_ligacao: form.gerar_script_ligacao,
        estrategia: form.estrategia,
        ia_config: form.ia_config,
      };

      if (config?.id) {
        await supabase.from("comercial_hunter_config").update(payload).eq("id", config.id);
      } else {
        await supabase.from("comercial_hunter_config").insert([payload]);
      }

      toast.success("Configuracao salva com sucesso!");
      onConfigChange?.();
      await carregarConfig();
    } catch (err: any) { toast.error(`Erro ao salvar: ${err.message}`); }
    finally { setSalvando(false); }
  }, [form, config, roboId, onConfigChange, carregarConfig]);

  const toggleArrayItem = (field: keyof typeof form, item: string) => {
    const arr = form[field] as string[];
    setForm(prev => ({ ...prev, [field]: arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item] }));
  };

  const toggleDiaSemana = (dia: number) => {
    const arr = form.dias_semana;
    setForm(prev => ({ ...prev, dias_semana: arr.includes(dia) ? arr.filter(d => d !== dia) : [...arr, dia].sort() }));
  };

  const updateEstrategia = (path: string, value: any) => {
    setForm(prev => {
      const e = { ...prev.estrategia };
      const parts = path.split(".");
      let obj: any = e;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return { ...prev, estrategia: e };
    });
  };

  const updateIaConfig = (key: string, value: any) => {
    setForm(prev => ({ ...prev, ia_config: { ...prev.ia_config, [key]: value } }));
  };

  const updatePesoScore = (key: string, value: number) => {
    setForm(prev => {
      const e = { ...prev.estrategia };
      if (!e.scoring) e.scoring = { ...ESTRATEGIA_PADRAO.scoring, pesos: { ...ESTRATEGIA_PADRAO.scoring.pesos } };
      e.scoring.pesos = { ...e.scoring.pesos, [key]: value };
      return { ...prev, estrategia: e };
    });
  };

  const toggleCriterioDuplicidade = (criterio: string) => {
    setForm(prev => {
      const e = { ...prev.estrategia };
      if (!e.anti_duplicidade) e.anti_duplicidade = { ...ESTRATEGIA_PADRAO.anti_duplicidade };
      const criterios = e.anti_duplicidade.criterios;
      e.anti_duplicidade = {
        ...e.anti_duplicidade,
        criterios: criterios.includes(criterio)
          ? criterios.filter(c => c !== criterio)
          : [...criterios, criterio],
      };
      return { ...prev, estrategia: e };
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Settings className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const BadgeToggle = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
    <Badge variant={selected ? "default" : "outline"} className="cursor-pointer" onClick={onClick}>{label}</Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estrategia Comercial — Hunter SDR</h2>
          <p className="text-muted-foreground">Toda a estrategia do Hunter e configurada aqui, sem alterar codigo</p>
        </div>
        <Button onClick={handleSalvar} disabled={salvando}>
          <Save className="w-4 h-4 mr-1" /> {salvando ? "Salvando..." : "Salvar Estrategia"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid-cols-9 w-full">
          <TabsTrigger value="geral"><Settings className="w-4 h-4 mr-1" />Geral</TabsTrigger>
          <TabsTrigger value="alvos"><Target className="w-4 h-4 mr-1" />Alvos</TabsTrigger>
          <TabsTrigger value="score"><Gauge className="w-4 h-4 mr-1" />Score</TabsTrigger>
          <TabsTrigger value="tom"><Volume2 className="w-4 h-4 mr-1" />Tom Voz</TabsTrigger>
          <TabsTrigger value="canais"><MessageSquare className="w-4 h-4 mr-1" />Canais</TabsTrigger>
          <TabsTrigger value="fontes"><Globe className="w-4 h-4 mr-1" />Fontes</TabsTrigger>
          <TabsTrigger value="regras"><Shield className="w-4 h-4 mr-1" />Regras</TabsTrigger>
          <TabsTrigger value="ia"><Brain className="w-4 h-4 mr-1" />IA</TabsTrigger>
          <TabsTrigger value="limites"><DollarSign className="w-4 h-4 mr-1" />Limites</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[600px] pr-4">
          {/* ABA GERAL */}
          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Modo de Operacao</CardTitle><CardDescription>Define como o Hunter executa as acoes</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Ativo</Label><p className="text-sm text-muted-foreground">Ligar/desligar o Hunter</p></div>
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm(p => ({ ...p, ativo: v }))} />
                </div>
                <div className="space-y-2">
                  <Label>Modo</Label>
                  <Select value={form.modo} onValueChange={(v: HunterModo) => setForm(p => ({ ...p, modo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual — apenas gera relatorio</SelectItem>
                      <SelectItem value="assistido">Assistido — gera leads, nao envia msgs</SelectItem>
                      <SelectItem value="automatico">Automatico — ciclo completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Fontes de Prospeccao (informativas para prompt)</Label>
                  <div className="flex flex-wrap gap-2">
                    {["google", "google_maps", "linkedin", "instagram", "facebook", "catalogos_industriais", "associacoes", "federacoes", "sites_empresariais", "portais_b2b"].map(f => (
                      <BadgeToggle key={f} label={f.replace(/_/g, " ")} selected={form.fontes.includes(f)} onClick={() => toggleArrayItem("fontes", f)} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Horarios e Dias de Trabalho</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Horario Inicio</Label><Input type="time" value={form.horario_inicio} onChange={e => setForm(p => ({ ...p, horario_inicio: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Horario Fim</Label><Input type="time" value={form.horario_fim} onChange={e => setForm(p => ({ ...p, horario_fim: e.target.value }))} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2">
                    {[{ n: 0, label: "Dom" }, { n: 1, label: "Seg" }, { n: 2, label: "Ter" }, { n: 3, label: "Qua" }, { n: 4, label: "Qui" }, { n: 5, label: "Sex" }, { n: 6, label: "Sab" }].map(({ n, label }) => (
                      <BadgeToggle key={n} label={label} selected={form.dias_semana.includes(n)} onClick={() => toggleDiaSemana(n)} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA ALVOS */}
          <TabsContent value="alvos" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Segmentos Alvo</CardTitle><CardDescription>Quais segmentos prospectar</CardDescription></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {SEGMENTOS_DISPONIVEIS.map(s => (
                    <BadgeToggle key={s} label={s} selected={form.segmentos.includes(s)} onClick={() => toggleArrayItem("segmentos", s)} />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Segmentos Alvo (estrategia — usado no prompt da IA)</Label>
                  <Input value={(form.estrategia.segmentos_alvo || []).join(", ")}
                    onChange={e => updateEstrategia("segmentos_alvo", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="Separados por virgula" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Segmentos Proibidos</CardTitle><CardDescription>Nunca prospectar estes segmentos</CardDescription></CardHeader>
              <CardContent>
                <Input value={(form.estrategia.segmentos_proibidos || []).join(", ")}
                  onChange={e => updateEstrategia("segmentos_proibidos", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                  placeholder="Ex: Transportadoras, Operadores Logisticos" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Estados e Regioes</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {ESTADOS_DISPONIVEIS.map(e => (
                    <BadgeToggle key={e} label={e} selected={form.estados.includes(e)} onClick={() => toggleArrayItem("estados", e)} />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Palavras-chave de Prospeccao</CardTitle><CardDescription>Usadas no prompt da IA para filtrar empresas</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Palavras-chave (incluir)</Label>
                  <Input value={(form.estrategia.palavras_chave_prospeccao || []).join(", ")}
                    onChange={e => updateEstrategia("palavras_chave_prospeccao", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </div>
                <div className="space-y-2"><Label>Palavras-chave (excluir)</Label>
                  <Input value={(form.estrategia.palavras_excluir || []).join(", ")}
                    onChange={e => updateEstrategia("palavras_excluir", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </div>
                <div className="space-y-2"><Label>Concorrentes (palavras para bloquear)</Label>
                  <Input value={(form.estrategia.concorrentes || []).join(", ")}
                    onChange={e => updateEstrategia("concorrentes", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Descarte Automatico</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Descartar concorrentes automaticamente</Label></div>
                  <Switch checked={form.estrategia.descarte?.concorrente_automatico ?? true}
                    onCheckedChange={(v) => updateEstrategia("descarte.concorrente_automatico", v)} />
                </div>
                <div className="space-y-2"><Label>Score minimo para descarte automatico</Label>
                  <Input type="number" min={0} max={100}
                    value={form.estrategia.descarte?.score_minimo_auto ?? 20}
                    onChange={e => updateEstrategia("descarte.score_minimo_auto", Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA SCORE */}
          <TabsContent value="score" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Pesos do Score IA</CardTitle><CardDescription>Cada criterio tem um peso configurado aqui. Altere para recalibrar.</CardDescription></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(form.estrategia.scoring?.pesos || ESTRATEGIA_PADRAO.scoring.pesos).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{key.replace(/_/g, " ")}</Label>
                      <Input type="number" min={0} max={100} value={val as number}
                        onChange={e => updatePesoScore(key, Number(e.target.value))} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Thresholds de Temperatura</CardTitle><CardDescription>Notas de corte para cada classificacao</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                {["em_chamas", "quente", "morno"].map(t => (
                  <div key={t} className="space-y-2">
                      <Label>{t.replace(/_/g, " ")} (&gt;=)</Label>
                    <Input type="number" min={0} max={100}
                      value={(form.estrategia.scoring?.thresholds as any)?.[t] ?? (ESTRATEGIA_PADRAO.scoring.thresholds as any)[t]}
                      onChange={e => { const th = { ...form.estrategia.scoring?.thresholds, ...ESTRATEGIA_PADRAO.scoring.thresholds, [t]: Number(e.target.value) }; updateEstrategia("scoring.thresholds", th); }} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ranges de Probabilidade</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {["em_chamas", "quente", "morno", "frio"].map(t => {
                    const range = (form.estrategia.scoring?.probabilidade_ranges as any)?.[t] || (ESTRATEGIA_PADRAO.scoring.probabilidade_ranges as any)[t];
                    return (
                      <div key={t} className="space-y-2 p-3 border rounded-lg">
                        <Label className="font-medium">{t.replace(/_/g, " ")}</Label>
                        <div className="flex gap-2">
                          <Input type="number" min={0} max={100} value={range?.min ?? 0}
                            onChange={e => updateEstrategia(`scoring.probabilidade_ranges.${t}.min`, Number(e.target.value))} placeholder="Min" />
                          <Input type="number" min={0} max={100} value={range?.max ?? 0}
                            onChange={e => updateEstrategia(`scoring.probabilidade_ranges.${t}.max`, Number(e.target.value))} placeholder="Max" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Lead Quente</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-2"><Label>Score minimo para lead quente</Label>
                  <Input type="number" min={0} max={100}
                    value={form.estrategia.lead_quente?.score_minimo ?? 80}
                    onChange={e => updateEstrategia("lead_quente.score_minimo", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Criterios extras de lead quente</Label>
                  <Input value={(form.estrategia.lead_quente?.criterios_extra || []).join("; ")}
                    onChange={e => updateEstrategia("lead_quente.criterios_extra", e.target.value.split(";").map((s: string) => s.trim()).filter(Boolean))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA TOM DE VOZ */}
          <TabsContent value="tom" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Tom de Voz</CardTitle><CardDescription>Define a personalidade do Hunter nas abordagens</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Estilo</Label>
                    <Select value={form.estrategia.tom_voz?.estilo || "consultivo"}
                      onValueChange={(v) => updateEstrategia("tom_voz.estilo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="consultivo">Consultivo</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Formalidade</Label>
                    <Select value={form.estrategia.tom_voz?.formalidade || "semiformal"}
                      onValueChange={(v) => updateEstrategia("tom_voz.formalidade", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="semiformal">Semiformal</SelectItem>
                        <SelectItem value="informal">Informal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Comp. maximo WhatsApp (caracteres)</Label>
                    <Input type="number" value={form.estrategia.tom_voz?.comprimento_maximo ?? 300}
                      onChange={e => updateEstrategia("tom_voz.comprimento_maximo", Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-2"><Label>Regras de tom (uma por linha)</Label>
                  <Textarea rows={4}
                    value={(form.estrategia.tom_voz?.regras || []).join("\n")}
                    onChange={e => updateEstrategia("tom_voz.regras", e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="Seja natural e profissional&#10;Nunca pareca spam&#10;Maximo 3 paragrafos" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Abordagem</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Nome da empresa no prompt</Label>
                  <Input value={form.estrategia.abordagem?.empresa_nome || "Conexao Express Transportes"}
                    onChange={e => updateEstrategia("abordagem.empresa_nome", e.target.value)} />
                </div>
                <div className="space-y-2"><Label>Assunto padrao de email</Label>
                  <Input value={form.estrategia.abordagem?.assunto_email_padrao || "Apresentacao Conexao Express"}
                    onChange={e => updateEstrategia("abordagem.assunto_email_padrao", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Comp. max WhatsApp</Label>
                    <Input type="number" value={form.estrategia.abordagem?.comprimento_max_whatsapp ?? 300}
                      onChange={e => updateEstrategia("abordagem.comprimento_max_whatsapp", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2"><Label>Duracao script ligacao (seg)</Label>
                    <Input type="number" value={form.estrategia.abordagem?.duracao_script_ligacao_seg ?? 30}
                      onChange={e => updateEstrategia("abordagem.duracao_script_ligacao_seg", Number(e.target.value))} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Incluir assinatura</Label></div>
                  <Switch checked={form.estrategia.abordagem?.incluir_assinatura ?? true}
                    onCheckedChange={(v) => updateEstrategia("abordagem.incluir_assinatura", v)} />
                </div>
                {form.estrategia.abordagem?.incluir_assinatura !== false && (
                  <div className="space-y-2"><Label>Texto da assinatura</Label>
                    <Input value={form.estrategia.abordagem?.assinatura || "Atenciosamente, Equipe Comercial - Conexao Express"}
                      onChange={e => updateEstrategia("abordagem.assinatura", e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA CANAIS */}
          <TabsContent value="canais" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Canais de Abordagem</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "whatsapp", label: "WhatsApp" },
                  { key: "email", label: "E-mail" },
                  { key: "linkedin", label: "LinkedIn" },
                  { key: "instagram", label: "Instagram" },
                  { key: "ligacao", label: "Ligacao Telefonica" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div><Label>{label}</Label></div>
                    <Switch
                      checked={(form.estrategia.canais as any)?.[key] ?? (ESTRATEGIA_PADRAO.canais as any)[key]}
                      onCheckedChange={(v) => updateEstrategia(`canais.${key}`, v)} />
                  </div>
                ))}
                <Separator />
                <div className="space-y-2"><Label>Ordem de prioridade dos canais (separados por virgula)</Label>
                  <Input value={form.estrategia.canais?.ordem_prioridade?.join(", ") || ""}
                    onChange={e => updateEstrategia("canais.ordem_prioridade", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA FONTES / PROVIDERS */}
          <TabsContent value="fontes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Providers de Prospeccao</CardTitle>
                <CardDescription>Configure quais providers usar e em qual ordem. A IA nao inventa mais empresas — tudo vem de fontes reais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Ordem de Execucao (separados por virgula)</Label>
                  <Input value={form.estrategia.providers?.ordem?.join(", ") || ""}
                    onChange={e => updateEstrategia("providers.ordem", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="manual, mock, web_search, google_maps, catalogo, social_assistido" />
                  <p className="text-xs text-muted-foreground">Define a sequencia em que os providers sao executados no ciclo</p>
                </div>

                <Separator />

                {/* Manual */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900"><Settings className="w-4 h-4 text-blue-600" /></div>
                    <div>
                      <Label>Manual — Insercao Direta</Label>
                      <p className="text-xs text-muted-foreground">Insira prospects via UI. Nao requer chave de API.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.manual?.ativo ?? true}
                    onCheckedChange={(v) => updateEstrategia("providers.manual.ativo", v)} />
                </div>

                {/* Mock */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-gray-100 dark:bg-gray-800"><Ban className="w-4 h-4 text-gray-500" /></div>
                    <div>
                      <Label>Mock — Simulado (Homologacao)</Label>
                      <p className="text-xs text-muted-foreground">Apenas para testes. Dados simulados — nao criar leads reais.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.mock?.ativo ?? false}
                    onCheckedChange={(v) => updateEstrategia("providers.mock.ativo", v)} />
                </div>

                {/* WebSearch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-green-100 dark:bg-green-900"><Search className="w-4 h-4 text-green-600" /></div>
                    <div>
                      <Label>Busca Web (SerpAPI / Google CSE)</Label>
                      <p className="text-xs text-muted-foreground">Busca empresas na web. Requer chave SerpAPI ou Google CSE.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.web_search?.ativo ?? false}
                    onCheckedChange={(v) => updateEstrategia("providers.web_search.ativo", v)} />
                </div>
                {(form.estrategia.providers?.web_search?.ativo) && (
                  <div className="ml-10 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Provider</Label>
                      <Select value={form.estrategia.providers?.web_search?.provider || "serpapi"}
                        onValueChange={(v) => updateEstrategia("providers.web_search.provider", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="serpapi">SerpAPI</SelectItem>
                          <SelectItem value="google_cse">Google Custom Search</SelectItem>
                          <SelectItem value="bing">Bing Search</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Secret da Chave</Label>
                      <Input value={form.estrategia.providers?.web_search?.api_key_secret || "SERPAPI_KEY"}
                        onChange={e => updateEstrategia("providers.web_search.api_key_secret", e.target.value)}
                        placeholder="VARIAVEL_AMBIENTE" />
                    </div>
                  </div>
                )}

                {/* Google Maps */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-red-100 dark:bg-red-900"><MapPin className="w-4 h-4 text-red-600" /></div>
                    <div>
                      <Label>Google Maps / Places API</Label>
                      <p className="text-xs text-muted-foreground">Busca empresas por segmento/regiao. Requer Google Places API key.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.google_maps?.ativo ?? false}
                    onCheckedChange={(v) => updateEstrategia("providers.google_maps.ativo", v)} />
                </div>
                {(form.estrategia.providers?.google_maps?.ativo) && (
                  <div className="ml-10">
                    <div className="space-y-1">
                      <Label className="text-xs">Secret da Chave</Label>
                      <Input value={form.estrategia.providers?.google_maps?.api_key_secret || "GOOGLE_MAPS_API_KEY"}
                        onChange={e => updateEstrategia("providers.google_maps.api_key_secret", e.target.value)}
                        placeholder="VARIAVEL_AMBIENTE" />
                    </div>
                  </div>
                )}

                {/* Catalogos */}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900"><Globe className="w-4 h-4 text-purple-600" /></div>
                    <div>
                      <Label>Catalogos e Associacoes</Label>
                      <p className="text-xs text-muted-foreground">Sugere fontes publicas para consulta manual. Nao faz scraping.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.catalogos?.ativo ?? true}
                    onCheckedChange={(v) => updateEstrategia("providers.catalogos.ativo", v)} />
                </div>
                {(form.estrategia.providers?.catalogos?.ativo) && (
                  <div className="ml-10 space-y-1">
                    <Label className="text-xs">Fontes de Catalogos (uma por linha)</Label>
                    <Textarea rows={3}
                      value={(form.estrategia.providers?.catalogos?.fontes || []).join("\n")}
                      onChange={e => updateEstrategia("providers.catalogos.fontes", e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean))}
                      placeholder="https://www.acsp.com.br/associados&#10;https://www.fiesp.com.br/associados" />
                  </div>
                )}

                {/* Social Assistido */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-900"><MessageSquare className="w-4 h-4 text-amber-600" /></div>
                    <div>
                      <Label>Redes Sociais (Assistido)</Label>
                      <p className="text-xs text-muted-foreground">Apenas sugestoes de busca manual. Nao automatiza scraping de redes sociais.</p>
                    </div>
                  </div>
                  <Switch checked={form.estrategia.providers?.social_assistido?.ativo ?? true}
                    onCheckedChange={(v) => updateEstrategia("providers.social_assistido.ativo", v)} />
                </div>
                {(form.estrategia.providers?.social_assistido?.ativo) && (
                  <div className="ml-10 space-y-1">
                    <Label className="text-xs">Redes Ativas</Label>
                    <div className="flex flex-wrap gap-2">
                      {["linkedin", "instagram", "facebook"].map(rede => (
                        <BadgeToggle key={rede} label={rede.charAt(0).toUpperCase() + rede.slice(1)}
                          selected={form.estrategia.providers?.social_assistido?.redes?.includes(rede) ?? false}
                          onClick={() => {
                            const redes = form.estrategia.providers?.social_assistido?.redes || [];
                            const novas = redes.includes(rede)
                              ? redes.filter((r: string) => r !== rede)
                              : [...redes, rede];
                            updateEstrategia("providers.social_assistido.redes", novas);
                          }} />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Regra Anti-Invencao</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ativo (sempre ligado)</Label>
                    <p className="text-xs text-muted-foreground">Nunca cria lead sem provider_origem, fonte_nome ou com confianca = simulada. Tudo registrado em log.</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Sempre Ativo</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA REGRAS */}
          <TabsContent value="regras" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Anti-Duplicidade</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Ativar anti-duplicidade</Label></div>
                  <Switch checked={form.estrategia.anti_duplicidade?.ativo ?? true}
                    onCheckedChange={(v) => updateEstrategia("anti_duplicidade.ativo", v)} />
                </div>
                <div className="space-y-2"><Label>Criterios de verificacao</Label>
                  <div className="flex flex-wrap gap-2">
                    {CRITERIOS_ANTI_DUPLICIDADE.map(c => (
                      <BadgeToggle key={c} label={c} selected={form.estrategia.anti_duplicidade?.criterios?.includes(c) ?? false}
                        onClick={() => toggleCriterioDuplicidade(c)} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Verificar em resultados anteriores do Hunter</Label></div>
                  <Switch checked={form.estrategia.anti_duplicidade?.check_resultados_anteriores ?? true}
                    onCheckedChange={(v) => updateEstrategia("anti_duplicidade.check_resultados_anteriores", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Verificar em leads do CRM</Label></div>
                  <Switch checked={form.estrategia.anti_duplicidade?.check_crm_leads ?? true}
                    onCheckedChange={(v) => updateEstrategia("anti_duplicidade.check_crm_leads", v)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Follow-up</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Dias para follow-up</Label>
                  <div className="flex gap-2">
                    {[2, 3, 5, 7, 10, 14, 20, 30].map(d => {
                      const dias = form.estrategia.followup?.dias || ESTRATEGIA_PADRAO.followup.dias;
                      return (
                        <BadgeToggle key={d} label={`D+${d}`} selected={dias.includes(d)}
                          onClick={() => {
                            const arr = dias.includes(d) ? dias.filter(i => i !== d) : [...dias, d].sort((a, b) => a - b);
                            updateEstrategia("followup.dias", arr);
                          }} />
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Max follow-ups</Label>
                    <Input type="number" value={form.estrategia.followup?.max_followups ?? 4}
                      onChange={e => updateEstrategia("followup.max_followups", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2"><Label>Recontato apos (dias)</Label>
                    <Input type="number" value={form.estrategia.followup?.tempo_recontato_dias ?? 30}
                      onChange={e => updateEstrategia("followup.tempo_recontato_dias", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2"><Label>Arquivar apos (dias)</Label>
                    <Input type="number" value={form.estrategia.followup?.arquivar_apos_dias ?? 30}
                      onChange={e => updateEstrategia("followup.arquivar_apos_dias", Number(e.target.value))} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Mensagem personalizada por IA</Label></div>
                  <Switch checked={form.estrategia.followup?.mensagem_personalizada ?? true}
                    onCheckedChange={(v) => updateEstrategia("followup.mensagem_personalizada", v)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA IA */}
          <TabsContent value="ia" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Provedor IA Principal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Provider</Label>
                    <Select value={form.ia_config?.provider || "groq"}
                      onValueChange={(v) => updateIaConfig("provider", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Modelo</Label>
                    <Input value={form.ia_config?.model || "llama-3.1-8b-instant"}
                      onChange={e => updateIaConfig("model", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Fallback Provider</Label>
                    <Select value={form.ia_config?.fallback_provider || "groq"}
                      onValueChange={(v) => updateIaConfig("fallback_provider", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Fallback Modelo</Label>
                    <Input value={form.ia_config?.fallback_model || "llama-3.1-8b-instant"}
                      onChange={e => updateIaConfig("fallback_model", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Temperatura por Operacao</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Prospeccao (criatividade)</Label>
                  <Input type="number" min={0} max={2} step={0.1}
                    value={form.ia_config?.temperature_prospeccao ?? 0.7}
                    onChange={e => updateIaConfig("temperature_prospeccao", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Enriquecimento</Label>
                  <Input type="number" min={0} max={2} step={0.1}
                    value={form.ia_config?.temperature_enriquecimento ?? 0.5}
                    onChange={e => updateIaConfig("temperature_enriquecimento", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Validacao (precisa)</Label>
                  <Input type="number" min={0} max={2} step={0.1}
                    value={form.ia_config?.temperature_validacao ?? 0.3}
                    onChange={e => updateIaConfig("temperature_validacao", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Abordagem (personalizada)</Label>
                  <Input type="number" min={0} max={2} step={0.1}
                    value={form.ia_config?.temperature_abordagem ?? 0.7}
                    onChange={e => updateIaConfig("temperature_abordagem", Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Max Tokens por Operacao</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[{ key: "max_tokens_prospeccao", label: "Prospeccao" },
                  { key: "max_tokens_enriquecimento", label: "Enriquecimento" },
                  { key: "max_tokens_validacao", label: "Validacao" },
                  { key: "max_tokens_abordagem", label: "Abordagem" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2"><Label>{label}</Label>
                    <Input type="number" min={100} max={10000} step={100}
                      value={(form.ia_config as any)?.[key] ?? 500}
                      onChange={e => updateIaConfig(key, Number(e.target.value))} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA LIMITES */}
          <TabsContent value="limites" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Limites Operacionais</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Leads por dia</Label>
                  <Input type="number" min={1} max={100} value={form.estrategia.limites?.leads_por_dia ?? 10}
                    onChange={e => updateEstrategia("limites.leads_por_dia", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Prospeccoes por ciclo</Label>
                  <Input type="number" min={1} max={50} value={form.estrategia.limites?.prospeccoes_por_ciclo ?? 20}
                    onChange={e => updateEstrategia("limites.prospeccoes_por_ciclo", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Max tokens por ciclo</Label>
                  <Input type="number" min={1000} max={200000} step={1000}
                    value={form.estrategia.limites?.max_tokens_por_ciclo ?? 50000}
                    onChange={e => updateEstrategia("limites.max_tokens_por_ciclo", Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Orcamento</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Orcamento diario (USD)</Label>
                  <Input type="number" min={0} step={0.5}
                    value={form.estrategia.orcamento?.diario ?? 10}
                    onChange={e => updateEstrategia("orcamento.diario", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Orcamento mensal (USD)</Label>
                  <Input type="number" min={0} step={5}
                    value={form.estrategia.orcamento?.mensal ?? 200}
                    onChange={e => updateEstrategia("orcamento.mensal", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Alerta ao atingir (%)</Label>
                  <Input type="number" min={0} max={100}
                    value={form.estrategia.orcamento?.alerta_atingir ?? 80}
                    onChange={e => updateEstrategia("orcamento.alerta_atingir", Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

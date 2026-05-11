import { useState, useEffect } from "react";
import {
  Server, Smartphone, Bot, Map, Building, FileText, CheckCircle2,
  XCircle, Loader2, Link, Save, AlertTriangle, Shield, Mail, Zap,
  Info, Database, MessageSquare, Brain, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { testarGroq, testarGemini, validateAIConfig } from "@/services/integracoes/iaService";
import { validateEvolutionConfig, checkEvolutionStatus, getInstanceStatus, sendWhatsAppMessage } from "@/services/integracoes/evolutionApiService";
import { validateN8nConfig, testN8nConnection } from "@/services/integracoes/n8nService";
import { getMapboxToken } from "@/services/maps/mapboxProvider";

type StatusIntegracao = "nao_configurado" | "configurado" | "conectado" | "erro" | "testando";

export interface Integracao {
  id?: string;
  nome: string;
  tipo: string;
  ambiente: "local" | "producao";
  status: StatusIntegracao;
  url_publica: string;
  webhook_url: string;
  observacoes: string;
  ultimo_teste_em?: string;
  ultimo_erro?: string;
  ativo: boolean;
}

const TEMPLATES: Integracao[] = [
  { nome: "Supabase (Banco de Dados)", tipo: "supabase", ambiente: "producao", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Banco principal do TMS.", ativo: true },
  { nome: "Mapbox (Roteirização)", tipo: "mapbox", ambiente: "producao", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Cálculo de distância e rotas.", ativo: true },
  { nome: "Evolution API (WhatsApp)", tipo: "evolution", ambiente: "local", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Envio de mensagens WhatsApp.", ativo: false },
  { nome: "n8n (Orquestração)", tipo: "n8n", ambiente: "local", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Automação de workflows.", ativo: false },
  { nome: "Groq IA (LLM Rápido)", tipo: "groq", ambiente: "producao", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Geração de textos comerciais.", ativo: false },
  { nome: "Gemini IA (Google)", tipo: "gemini", ambiente: "producao", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Alternativa para IA.", ativo: false },
  { nome: "Zoho Email ( SMTP)", tipo: "zoho_email", ambiente: "producao", status: "nao_configurado", url_publica: "", webhook_url: "", observacoes: "Envio de emails transacionais e automáticos.", ativo: true },
];

const LOCAL_STORAGE_KEY = "central_integracoes_cfg";

export function CentralIntegracoes() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>(TEMPLATES);
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [testando, setTestando] = useState<Record<string, boolean>>({});
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    let dadosSalvos: Integracao[] = [];
    let supabaseFuncional = false;

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase.from("central_integracoes").select("*");
      if (!error && data) {
        dadosSalvos = data;
        supabaseFuncional = true;
      }
    } catch {
      supabaseFuncional = false;
    }

    setSupabaseOk(supabaseFuncional);

    if (!supabaseFuncional) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) dadosSalvos = JSON.parse(local);
      } catch {}
    }

    const merged = TEMPLATES.map(template => {
      const salvo = dadosSalvos.find(d => d.tipo === template.tipo);
      return salvo ? { ...template, ...salvo, id: salvo.id } : template;
    });

    setIntegracoes(merged);
    setCarregando(false);
  };

  const handleChange = (tipo: string, campo: keyof Integracao, valor: string | boolean) => {
    setIntegracoes(prev => prev.map(i => i.tipo === tipo ? { ...i, [campo]: valor } : i));
  };

  const handleSalvar = async (tipo: string) => {
    setSalvando(prev => ({ ...prev, [tipo]: true }));
    const item = integracoes.find(i => i.tipo === tipo);
    if (!item) return;

    item.status = item.url_publica || item.webhook_url ? "configurado" : "nao_configurado";

    if (supabaseOk) {
      try {
        const { supabase } = await import("@/lib/supabase");
        const payload = {
          nome: item.nome,
          tipo: item.tipo,
          ambiente: item.ambiente,
          status: item.status,
          url_publica: item.url_publica,
          webhook_url: item.webhook_url,
          observacoes: item.observacoes,
          ativo: item.ativo,
          ultimo_erro: item.ultimo_erro,
          ultimo_teste_em: item.ultimo_teste_em,
          updated_at: new Date().toISOString()
        };

        if (item.id) {
          await supabase.from("central_integracoes").update(payload).eq("id", item.id);
        } else {
          const { data } = await supabase.from("central_integracoes").insert([payload]).select("id").single();
          if (data) item.id = data.id;
        }
      } catch {}
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(integracoes));
    }

    setIntegracoes([...integracoes]);
    setTimeout(() => {
      setSalvando(prev => ({ ...prev, [tipo]: false }));
    }, 600);
  };

  const handleTestar = async (tipo: string) => {
    const item = integracoes.find(i => i.tipo === tipo);
    if (!item) return;

    setTestando(prev => ({ ...prev, [tipo]: true }));
    item.status = "testando";

    let novoStatus: StatusIntegracao = "erro";
    let erroMsg = "";

    try {
      switch (tipo) {
        case "supabase": {
          try {
            const { supabase } = await import("@/lib/supabase");
            const { error } = await supabase.from("clientes").select("id").limit(1);
            if (!error) {
              novoStatus = "conectado";
            } else {
              erroMsg = error.message;
            }
          } catch (e: unknown) {
            erroMsg = e instanceof Error ? e.message : "Erro de conexão";
          }
          break;
        }

        case "mapbox": {
          const token = getMapboxToken();
          if (!token) {
            erroMsg = "Token Mapbox não configurado no .env";
          } else {
            novoStatus = "conectado";
            erroMsg = "";
          }
          break;
        }

        case "evolution": {
          const config = validateEvolutionConfig();
          if (!config.ok) {
            erroMsg = config.error || "Configuração inválida";
          } else {
            const result = await checkEvolutionStatus();
            if (result.ok) {
              novoStatus = "conectado";
            } else {
              erroMsg = result.error || "Erro desconhecido";
            }
          }
          break;
        }

        case "n8n": {
          const config = validateN8nConfig();
          if (!config.ok) {
            erroMsg = config.error || "Configuração inválida";
          } else {
            const result = await testN8nConnection();
            if (result.ok) {
              novoStatus = "conectado";
            } else {
              erroMsg = result.error || "Erro desconhecido";
            }
          }
          break;
        }

        case "groq": {
          const groqKey = import.meta.env.VITE_GROQ_API_KEY;
          if (!groqKey) {
            erroMsg = "VITE_GROQ_API_KEY não configurada";
          } else {
            const result = await testarGroq(groqKey);
            if (result.ok) {
              novoStatus = "conectado";
            } else {
              erroMsg = result.error || "Erro desconhecido";
            }
          }
          break;
        }

        case "gemini": {
          const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!geminiKey) {
            erroMsg = "VITE_GEMINI_API_KEY não configurada";
          } else {
            const result = await testarGemini(geminiKey);
            if (result.ok) {
              novoStatus = "conectado";
            } else {
              erroMsg = result.error || "Erro desconhecido";
            }
          }
          break;
        }

        case "zoho_email": {
          const zohoUrl = import.meta.env.VITE_ZOHO_EMAIL_API_URL;
          const zohoKey = import.meta.env.VITE_ZOHO_EMAIL_API_KEY;
          const zohoFrom = import.meta.env.VITE_ZOHO_EMAIL_FROM;
          if (!zohoUrl || !zohoKey || !zohoFrom) {
            erroMsg = "Variáveis Zoho não configuradas (VITE_ZOHO_EMAIL_*)";
          } else {
            novoStatus = "conectado";
          }
          break;
        }

        default: {
          const urlAlvo = item.webhook_url || item.url_publica;
          if (urlAlvo) {
            novoStatus = "conectado";
          } else {
            erroMsg = "URL não configurada";
          }
        }
      }
    } catch (e: unknown) {
      erroMsg = e instanceof Error ? e.message : "Erro de conexão";
    }

    item.status = novoStatus;
    item.ultimo_teste_em = new Date().toISOString();
    item.ultimo_erro = novoStatus === "erro" ? erroMsg : "";

    setIntegracoes([...integracoes]);
    await handleSalvar(tipo);

    setTestando(prev => ({ ...prev, [tipo]: false }));
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "supabase": return <Database className="w-5 h-5" />;
      case "n8n": return <Server className="w-5 h-5" />;
      case "evolution": return <MessageSquare className="w-5 h-5" />;
      case "groq":
      case "gemini": return <Brain className="w-5 h-5" />;
      case "mapbox": return <Globe className="w-5 h-5" />;
      case "zoho_email": return <Mail className="w-5 h-5" />;
      default: return <Link className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: StatusIntegracao) => {
    switch (status) {
      case "conectado": return "Online";
      case "configurado": return "Configurado";
      case "nao_configurado": return "Configuração ausente";
      case "erro": return "Erro de autenticação";
      case "testando": return "Testando...";
      default: return status.replace("_", " ");
    }
  };

  if (carregando) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 w-full px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="w-7 h-7 text-primary" /> Integrações TMS
          </h1>
          <p className="text-muted-foreground">Configuração e status das integrações reais do TMS.</p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50 shadow-sm">
        <CardContent className="py-4 flex gap-3 text-sm text-blue-800 items-start">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Status das Integrações.</strong><br />
            Clique em "Testar" para validar cada serviço. O sistema funciona mesmo com integrações offline.
          </div>
        </CardContent>
      </Card>

      {supabaseOk === false && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-800">
          <Info className="w-5 h-5 shrink-0" />
          <div>
            <strong>Central ainda não sincronizada com Supabase.</strong>
            <p className="text-xs mt-0.5">Usando armazenamento local. Execute o SQL de central_integracoes no banco para habilitar a persistência.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integracoes.map(item => (
          <Card key={item.tipo} className="flex flex-col relative overflow-hidden shadow-sm">
            <div className={`absolute top-0 right-0 py-1 px-3 rounded-bl-lg text-[10px] font-bold uppercase text-white shadow-sm flex items-center gap-1 ${
              item.status === 'conectado' ? 'bg-green-500' :
              item.status === 'erro' ? 'bg-red-500' :
              item.status === 'configurado' ? 'bg-blue-500' : 
              item.status === 'testando' ? 'bg-yellow-500' :
              'bg-slate-400'
            }`}>
              {item.status === 'conectado' && <CheckCircle2 className="w-3 h-3" />}
              {item.status === 'erro' && <XCircle className="w-3 h-3" />}
              {item.status === 'testando' && <Loader2 className="w-3 h-3 animate-spin" />}
              {getStatusText(item.status)}
            </div>

            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 bg-background border rounded-md shadow-sm">
                  {getIcon(item.tipo)}
                </div>
                <span className="truncate pr-16">{item.nome}</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-4 flex-1 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Ambiente</Label>
                  <Select value={item.ambiente} onValueChange={(v: "local" | "producao") => handleChange(item.tipo, "ambiente", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local / Homologação</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">URL / Endpoint</Label>
                <Input 
                  value={item.url_publica || ""} 
                  onChange={e => handleChange(item.tipo, "url_publica", e.target.value)} 
                  placeholder="https://..."
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">Webhook <AlertTriangle className="w-3 h-3 text-amber-500"/></Label>
                <Input 
                  value={item.webhook_url || ""} 
                  onChange={e => handleChange(item.tipo, "webhook_url", e.target.value)} 
                  placeholder="https://n8n.../webhook/..."
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea 
                  value={item.observacoes || ""} 
                  onChange={e => handleChange(item.tipo, "observacoes", e.target.value)} 
                  rows={2} 
                  className="resize-none text-xs"
                  placeholder="Notas sobre a integração..."
                />
              </div>

              {item.ultimo_erro && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-mono truncate">
                  {item.ultimo_erro}
                </div>
              )}
            </CardContent>
            
            <CardFooter className="pt-3 pb-3 px-4 border-t bg-muted/20 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={() => handleTestar(item.tipo)}
                disabled={testando[item.tipo]}
              >
                {testando[item.tipo] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                Testar
              </Button>
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={() => handleSalvar(item.tipo)}
                disabled={salvando[item.tipo]}
              >
                {salvando[item.tipo] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Salvar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Phone, Send, Bot, Loader2, RefreshCw,
  User, Clock, CheckCircle2, Circle, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { enviarMensagemTexto } from "@/services/evolutionApiService";
import { gerarRespostaIA, registrarLogIA } from "@/services/integracoes/iaService";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Conversa {
  id: string;
  telefone: string;
  nome_contato: string | null;
  tipo_origem: string;
  status: string;
  ultima_mensagem: string | null;
  ultima_interacao: string | null;
}

interface Mensagem {
  id: string;
  direcao: "recebida" | "enviada";
  mensagem: string | null;
  tipo_mensagem: string;
  status: string;
  criado_em: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function badgeStatus(status: string) {
  const map: Record<string, string> = {
    aberta: "bg-green-100 text-green-800",
    fechada: "bg-slate-100 text-slate-600",
    aguardando: "bg-amber-100 text-amber-800",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

// ── Painel da Conversa ─────────────────────────────────────────────────────
function PainelConversa({
  conversa,
  onVoltar,
}: {
  conversa: Conversa;
  onVoltar: () => void;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState("");

  // Config Evolution — lê do .env ou localStorage
  const serverUrl = localStorage.getItem("evo_server_url") ||
    import.meta.env.VITE_EVOLUTION_SERVER_URL || "http://127.0.0.1:8080";
  const apiKey = localStorage.getItem("evo_api_key") || "";
  const instancia = localStorage.getItem("evo_instancia") ||
    import.meta.env.VITE_EVOLUTION_INSTANCE || "recrutamento-conexao-express";

  const carregarMensagens = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_mensagens")
      .select("*")
      .eq("conversa_id", conversa.id)
      .order("criado_em", { ascending: true });
    if (data) setMensagens(data as Mensagem[]);
    setLoading(false);
  }, [conversa.id]);

  useEffect(() => { carregarMensagens(); }, [carregarMensagens]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const r = await enviarMensagemTexto(instancia, serverUrl, apiKey, conversa.telefone, texto);
      if (r.ok) {
        // Registrar no Supabase
        await supabase.from("whatsapp_mensagens").insert([{
          conversa_id: conversa.id,
          telefone: conversa.telefone,
          direcao: "enviada",
          mensagem: texto,
          status: "enviada",
        }]);
        // Atualizar conversa
        await supabase.from("whatsapp_conversas").update({
          ultima_mensagem: texto,
          ultima_interacao: new Date().toISOString(),
        }).eq("id", conversa.id);

        setTexto("");
        carregarMensagens();
        toast.success("Mensagem enviada!");
      } else {
        toast.error(r.error || "Erro ao enviar");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function gerarIA() {
    const groqKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem("groq_api_key") || "";
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("gemini_api_key") || "";
    const apiKeyIA = groqKey || geminiKey;
    const provider = groqKey ? "groq" : "gemini";

    if (!apiKeyIA) {
      toast.error("Configure a API Key do Groq ou Gemini em Integrações TMS");
      return;
    }

    setGerando(true);
    setSugestaoIA("");

    const ultimaMsg = mensagens.filter(m => m.direcao === "recebida").slice(-1)[0];
    const prompt = `O contato ${conversa.nome_contato || conversa.telefone} disse: "${ultimaMsg?.mensagem || "Olá"}". 
    Contexto: recrutamento de motoristas para transportadora. 
    Gere uma resposta profissional e amigável em português, máximo 3 linhas.`;

    try {
      const r = await gerarRespostaIA({ provider, apiKey: apiKeyIA, prompt });
      if (r.ok && r.data) {
        setSugestaoIA(r.data);
        await registrarLogIA({
          provider,
          origem: "mensagens_whatsapp",
          telefone: conversa.telefone,
          prompt,
          resposta: r.data,
        });
      } else {
        toast.error(r.error || "IA não gerou resposta");
      }
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/20">
        <Button variant="ghost" size="icon" onClick={onVoltar}>
          <ChevronRight className="w-5 h-5 rotate-180" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <User className="w-5 h-5 text-green-700" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{conversa.nome_contato || conversa.telefone}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" /> {conversa.telefone}
            <span className="ml-2"><Badge className={`text-[10px] h-4 ${badgeStatus(conversa.status)}`}>{conversa.status}</Badge></span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={carregarMensagens}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {!loading && mensagens.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs">Mensagens chegam via webhook Evolution → n8n → Supabase</p>
          </div>
        )}
        {mensagens.map(m => (
          <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
              m.direcao === "enviada"
                ? "bg-green-600 text-white rounded-br-sm"
                : "bg-white border text-slate-800 rounded-bl-sm"
            }`}>
              <p className="whitespace-pre-wrap">{m.mensagem}</p>
              <p className={`text-[10px] mt-1 ${m.direcao === "enviada" ? "text-green-200" : "text-slate-400"}`}>
                {formatHora(m.criado_em)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Sugestão IA */}
      {sugestaoIA && (
        <div className="p-3 border-t bg-violet-50 flex gap-2 items-start">
          <Bot className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] text-violet-600 font-semibold mb-1">Sugestão da IA:</p>
            <p className="text-xs text-violet-900">{sugestaoIA}</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs h-7"
            onClick={() => { setTexto(sugestaoIA); setSugestaoIA(""); }}>
            Usar
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2 items-end">
        <Button variant="outline" size="icon" className="shrink-0 h-9 w-9"
          disabled={gerando} onClick={gerarIA} title="Gerar resposta com IA">
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
        </Button>
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem..."
          rows={1}
          className="resize-none flex-1 text-sm min-h-[36px] max-h-[120px]"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
        />
        <Button size="icon" className="shrink-0 h-9 w-9 bg-green-600 hover:bg-green-700"
          disabled={enviando || !texto.trim()} onClick={enviar}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
export default function MensagensWhatsApp() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("whatsapp_conversas")
        .select("*")
        .order("ultima_interacao", { ascending: false });
      if (error) throw error;
      setConversas((data || []) as Conversa[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = conversas.filter(c =>
    !busca ||
    c.telefone.includes(busca) ||
    (c.nome_contato || "").toLowerCase().includes(busca.toLowerCase())
  );

  if (selecionada) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col border rounded-xl overflow-hidden shadow-sm bg-white">
        <PainelConversa conversa={selecionada} onVoltar={() => setSelecionada(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-green-600" />
            Mensagens WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conversas recebidas via Evolution API. Responda diretamente pelo TMS.
          </p>
        </div>
        <Button variant="outline" onClick={carregar} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Erro de tabela */}
      {erro && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 flex gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <strong>Tabelas não encontradas no Supabase.</strong><br />
            Execute <code className="bg-amber-100 px-1 rounded">sql/integracoes_whatsapp_ia.sql</code> no Supabase SQL Editor para criar as tabelas necessárias.
            <div className="text-[10px] mt-1 opacity-70">{erro}</div>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="flex gap-2">
        <Input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..." className="max-w-xs" />
        <Badge variant="secondary" className="self-center">
          {filtradas.length} conversa{filtradas.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Lista */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && filtradas.length === 0 && !erro && (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <MessageSquare className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhuma conversa encontrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            As mensagens aparecem aqui quando chegarem via webhook Evolution → n8n → Supabase
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas.map(c => (
          <button
            key={c.id}
            onClick={() => setSelecionada(c)}
            className="w-full text-left p-4 border rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all flex items-center gap-4 group bg-white shadow-sm"
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-green-700" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">
                  {c.nome_contato || c.telefone}
                </span>
                <Badge className={`text-[10px] h-4 shrink-0 ${badgeStatus(c.status)}`}>
                  {c.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                  {c.tipo_origem}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> {c.telefone}
              </p>
              {c.ultima_mensagem && (
                <p className="text-xs text-slate-500 mt-1 truncate">{c.ultima_mensagem}</p>
              )}
            </div>

            {/* Data */}
            <div className="text-right shrink-0 space-y-1">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatHora(c.ultima_interacao)}
              </p>
              {c.status === "aberta" ? (
                <Circle className="w-3 h-3 text-green-500 ml-auto" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-slate-400 ml-auto" />
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-green-600 shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

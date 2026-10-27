// ============================================================
// MISSÃO COTACAO-LEADS — aba "Leads / Cotações Site" (Comercial)
//
// Fila de triagem das cotações públicas vindas do /cotacao-express:
//   · lista leads em aberto (Pendente · Aguardando aprovação ·
//     Aprovada pelo Cliente · Pronto para OS)
//   · assina `cotacoes_publicas` (Realtime) e atualiza sozinha
//   · ação "Converter em Orçamento/OS" abre o Novo Orçamento já
//     pré-preenchido via /comercial?tab=orcamentos&action=novo&cotacao=<id>
//     (mesmo caminho dos alertas da Torre — montarOrcamentoDaCotacao)
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, RefreshCw, Loader2, ArrowRightCircle, ExternalLink,
  Globe, Copy, Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  buscarLeadsCotacoes,
  valorExibidoCotacao,
  resumoRotaCotacao,
  veiculoSugeridoCotacao,
  STATUS_LEAD_LABEL,
  STATUS_LEAD_COR,
  STATUS_LEADS_TRIAGEM,
  gerarLinkFase2,
  type CotacaoPublica,
} from "@/services/cotacoes/cotacaoPublicaService";

const formatarBrl = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarData = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const LeadsCotacoesLista = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<CotacaoPublica[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const carregar = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await buscarLeadsCotacoes();
      if (res.ok && res.dado) {
        setLeads(res.dado);
      } else {
        toast.error(res.erro || "Erro ao carregar leads de cotação.");
      }
    } catch {
      toast.error("Erro ao carregar leads de cotação.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Realtime — lead novo / status que muda aparece sem F5
  useEffect(() => {
    const canal = supabase
      .channel("leads-cotacoes-site")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cotacoes_publicas" },
        () => {
          void carregar();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [carregar]);

  // 1-click de conversão → Novo Orçamento pré-preenchido
  const handleConverter = (cotacao: CotacaoPublica) => {
    navigate(`/comercial?tab=orcamentos&action=novo&cotacao=${cotacao.id}`);
  };

  const handleVerOrcamento = (orcamentoId: string) => {
    navigate(`/comercial?tab=orcamentos&orcamento=${orcamentoId}`);
  };

  const handleCopiarLinkFase2 = async (cotacao: CotacaoPublica) => {
    const link = gerarLinkFase2(cotacao.id);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link da Fase 2 copiado.", { description: link });
    } catch {
      toast.info(link);
    }
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((c) => {
      const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
      if (!matchStatus) return false;
      if (!termo) return true;
      const alvo = [
        c.nome_cliente || "",
        c.telefone || "",
        c.carga_descricao || "",
        resumoRotaCotacao(c),
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [leads, busca, filtroStatus]);

  const totalAberto = leads.filter((c) => !c.orcamento_id).length;
  const totalAprovado = leads.filter((c) => c.valor_aprovado !== null).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" /> Leads / Cotações Site
            </CardTitle>
            <CardDescription>
              Solicitações públicas do /cotacao-express aguardando ação do comercial.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
            {leads.length} lead(s)
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
            {totalAberto} sem orçamento
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800">
            {totalAprovado} aprovada(s) pelo cliente
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, WhatsApp, carga ou rota..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[230px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_LEADS_TRIAGEM.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LEAD_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && leads.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando leads...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Globe className="w-8 h-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Nenhum lead de cotação encontrado</p>
            <p className="text-sm text-muted-foreground">
              Novas cotações do site aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Origem / Destino</TableHead>
                  <TableHead>Veículo Sugerido</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => {
                  const valor = valorExibidoCotacao(c);
                  const temOrcamento = Boolean(c.orcamento_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.nome_cliente || "Cliente"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.carga_descricao || "carga não informada"}
                          {c.carga_peso ? ` · ${c.carga_peso} kg` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{c.telefone || "—"}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="truncate" title={resumoRotaCotacao(c)}>
                          {resumoRotaCotacao(c)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.paradas.length} parada(s) · {formatarData(c.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>{veiculoSugeridoCotacao(c)}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {valor !== null ? formatarBrl(valor) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_LEAD_COR[c.status] || "bg-slate-100 text-slate-700"}>
                          {STATUS_LEAD_LABEL[c.status] || c.status}
                        </Badge>
                        {temOrcamento && (
                          <Badge className="ml-1 bg-violet-100 text-violet-800">Orçamento</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {temOrcamento ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => c.orcamento_id && handleVerOrcamento(c.orcamento_id)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver Orçamento
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleConverter(c)}
                            title="Abre o Novo Orçamento com cliente, endereços, carga e valor já preenchidos"
                          >
                            <ArrowRightCircle className="w-4 h-4" /> Converter em Orçamento/OS
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-1"
                          onClick={() => void handleCopiarLinkFase2(c)}
                          title="Copiar link da Fase 2 para o cliente completar os endereços"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadsCotacoesLista;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Package,
  Search,
  ShieldAlert,
} from "lucide-react";
import { emRiscoSlaPendente } from "@/services/operacao/osAlocacaoPendenteService";

/**
 * Solicitações Cliente (Operação)
 * ------------------------------------------------------------------
 * Fila EXCLUSIVA de pedidos/origens externas. Nunca lista OS criadas
 * internamente pela equipe. Fontes aceitas (flag de origem no banco):
 *   • Cotação Express  → ordens_servico.carga->>origem_cotacao
 *   • Painel do Cliente → ordens_servico.pedido_portal_id / portal_pedidos
 *   • App do Cliente    → portal_pedidos.solicitacao_via/origem = app_cliente
 */
type OrigemSolicitacao = "cotacao_express" | "painel_cliente" | "app_cliente";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORIGEM_INFO: Record<OrigemSolicitacao, { label: string; css: string }> = {
  cotacao_express: {
    label: "Cotação Express",
    css: "bg-violet-100 text-violet-700 border-violet-200",
  },
  painel_cliente: {
    label: "Painel do Cliente",
    css: "bg-blue-100 text-blue-700 border-blue-200",
  },
  app_cliente: {
    label: "App do Cliente",
    css: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const normalizarOrigem = (valor: string | null | undefined): OrigemSolicitacao | null => {
  const v = String(valor || "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("app")) return "app_cliente";
  if (v.includes("painel") || v.includes("portal")) return "painel_cliente";
  if (v.includes("cota")) return "cotacao_express";
  return null;
};

const STATUS_INFO: Record<string, { label: string; css: string }> = {
  rascunho: { label: "Rascunho", css: "bg-slate-100 text-slate-700 border-slate-200" },
  pendente: { label: "Pendente", css: "bg-amber-50 text-amber-700 border-amber-200" },
  aguardando_programacao: {
    label: "Aguardando Programação",
    css: "bg-amber-50 text-amber-700 border-amber-200",
  },
  agendada: { label: "Agendada", css: "bg-blue-50 text-blue-700 border-blue-200" },
  em_analise: { label: "Em Análise", css: "bg-blue-50 text-blue-700 border-blue-200" },
  em_andamento: {
    label: "Em Andamento",
    css: "bg-orange-50 text-orange-700 border-orange-200",
  },
  em_rota: { label: "Em Rota", css: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  enviado: { label: "Pendente", css: "bg-amber-50 text-amber-700 border-amber-200" },
  aprovado: { label: "Aprovado", css: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  programado: {
    label: "Programado",
    css: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

const statusInfo = (status: string | null | undefined) =>
  STATUS_INFO[String(status || "").toLowerCase().trim()] || {
    label: status || "—",
    css: "bg-slate-100 text-slate-700 border-slate-200",
  };

const prioridadeBadge = (p: string | null | undefined) => {
  const map: Record<string, string> = {
    alta: "bg-red-100 text-red-700 border-red-200",
    urgente: "bg-orange-100 text-orange-700 border-orange-200",
    normal: "bg-blue-100 text-blue-700 border-blue-200",
    baixa: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return map[String(p || "normal").toLowerCase()] || map.normal;
};

const textoOuTraco = (valor: unknown): string => {
  const texto = String(valor ?? "").trim();
  return texto || "—";
};

const localidade = (endereco?: { cidade?: string; uf?: string } | null): string => {
  const partes = [endereco?.cidade, endereco?.uf].filter(Boolean);
  return partes.length > 0 ? partes.join("/") : "—";
};

interface PortalPedidoRow {
  id: string;
  numero_pedido?: string | null;
  status?: string | null;
  solicitante_nome?: string | null;
  solicitante_email?: string | null;
  coleta_cidade?: string | null;
  coleta_uf?: string | null;
  entrega_destinatario?: string | null;
  entrega_cidade?: string | null;
  entrega_uf?: string | null;
  descricao?: string | null;
  volumes?: number | null;
  peso?: number | null;
  prioridade?: string | null;
  veiculo_sugerido?: string | null;
  observacoes?: string | null;
  os_vinculada_id?: string | null;
  solicitacao_via?: string | null;
  origem?: string | null;
  created_at?: string | null;
}

interface EnderecoOSRow {
  tipo?: string;
  endereco?: string;
  logradouro?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
}

interface OSExternaRow {
  id: string;
  numero?: string | null;
  status?: string | null;
  cliente?: string | null;
  created_at?: string | null;
  carga?: Record<string, unknown> | null;
  enderecos?: EnderecoOSRow[] | null;
  prioridade?: string | null;
  veiculo_tipo?: string | null;
  peso?: number | null;
  volumes?: number | null;
  carga_descricao?: string | null;
  pedido_portal_id?: string | null;
  clientes?: { nome_fantasia?: string | null; razao_social?: string | null } | null;
}

interface Solicitacao {
  key: string;
  tipo: "os" | "pedido";
  id: string;
  numero: string;
  origem: OrigemSolicitacao;
  cliente: string;
  coleta: string;
  destino: string;
  descricao: string;
  volumes: number;
  peso: number;
  prioridade: string;
  veiculo: string;
  status: string;
  statusLabel: string;
  statusCss: string;
  createdAt: string;
  osId: string | null;
  pedido: PortalPedidoRow | null;
  riscoSla: boolean;
}

const SELECT_OS_EXTERNA =
  "id, numero, status, cliente, created_at, carga, enderecos, prioridade, veiculo_tipo, peso, volumes, carga_descricao, pedido_portal_id, clientes(nome_fantasia, razao_social)";

/** Status de OS que NÃO entram na fila de solicitações (já encerradas). */
const STATUS_OS_ENCERRADOS = "(finalizada,cancelada,faturada,paga,encerrada)";

const nomeClienteOS = (row: OSExternaRow): string => {
  const join = row.clientes?.nome_fantasia || row.clientes?.razao_social || "";
  if (join.trim()) return join.trim();
  const bruto = String(row.cliente || "").trim();
  if (!bruto || UUID_REGEX.test(bruto)) return "—";
  return bruto;
};

export default function SolicitacoesClienteLista() {
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [solicitacaoAtual, setSolicitacaoAtual] = useState<Solicitacao | null>(null);
  const [osNumero, setOsNumero] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      const [osCotacao, osPortal, pedidosPortal] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select(SELECT_OS_EXTERNA)
          .not("carga->>origem_cotacao", "is", null)
          .not("status", "in", STATUS_OS_ENCERRADOS)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("ordens_servico")
          .select(SELECT_OS_EXTERNA)
          .not("pedido_portal_id", "is", null)
          .not("status", "in", STATUS_OS_ENCERRADOS)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("portal_pedidos")
          .select("*")
          .in("status", ["enviado", "em_analise", "aprovado"])
          .is("os_vinculada_id", null)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const osMap = new Map<string, OSExternaRow>();
      for (const row of [
        ...((osCotacao.data as unknown as OSExternaRow[]) || []),
        ...((osPortal.data as unknown as OSExternaRow[]) || []),
      ]) {
        if (row?.id) osMap.set(String(row.id), row);
      }
      const osRows = [...osMap.values()];

      // Origem real do pedido do portal (Painel x App) para as OS vinculadas.
      const pedidoIds = [
        ...new Set(
          osRows
            .map((row) => String(row.pedido_portal_id || "").trim())
            .filter((id) => id.length > 0),
        ),
      ];
      const origemPorPedido = new Map<string, OrigemSolicitacao>();
      if (pedidoIds.length > 0) {
        const { data: pedidosVinculados } = await supabase
          .from("portal_pedidos")
          .select("id, solicitacao_via, origem")
          .in("id", pedidoIds);
        for (const pedido of (pedidosVinculados as unknown as PortalPedidoRow[]) || []) {
          const origem = normalizarOrigem(pedido.origem || pedido.solicitacao_via);
          if (origem) origemPorPedido.set(String(pedido.id), origem);
        }
      }

      const deOS = (row: OSExternaRow): Solicitacao => {
        const carga = (row.carga || {}) as Record<string, unknown>;
        const origemCotacao = String(carga.origem_cotacao || "").trim();
        const origem = origemCotacao
          ? "cotacao_express"
          : origemPorPedido.get(String(row.pedido_portal_id || "")) || "painel_cliente";

        const enderecos = Array.isArray(row.enderecos) ? row.enderecos : [];
        const coleta = enderecos.find((e) => e?.tipo === "coleta") || enderecos[0];
        const destino =
          [...enderecos].reverse().find((e) => e?.tipo === "entrega") ||
          enderecos[enderecos.length - 1];

        const st = statusInfo(row.status);
        return {
          key: `os-${row.id}`,
          tipo: "os",
          id: String(row.id),
          numero: textoOuTraco(row.numero),
          origem,
          cliente: nomeClienteOS(row),
          coleta: localidade(coleta),
          destino: localidade(destino),
          descricao:
            textoOuTraco(row.carga_descricao) !== "—"
              ? textoOuTraco(row.carga_descricao)
              : textoOuTraco(carga.descricao),
          volumes: Number(row.volumes || carga.volumes || 0),
          peso: Number(row.peso || carga.peso || 0),
          prioridade: String(row.prioridade || "normal"),
          veiculo: String(row.veiculo_tipo || ""),
          status: String(row.status || ""),
          statusLabel: st.label,
          statusCss: st.css,
          createdAt: String(row.created_at || ""),
          osId: String(row.id),
          pedido: null,
          riscoSla: emRiscoSlaPendente(row.status, row.created_at),
        };
      };

      const dePedido = (pedido: PortalPedidoRow): Solicitacao | null => {
        const origem = normalizarOrigem(pedido.origem || pedido.solicitacao_via);
        if (!origem) return null;
        const st = statusInfo(pedido.status);
        return {
          key: `pedido-${pedido.id}`,
          tipo: "pedido",
          id: String(pedido.id),
          numero: textoOuTraco(pedido.numero_pedido),
          origem,
          cliente: textoOuTraco(pedido.solicitante_nome || pedido.solicitante_email),
          coleta:
            [pedido.coleta_cidade, pedido.coleta_uf].filter(Boolean).join("/") || "—",
          destino:
            [pedido.entrega_cidade, pedido.entrega_uf].filter(Boolean).join("/") || "—",
          descricao: textoOuTraco(pedido.descricao),
          volumes: Number(pedido.volumes || 0),
          peso: Number(pedido.peso || 0),
          prioridade: String(pedido.prioridade || "normal"),
          veiculo: String(pedido.veiculo_sugerido || ""),
          status: String(pedido.status || ""),
          statusLabel: st.label,
          statusCss: st.css,
          createdAt: String(pedido.created_at || ""),
          osId: null,
          pedido,
          riscoSla: emRiscoSlaPendente(pedido.status, pedido.created_at),
        };
      };

      const dePedidos = ((pedidosPortal.data as unknown as PortalPedidoRow[]) || [])
        .map(dePedido)
        .filter((item): item is Solicitacao => Boolean(item));

      const todas = [...osRows.map(deOS), ...dePedidos].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setSolicitacoes(todas);
    } catch (erro) {
      console.error("[SolicitacoesCliente] Falha ao carregar:", erro);
      setSolicitacoes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const analisar = async (id: string) => {
    await supabase
      .from("portal_pedidos")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", id);
    void carregar();
  };

  const abrirProgramar = (s: Solicitacao) => {
    if (s.tipo !== "pedido") return;
    setSolicitacaoAtual(s);
    setOsNumero("");
    setDialogAberto(true);
  };

  const programar = async () => {
    if (!solicitacaoAtual || !osNumero.trim()) return;
    const numero = osNumero.trim();

    // `portal_pedidos.os_vinculada_id` é UUID: resolve o número para o id real.
    const { data: osEncontrada } = await supabase
      .from("ordens_servico")
      .select("id")
      .eq("numero", numero)
      .maybeSingle();

    if (!osEncontrada?.id) {
      toast.error(`OS ${numero} não encontrada. Confira o número e tente novamente.`);
      return;
    }

    const { error } = await supabase
      .from("portal_pedidos")
      .update({
        status: "programado",
        os_vinculada_id: osEncontrada.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", solicitacaoAtual.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Pedido vinculado à OS ${numero}.`);
    setDialogAberto(false);
    setSolicitacaoAtual(null);
    void carregar();
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return solicitacoes;
    return solicitacoes.filter((s) =>
      [s.numero, s.cliente, s.coleta, s.destino, s.descricao, ORIGEM_INFO[s.origem].label].some(
        (v) => v?.toLowerCase().includes(termo),
      ),
    );
  }, [solicitacoes, busca]);

  const totalRisco = solicitacoes.filter((s) => s.riscoSla).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Solicitações de Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Exclusivo de Cotação Express, Painel do Cliente e App do Cliente.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              {solicitacoes.length} solicitação(ões)
            </span>
            {totalRisco > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-bold text-red-700">
                <ShieldAlert className="h-3 w-3 animate-pulse" /> {totalRisco} em risco de SLA
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Carregando solicitações...</p>
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma solicitação pendente</p>
            <p className="text-sm mt-1">
              Não há pedidos de Cotação Express, Painel do Cliente ou App do Cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pedido / OS</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Coleta</TableHead>
                  <TableHead className="text-xs">Destino</TableHead>
                  <TableHead className="text-xs">Mercadoria</TableHead>
                  <TableHead className="text-xs">Prioridade</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => {
                  const origem = ORIGEM_INFO[s.origem];
                  const pedido = s.pedido;
                  return (
                    <TableRow
                      key={s.key}
                      className={
                        s.riscoSla
                          ? "border-l-4 border-l-red-500 bg-red-50/70 hover:bg-red-50"
                          : undefined
                      }
                    >
                      <TableCell className="font-mono text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          {s.riscoSla && (
                            <ShieldAlert className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                          )}
                          {s.numero}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${origem.css}`}
                        >
                          {origem.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-xs max-w-[120px] truncate"
                        title={s.cliente}
                      >
                        {s.cliente}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[110px] truncate">
                        {s.coleta}
                      </TableCell>
                      <TableCell className="text-xs max-w-[110px] truncate">
                        {s.destino}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {s.descricao}
                        {s.volumes ? ` (${s.volumes} vol)` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${prioridadeBadge(s.prioridade)}`}
                        >
                          {s.prioridade || "normal"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${s.statusCss}`}
                          >
                            {s.statusLabel}
                          </Badge>
                          {s.riscoSla && (
                            <Badge className="animate-pulse gap-1 border border-red-300 bg-red-600 px-1.5 py-0 text-[9px] font-bold uppercase text-white">
                              <AlertTriangle className="h-2.5 w-2.5" /> Atraso/Risco de SLA
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.tipo === "os" && s.osId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => navigate(`/operacao?tab=os&os=${s.osId}`)}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir OS
                            </Button>
                          )}
                          {s.tipo === "pedido" && pedido && (
                            <>
                              {pedido.status === "enviado" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => void analisar(pedido.id)}
                                >
                                  <Clock className="w-3 h-3 mr-1" /> Analisar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => abrirProgramar(s)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Programar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Vincular o pedido <strong>{solicitacaoAtual?.numero}</strong> a uma Ordem de
                Serviço existente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="osNumero">Número da OS</Label>
              <Input
                id="osNumero"
                placeholder="Ex: OS-202606-000001"
                value={osNumero}
                onChange={(e) => setOsNumero(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void programar()} disabled={!osNumero.trim()}>
              <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Programação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

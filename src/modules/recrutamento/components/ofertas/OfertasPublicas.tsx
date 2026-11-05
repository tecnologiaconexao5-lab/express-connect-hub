import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  MapPin,
  MessageCircle,
  Phone,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCheck,
  Users,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "../design-system/PageHeader";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
} from "../design-system/PremiumCard";
import { PremiumBadge } from "../design-system/PremiumBadge";
import { EmptyState } from "../design-system/EmptyState";
import { MetricCard } from "../design-system/MetricCard";
import { OfertaDetalheSheet } from "./OfertaDetalheSheet";
import { OfertaComparacaoDialog } from "./OfertaComparacaoDialog";
import { FiltrosAtivos, type FiltroAtivoItem } from "@/components/ui/filtros-ativos";
import { calcularFrescorCadastro } from "@/utils/frescorCadastro";
import {
  calcularIndicadores,
  contatosDisponiveis,
  FILTRO_OFERTAS_VAZIO,
  filtrarOfertas,
  mensagemErroOferta,
  ofertasPublicasService,
  STATUS_OFERTA_LABELS,
  TIPO_OFERTA_LABELS,
  type OfertaCanalContato,
  type OfertaFiltro,
  type OfertaPublica,
  type OfertaStatus,
} from "../../services/ofertasPublicasService";
import {
  extrairCaracteristicas,
  listarPreCadastros,
  resumoVeiculoPreCadastro,
  rotuloCategoriaAtuacao,
} from "@/lib/recrutamento";
import {
  MODALIDADES,
  mensagemConviteOfertas,
  obterLinkPublicoOfertas,
  UFS,
} from "@/lib/ofertaPublica";

const PASSOS = [
  "Copie o link público e compartilhe com motoboys, motoristas e proprietários de veículos.",
  "O interessado preenche a oferta externamente, sem login e sem documentos pessoais.",
  "A equipe recebe a oferta para análise e contato, sem aprovação automática.",
  "A conversão em candidato ocorre depois, de forma explícita, no fluxo de Recrutamento.",
];

const STATUS_VARIANT: Record<OfertaStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  nova: "info",
  em_analise: "warning",
  em_contato: "info",
  convertida: "success",
  descartada: "danger",
  arquivada: "default",
  duplicada: "warning",
};

const TAMANHO_PAGINA = 10;

function formatarDataHora(valor: string): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resumoRegioes(regioes: string[]): string {
  if (!regioes.length) return "—";
  if (regioes.length <= 2) return regioes.join(", ");
  return `${regioes.slice(0, 2).join(", ")} +${regioes.length - 2}`;
}

function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

export function OfertasPublicas() {
  const [ofertas, setOfertas] = useState<OfertaPublica[]>([]);
  const [filtros, setFiltros] = useState<OfertaFiltro>(FILTRO_OFERTAS_VAZIO);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [backendIndisponivel, setBackendIndisponivel] = useState(false);
  const [ofertaSelecionada, setOfertaSelecionada] = useState<OfertaPublica | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [compararOpen, setCompararOpen] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const link = obterLinkPublicoOfertas();
  const mensagem = mensagemConviteOfertas(link);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setBackendIndisponivel(false);
    const resultado = await listarPreCadastros();
    setCarregando(false);
    if (!resultado.ok) {
      setOfertas([]);
      setErro(resultado.erro);
      setBackendIndisponivel(resultado.backendIndisponivel);
      return;
    }
    setOfertas(resultado.ofertas);
    setSelecionadas((atuais) => atuais.filter((id) => resultado.ofertas.some((oferta) => oferta.id === id)));
    setOfertaSelecionada((atual) =>
      atual ? resultado.ofertas.find((oferta) => oferta.id === atual.id) ?? null : null,
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const indicadores = useMemo(() => calcularIndicadores(ofertas), [ofertas]);

  const categoriasDisponiveis = useMemo(() => {
    const labels = ofertas.map((oferta) => {
      const extras = extrairCaracteristicas(oferta.caracteristicas);
      return rotuloCategoriaAtuacao(extras.categoriaAtuacao, oferta.tipoOferta);
    });
    return Array.from(new Set(labels.filter((label) => label !== "—"))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [ofertas]);

  const regioesDisponiveis = useMemo(() => {
    const regioes = ofertas.flatMap((oferta) => oferta.regioes);
    return Array.from(new Set(regioes)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [ofertas]);

  const filtradas = useMemo(() => {
    const base = filtrarOfertas(ofertas, filtros);
    return base.filter((oferta) => {
      if (filtroCategoria !== "todas") {
        const extras = extrairCaracteristicas(oferta.caracteristicas);
        const categoria = rotuloCategoriaAtuacao(extras.categoriaAtuacao, oferta.tipoOferta);
        if (categoria !== filtroCategoria) return false;
      }
      if (filtroRegiao !== "todas" && !oferta.regioes.includes(filtroRegiao)) return false;
      return true;
    });
  }, [filtros, filtroCategoria, filtroRegiao, ofertas]);

  const selecionadasOfertas = useMemo(
    () => ofertas.filter((oferta) => selecionadas.includes(oferta.id)),
    [ofertas, selecionadas],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANHO_PAGINA));
  const ofertasPagina = filtradas.slice(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA);

  useEffect(() => {
    setPagina(0);
  }, [filtros, filtroCategoria, filtroRegiao]);

  useEffect(() => {
    if (pagina >= totalPaginas) setPagina(Math.max(0, totalPaginas - 1));
  }, [pagina, totalPaginas]);

  const atualizarFiltro = <K extends keyof OfertaFiltro>(chave: K, valor: OfertaFiltro[K]) => {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  };

  const limparFiltros = () => {
    setFiltros(FILTRO_OFERTAS_VAZIO);
    setFiltroCategoria("todas");
    setFiltroRegiao("todas");
  };

  const filtrosRapidosAtivos: FiltroAtivoItem[] = [];
  if (filtroCategoria !== "todas") {
    filtrosRapidosAtivos.push({
      id: "categoria",
      label: "Categoria",
      valor: filtroCategoria,
      onRemove: () => setFiltroCategoria("todas"),
    });
  }
  if (filtroRegiao !== "todas") {
    filtrosRapidosAtivos.push({
      id: "regiao",
      label: "Região",
      valor: filtroRegiao,
      onRemove: () => setFiltroRegiao("todas"),
    });
  }

  const filtrosAvancadosAtivos: FiltroAtivoItem[] = [];
  if (filtros.busca.trim()) {
    filtrosAvancadosAtivos.push({
      id: "busca",
      label: "Busca",
      valor: filtros.busca.trim(),
      onRemove: () => atualizarFiltro("busca", ""),
    });
  }
  if (filtros.status !== "todas") {
    filtrosAvancadosAtivos.push({
      id: "status",
      label: "Status",
      valor: STATUS_OFERTA_LABELS[filtros.status],
      onRemove: () => atualizarFiltro("status", "todas"),
    });
  }
  if (filtros.tipoOferta !== "todos") {
    filtrosAvancadosAtivos.push({
      id: "tipoOferta",
      label: "Tipo",
      valor: TIPO_OFERTA_LABELS[filtros.tipoOferta],
      onRemove: () => atualizarFiltro("tipoOferta", "todos"),
    });
  }
  if (filtros.uf) {
    filtrosAvancadosAtivos.push({
      id: "uf",
      label: "UF",
      valor: filtros.uf,
      onRemove: () => atualizarFiltro("uf", ""),
    });
  }
  if (filtros.cidade.trim()) {
    filtrosAvancadosAtivos.push({
      id: "cidade",
      label: "Cidade",
      valor: filtros.cidade.trim(),
      onRemove: () => atualizarFiltro("cidade", ""),
    });
  }
  if (filtros.modalidade) {
    filtrosAvancadosAtivos.push({
      id: "modalidade",
      label: "Modalidade",
      valor: MODALIDADES.find((item) => item.value === filtros.modalidade)?.label ?? filtros.modalidade,
      onRemove: () => atualizarFiltro("modalidade", ""),
    });
  }
  if (filtros.veiculoTipo.trim()) {
    filtrosAvancadosAtivos.push({
      id: "veiculoTipo",
      label: "Veículo",
      valor: filtros.veiculoTipo.trim(),
      onRemove: () => atualizarFiltro("veiculoTipo", ""),
    });
  }
  if (filtros.valorMin) {
    filtrosAvancadosAtivos.push({
      id: "valorMin",
      label: "Valor mín.",
      valor: filtros.valorMin,
      onRemove: () => atualizarFiltro("valorMin", ""),
    });
  }
  if (filtros.valorMax) {
    filtrosAvancadosAtivos.push({
      id: "valorMax",
      label: "Valor máx.",
      valor: filtros.valorMax,
      onRemove: () => atualizarFiltro("valorMax", ""),
    });
  }

  const abrirDetalhe = (oferta: OfertaPublica) => {
    setOfertaSelecionada(oferta);
    setDetalheOpen(true);
  };

  const registrarContatoRapido = async (oferta: OfertaPublica, canal: OfertaCanalContato) => {
    const disponiveis = contatosDisponiveis(oferta);
    if (!disponiveis[canal]) {
      toast.error("Este canal não possui dados disponíveis.");
      return;
    }
    const digitos = oferta.telefone.replace(/\D/g, "");
    const url =
      canal === "whatsapp"
        ? `https://wa.me/${telefoneParaWhatsApp(oferta.telefone)}`
        : canal === "telefone"
          ? `tel:${digitos}`
          : `mailto:${oferta.email}`;
    const resultado = await ofertasPublicasService.registrarContato(oferta.id, canal);
    window.open(url, "_blank", "noopener,noreferrer");
    if (resultado.ok) {
      toast.success("Contato aberto e registrado no histórico.");
      void carregar();
    } else {
      toast.warning(
        `Contato aberto, mas não foi possível registrar no histórico: ${mensagemErroOferta(resultado.codigo, resultado.erro)}`,
      );
    }
  };

  const toggleSelecionada = (id: string) => {
    setSelecionadas((atuais) => {
      if (atuais.includes(id)) return atuais.filter((item) => item !== id);
      if (atuais.length >= 4) {
        toast.warning("Selecione no máximo 4 ofertas para comparar.");
        return atuais;
      }
      return [...atuais, id];
    });
  };

  const copiar = async (texto: string, rotulo: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success(rotulo);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link manualmente.");
    }
  };

  const compartilhar = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Oferta de Prestadores — Conexão Express",
          text: mensagem,
          url: link,
        });
        return;
      } catch {
        // Usuário cancelou ou o navegador não concluiu; cai para cópia.
      }
    }
    await copiar(mensagem, "Mensagem copiada para compartilhamento.");
  };

  const abrirWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<QrCode className="h-5 w-5 text-primary" />}
        title="Gestão de Parceiros (Pré-Cadastros)"
        description="Acompanhe os pré-cadastros recebidos pelo link público, faça a triagem do perfil e converta em candidato quando fizer sentido."
        actions={
          <>
            <Button size="sm" variant="outline" className="h-9 gap-2" onClick={() => void carregar()}>
              <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-2"
              onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" /> Abrir formulário
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total de propostas"
          value={String(indicadores.total)}
          icon={<Users className="h-4 w-4" />}
          loading={carregando}
        />
        <MetricCard
          title="Aguardando análise"
          value={String(indicadores.novas + indicadores.emAnalise)}
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={carregando}
        />
        <MetricCard
          title="Em contato"
          value={String(indicadores.emContato)}
          icon={<MessageCircle className="h-4 w-4" />}
          loading={carregando}
        />
        <MetricCard
          title="Convertidas"
          value={String(indicadores.convertidas)}
          icon={<UserCheck className="h-4 w-4" />}
          loading={carregando}
        />
      </div>

      <PremiumCard hover={false}>
        <PremiumCardHeader>
          <div>
            <PremiumCardTitle>Filtros rápidos</PremiumCardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Refine a fila por categoria de veículo e região de atendimento.
            </p>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-primary" />
        </PremiumCardHeader>
        <PremiumCardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FiltroSelect
              label="Categoria de veículo"
              value={filtroCategoria}
              onChange={setFiltroCategoria}
              options={[
                { value: "todas", label: "Todas as categorias" },
                ...categoriasDisponiveis.map((categoria) => ({ value: categoria, label: categoria })),
              ]}
            />
            <FiltroSelect
              label="Região"
              value={filtroRegiao}
              onChange={setFiltroRegiao}
              options={[
                { value: "todas", label: "Todas as regiões" },
                ...regioesDisponiveis.map((regiao) => ({ value: regiao, label: regiao })),
              ]}
            />
            {filtrosRapidosAtivos.length > 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <FiltrosAtivos filtros={filtrosRapidosAtivos} onLimpar={limparFiltros} className="pt-1" />
              </div>
            ) : null}
          </div>
        </PremiumCardContent>
      </PremiumCard>

      {backendIndisponivel && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Backend de ofertas ainda não implantado neste ambiente.</p>
              <p className="mt-1 text-xs">
                A migration da ADM-APP-02B.2/02B.3 não está aplicada ou a API não expõe as tabelas/RPCs.
                Nenhuma oferta é simulada e nenhuma gravação é permitida até a implantação autorizada.
              </p>
              {erro && <p className="mt-2 break-words font-mono text-[10px] text-amber-800/80">{erro}</p>}
            </div>
          </div>
        </div>
      )}

      <PremiumCard hover={false}>
        <PremiumCardHeader>
          <div>
            <PremiumCardTitle>Filtros e busca</PremiumCardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Busque por nome, veículo ou digite a demanda (Ex: urgente guarulhos baú).
            </p>
          </div>
          <Filter className="h-5 w-5 text-primary" />
        </PremiumCardHeader>
        <PremiumCardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtros.busca}
              onChange={(event) => atualizarFiltro("busca", event.target.value)}
              placeholder="Busque por nome, veículo ou digite a demanda (Ex: urgente guarulhos baú)"
              className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            O motor de match cruza região, modalidade e veículo automaticamente e ordena por aderência.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FiltroSelect
              label="Status"
              value={filtros.status}
              onChange={(valor) => atualizarFiltro("status", valor as OfertaFiltro["status"])}
              options={[
                { value: "todas", label: "Todos os status" },
                ...Object.entries(STATUS_OFERTA_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <FiltroSelect
              label="Tipo de oferta"
              value={filtros.tipoOferta}
              onChange={(valor) => atualizarFiltro("tipoOferta", valor as OfertaFiltro["tipoOferta"])}
              options={[
                { value: "todos", label: "Todos os tipos" },
                ...Object.entries(TIPO_OFERTA_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <FiltroSelect
              label="UF"
              value={filtros.uf || "todas"}
              onChange={(valor) => atualizarFiltro("uf", valor === "todas" ? "" : valor)}
              options={[{ value: "todas", label: "Todas as UF" }, ...UFS.map((uf) => ({ value: uf, label: uf }))]}
            />
            <label className="space-y-1.5 text-xs">
              <span className="text-muted-foreground">Cidade</span>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filtros.cidade}
                  onChange={(event) => atualizarFiltro("cidade", event.target.value)}
                  placeholder="Ex.: São Paulo"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </label>
            <FiltroSelect
              label="Modalidade"
              value={filtros.modalidade || "todas"}
              onChange={(valor) => atualizarFiltro("modalidade", valor === "todas" ? "" : valor)}
              options={[{ value: "todas", label: "Todas" }, ...MODALIDADES.map((item) => ({ value: item.value, label: item.label }))]}
            />
            <label className="space-y-1.5 text-xs">
              <span className="text-muted-foreground">Veículo</span>
              <div className="relative">
                <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filtros.veiculoTipo}
                  onChange={(event) => atualizarFiltro("veiculoTipo", event.target.value)}
                  placeholder="Ex.: VUC, Truck, moto"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="text-muted-foreground">Valor mínimo (R$)</span>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={filtros.valorMin}
                  onChange={(event) => atualizarFiltro("valorMin", event.target.value)}
                  placeholder="Ex.: 100"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="text-muted-foreground">Valor máximo (R$)</span>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={filtros.valorMax}
                  onChange={(event) => atualizarFiltro("valorMax", event.target.value)}
                  placeholder="Ex.: 800"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </label>
          </div>
          <FiltrosAtivos filtros={filtrosAvancadosAtivos} onLimpar={limparFiltros} className="pt-1" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {filtradas.length} oferta(s) encontrada(s) · filtros aplicados localmente após leitura autorizada.
            </p>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ofertas recebidas</h2>
          <p className="text-xs text-muted-foreground">
            Clique em uma linha para abrir o raio-x do prestador. Selecione até 4 para comparar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={selecionadas.length < 2}
            onClick={() => setCompararOpen(true)}
          >
            <Filter className="h-3.5 w-3.5" /> Comparar ({selecionadas.length})
          </Button>
          {selecionadas.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelecionadas([])}>
              Limpar seleção
            </Button>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, indice) => (
            <div key={indice} className="h-14 animate-pulse rounded-lg border border-border/60 bg-card" />
          ))}
        </div>
      ) : !backendIndisponivel && erro ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Não foi possível carregar as ofertas.</p>
          <p className="mt-1 text-xs">{erro}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : !backendIndisponivel && filtradas.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6 text-muted-foreground/40" />}
          title={ofertas.length === 0 ? "Nenhuma oferta recebida ainda" : "Nenhuma oferta encontrada"}
          description={
            ofertas.length === 0
              ? "Compartilhe o link público. As ofertas aparecerão aqui após a integração segura estar publicada."
              : "Ajuste a busca ou limpe os filtros para ver mais resultados."
          }
          action={
            ofertas.length === 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => window.open(link, "_blank", "noopener,noreferrer")}>
                Abrir formulário público <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <PremiumCard hover={false} className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-3" aria-label="Selecionar" />
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Protocolo</th>
                  <th className="px-3 py-3">Nome / Contato</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Veículo</th>
                  <th className="px-3 py-3">Regiões</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ofertasPagina.map((oferta) => {
                  const extras = extrairCaracteristicas(oferta.caracteristicas);
                  const categoria = rotuloCategoriaAtuacao(extras.categoriaAtuacao, oferta.tipoOferta);
                  const contatos = contatosDisponiveis(oferta);
                  const frescor = calcularFrescorCadastro(oferta.createdAt);
                  const detalheVeiculo = [
                    extras.cilindrada ? `${extras.cilindrada} cc` : "",
                    extras.marcaRastreador ? `Rastreador ${extras.marcaRastreador}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr
                      key={oferta.id}
                      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
                      onClick={() => abrirDetalhe(oferta)}
                    >
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selecionadas.includes(oferta.id)}
                          onCheckedChange={() => toggleSelecionada(oferta.id)}
                          aria-label={`Selecionar ${oferta.nome} para comparação`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatarDataHora(oferta.createdAt)}
                        </span>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${frescor.className}`}
                          title={frescor.titulo}
                        >
                          {frescor.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                        {oferta.protocolo}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[220px] truncate font-medium text-foreground">{oferta.nome}</p>
                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {oferta.telefone || oferta.email || "Sem contato"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <PremiumBadge variant="info">{categoria}</PremiumBadge>
                      </td>
                      <td className="px-3 py-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Truck className="h-3.5 w-3.5 shrink-0" />
                          {resumoVeiculoPreCadastro(oferta)}
                        </p>
                        {detalheVeiculo ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{detalheVeiculo}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {resumoRegioes(oferta.regioes)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <PremiumBadge variant={STATUS_VARIANT[oferta.status]}>
                          {STATUS_OFERTA_LABELS[oferta.status]}
                        </PremiumBadge>
                        {oferta.revisaoHumana && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700">
                            <ShieldAlert className="h-3 w-3" /> Conflito
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-emerald-700"
                            title="WhatsApp"
                            disabled={!contatos.whatsapp}
                            onClick={(event) => {
                              event.stopPropagation();
                              void registrarContatoRapido(oferta, "whatsapp");
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Telefone"
                            disabled={!contatos.telefone}
                            onClick={(event) => {
                              event.stopPropagation();
                              void registrarContatoRapido(oferta, "telefone");
                            }}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="E-mail"
                            disabled={!contatos.email}
                            onClick={(event) => {
                              event.stopPropagation();
                              void registrarContatoRapido(oferta, "email");
                            }}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              abrirDetalhe(oferta);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Detalhes
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Página {pagina + 1} de {totalPaginas}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pagina === 0}
              onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <PremiumCard hover={false}>
        <PremiumCardHeader>
          <div>
            <PremiumCardTitle>Link público de ofertas</PremiumCardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Compartilhe este link com profissionais e proprietários de veículos.
            </p>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </PremiumCardHeader>
        <PremiumCardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} className="h-10 flex-1 bg-muted/30 font-mono text-xs" />
            <Button
              type="button"
              className="h-10 shrink-0 gap-2 bg-[#2E1065] text-white hover:bg-[#3b1580]"
              onClick={() => void copiar(link, "Link público copiado.")}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar link"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void compartilhar()}>
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={abrirWhatsApp}
            >
              <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
            </Button>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <PremiumCard hover={false}>
        <PremiumCardHeader>
          <div>
            <PremiumCardTitle>Como funciona</PremiumCardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              O canal público é separado do cadastro operacional e do APP.
            </p>
          </div>
          <QrCode className="h-5 w-5 text-primary" />
        </PremiumCardHeader>
        <PremiumCardContent>
          <ol className="grid gap-3 md:grid-cols-2">
            {PASSOS.map((passo, index) => (
              <li key={passo} className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">
                  {index + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        </PremiumCardContent>
      </PremiumCard>

      <OfertaDetalheSheet
        oferta={ofertaSelecionada}
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        onAtualizada={carregar}
      />

      <OfertaComparacaoDialog
        ofertas={selecionadasOfertas}
        open={compararOpen}
        onOpenChange={setCompararOpen}
      />
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 bg-background focus-visible:ring-2 focus-visible:ring-primary/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

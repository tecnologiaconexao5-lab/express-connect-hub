import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
  X,
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
import { DIAS_SEMANA, MODALIDADES, obterLinkPublicoOfertas, UFS } from "@/lib/ofertaPublica";

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

const TAMANHO_PAGINA = 9;

function formatarValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDias(dias: number[]): string {
  if (!dias.length) return "—";
  return dias
    .map((dia) => DIAS_SEMANA.find((item) => item.value === dia)?.label ?? String(dia))
    .join(", ");
}

function formatarHorario(inicio: string, fim: string): string {
  if (!inicio && !fim) return "—";
  return `${inicio || "—"} às ${fim || "—"}`;
}

function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

function resumoVeiculo(oferta: OfertaPublica): string {
  return [oferta.veiculoTipo, oferta.veiculoModelo, oferta.carroceria].filter(Boolean).join(" · ") || "—";
}

function resumoCapacidade(oferta: OfertaPublica): string {
  const partes = [
    oferta.capacidadeKg !== null ? `${oferta.capacidadeKg} kg` : "",
    oferta.capacidadeM3 !== null ? `${oferta.capacidadeM3} m³` : "",
    oferta.capacidadeBauLitros !== null ? `${oferta.capacidadeBauLitros} L baú` : "",
  ].filter(Boolean);
  return partes.join(" · ") || "—";
}

function resumoValores(oferta: OfertaPublica): string {
  const valores = [
    oferta.valorDiaria !== null ? `Diária ${formatarValor(oferta.valorDiaria)}` : "",
    oferta.valorKm !== null ? `Km ${formatarValor(oferta.valorKm)}` : "",
    oferta.valorSaida !== null ? `Saída ${formatarValor(oferta.valorSaida)}` : "",
    oferta.valorMensal !== null ? `Mensal ${formatarValor(oferta.valorMensal)}` : "",
  ].filter(Boolean);
  return valores.join(" · ") || (oferta.valorNegociavel ? "Valor a negociar" : "—");
}

export function OfertasPublicas() {
  const [ofertas, setOfertas] = useState<OfertaPublica[]>([]);
  const [filtros, setFiltros] = useState<OfertaFiltro>(FILTRO_OFERTAS_VAZIO);
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
  const mensagem = `Olá! A Conexão Express está recebendo ofertas de motoboys, motoristas e veículos. Se tiver interesse, preencha o formulário: ${link}`;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setBackendIndisponivel(false);
    const resultado = await ofertasPublicasService.listarOfertas(FILTRO_OFERTAS_VAZIO);
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

  const filtradas = useMemo(() => filtrarOfertas(ofertas, filtros), [filtros, ofertas]);
  const indicadores = useMemo(() => calcularIndicadores(ofertas), [ofertas]);
  const selecionadasOfertas = useMemo(
    () => ofertas.filter((oferta) => selecionadas.includes(oferta.id)),
    [ofertas, selecionadas],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANHO_PAGINA));
  const ofertasPagina = filtradas.slice(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA);

  useEffect(() => {
    setPagina(0);
  }, [filtros]);

  useEffect(() => {
    if (pagina >= totalPaginas) setPagina(Math.max(0, totalPaginas - 1));
  }, [pagina, totalPaginas]);

  const atualizarFiltro = <K extends keyof OfertaFiltro>(chave: K, valor: OfertaFiltro[K]) => {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  };

  const limparFiltros = () => setFiltros(FILTRO_OFERTAS_VAZIO);

  const abrirDetalhe = (oferta: OfertaPublica) => {
    setOfertaSelecionada(oferta);
    setDetalheOpen(true);
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
      toast.warning(`Contato aberto, mas não foi possível registrar no histórico: ${mensagemErroOferta(resultado.codigo, resultado.erro)}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<QrCode className="h-5 w-5 text-primary" />}
        title="Ofertas Públicas"
        description="Divulgue o link de captação e gerencie as ofertas recebidas. A oferta é comercial e não cria acesso ao APP."
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Ofertas recebidas" value={String(indicadores.total)} icon={<Users className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Novas" value={String(indicadores.novas)} icon={<ShieldCheck className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Em análise" value={String(indicadores.emAnalise)} icon={<Filter className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Em contato" value={String(indicadores.emContato)} icon={<MessageCircle className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Convertidas" value={String(indicadores.convertidas)} icon={<UserCheck className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Descartadas" value={String(indicadores.descartadas)} icon={<X className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Arquivadas" value={String(indicadores.arquivadas)} icon={<ShieldAlert className="h-4 w-4" />} loading={carregando} />
        <MetricCard title="Revisão humana" value={String(indicadores.revisaoHumana)} icon={<AlertTriangle className="h-4 w-4" />} loading={carregando} />
      </div>

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
              Busque por nome, telefone, e-mail ou protocolo e combine com os filtros operacionais.
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
              placeholder="Nome, telefone, e-mail ou protocolo..."
              className="h-10 pl-9"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Cidade</span>
              <Input value={filtros.cidade} onChange={(event) => atualizarFiltro("cidade", event.target.value)} placeholder="Ex.: São Paulo" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Região</span>
              <Input value={filtros.regiao} onChange={(event) => atualizarFiltro("regiao", event.target.value)} placeholder="Ex.: Grande SP" />
            </label>
            <FiltroSelect
              label="Modalidade"
              value={filtros.modalidade || "todas"}
              onChange={(valor) => atualizarFiltro("modalidade", valor === "todas" ? "" : valor)}
              options={[{ value: "todas", label: "Todas" }, ...MODALIDADES.map((item) => ({ value: item.value, label: item.label }))]}
            />
            <FiltroSelect
              label="Dia"
              value={filtros.dia || "todos"}
              onChange={(valor) => atualizarFiltro("dia", valor === "todos" ? "" : valor)}
              options={[{ value: "todos", label: "Todos" }, ...DIAS_SEMANA.map((dia) => ({ value: String(dia.value), label: dia.label }))]}
            />
            <FiltroSelect
              label="Disponibilidade interna"
              value={filtros.disponibilidade}
              onChange={(valor) => atualizarFiltro("disponibilidade", valor as OfertaFiltro["disponibilidade"])}
              options={[
                { value: "todas", label: "Todas" },
                { value: "com_interna", label: "Com atualização interna" },
                { value: "sem_interna", label: "Sem atualização interna" },
              ]}
            />
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Veículo</span>
              <Input value={filtros.veiculoTipo} onChange={(event) => atualizarFiltro("veiculoTipo", event.target.value)} placeholder="Ex.: VUC, Truck, moto" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Capacidade mín. (kg ou L)</span>
              <Input type="number" min={0} value={filtros.capacidadeMinKg} onChange={(event) => atualizarFiltro("capacidadeMinKg", event.target.value)} placeholder="Ex.: 600" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Valor mínimo (R$)</span>
              <Input type="number" min={0} value={filtros.valorMin} onChange={(event) => atualizarFiltro("valorMin", event.target.value)} placeholder="Ex.: 100" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Valor máximo (R$)</span>
              <Input type="number" min={0} value={filtros.valorMax} onChange={(event) => atualizarFiltro("valorMax", event.target.value)} placeholder="Ex.: 800" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {filtradas.length} oferta(s) encontrada(s) · filtros aplicados localmente após leitura autorizada.
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={limparFiltros} className="h-8 gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ofertas recebidas</h2>
          <p className="text-xs text-muted-foreground">
            Selecione até 4 ofertas para comparar. A conversão é sempre explícita.
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, indice) => (
            <div key={indice} className="h-56 animate-pulse rounded-xl border border-border/60 bg-card" />
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
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ofertasPagina.map((oferta) => {
              const contatos = contatosDisponiveis(oferta);
              const marcada = selecionadas.includes(oferta.id);
              return (
                <PremiumCard key={oferta.id} hover={false} className="flex flex-col p-0">
                  <div className="space-y-3 p-4">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={() => toggleSelecionada(oferta.id)}
                        aria-label={`Selecionar ${oferta.nome} para comparação`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <button type="button" className="block w-full text-left" onClick={() => abrirDetalhe(oferta)}>
                          <p className="truncate text-sm font-semibold text-foreground">{oferta.nome}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{oferta.protocolo}</p>
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <PremiumBadge variant={STATUS_VARIANT[oferta.status]}>{STATUS_OFERTA_LABELS[oferta.status]}</PremiumBadge>
                          <PremiumBadge variant="info">{TIPO_OFERTA_LABELS[oferta.tipoOferta]}</PremiumBadge>
                          {oferta.revisaoHumana && (
                            <PremiumBadge variant="danger">
                              <ShieldAlert className="h-3 w-3" /> Conflito
                            </PremiumBadge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> {[oferta.cidade, oferta.uf].filter(Boolean).join(" / ") || "—"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatarDias(oferta.diasDisponiveis)} · {formatarHorario(oferta.horarioInicio, oferta.horarioFim)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" /> {resumoVeiculo(oferta)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> {resumoCapacidade(oferta)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {oferta.telefone || oferta.email || "Sem contato"}
                      </p>
                      <p className="line-clamp-2 text-foreground/80">{resumoValores(oferta)}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-emerald-200 px-2 text-emerald-700 hover:bg-emerald-50"
                      disabled={!contatos.whatsapp}
                      onClick={() => void registrarContatoRapido(oferta, "whatsapp")}
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2"
                      disabled={!contatos.telefone}
                      onClick={() => void registrarContatoRapido(oferta, "telefone")}
                    >
                      <Phone className="h-3 w-3" /> Ligar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2"
                      disabled={!contatos.email}
                      onClick={() => void registrarContatoRapido(oferta, "email")}
                    >
                      <Mail className="h-3 w-3" /> E-mail
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={() => abrirDetalhe(oferta)}>
                      Detalhes <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </PremiumCard>
              );
            })}
          </div>

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
        </>
      )}

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
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
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

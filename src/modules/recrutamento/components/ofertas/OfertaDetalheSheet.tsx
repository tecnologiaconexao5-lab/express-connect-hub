import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  ShieldAlert,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PremiumBadge } from "../design-system/PremiumBadge";
import { DIAS_SEMANA, MODALIDADES } from "@/lib/ofertaPublica";
import {
  BUSCA_CONTRATO_LABELS,
  COMPARTIMENTO_LABELS,
  VINCULO_VEICULO_LABELS,
  extrairCaracteristicas,
  extrairTriagem,
  rotuloCategoriaAtuacao,
} from "@/lib/recrutamento";
import {
  contatosDisponiveis,
  mensagemErroOferta,
  ofertasPublicasService,
  podeConverter,
  STATUS_OFERTA_LABELS,
  TIPO_OFERTA_LABELS,
  transicoesPermitidas,
  type OfertaCanalContato,
  type OfertaEvento,
  type OfertaPublica,
  type OfertaStatus,
} from "../../services/ofertasPublicasService";

interface OfertaDetalheSheetProps {
  oferta: OfertaPublica | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAtualizada: () => void | Promise<void>;
}

const STATUS_VARIANT: Record<OfertaStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  nova: "info",
  em_analise: "warning",
  em_contato: "info",
  convertida: "success",
  descartada: "danger",
  arquivada: "default",
  duplicada: "warning",
};

function formatarValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataHora(valor: string): string {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR");
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

function formatarDimensoes(dimensoes: Record<string, number | null>): string {
  const partes = [
    dimensoes.comprimento_m !== null ? `C ${dimensoes.comprimento_m}m` : "",
    dimensoes.largura_m !== null ? `L ${dimensoes.largura_m}m` : "",
    dimensoes.altura_m !== null ? `A ${dimensoes.altura_m}m` : "",
  ].filter(Boolean);
  return partes.length ? partes.join(" × ") : "—";
}

function rotuloModalidade(valor: string): string {
  return MODALIDADES.find((item) => item.value === valor)?.label ?? valor;
}

function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

export function OfertaDetalheSheet({
  oferta,
  open,
  onOpenChange,
  onAtualizada,
}: OfertaDetalheSheetProps) {
  const [eventos, setEventos] = useState<OfertaEvento[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [erroEventos, setErroEventos] = useState<string | null>(null);
  const [status, setStatus] = useState<OfertaStatus | "">("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dias, setDias] = useState<number[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [confirmarConversao, setConfirmarConversao] = useState(false);

  const carregarEventos = useCallback(async () => {
    if (!oferta?.id) {
      setEventos([]);
      return;
    }
    setCarregandoEventos(true);
    setErroEventos(null);
    const resultado = await ofertasPublicasService.listarEventos(oferta.id);
    setCarregandoEventos(false);
    if (resultado.ok) {
      setEventos(resultado.eventos);
      return;
    }
    setErroEventos(resultado.erro);
    if (!resultado.backendIndisponivel) {
      toast.error(resultado.erro);
    }
  }, [oferta?.id]);

  useEffect(() => {
    if (!open || !oferta) return;
    setStatus("");
    setMotivo("");
    setObservacao("");
    setDias(oferta.disponibilidadeInterna.dias.length ? oferta.disponibilidadeInterna.dias : oferta.diasDisponiveis);
    setHorarioInicio(oferta.disponibilidadeInterna.horarioInicio || oferta.horarioInicio);
    setHorarioFim(oferta.disponibilidadeInterna.horarioFim || oferta.horarioFim);
    setModalidades(
      oferta.disponibilidadeInterna.modalidades.length
        ? oferta.disponibilidadeInterna.modalidades
        : oferta.modalidades,
    );
    void carregarEventos();
  }, [carregarEventos, oferta, open]);

  if (!oferta) return null;

  const contatos = contatosDisponiveis(oferta);
  const transicoes = transicoesPermitidas(oferta.status);
  const conversaoPermitida = podeConverter(oferta);
  const extras = extrairCaracteristicas(oferta.caracteristicas);
  const triagem = extrairTriagem(oferta.observacoes);
  const valorSemanal = triagem.respostas.find((resposta) => resposta.chave === "Valor semanal");
  const respostasPerfil = triagem.respostas.filter((resposta) => resposta.chave !== "Valor semanal");
  const categoriaAtuacao = rotuloCategoriaAtuacao(extras.categoriaAtuacao, oferta.tipoOferta);
  const modalidadesCompletas = Array.from(
    new Set([
      ...oferta.modalidades.map(rotuloModalidade),
      ...extras.modalidadesAdicionais,
    ]),
  );
  const rastreador = extras.marcaRastreador
    ? extras.marcaRastreador
    : oferta.caracteristicas.includes("Rastreador")
      ? "Sim (marca não informada)"
      : "—";

  const recarregar = async () => {
    await onAtualizada();
    await carregarEventos();
  };

  const alterarStatus = async () => {
    if (!status) return;
    setSalvando("status");
    const resultado = await ofertasPublicasService.atualizarStatus(oferta.id, status, motivo);
    setSalvando(null);
    if (!resultado.ok) {
      toast.error(mensagemErroOferta(resultado.codigo, resultado.erro));
      return;
    }
    toast.success(`Status atualizado para ${STATUS_OFERTA_LABELS[status]}.`);
    setStatus("");
    setMotivo("");
    await recarregar();
  };

  const salvarObservacao = async () => {
    if (observacao.trim().length < 2) {
      toast.error("Informe uma observação com pelo menos 2 caracteres.");
      return;
    }
    setSalvando("observacao");
    const resultado = await ofertasPublicasService.registrarObservacao(oferta.id, observacao);
    setSalvando(null);
    if (!resultado.ok) {
      toast.error(mensagemErroOferta(resultado.codigo, resultado.erro));
      return;
    }
    toast.success("Observação interna registrada.");
    setObservacao("");
    await recarregar();
  };

  const salvarDisponibilidade = async () => {
    if ((horarioInicio && !horarioFim) || (!horarioInicio && horarioFim)) {
      toast.error("Informe os dois horários ou deixe os dois em branco.");
      return;
    }
    if (horarioInicio && horarioFim && horarioFim <= horarioInicio) {
      toast.error("O horário final deve ser maior que o inicial.");
      return;
    }
    setSalvando("disponibilidade");
    const resultado = await ofertasPublicasService.atualizarDisponibilidade(oferta.id, {
      dias,
      horarioInicio,
      horarioFim,
      modalidades,
    });
    setSalvando(null);
    if (!resultado.ok) {
      toast.error(mensagemErroOferta(resultado.codigo, resultado.erro));
      return;
    }
    toast.success("Disponibilidade interna atualizada. Oferta original preservada.");
    await recarregar();
  };

  const registrarContato = async (canal: OfertaCanalContato) => {
    const digitos = oferta.telefone.replace(/\D/g, "");
    let url = "";
    if (canal === "whatsapp") url = `https://wa.me/${telefoneParaWhatsApp(oferta.telefone)}`;
    if (canal === "telefone") url = `tel:${digitos}`;
    if (canal === "email") url = `mailto:${oferta.email}`;
    if (!url) {
      toast.error("Este canal não possui dados disponíveis.");
      return;
    }
    const resultado = await ofertasPublicasService.registrarContato(oferta.id, canal);
    window.open(url, "_blank", "noopener,noreferrer");
    if (resultado.ok) {
      toast.success("Contato aberto e registrado no histórico.");
      await recarregar();
    } else {
      toast.warning("Contato aberto, mas não foi possível registrar no histórico.");
    }
  };

  const resolverRevisao = async () => {
    setSalvando("revisao");
    const resultado = await ofertasPublicasService.resolverRevisao(oferta.id, observacao || undefined);
    setSalvando(null);
    if (!resultado.ok) {
      toast.error(mensagemErroOferta(resultado.codigo, resultado.erro));
      return;
    }
    toast.success("Revisão humana marcada como resolvida.");
    setObservacao("");
    await recarregar();
  };

  const converter = async () => {
    setSalvando("conversao");
    const resultado = await ofertasPublicasService.converterEmCandidato(oferta.id);
    setSalvando(null);
    setConfirmarConversao(false);
    if (!resultado.ok) {
      toast.error(mensagemErroOferta(resultado.codigo, resultado.erro));
      return;
    }
    const jaConvertida = resultado.dados.ja_convertida === true;
    const jaExistente = resultado.dados.ja_existente === true;
    toast.success(
      jaExistente
        ? "Oferta vinculada a um candidato já existente por telefone/e-mail; nenhum candidato duplicado foi criado."
        : jaConvertida
          ? "Esta oferta já possuía candidato vinculado. Nenhum candidato duplicado foi criado."
          : "Oferta convertida em candidato do Recrutamento.",
    );
    await recarregar();
  };

  const copiarProtocolo = async () => {
    try {
      await navigator.clipboard.writeText(oferta.protocolo);
      toast.success("Protocolo copiado.");
    } catch {
      toast.error("Não foi possível copiar o protocolo.");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border/60 bg-slate-50/70 px-5 py-4 text-left">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {oferta.nome}
                  <PremiumBadge variant={STATUS_VARIANT[oferta.status]}>
                    {STATUS_OFERTA_LABELS[oferta.status]}
                  </PremiumBadge>
                  {oferta.revisaoHumana && (
                    <PremiumBadge variant="danger">
                      <ShieldAlert className="h-3 w-3" /> Revisão humana
                    </PremiumBadge>
                  )}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {TIPO_OFERTA_LABELS[oferta.tipoOferta]} · {oferta.protocolo} · recebida em{" "}
                  {formatarDataHora(oferta.createdAt)}
                </SheetDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => void copiarProtocolo()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5">
            {oferta.revisaoHumana && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-semibold">Conflito de telefone, e-mail ou CPF/CNPJ.</p>
                    <p className="text-xs">
                      Esta oferta exige revisão humana antes da conversão. Compare os dados originais,
                      registre a análise e só depois marque a revisão como resolvida.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-rose-300 bg-white text-rose-800 hover:bg-rose-100"
                      disabled={salvando === "revisao"}
                      onClick={() => void resolverRevisao()}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {salvando === "revisao" ? "Salvando..." : "Marcar revisão como resolvida"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Contato e disponibilidade</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Telefone/WhatsApp" value={oferta.telefone || "—"} />
                <Info label="E-mail" value={oferta.email || "—"} />
                <Info label="Cidade/UF" value={[oferta.cidade, oferta.uf].filter(Boolean).join(" / ") || "—"} />
                <Info label="CPF/CNPJ" value={oferta.cpfCnpj || "—"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  disabled={!contatos.whatsapp}
                  onClick={() => void registrarContato("whatsapp")}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!contatos.telefone}
                  onClick={() => void registrarContato("telefone")}
                >
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!contatos.email}
                  onClick={() => void registrarContato("email")}
                >
                  <Mail className="h-3.5 w-3.5" /> E-mail
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Turnos e disponibilidade</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Regiões" value={oferta.regioes.join(", ") || "—"} />
                <Info label="Dias" value={formatarDias(oferta.diasDisponiveis)} />
                <Info label="Horário" value={formatarHorario(oferta.horarioInicio, oferta.horarioFim)} />
                <Info label="Modalidades" value={modalidadesCompletas.join(", ") || "—"} />
                <Info label="Categoria de atuação" value={categoriaAtuacao} />
                <Info
                  label="Busca contrato"
                  value={
                    extras.buscaContrato
                      ? BUSCA_CONTRATO_LABELS[extras.buscaContrato] || extras.buscaContrato
                      : "—"
                  }
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dados enviados pelo interessado. A edição abaixo grava apenas a disponibilidade interna.
              </p>
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Disponibilidade interna</h3>
                {salvando === "disponibilidade" && <span className="text-xs text-muted-foreground">Salvando...</span>}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Dias</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = dias.includes(dia.value);
                    return (
                      <button
                        key={dia.value}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() =>
                          setDias((atual) =>
                            atual.includes(dia.value)
                              ? atual.filter((valor) => valor !== dia.value)
                              : [...atual, dia.value].sort((a, b) => a - b),
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          ativo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Início</span>
                  <Input type="time" value={horarioInicio} onChange={(event) => setHorarioInicio(event.target.value)} />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Fim</span>
                  <Input type="time" value={horarioFim} onChange={(event) => setHorarioFim(event.target.value)} />
                </label>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Modalidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODALIDADES.map((modalidade) => {
                    const ativo = modalidades.includes(modalidade.value);
                    return (
                      <button
                        key={modalidade.value}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() =>
                          setModalidades((atual) =>
                            atual.includes(modalidade.value)
                              ? atual.filter((valor) => valor !== modalidade.value)
                              : [...atual, modalidade.value],
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          ativo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {modalidade.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={salvando === "disponibilidade"}
                onClick={() => void salvarDisponibilidade()}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Salvar disponibilidade interna
              </Button>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Veículo e capacidade</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Categoria de atuação" value={categoriaAtuacao} />
                <Info
                  label="Vínculo do veículo"
                  value={
                    oferta.veiculoCategoria
                      ? VINCULO_VEICULO_LABELS[oferta.veiculoCategoria] || oferta.veiculoCategoria
                      : "—"
                  }
                />
                <Info label="Tipo" value={oferta.veiculoTipo || "—"} />
                <Info label="Marca" value={extras.marcaMoto || "—"} />
                <Info label="Modelo" value={oferta.veiculoModelo || "—"} />
                <Info label="Ano" value={oferta.veiculoAno !== null ? String(oferta.veiculoAno) : "—"} />
                <Info label="Cilindrada" value={extras.cilindrada ? `${extras.cilindrada} cc` : "—"} />
                <Info label="Carroceria" value={oferta.carroceria || "—"} />
                <Info label="Placa" value={oferta.veiculoPlaca || "—"} />
                <Info label="Rastreador" value={rastreador} />
                <Info label="Capacidade kg" value={oferta.capacidadeKg !== null ? `${oferta.capacidadeKg} kg` : "—"} />
                <Info label="Capacidade m³" value={oferta.capacidadeM3 !== null ? `${oferta.capacidadeM3} m³` : "—"} />
                <Info label="Dimensões" value={formatarDimensoes(oferta.dimensoes)} />
                {oferta.tipoOferta === "motoboy" && (
                  <>
                    <Info label="Tipo de moto" value={oferta.tipoMoto || "—"} />
                    <Info
                      label="Compartimento"
                      value={
                        extras.compartimento
                          ? COMPARTIMENTO_LABELS[extras.compartimento] || extras.compartimento
                          : oferta.possuiBau === null
                            ? "—"
                            : oferta.possuiBau
                              ? `Baú${oferta.capacidadeBauLitros !== null ? ` (${oferta.capacidadeBauLitros} L)` : ""}`
                              : "Sem compartimento"
                      }
                    />
                  </>
                )}
              </div>
              {extras.outras.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extras.outras.map((caracteristica) => (
                    <PremiumBadge key={caracteristica} variant="info">
                      {caracteristica}
                    </PremiumBadge>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Expectativas de Remuneração</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Diária" value={formatarValor(oferta.valorDiaria)} />
                <Info label="Adicional por Km" value={formatarValor(oferta.valorKm)} />
                <Info label="Saída" value={formatarValor(oferta.valorSaida)} />
                <Info label="Mensal" value={formatarValor(oferta.valorMensal)} />
                <Info label="Valor semanal" value={valorSemanal?.resposta || "—"} />
              </div>
              {oferta.valorNegociavel && (
                <PremiumBadge variant="warning">Valor a negociar</PremiumBadge>
              )}
              <Info label="Condições comerciais" value={oferta.condicoesComerciais || "—"} block />
              <Info label="Restrições" value={oferta.restricoes || "—"} block />
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Perfil Operacional e Psicológico</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Respostas da triagem informadas pelo interessado, organizadas para leitura da equipe.
                </p>
              </div>
              {respostasPerfil.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma resposta de triagem informada nesta oferta.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {respostasPerfil.map((resposta) => (
                    <div
                      key={resposta.chave}
                      className="rounded-lg border border-border/60 bg-background p-3"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {resposta.pergunta}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">{resposta.resposta}</p>
                    </div>
                  ))}
                </div>
              )}
              {triagem.textoLivre ? (
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Outras observações
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{triagem.textoLivre}</p>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 p-4">
              <h3 className="text-sm font-semibold text-foreground">Status e conversão</h3>
              {transicoes.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={status} onValueChange={(valor) => setStatus(valor as OfertaStatus)}>
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Selecionar novo status" />
                    </SelectTrigger>
                    <SelectContent>
                      {transicoes.map((transicao) => (
                        <SelectItem key={transicao} value={transicao}>
                          {STATUS_OFERTA_LABELS[transicao]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    placeholder="Motivo (opcional)"
                    className="h-9 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={!status || salvando === "status"}
                    onClick={() => void alterarStatus()}
                  >
                    {salvando === "status" ? "Salvando..." : "Alterar status"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Este status não permite novas transições manuais.
                </p>
              )}

              {oferta.status === "convertida" ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  Oferta já convertida em candidato. O vínculo é por oferta_id e a oferta original permanece preservada.
                </div>
              ) : !conversaoPermitida ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {oferta.revisaoHumana
                    ? "Resolva a revisão humana antes de converter."
                    : "Mova a oferta para Em análise ou Em contato para habilitar a conversão."}
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    A conversão cria um candidato no Recrutamento. Não cria prestador, usuário de autenticação ou acesso ao APP.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-[#2E1065] text-white hover:bg-[#3b1580]"
                    onClick={() => setConfirmarConversao(true)}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Converter em candidato
                  </Button>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Observação interna</h3>
              <Textarea
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
                placeholder="Registre a análise, o retorno do contato ou a decisão da equipe."
                className="min-h-[88px]"
                maxLength={2000}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={salvando === "observacao"}
                onClick={() => void salvarObservacao()}
              >
                {salvando === "observacao" ? "Salvando..." : "Registrar observação"}
              </Button>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Histórico cronológico
              </h3>
              {carregandoEventos ? (
                <p className="text-xs text-muted-foreground">Carregando histórico...</p>
              ) : erroEventos ? (
                <p className="text-xs text-amber-700">Histórico indisponível no backend atual.</p>
              ) : eventos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <ol className="space-y-3">
                  {eventos.map((evento) => (
                    <li key={evento.id} className="relative border-l border-border/70 pl-4">
                      <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-xs font-medium text-foreground">{evento.descricao || evento.tipo}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatarDataHora(evento.createdAt)} · {evento.ator || "sistema"}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmarConversao} onOpenChange={setConfirmarConversao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Confirmar conversão
            </DialogTitle>
            <DialogDescription>
              A oferta <strong>{oferta.protocolo}</strong> será convertida em um candidato do Recrutamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p>• Cria apenas o candidato vinculado por oferta_id.</p>
            <p>• Não cria prestador operacional, usuário de autenticação ou liberado_app.</p>
            <p>• Não coleta documentos, CNH, CRLV, selfie, PIX ou dados bancários.</p>
            <p>• A oferta original e seu histórico são preservados.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarConversao(false)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvando === "conversao"}
              onClick={() => void converter()}
            >
              {salvando === "conversao" ? "Convertendo..." : "Confirmar conversão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value, block = false }: { label: string; value: string; block?: boolean }) {
  return (
    <div className={block ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

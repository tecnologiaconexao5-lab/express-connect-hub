import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, Star, FileSignature, Upload, Plus, Trash2, Edit, Camera, Sparkles, Loader2, Truck, CreditCard, Users, List, ShieldAlert, CalendarDays, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Prestador, TIPO_PARCEIRO_LABEL, TIPO_PARCEIRO_COR, STATUS_LABEL, STATUS_COR,
  TIPO_VEICULO_LABEL, TipoParceiro, StatusPrestador, TipoVeiculo, StatusDocumento,
  VeiculoPrestador, normalizarStatusPrestador, STATUS_OPCOES_CANONICAS,
} from "./types";
import { DocumentoAnalyzer } from "@/components/documentos/AnaliseDocumentoIA";
import ContratoPrestadorModal from "./ContratoPrestadorModal";
import { toPrestadorInsert, toPrestadorUpdate, sanitizePrestadorPayload } from "@/lib/dbMappers";
import { formatarDataBR } from "@/lib/formatDates";
import { sanitizeVeiculoPayload, camposTipoVeiculo } from "@/helpers/veiculoPayload";
import { buscarCEP } from "@/services/cepService";
import { resolverUrlDocumento, referenciaEstavelDocumento } from "@/services/documentos/documentoStorageService";
import { montarResumoTalent, MODALIDADE_LABEL } from "@/lib/talentResumo";

const BUCKET_PRESTADORES = "documentos_prestadores";
const DRAFT_KEY = "conexao_prestador_draft";

interface Props {
  prestador?: Prestador;
  onBack: () => void;
}

/** Fields saved to draft (textual only, no binaries/passwords/tokens) */
const DRAFT_FIELDS = [
  "nomeCompleto", "nomeFantasia", "cpfCnpj", "rgIe", "dataNascimento",
  "telefone", "whatsapp", "email", "rntrc", "antt",
  "tipoParceiro", "status", "liberadoApp",
  "regiaoPrincipal", "origemCadastro", "indicacao", "disponibilidade",
  "turnosPreferenciais", "restricoesOperacionais",
  "banco", "agencia", "conta", "digito", "tipoConta", "favorecido",
  "cpfCnpjFavorecido", "chavePix", "tipoChavePix",
  "valorDiaria", "valorKm", "valorSaida", "fixoMensal",
  "valorAjudante", "valorEspera", "valorReentrega", "valorDevolucao", "franquiaKm",
  "periodicidadePagamento", "prazoPagamento", "formaPreferencialPagamento",
  "contaContabil", "centroCusto", "retencoes", "conferenciManual",
  "observacoesFinanceiras",
  "aceitaRefrigerada", "aceitaUrbana", "aceitaDedicada", "aceitaEsporadica",
] as const;

function saveDraft(data: Partial<Prestador>) {
  try {
    const draft: Record<string, any> = {};
    for (const f of DRAFT_FIELDS) {
      const val = (data as any)[f];
      if (val !== undefined && val !== null) draft[f] = val;
    }
    if (data.endereco) draft.endereco = data.endereco;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or private mode */ }
}

function loadDraft(): Partial<Prestador> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (typeof draft !== "object" || draft === null) return null;
    return draft;
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

const DOC_STATUS_STYLE: Record<StatusDocumento, string> = {
  valido: "bg-green-100 text-green-700",
  vencendo: "bg-yellow-100 text-yellow-700",
  vencido: "bg-red-100 text-red-700",
  pendente: "bg-gray-100 text-gray-600",
  aprovado: "bg-emerald-100 text-emerald-700",
  reprovado: "bg-rose-100 text-rose-700",
  em_analise: "bg-blue-100 text-blue-700",
};
const DOC_STATUS_LABEL: Record<StatusDocumento, string> = {
  valido: "Válido", vencendo: "Vencendo", vencido: "Vencido", pendente: "Pendente",
  aprovado: "Aprovado", reprovado: "Reprovado", em_analise: "Em análise",
};

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return "-";
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const DOCS_TIPOS = [
  "CNH Frente", "CNH Verso", "Documento Pessoal", "Comprovante de Residência",
  "Comprovante Bancário", "Contrato", "CRLV", "Documento do Veículo", "ANTT",
  "Apólice de Seguro", "Outros",
];

const MODALIDADES_TALENT = ["esporadico", "contrato", "rota_fixa"] as const;

interface PerfilTalentoForm {
  modalidadePreferencial: string[];
  distanciaMaxColetaKm: string;
  aceitaViagens: boolean;
  restricoesOperacionais: string;
}

interface DisponibilidadeTalentoForm {
  key: string;
  diaSemana: string;
  horaInicio: string;
  horaFim: string;
  disponivel: boolean;
}

interface AvaliacaoTalentItem {
  id: string;
  cenarioTitulo: string;
  competencia: string;
  descricaoSituacao: string;
  resposta: string;
  pontuacao: number | null;
  analise: unknown;
  createdAt: string;
}

const perfilTalentoVazio = (): PerfilTalentoForm => ({
  modalidadePreferencial: [],
  distanciaMaxColetaKm: "",
  aceitaViagens: true,
  restricoesOperacionais: "",
});

const DIAS_SEMANA_TALENT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const renderStars = (score: number, size = "w-5 h-5") => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`${size} ${s <= Math.round(score) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
    ))}
  </div>
);

const fmt = (v?: number) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

function getDefaultPrestador(): Partial<Prestador> {
  return {
    status: "analise",
    liberadoApp: false,
    tipoParceiro: "autonomo",
    scoreInterno: 0,
    qtdOperacoes: 0,
    indiceAceite: 0,
    indiceComparecimento: 0,
    indiceEntregaNoPrazo: 0,
    aceitaRefrigerada: false,
    aceitaUrbana: false,
    aceitaDedicada: false,
    aceitaEsporadica: false,
    conferenciManual: false,
    documentos: [],
    veiculos: [],
    contatosEmergencia: [{}, {}, {}] as any,
  } as Partial<Prestador>;
}

const PrestadorDetalhe = ({ prestador: initial, onBack }: Props) => {
  const isNew = !initial;

  // Restore draft for CREATE, or use initial data for EDIT
  const getInitialState = useCallback((): Partial<Prestador> => {
    if (!initial) {
      const draft = loadDraft();
      if (draft) return { ...getDefaultPrestador(), ...draft };
    }
    return initial || getDefaultPrestador();
  }, [initial]);

  const [p, setP] = useState<Partial<Prestador>>(getInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const initialStateRef = useRef<string>(JSON.stringify(initial || getDefaultPrestador()));

  // === INDICADORES REAIS (do banco) ===
  const [qtdEntregasReais, setQtdEntregasReais] = useState<number | null>(null);
  const [ocorrenciasReais, setOcorrenciasReais] = useState<any[]>([]);
  const [docToAnalyze, setDocToAnalyze] = useState<string | null>(null);
  const [modalContratoOpen, setModalContratoOpen] = useState(false);
  const [modalVeiculoOpen, setModalVeiculoOpen] = useState(false);
  const [modalOcorrenciaOpen, setModalOcorrenciaOpen] = useState(false);
  const [novaOcorrencia, setNovaOcorrencia] = useState<any>({
    tipo: "Atraso",
    gravidade: "media",
    status: "Aberta",
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    registradoPor: "Sistema"
  });
  const [novoVeiculo, setNovoVeiculo] = useState<Partial<VeiculoPrestador>>({
    status: "ativo"
  });
  const [modoEdicaoVeiculo, setModoEdicaoVeiculo] = useState<"adicionar" | "editar">("adicionar");
  const [isUploading, setIsUploading] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState<Record<string, boolean>>({});
  const [fotoRef, setFotoRef] = useState<string | null>(initial?.foto || null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [documentosPendentes, setDocumentosPendentes] = useState<Array<{tipo: string, file: File}>>([]);

  // === TALENT INTELLIGENCE (perfil, disponibilidade e avaliação situacional) ===
  const [perfilTalento, setPerfilTalento] = useState<PerfilTalentoForm>(perfilTalentoVazio);
  const [disponibilidadeTalento, setDisponibilidadeTalento] = useState<DisponibilidadeTalentoForm[]>([]);
  const [avaliacoesTalento, setAvaliacoesTalento] = useState<AvaliacaoTalentItem[]>([]);
  const [loadingTalento, setLoadingTalento] = useState(false);
  const [salvandoPerfilTalento, setSalvandoPerfilTalento] = useState(false);
  const [salvandoDisponibilidade, setSalvandoDisponibilidade] = useState(false);

  // Carregar documentos do banco ao abrir prestador existente
  useEffect(() => {
    const carregarDocumentos = async () => {
      if (!p.id) return;
      const { data, error } = await supabase
        .from("documentos_prestadores")
        .select("id, tipo, url, created_at")
        .eq("prestador_id", p.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Documentos] Erro ao carregar:", error);
      } else if (data) {
        console.log("[Documentos] Carregados do banco:", data.length);
        const docsFromDb = await Promise.all(
          data.map(async (d: any) => ({
            tipo: d.tipo,
            url: (await resolverUrlDocumento(d.url, { prestadorId: p.id })) ?? undefined,
            status: "valido" as const
          }))
        );
        setP(prev => ({ ...prev, documentos: docsFromDb }));
      }
    };
    carregarDocumentos();
  }, [p.id]);

  useEffect(() => {
    let ativo = true;
    const resolver = async () => {
      if (!fotoRef) {
        setFotoPreview(null);
        return;
      }
      const resolvida = await resolverUrlDocumento(fotoRef, { prestadorId: p.id });
      if (ativo) setFotoPreview(resolvida);
    };
    resolver();
    return () => {
      ativo = false;
    };
  }, [fotoRef, p.id]);

  // === TALENT INTELLIGENCE — carrega perfil, janelas e avaliações ===
  useEffect(() => {
    if (!p.id) return;
    let ativo = true;

    const carregarTalento = async () => {
      setLoadingTalento(true);
      try {
        const [perfilRes, dispoRes, avaliacoesRes] = await Promise.all([
          supabase
            .from("prestador_perfil_talento")
            .select("*")
            .eq("prestador_id", p.id)
            .maybeSingle(),
          supabase
            .from("prestador_disponibilidade")
            .select("*")
            .eq("prestador_id", p.id)
            .order("dia_semana", { ascending: true }),
          supabase
            .from("recrutamento_avaliacoes")
            .select("*, recrutamento_cenarios(titulo, descricao_situacao, competencia_alvo)")
            .eq("prestador_id", p.id)
            .order("created_at", { ascending: false }),
        ]);

        if (!ativo) return;

        if (perfilRes.data) {
          const row = perfilRes.data as Record<string, unknown>;
          setPerfilTalento({
            modalidadePreferencial: Array.isArray(row.modalidade_preferencial)
              ? (row.modalidade_preferencial as string[])
              : [],
            distanciaMaxColetaKm:
              row.distancia_max_coleta_km !== null && row.distancia_max_coleta_km !== undefined
                ? String(row.distancia_max_coleta_km)
                : "",
            aceitaViagens: row.aceita_viagens !== false,
            restricoesOperacionais: row.restricoes_operacionais
              ? JSON.stringify(row.restricoes_operacionais, null, 2)
              : "",
          });
        } else {
          setPerfilTalento(perfilTalentoVazio());
        }

        const dispoRows = (dispoRes.data as Record<string, unknown>[]) || [];
        setDisponibilidadeTalento(
          dispoRows.map((row, idx) => ({
            key: String(row.id || `disp-${idx}`),
            diaSemana: String(row.dia_semana ?? 1),
            horaInicio: String(row.hora_inicio || "08:00").slice(0, 5),
            horaFim: String(row.hora_fim || "18:00").slice(0, 5),
            disponivel: row.disponivel !== false,
          })),
        );

        const avaliacoesRows = (avaliacoesRes.data as Record<string, unknown>[]) || [];
        setAvaliacoesTalento(
          avaliacoesRows.map((row) => {
            const cenario = (row.recrutamento_cenarios || {}) as Record<string, unknown>;
            return {
              id: String(row.id),
              cenarioTitulo: String(cenario.titulo || "Cenário situacional"),
              competencia: String(cenario.competencia_alvo || ""),
              descricaoSituacao: String(cenario.descricao_situacao || ""),
              resposta: String(row.resposta_candidato || ""),
              pontuacao: row.pontuacao === null || row.pontuacao === undefined ? null : Number(row.pontuacao),
              analise: row.analise_ia_jsonb ?? null,
              createdAt: String(row.created_at || ""),
            };
          }),
        );
      } finally {
        if (ativo) setLoadingTalento(false);
      }
    };

    void carregarTalento();
    return () => {
      ativo = false;
    };
  }, [p.id]);

  // === CARREGAR INDICADORES REAIS DO BANCO ===
  useEffect(() => {
    if (!p.id) return;

    const carregarIndicadores = async () => {
      // 1. Total de entregas CONCLUIDAS via alocacoes_escala (contagem derivada, sem cache)
      // Status concluida = operacao realmente finalizada no app/topedo motorista
      const { count: totalConcluidas } = await supabase
        .from("alocacoes_escala")
        .select("*", { count: "exact", head: true })
        .eq("prestador_id", p.id!)
        .eq("status", "concluida");

      setQtdEntregasReais(totalConcluidas ?? 0);

      // 2. Ocorrências reais do prestador — fonte canônica: tabela `ocorrencias`
      //    (vínculo real por prestador_id; a tabela legada de ocorrências está vazia)
      const { data: ocorrenciasData } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("prestador_id", p.id!)
        .order("created_at", { ascending: false });

      setOcorrenciasReais(ocorrenciasData || []);
    };

    carregarIndicadores();
  }, [p.id]);

  // === DIRTY TRACKING ===
  useEffect(() => {
    const current = JSON.stringify(p);
    setIsDirty(current !== initialStateRef.current);
  }, [p]);

  // Save draft on change (CREATE only)
  useEffect(() => {
    if (isNew && isDirty) saveDraft(p);
  }, [p, isNew, isDirty]);

  // === BROWSER EXIT GUARD (beforeunload) ===
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // === LOCAL NAV GUARD (Voltar/Cancelar button only) ===
  const handleDiscardClick = useCallback(() => {
    clearDraft();
    onBack();
  }, [onBack]);

  const handleCancelClick = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  // Helper to handle input changes
  const handleChange = (field: keyof Prestador, value: any) => {
    setP(prev => ({ ...prev, [field]: value }));
  };

  const handleChangeAddress = (field: string, value: string) => {
    setP(prev => ({ ...prev, endereco: { ...prev.endereco, [field]: value } as any }));
  };

  const [cepLoading, setCepLoading] = useState(false);

  const handleCEPBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cepValue = e.target.value.replace(/\D/g, '');
    if (cepValue.length !== 8) return;
    if (p.endereco?.rua || p.endereco?.bairro || p.endereco?.cidade) return;

    setCepLoading(true);
    const resultado = await buscarCEP(cepValue);

    if ('logradouro' in resultado) {
      setP(prev => ({
        ...prev,
        endereco: {
          ...prev.endereco,
          rua: resultado.logradouro || prev.endereco?.rua,
          bairro: resultado.bairro || prev.endereco?.bairro,
          cidade: resultado.cidade || prev.endereco?.cidade,
          estado: resultado.estado || prev.endereco?.estado,
          ...(resultado.complemento ? { complemento: resultado.complemento } : {})
        } as any
      }));
      toast.success('Endereço preenchido automaticamente.');
    } else {
      toast.warning(resultado.message);
    }
    setCepLoading(false);
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas imagens");
      return;
    }

    const prestadorId = p.id || `temp_${Date.now()}`;
    const fileName = `foto_${prestadorId}_${Date.now()}.${file.type.split("/")[1]}`;

    try {
      setIsUploading(true);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_PRESTADORES)
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Erro ao fazer upload da imagem");
        return;
      }

      const fotoRefPersistida = referenciaEstavelDocumento(uploadData.path) ?? uploadData.path;
      setFotoRef(fotoRefPersistida);
      setP(prev => ({ ...prev, foto: fotoRefPersistida }));

      // Salva localmente caso nǜo exista a coluna no DB
      try {
        const localFotos = JSON.parse(localStorage.getItem('conexao_prestador_fotos') || '{}');
        if (prestadorId) {
          localFotos[prestadorId] = fotoRefPersistida;
          localStorage.setItem('conexao_prestador_fotos', JSON.stringify(localFotos));
        }
      } catch (e) {}

      toast.success("Foto atualizada! Salva localmente até criar coluna no banco.");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocUpload = async (tipoDocumento: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const prestadorId = p.id;
    if (!prestadorId) {
      setDocumentosPendentes(prev => {
        const next = prev.filter(d => d.tipo !== tipoDocumento);
        return [...next, { tipo: tipoDocumento, file }];
      });
      toast.success(`Documento ${tipoDocumento} anexado, será enviado após salvar o prestador.`);
      return;
    }

    const fileName = `doc_${prestadorId}_${tipoDocumento.replace(/\s+/g, "_")}_${Date.now()}.${file.name.split(".").pop()}`;

    try {
      setDocUploadProgress(prev => ({ ...prev, [tipoDocumento]: true }));
      setIsUploading(true);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_PRESTADORES)
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("[Documentos] Upload error:", uploadError);
        toast.error(`Erro ao fazer upload do ${tipoDocumento}`);
        return;
      }

      console.log("[Documentos] Upload OK:", uploadData);

      const docRefPersistida = referenciaEstavelDocumento(uploadData.path) ?? uploadData.path;
      const docUrl = await resolverUrlDocumento(docRefPersistida, { prestadorId });
      console.log("[Documentos] referencia persistida:", docRefPersistida);

      const docPayload = {
        prestador_id: prestadorId,
        tipo: tipoDocumento,
        url: docRefPersistida,
        created_at: new Date().toISOString()
      };
      console.log("[Documentos] Insert payload:", docPayload);

      const { data: dbData, error: dbError } = await supabase.from("documentos_prestadores").insert([docPayload]).select();

      if (dbError) {
        console.error("[Documentos] DB error:", dbError);
        toast.error(`Erro ao salvar documento: ${dbError.message}`);
      } else {
        console.log("[Documentos] Insert OK:", dbData);
      }

      const currentDocs = p.documentos || [];
      const updatedDocs = currentDocs.some(d => d.tipo === tipoDocumento)
        ? currentDocs.map(d => d.tipo === tipoDocumento ? { ...d, url: docUrl ?? undefined, status: "valido" as const } : d)
        : [...currentDocs, { tipo: tipoDocumento, url: docUrl ?? undefined, status: "valido" as const }];
      setP(prev => ({ ...prev, documentos: updatedDocs }));
      toast.success(`${tipoDocumento} enviado!`);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error(`Erro ao fazer upload do ${tipoDocumento}`);
    } finally {
      setDocUploadProgress(prev => ({ ...prev, [tipoDocumento]: false }));
      setIsUploading(false);
    }
  };

  const handleAddVeiculo = async (veiculoData: Partial<VeiculoPrestador>) => {
    const prestadorId = p.id;
    if (!veiculoData.tipoVeiculo) return toast.error("Selecione o tipo de veículo.");
    
    const newVeiculo: VeiculoPrestador = {
      id: veiculoData.id || `temp_${Date.now()}`,
      tipoVeiculo: veiculoData.tipoVeiculo || "outro",
      subcategoria: "outro",
      tipoCarroceria: "outro",
      classificacaoTermica: "seco",
      placa: veiculoData.placa || "",
      renavam: veiculoData.renavam || "",
      marca: veiculoData.marca || "",
      modelo: veiculoData.modelo || "",
      ano: veiculoData.ano || 2024,
      cor: "",
      capacidadeKg: veiculoData.capacidadeKg || 0,
      capacidadeM3: veiculoData.capacidadeM3 || 0,
      proprietario: veiculoData.proprietario || "",
      cpfCnpjProprietario: veiculoData.cpfCnpjProprietario || "",
      tempMin: veiculoData.tempMin,
      tempMax: veiculoData.tempMax,
      tipoCarga: veiculoData.tipoCarga,
      status: "ativo",
      observacoesOperacionais: veiculoData.observacoesOperacionais,
      restricoesRegiao: veiculoData.restricoesRegiao,
      antt: veiculoData.antt,
      possuiSeguro: veiculoData.possuiSeguro,
    };

    if (!prestadorId) {
      const currentVeiculos = p.veiculos || [];
      setP(prev => ({ ...prev, veiculos: [...currentVeiculos, newVeiculo] }));
      setModalVeiculoOpen(false);
      toast.success("Veículo adicionado temporariamente! Salve o prestador para confirmar.");
      return;
    }

    try {
      const payloadVeiculo = sanitizeVeiculoPayload({
        placa: veiculoData.placa,
        ...camposTipoVeiculo(veiculoData.tipoVeiculo),
        marca: veiculoData.marca,
        modelo: veiculoData.modelo,
        ano: veiculoData.ano,
        renavam: veiculoData.renavam,
        antt: veiculoData.antt,
        proprietario_nome: veiculoData.proprietario,
        proprietario_documento: veiculoData.cpfCnpjProprietario,
        capacidade_kg: veiculoData.capacidadeKg,
        capacidade_m3: veiculoData.capacidadeM3,
        comprimento_m: veiculoData.comprimento,
        largura_m: veiculoData.largura,
        altura_m: veiculoData.altura,
        tipo_carga: veiculoData.tipoCarga,
        temperatura_min: veiculoData.tempMin,
        temperatura_max: veiculoData.tempMax,
        rastreador: veiculoData.rastreador === "Sim",
        seguro: veiculoData.possuiSeguro,
        restricoes_regiao: veiculoData.restricoesRegiao,
        observacoes: veiculoData.observacoesOperacionais,
        principal: true,
        status: 'ativo',
        prestador_vinculado: prestadorId,
        updated_at: new Date().toISOString()
      });

      const { data: veiculoResult, error: veiculoError } = await supabase.from("veiculos").insert(payloadVeiculo).select();

      if (veiculoError) {
        console.error("Erro ao adicionar veículo:", veiculoError);
        if (veiculoError.message.includes('does not exist') || veiculoError.code === 'PGRST116') {
          toast.error("Tabela de veículos não encontrada. Configure o banco de dados.");
        } else {
          toast.error("Erro ao adicionar veículo: " + veiculoError.message);
        }
        return;
      }

      // Confirmação real: só considera sucesso se o veículo foi persistido
      if (!veiculoResult || veiculoResult.length === 0) {
        toast.error("Nenhum veículo foi salvo. Verifique permissões e tente novamente.");
        return;
      }

      const currentVeiculos = p.veiculos || [];
      setP(prev => ({ ...prev, veiculos: [...currentVeiculos, newVeiculo] }));
      setModalVeiculoOpen(false);
      toast.success("Veículo salvo com sucesso!");
      
      const { data: veiculosAtualizados } = await supabase
        .from('veiculos')
        .select('*')
        .eq('prestador_vinculado', prestadorId);
      
      if (veiculosAtualizados) {
        console.log(`[PRESTADOR] Veículos carregados do banco: ${veiculosAtualizados.length}`);
      }
    } catch (error) {
      console.error("Erro ao adicionar veículo:", error);
      toast.error("Erro ao adicionar veículo");
    }
  };

  const handleUpdateVeiculo = async (veiculoData: Partial<VeiculoPrestador>) => {
    if (!veiculoData.id) return toast.error("ID do veículo não encontrado.");
    if (!veiculoData.tipoVeiculo) return toast.error("Selecione o tipo de veículo.");
    
    try {
      const payloadVeiculo = sanitizeVeiculoPayload({
        placa: veiculoData.placa,
        ...camposTipoVeiculo(veiculoData.tipoVeiculo),
        marca: veiculoData.marca,
        modelo: veiculoData.modelo,
        ano: veiculoData.ano,
        renavam: veiculoData.renavam,
        antt: veiculoData.antt,
        proprietario_nome: veiculoData.proprietario,
        proprietario_documento: veiculoData.cpfCnpjProprietario,
        capacidade_kg: veiculoData.capacidadeKg,
        capacidade_m3: veiculoData.capacidadeM3,
        comprimento_m: veiculoData.comprimento,
        largura_m: veiculoData.largura,
        altura_m: veiculoData.altura,
        tipo_carga: veiculoData.tipoCarga,
        temperatura_min: veiculoData.tempMin,
        temperatura_max: veiculoData.tempMax,
        rastreador: veiculoData.rastreador === "Sim",
        seguro: veiculoData.possuiSeguro,
        restricoes_regiao: veiculoData.restricoesRegiao,
        observacoes: veiculoData.observacoesOperacionais,
        updated_at: new Date().toISOString()
      });

      const { data: updResult, error } = await supabase.from("veiculos").update(payloadVeiculo).eq("id", veiculoData.id).select("id");
      if (error) throw error;

      // Confirmação real: só considera sucesso se o veículo foi atualizado
      if (!updResult || updResult.length === 0) {
        toast.error("Nenhum veículo foi atualizado. Verifique permissões e tente novamente.");
        return;
      }

      setP(prev => ({
        ...prev,
        veiculos: (prev.veiculos || []).map(v => 
          v.id === veiculoData.id ? { ...v, ...veiculoData } : v
        )
      }));
      setModalVeiculoOpen(false);
      toast.success("Veículo atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar veículo:", error);
      toast.error("Erro ao atualizar veículo: " + (error?.message || ""));
    }
  };

  const handleDeleteVeiculo = async (veiculoId: string) => {
    if (!veiculoId) return;
    try {
      const { error } = await supabase.from("veiculos").delete().eq("id", veiculoId);
      if (error) throw error;
      setP(prev => ({
        ...prev,
        veiculos: (prev.veiculos || []).filter(v => v.id !== veiculoId)
      }));
      toast.success("Veículo removido com sucesso!");
    } catch (error: any) {
      console.error("Erro ao remover veículo:", error);
      toast.error("Erro ao remover veículo: " + (error?.message || ""));
    }
  };

  const handleSave = async () => {
    // Double-submit protection
    if (isLoading) return;

    // Required field validation
    const errors: string[] = [];
    if (!p.nomeCompleto?.trim()) errors.push("Nome completo");
    if (!p.cpfCnpj?.trim()) errors.push("CPF/CNPJ");
    if (!p.tipoParceiro) errors.push("Tipo de parceiro");
    if (!p.status) errors.push("Status");
    if (errors.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${errors.join(", ")}`);
      return;
    }

    try {
      setIsLoading(true);
      const isUpdate = !!initial?.id;

      // E2E-05D — coerência: liberado_app SÓ pode ser true quando status ativo/aprovado.
      // Bloqueado/reprovado/em análise → liberado_app permanece false.
      const statusCanonico = normalizarStatusPrestador(p.status);
      const pEfetivo = statusCanonico === "ativo" ? p : { ...p, liberadoApp: false };

      const payload = isUpdate ? toPrestadorUpdate(pEfetivo) : toPrestadorInsert(pEfetivo);
      const sanitizedPayload = sanitizePrestadorPayload(payload);

      console.log("Payload enviado:", sanitizedPayload);

      let result;
      if (isUpdate) {
        result = await supabase.from('prestadores').update(sanitizedPayload).eq('id', p.id).select();
      } else {
        result = await supabase.from('prestadores').insert([sanitizedPayload]).select();
      }

      const { data, error } = result;
      
      if (error) {
        console.error("SUPABASE ERROR:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      // CREATE: confirm persistence via reread
      if (isNew) {
        const persistedId = data?.[0]?.id;
        if (!persistedId) {
          console.error("INSERT retornou dados vazios:", data);
          toast.error("Cadastro falhou: banco não retornou registro. Tente novamente.");
          return;
        }

        // REREAD: independent SELECT to confirm record exists
        const { data: rereadData, error: rereadError } = await supabase
          .from('prestadores')
          .select('id, nome_completo, cpf_cnpj, status')
          .eq('id', persistedId)
          .single();

        if (rereadError || !rereadData) {
          console.error("CREATE reread falhou:", rereadError);
          toast.error("Cadastro inserido mas não confirmado na releitura. Contate suporte.");
          return;
        }

        console.log("[CREATE REREAD] Registro confirmado:", rereadData);

        // Save vehicles linked to confirmed prestador
        if (p.veiculos?.length) {
          const veiculosPayload = p.veiculos.map(v => ({
            placa: v.placa,
            tipo_veiculo: v.tipoVeiculo,
            marca: v.marca,
            modelo: v.modelo,
            ano_fabricacao: v.ano,
            capacidade_kg: v.capacidadeKg,
            capacidade_m3: v.capacidadeM3,
            tipo_carga: v.tipoCarga,
            prestador_vinculado: persistedId,
            status: "Ativo",
            created_at: new Date().toISOString()
          }));
          await supabase.from("veiculos").insert(veiculosPayload);
        }

        // Send pending documents (only after reread confirmed)
        if (documentosPendentes.length > 0) {
          toast.info("Enviando documentos pendentes...");
          for (const doc of documentosPendentes) {
            const fileName = `doc_${persistedId}_${doc.tipo.replace(/\s+/g, "_")}_${Date.now()}.${doc.file.name.split(".").pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(BUCKET_PRESTADORES)
              .upload(fileName, doc.file, { upsert: true });

            if (!uploadError && uploadData) {
              await supabase.from("documentos_prestadores").insert([{
                prestador_id: persistedId,
                tipo: doc.tipo,
                url: referenciaEstavelDocumento(uploadData.path) ?? uploadData.path,
                created_at: new Date().toISOString()
              }]);
            }
          }
        }

        toast.success("Prestador cadastrado com sucesso!");
        clearDraft();
        onBack();
        return;
      }

      // UPDATE: confirm persistence via reread
      const affectedRows = data?.length ?? 0;
      if (affectedRows === 0) {
        console.error("UPDATE afetou 0 registros. ID pode não existir:", p.id);
        toast.error("Atualização falhou: registro não encontrado no banco.");
        return;
      }

      // REREAD: independent SELECT to confirm record exists and fields match
      const { data: rereadData, error: rereadError } = await supabase
        .from('prestadores')
        .select('id, nome_completo, cpf_cnpj, status')
        .eq('id', p.id)
        .single();

      if (rereadError || !rereadData) {
        console.error("UPDATE reread falhou:", rereadError);
        toast.error("Atualização executada mas não confirmada na releitura. Contate suporte.");
        return;
      }

      console.log("[UPDATE REREAD] Registro confirmado:", rereadData);
      toast.success("Prestador atualizado com sucesso!");
      onBack();
    } catch (error: any) {
      console.error("Erro ao salvar prestador:", error);
      toast.error("Erro ao salvar dados no Supabase");
      // Form stays open — user's typed data is preserved in state
    } finally {
      setIsLoading(false);
    }
  };

  const veiculoResumoTalent = useMemo(() => {
    const veiculo = p.veiculos?.find((v) => v.principal) || p.veiculos?.[0];
    if (!veiculo) return "";
    return TIPO_VEICULO_LABEL[veiculo.tipoVeiculo] || String(veiculo.tipoVeiculo || "");
  }, [p.veiculos]);

  const resumoTalent = useMemo(
    () =>
      montarResumoTalent({
        veiculo: veiculoResumoTalent,
        regiao:
          p.regiaoPrincipal ||
          [p.endereco?.cidade, p.endereco?.estado].filter(Boolean).join(" - "),
        modalidades: perfilTalento.modalidadePreferencial,
        disponibilidade: disponibilidadeTalento.map((d) => ({
          dia_semana: Number(d.diaSemana),
          hora_inicio: d.horaInicio,
          hora_fim: d.horaFim,
          disponivel: d.disponivel,
        })),
      }),
    [
      veiculoResumoTalent,
      p.regiaoPrincipal,
      p.endereco?.cidade,
      p.endereco?.estado,
      perfilTalento.modalidadePreferencial,
      disponibilidadeTalento,
    ],
  );

  const toggleModalidadeTalento = (modalidade: string) => {
    setPerfilTalento((prev) => ({
      ...prev,
      modalidadePreferencial: prev.modalidadePreferencial.includes(modalidade)
        ? prev.modalidadePreferencial.filter((m) => m !== modalidade)
        : [...prev.modalidadePreferencial, modalidade],
    }));
  };

  const salvarPerfilTalento = async () => {
    if (!p.id) {
      toast.error("Salve o prestador antes de editar o perfil de talento.");
      return;
    }
    let restricoes: unknown = {};
    const textoRestricoes = perfilTalento.restricoesOperacionais.trim();
    if (textoRestricoes) {
      try {
        restricoes = JSON.parse(textoRestricoes);
      } catch {
        toast.error("Restrições operacionais: JSON inválido. Revise o conteúdo.");
        return;
      }
    }
    const distanciaTexto = perfilTalento.distanciaMaxColetaKm.trim();
    const distancia = distanciaTexto ? Number(distanciaTexto) : null;
    if (distancia !== null && (!Number.isFinite(distancia) || distancia < 0)) {
      toast.error("Distância máxima de coleta inválida.");
      return;
    }

    setSalvandoPerfilTalento(true);
    try {
      const { error } = await supabase.from("prestador_perfil_talento").upsert(
        {
          prestador_id: p.id,
          modalidade_preferencial: perfilTalento.modalidadePreferencial,
          distancia_max_coleta_km: distancia,
          aceita_viagens: perfilTalento.aceitaViagens,
          restricoes_operacionais: restricoes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "prestador_id" },
      );
      if (error) throw error;
      toast.success("Perfil e preferências salvos.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível salvar o perfil: ${mensagem}`);
    } finally {
      setSalvandoPerfilTalento(false);
    }
  };

  const adicionarJanelaTalento = () => {
    setDisponibilidadeTalento((prev) => [
      ...prev,
      {
        key: `janela-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        diaSemana: "1",
        horaInicio: "08:00",
        horaFim: "18:00",
        disponivel: true,
      },
    ]);
  };

  const salvarDisponibilidadeTalento = async () => {
    if (!p.id) {
      toast.error("Salve o prestador antes de editar a disponibilidade.");
      return;
    }
    const janelas = disponibilidadeTalento
      .filter((j) => j.diaSemana !== "" && j.horaInicio && j.horaFim)
      .map((j) => ({
        prestador_id: p.id,
        dia_semana: Number(j.diaSemana),
        hora_inicio: j.horaInicio,
        hora_fim: j.horaFim,
        disponivel: j.disponivel,
      }));

    if (janelas.some((j) => !Number.isFinite(j.dia_semana) || j.dia_semana < 0 || j.dia_semana > 6)) {
      toast.error("Dia da semana inválido.");
      return;
    }
    if (janelas.some((j) => j.hora_fim <= j.hora_inicio)) {
      toast.error("O fim da janela deve ser depois do início.");
      return;
    }

    setSalvandoDisponibilidade(true);
    try {
      const { error: deleteError } = await supabase
        .from("prestador_disponibilidade")
        .delete()
        .eq("prestador_id", p.id);
      if (deleteError) throw deleteError;

      if (janelas.length > 0) {
        const { error } = await supabase.from("prestador_disponibilidade").insert(janelas);
        if (error) throw error;
      }
      toast.success("Disponibilidade atualizada.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível salvar a disponibilidade: ${mensagem}`);
    } finally {
      setSalvandoDisponibilidade(false);
    }
  };

  const docGeral = () => {
    if (!p.documentos?.length) return { label: "Pendente ⚠️", cls: "bg-yellow-100 text-yellow-700" };
    if (p.documentos.some((d) => d.status === "vencido")) return { label: "Vencido 🔴", cls: "bg-red-100 text-red-700" };
    if (p.documentos.some((d) => d.status === "pendente" || d.status === "vencendo")) return { label: "Pendente ⚠️", cls: "bg-yellow-100 text-yellow-700" };
    return { label: "Completo ✅", cls: "bg-green-100 text-green-700" };
  };

  return (
    <div className="w-full px-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="text-xl font-bold">{isNew ? "Cadastrar Prestador" : (p.nomeFantasia || p.nomeCompleto)}</h2>
        </div>
        <div className="flex items-center gap-2">
          {p.id && (
            <Button variant="outline" size="sm" className="gap-1.5 focus:ring-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" onClick={() => setModalContratoOpen(true)}>
              <FileSignature className="w-4 h-4" />
              Gerar Contrato
            </Button>
          )}
        </div>
      </div>

      {/* Resumo Operacional — Conexão Talent AI (string única consolidada) */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background shadow-sm">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Conexão Talent AI · Resumo Operacional
              </p>
              <p className="text-sm font-bold text-foreground">{resumoTalent}</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 text-[10px] font-bold text-primary">
            {loadingTalento ? "Sincronizando perfil..." : "Perfil 360º"}
          </Badge>
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Card Lateral - FIXO NA ESQUERDA */}
        <div className="xl:w-[340px] xl:sticky xl:top-4 xl:h-fit shrink-0 order-2 xl:order-1 space-y-4">
          <Card className="shadow-sm border-muted/60">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="relative mb-4 group">
                <input type="file" accept="image/*" className="hidden" id="foto-upload" onChange={handleFotoUpload} disabled={isUploading} />
                <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="text-3xl bg-muted">{p.nomeCompleto?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}</AvatarFallback>
                  )}
                </Avatar>
                <label htmlFor="foto-upload" className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg cursor-pointer hover:bg-primary/90 transition-all group-hover:scale-110">
                  <Camera className="w-4 h-4" />
                </label>
              </div>
              
              <div className="w-full space-y-1 mb-4">
                <h3 className="font-bold text-lg truncate px-2">{p.nomeCompleto || "Novo Prestador"}</h3>
                <p className="text-xs text-muted-foreground">{p.cpfCnpj || "CPF/CNPJ não informado"}</p>
              </div>

              {p.status && (
                <Badge className={`${STATUS_COR[normalizarStatusPrestador(p.status)]} px-4 py-1 text-[10px] uppercase tracking-wider mb-4`}>
                  {STATUS_LABEL[normalizarStatusPrestador(p.status)]}
                </Badge>
              )}
              
              <div className="flex flex-col items-center gap-1 w-full pt-4 border-t border-muted/40">
                <div className="flex items-center gap-1.5">{renderStars(p.scoreInterno || 0, "w-5 h-5")}</div>
                <p className="text-xs font-semibold mt-1">Score: {p.scoreInterno?.toFixed(1) || "0.0"} / 5.0</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Resumo Operacional</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-muted/40">
                <span className="text-muted-foreground text-xs">Desde / Cadastro</span>
                <span className="text-xs font-bold">{formatarDataBR(p.dataCadastro) || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted/40">
                <span className="text-muted-foreground text-xs">Aprovação</span>
                <span className="text-xs font-bold text-emerald-600">{formatarDataBR(p.dataAprovacao) || "Em análise"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted/40">
                <span className="text-muted-foreground text-xs">Idade</span>
                <span className="text-xs font-bold">{calculateAge(p.dataNascimento)} anos</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted/40">
                <span className="text-muted-foreground text-xs">Total Entregas</span>
                <span className="text-xs font-bold">{qtdEntregasReais ?? "—"} saídas</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted/40">
                <span className="text-muted-foreground text-xs">Ocorrências</span>
                <span className={`text-xs font-bold ${ocorrenciasReais.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {ocorrenciasReais.length} registrada(s)
                </span>
              </div>
              
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2 font-bold uppercase tracking-tighter">Observação / Torre</p>
                <div className="bg-muted/30 p-3 rounded-lg text-xs italic text-muted-foreground border border-muted/40">
                  {p.observacoesTorre || "Nenhuma observação operacional registrada."}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas principais - DIREITA */}
        <div className="flex-1 min-w-0 order-1 xl:order-2">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="bg-muted/60 w-full flex flex-wrap">
              <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
              <TabsTrigger value="documentacao">Documentacao</TabsTrigger>
              <TabsTrigger value="veiculos">Veiculos</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
              <TabsTrigger value="torre">Torre</TabsTrigger>
              <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões</TabsTrigger>
              <TabsTrigger value="talent">Perfil e Preferências</TabsTrigger>
              <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
              <TabsTrigger value="avaliacao_situacional">Avaliação Situacional</TabsTrigger>
            </TabsList>

          {/* ABA 1 - DADOS GERAIS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><Label className="text-xs">Nome completo / Razão social</Label><Input value={p.nomeCompleto || ""} onChange={(e) => handleChange('nomeCompleto', e.target.value)} /></div>
                <div><Label className="text-xs">CPF / CNPJ</Label><Input value={p.cpfCnpj || ""} onChange={(e) => handleChange('cpfCnpj', e.target.value)} /></div>
                <div><Label className="text-xs">RG</Label><Input value={p.rgIe || ""} onChange={(e) => handleChange('rgIe', e.target.value)} /></div>
                <div><Label className="text-xs">Data de nascimento</Label><Input type="date" value={p.dataNascimento || ""} onChange={(e) => handleChange('dataNascimento', e.target.value)} /></div>
                <div><Label className="text-xs">Telefone principal</Label><Input value={p.telefone || ""} onChange={(e) => handleChange('telefone', e.target.value)} /></div>
                <div><Label className="text-xs">WhatsApp</Label><Input value={p.whatsapp || ""} onChange={(e) => handleChange('whatsapp', e.target.value)} /></div>
                <div><Label className="text-xs">E-mail</Label><Input value={p.email || ""} onChange={(e) => handleChange('email', e.target.value)} /></div>
                <div><Label className="text-xs">RNTRC</Label><Input value={p.rntrc || ""} onChange={(e) => handleChange('rntrc', e.target.value)} placeholder="Nº RNTRC" /></div>
                <div><Label className="text-xs">ANTT</Label><Input value={p.antt || ""} onChange={(e) => handleChange('antt', e.target.value)} placeholder="Nº ANTT" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Tipo de Parceiro</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {(Object.entries(TIPO_PARCEIRO_LABEL) as [TipoParceiro, string][]).map(([key, label]) => (
                    <label key={key} onClick={() => handleChange('tipoParceiro', key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${p.tipoParceiro === key ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:bg-muted"}`}>
                      <div className={`w-3 h-3 rounded-full ${TIPO_PARCEIRO_COR[key].split(" ")[0]}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {STATUS_OPCOES_CANONICAS.map((key) => [key, STATUS_LABEL[key]] as [StatusPrestador, string]).map(([key, label]) => (
                    <label key={key} onClick={() => handleChange('status', key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${normalizarStatusPrestador(p.status) === key ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:bg-muted"}`}>
                      <div className={`w-3 h-3 rounded-full ${STATUS_COR[key].split(" ")[0]}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Liberado no Aplicativo</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Switch
                    id="liberado_app"
                    checked={p.liberadoApp ?? false}
                    onCheckedChange={(checked) => handleChange('liberadoApp', checked)}
                  />
                  <Label htmlFor="liberado_app" className="text-sm cursor-pointer">
                    {p.liberadoApp ? "Librado para receber operações via aplicativo" : "Sem acesso ao aplicativo (somente rede interna)"}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Controla se o prestador pode receber e aceitar oportunidades pela rede interna.
                  Prestadores inativos, bloqueados ou com documentos vencidos devem ter este desligado.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><Label className="text-xs">CEP</Label>
                  <div className="relative">
                    <Input 
                      value={p.endereco?.cep || ''} 
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        const formatted = v.length > 5 ? v.replace(/^(\d{5})(\d)/, '$1-$2') : v;
                        handleChangeAddress('cep', formatted);
                      }}
                      onBlur={handleCEPBlur}
                      placeholder="00000-000" 
                      maxLength={9}
                      className={cepLoading ? "pr-8" : ""}
                    />
                    {cepLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                </div>
                <div className="lg:col-span-2"><Label className="text-xs">Rua</Label><Input value={p.endereco?.rua || ''} onChange={e => handleChangeAddress('rua', e.target.value)} /></div>
                <div><Label className="text-xs">Número</Label><Input value={p.endereco?.numero || ''} onChange={e => handleChangeAddress('numero', e.target.value)} /></div>
                <div><Label className="text-xs">Complemento</Label><Input value={p.endereco?.complemento || ''} onChange={e => handleChangeAddress('complemento', e.target.value)} /></div>
                <div><Label className="text-xs">Bairro</Label><Input value={p.endereco?.bairro || ''} onChange={e => handleChangeAddress('bairro', e.target.value)} /></div>
                <div><Label className="text-xs">Cidade</Label><Input value={p.endereco?.cidade || ''} onChange={e => handleChangeAddress('cidade', e.target.value)} /></div>
                <div><Label className="text-xs">Estado</Label><Input value={p.endereco?.estado || ''} onChange={e => handleChangeAddress('estado', e.target.value)} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Região e Operação</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Região principal</Label>
                  <Select value={p.regiaoPrincipal || ""} onValueChange={(val) => handleChange('regiaoPrincipal', val)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["Todos os estados do Brasil", "Todas as capitais", "Grande SP", "ABC Paulista", "Interior SP", "Litoral SP", "Vale do Paraíba", "Baixada Santista", "Campinas", "Sorocaba", "Ribeirão Preto", "Rio de Janeiro Capital", "Grande Rio", "Belo Horizonte", "Curitiba", "Florianópolis", "Porto Alegre", "Salvador", "Recife", "Fortaleza", "Brasília", "Goiânia", "Manaus", "Belém", "Vitória", "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Regiões secundárias</Label><Input value={p.regioesSecundarias?.join(", ") || ""} onChange={(e) => handleChange('regioesSecundarias', e.target.value.split(",").map(s => s.trim()).filter(Boolean))} /></div>
                <div><Label className="text-xs">Origem do cadastro</Label><Input value={p.origemCadastro || ""} onChange={(e) => handleChange('origemCadastro', e.target.value)} /></div>
                <div><Label className="text-xs">Indicação</Label><Input value={p.indicacao || ""} onChange={(e) => handleChange('indicacao', e.target.value)} /></div>
                <div><Label className="text-xs">Disponibilidade padrão</Label><Input value={p.disponibilidade || ""} onChange={(e) => handleChange('disponibilidade', e.target.value)} /></div>
                <div><Label className="text-xs">Turnos preferenciais</Label><Input value={p.turnosPreferenciais || ""} onChange={(e) => handleChange('turnosPreferenciais', e.target.value)} /></div>
                <div className="md:col-span-2"><Label className="text-xs">Restrições operacionais</Label><Textarea value={p.restricoesOperacionais || ""} onChange={(e) => handleChange('restricoesOperacionais', e.target.value)} rows={2} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Preferências</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Aceita refrigerada", field: "aceitaRefrigerada", val: p.aceitaRefrigerada },
                  { label: "Aceita urbana", field: "aceitaUrbana", val: p.aceitaUrbana },
                  { label: "Aceita viagem", field: "aceitaDedicada", val: p.aceitaDedicada },
                  { label: "Aceita esporádica", field: "aceitaEsporadica", val: p.aceitaEsporadica },
                ].map((t) => (
                  <div key={t.label} className="flex items-center gap-2">
                    <Switch checked={!!t.val} onCheckedChange={(val) => handleChange(t.field as keyof Prestador, val)} />
                    <Label className="text-xs">{t.label}</Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Contatos de Emergência</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(p.contatosEmergencia || [{}, {}, {}]).map((c, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Nome ({i + 1})</Label><Input defaultValue={c.nome} /></div>
                    <div><Label className="text-xs">Telefone</Label><Input defaultValue={c.telefone} /></div>
                    <div><Label className="text-xs">Relação</Label><Input defaultValue={c.relacao} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2 - DOCUMENTAÇÃO */}
          <TabsContent value="documentacao" className="space-y-4 mt-4">
            {!p.id && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3 text-blue-700 mb-4">
                <Sparkles className="w-5 h-5" />
                <p className="text-sm font-medium">Salve o prestador primeiro para habilitar o envio de documentos.</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status geral:</span>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${docGeral().cls}`}>{docGeral().label}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCS_TIPOS.map((tipo) => {
                const doc = p.documentos?.find((d) => d.tipo === tipo);
                return (
                  <Card key={tipo}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{tipo}</span>
                        {documentosPendentes.some(d => d.tipo === tipo) ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                            Anexado (Aguardando Salvar)
                          </span>
                        ) : (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DOC_STATUS_STYLE[doc?.status || "pendente"]}`}>
                            {DOC_STATUS_LABEL[doc?.status || "pendente"]}
                          </span>
                        )}
                      </div>
                      {doc?.dataVencimento && (
                        <p className="text-xs text-muted-foreground mb-2">Vencimento: {new Date(doc.dataVencimento).toLocaleDateString("pt-BR")}</p>
                      )}
                      {docToAnalyze === tipo && p.id && (
                        <DocumentoAnalyzer
                          prestadorId={p.id}
                          prestadorData={{
                            nomeCompleto: p.nomeCompleto,
                            cpfCnpj: p.cpfCnpj,
                            dataNascimento: p.dataNascimento
                          }}
                          tipoDocumento={tipo}
                          onAnaliseConcluida={(dados, validade) => {
                            if (validade) {
                              handleChange("metadata", { ...(typeof p.metadata === 'object' ? p.metadata : {}), cnh_validade: validade });
                            }
                            setDocToAnalyze(null);
                          }}
                        />
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id={`doc-upload-${tipo}`}
                        onChange={(e) => handleDocUpload(tipo, e)}
                        disabled={docUploadProgress[tipo]}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <label
                          htmlFor={`doc-upload-${tipo}`}
                          className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer text-xs h-7 ${docUploadProgress[tipo] ? "bg-muted cursor-wait" : "hover:bg-muted"}`}
                        >
                          {docUploadProgress[tipo] ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )} Upload
                        </label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs gap-1 text-primary"
                          onClick={() => setDocToAnalyze(tipo)}
                        >
                          <Sparkles className="w-3 h-3" /> IA
                        </Button>
                        <Input type="date" className="h-7 text-xs w-36" defaultValue={doc?.dataVencimento} placeholder="Vencimento" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ABA 3 - VEÍCULOS */}
          <TabsContent value="veiculos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.veiculos?.length || 0} veículo(s) vinculada(s)</span>
              <Button size="sm" className="gap-1.5" onClick={() => { setNovoVeiculo({ status: "ativo" }); setModoEdicaoVeiculo("adicionar"); setModalVeiculoOpen(true); }}><Plus className="w-4 h-4" /> Adicionar Veículo</Button>
            </div>
            {(p.veiculos || []).map((v) => (
              <Card key={v.id} className="overflow-hidden border-muted/60 shadow-sm">
                <CardContent className="p-0">
                  <div className="bg-muted/30 p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase">{v.placa} — {v.marca} {v.modelo}</p>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{TIPO_VEICULO_LABEL[v.tipoVeiculo]} • {v.ano}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={v.status === "ativo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600"}>
                        {v.status?.toUpperCase() || "ATIVO"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setNovoVeiculo(v); setModoEdicaoVeiculo("editar"); setModalVeiculoOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Remover" onClick={() => handleDeleteVeiculo(v.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Capacidade</Label>
                      <p className="text-sm font-medium">{v.capacidadeKg} kg / {v.capacidadeM3} m³</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Dimensões (CxLxA)</Label>
                      <p className="text-sm font-medium">{v.comprimento || 0}m x {v.largura || 0}m x {v.altura || 0}m</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Tipo Carga</Label>
                      <Badge variant="secondary" className="text-[10px] uppercase">{v.tipoCarga || "Seco"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">RENAVAM / ANTT</Label>
                      <p className="text-xs font-medium">{v.renavam || "-"} / {v.antt || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Rastreador / Seguro</Label>
                      <p className="text-xs font-medium">{v.rastreador ? "SIM" : "NÃO"} / {v.possuiSeguro ? "SIM" : "NÃO"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Proprietário</Label>
                      <p className="text-xs font-medium truncate" title={`${v.proprietario || "-"} - ${v.cpfCnpjProprietario || ""}`}>
                        {v.proprietario || "-"} <span className="text-muted-foreground">({v.cpfCnpjProprietario || "Sem CPF/CNPJ"})</span>
                      </p>
                    </div>
                  </div>
                  
                  {(v.tipoCarga === "refrigerado" || v.tipoCarga === "congelado" || v.tipoCarga === "misto") && (
                     <div className="px-5 pb-2">
                       <div className="bg-blue-50 text-blue-700 text-[11px] p-2 rounded-lg font-medium inline-flex items-center gap-2">
                         ❄️ Faixa de Temperatura: {v.tempMin !== undefined ? v.tempMin : "?"}°C até {v.tempMax !== undefined ? v.tempMax : "?"}°C
                       </div>
                     </div>
                  )}

                  {v.restricoesRegiao && (
                    <div className="px-5 pb-2">
                      <div className="bg-red-50 text-red-700 text-[11px] p-2 rounded-lg font-medium inline-flex items-center gap-2">
                        🚫 Restrição de Região: {v.restricoesRegiao}
                      </div>
                    </div>
                  )}
                  
                  {v.observacoesOperacionais && (
                    <div className="px-5 pb-4">
                      <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-orange-800 leading-relaxed">
                          <span className="font-bold">OBSERVAÇÕES:</span> {v.observacoesOperacionais}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ABA 4 - FINANCEIRO */}
          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Dados Bancários</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label className="text-xs">Banco</Label><Input value={p.banco || ""} onChange={(e) => handleChange('banco', e.target.value)} /></div>
                <div><Label className="text-xs">Agência</Label><Input value={p.agencia || ""} onChange={(e) => handleChange('agencia', e.target.value)} /></div>
                <div><Label className="text-xs">Conta</Label><Input value={p.conta || ""} onChange={(e) => handleChange('conta', e.target.value)} /></div>
                <div><Label className="text-xs">Dígito</Label><Input value={p.digito || ""} onChange={(e) => handleChange('digito', e.target.value)} /></div>
                <div><Label className="text-xs">Tipo de conta</Label>
                  <Select value={p.tipoConta || "Corrente"} onValueChange={(val) => handleChange('tipoConta', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Corrente">Corrente</SelectItem><SelectItem value="Poupança">Poupança</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Favorecido</Label><Input value={p.favorecido || ""} onChange={(e) => handleChange('favorecido', e.target.value)} /></div>
                <div><Label className="text-xs">CPF/CNPJ favorecido</Label><Input value={p.cpfCnpjFavorecido || ""} onChange={(e) => handleChange('cpfCnpjFavorecido', e.target.value)} /></div>
                <div><Label className="text-xs">Chave Pix</Label><Input value={p.chavePix || ""} onChange={(e) => handleChange('chavePix', e.target.value)} /></div>
                <div><Label className="text-xs">Tipo chave Pix</Label>
                  <Select value={p.tipoChavePix || ""} onValueChange={(val) => handleChange('tipoChavePix', val)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["CPF/CNPJ", "E-mail", "Telefone", "Aleatória"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Valores</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label className="text-xs">Diária</Label><Input type="number" value={p.valorDiaria || ""} onChange={(e) => handleChange('valorDiaria', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Km Excedente</Label><Input type="number" value={p.valorKm || ""} onChange={(e) => handleChange('valorKm', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Franquia KM</Label><Input type="number" value={p.franquiaKm || ""} onChange={(e) => handleChange('franquiaKm', e.target.value)} placeholder="km" /></div>
                <div><Label className="text-xs">Saída</Label><Input type="number" value={p.valorSaida || ""} onChange={(e) => handleChange('valorSaida', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Fixo mensal</Label><Input type="number" value={p.fixoMensal || ""} onChange={(e) => handleChange('fixoMensal', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Ajudante</Label><Input type="number" value={p.valorAjudante || ""} onChange={(e) => handleChange('valorAjudante', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Espera</Label><Input type="number" value={p.valorEspera || ""} onChange={(e) => handleChange('valorEspera', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Reentrega</Label><Input type="number" value={p.valorReentrega || ""} onChange={(e) => handleChange('valorReentrega', e.target.value)} placeholder="R$" /></div>
                <div><Label className="text-xs">Devolução</Label><Input type="number" value={p.valorDevolucao || ""} onChange={(e) => handleChange('valorDevolucao', e.target.value)} placeholder="R$" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Pagamento</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><Label className="text-xs">Periodicidade</Label>
                  <Select value={p.periodicidadePagamento || ""} onValueChange={(val) => handleChange('periodicidadePagamento', val)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["Semanal", "Quinzenal", "Mensal", "Por operação"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Prazo de pagamento</Label><Input value={p.prazoPagamento || ""} onChange={(e) => handleChange('prazoPagamento', e.target.value)} /></div>
                <div><Label className="text-xs">Forma preferencial</Label>
                  <Select value={p.formaPreferencialPagamento || ""} onValueChange={(val) => handleChange('formaPreferencialPagamento', val)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["Transferência", "Pix", "Boleto", "Depósito"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Conta contábil</Label><Input value={p.contaContabil || ""} onChange={(e) => handleChange('contaContabil', e.target.value)} /></div>
                <div><Label className="text-xs">Centro de custo</Label><Input value={p.centroCusto || ""} onChange={(e) => handleChange('centroCusto', e.target.value)} /></div>
                <div><Label className="text-xs">Retenções/Descontos</Label><Input value={p.retencoes || ""} onChange={(e) => handleChange('retencoes', e.target.value)} /></div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch checked={!!p.conferenciManual} onCheckedChange={(val) => handleChange('conferenciManual', val)} />
                  <Label className="text-xs">Conferência manual</Label>
                </div>
                <div className="md:col-span-2"><Label className="text-xs">Observações financeiras</Label><Textarea value={p.observacoesFinanceiras || ""} onChange={(e) => handleChange('observacoesFinanceiras', e.target.value)} rows={2} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 5 - QUALIDADE E HISTÓRICO */}
          <TabsContent value="qualidade" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Indicadores de Qualidade</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{p.scoreInterno?.toFixed(1) || "—"}</p>
                    <div className="flex justify-center mt-1">{renderStars(p.scoreInterno || 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Score interno</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{qtdEntregasReais ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Operações realizadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{p.indiceAceite || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Índice de aceite</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{p.indiceEntregaNoPrazo || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Entrega no prazo</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Índice de comparecimento</Label><p className="font-semibold">{p.indiceComparecimento || 0}%</p></div>
                  <div><Label className="text-xs">Avaliação operacional</Label><p className="text-sm">{p.avaliacaoOperacional || "—"}</p></div>
                </div>
              </CardContent>
            </Card>

            {p.historicoOcorrencias && p.historicoOcorrencias.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de Ocorrências</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-xs">Data</TableHead><TableHead className="text-xs">Descrição</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {p.historicoOcorrencias.map((o, i) => (
                        <TableRow key={i}><TableCell className="text-xs">{new Date(o.data).toLocaleDateString("pt-BR")}</TableCell><TableCell className="text-xs">{o.descricao}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {p.historicoBloqueios && p.historicoBloqueios.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Bloqueios e Reativações</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-xs">Data</TableHead><TableHead className="text-xs">Tipo</TableHead><TableHead className="text-xs">Motivo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {p.historicoBloqueios.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{new Date(b.data).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.tipo === "Bloqueio" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{b.tipo}</span></TableCell>
                          <TableCell className="text-xs">{b.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {p.historicoAlteracoes && p.historicoAlteracoes.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de Alterações</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Campo</TableHead>
                        <TableHead className="text-xs">Antes</TableHead>
                        <TableHead className="text-xs">Depois</TableHead>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.historicoAlteracoes.map((h, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">{h.campo}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.antes}</TableCell>
                          <TableCell className="text-xs">{h.depois}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.usuario}</TableCell>
                          <TableCell className="text-xs">{new Date(h.data).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="torre" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Painel de Controle</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{qtdEntregasReais ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Operacoes Hoje</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{p.indiceEntregaNoPrazo || 0}%</p>
                    <p className="text-xs text-muted-foreground">Entregas no Prazo</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{p.indiceComparecimento || 0}%</p>
                    <p className="text-xs text-muted-foreground">Comparecimento</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{p.indiceAceite || 0}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de Aceite</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Status e Disponibilidade</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Status</span>
                  <span className="text-sm">{STATUS_LABEL[normalizarStatusPrestador(p.status)] || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Disponibilidade</span>
                  <span className="text-sm text-muted-foreground">{p.disponibilidade || 'Nao definida'}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Turnos</span>
                  <span className="text-sm text-muted-foreground">{p.turnosPreferenciais || 'Nao definido'}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Regiao</span>
                  <span className="text-sm text-muted-foreground">{p.regiaoPrincipal || 'Nao definida'}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissoes" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Controle de Acesso do Aplicativo</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Estas permissões controlam o que o prestador pode visualizar e fazer no aplicativo mobile.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Ver Ordens de Serviço pertinentes", field: "podeVerOS", icon: List },
                  { label: "Aceitar serviços disponíveis", field: "podeAceitarServico", icon: Sparkles },
                  { label: "Ver valores e ganhos próprios", field: "podeVerValores", icon: CreditCard },
                  { label: "Ver histórico de viagens", field: "podeVerHistorico", icon: Truck },
                  { label: "Enviar documentos via app", field: "podeEnviarDocumentos", icon: Upload },
                  { label: "Atualizar dados cadastrais", field: "podeAtualizarCadastro", icon: Users },
                  { label: "Receber notificações push", field: "podeReceberNotificacoes", icon: Star },
                ].map((item) => (
                  <div key={item.field} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <item.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground">Acesso exclusivo ao perfil vinculado</span>
                      </div>
                    </div>
                    <Switch 
                      checked={!!(p.permissoes as any)?.[item.field]} 
                      onCheckedChange={(val) => setP(prev => ({ 
                        ...prev, 
                        permissoes: { ...prev.permissoes, [item.field]: val } 
                      }))} 
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ocorrencias" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Relatórios / Ocorrências</h3>
              <Button size="sm" className="gap-2" onClick={() => setModalOcorrenciaOpen(true)}><Plus className="w-4 h-4" /> Nova Ocorrência</Button>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gravidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registrado por</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ocorrenciasReais.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                          Nenhuma ocorrência registrada para este prestador.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ocorrenciasReais.map((o) => {
                        const grav = (o.severidade || o.gravidade || "") as string;
                        const registradoPor = o.metadata?.registrado_por || o.registrado_por || "—";
                        return (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs">{new Date(o.created_at || o.data).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs font-medium uppercase">{o.tipo}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              grav === "baixa" ? "text-green-600 border-green-200 bg-green-50" :
                              grav === "media" ? "text-yellow-600 border-yellow-200 bg-yellow-50" :
                              grav === "alta" ? "text-orange-600 border-orange-200 bg-orange-50" :
                              "text-red-600 border-red-200 bg-red-50"
                            }>
                              {grav.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{o.status}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{registradoPor}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">Ver Detalhes</Button>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA — PERFIL E PREFERÊNCIAS (Talent Intelligence) */}
          <TabsContent value="talent" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" /> Perfil e Preferências
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs font-semibold">Modalidade preferencial</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MODALIDADES_TALENT.map((modalidade) => {
                      const ativa = perfilTalento.modalidadePreferencial.includes(modalidade);
                      return (
                        <button
                          key={modalidade}
                          type="button"
                          onClick={() => toggleModalidadeTalento(modalidade)}
                          className={
                            ativa
                              ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                              : "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40"
                          }
                        >
                          {MODALIDADE_LABEL[modalidade] || modalidade}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Selecione uma ou mais modalidades aceitas pelo prestador.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold">Distância máxima de coleta (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={perfilTalento.distanciaMaxColetaKm}
                      onChange={(e) =>
                        setPerfilTalento((prev) => ({ ...prev, distanciaMaxColetaKm: e.target.value }))
                      }
                      placeholder="Ex.: 30"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                    <div>
                      <Label className="text-xs font-semibold">Aceita viagens</Label>
                      <p className="text-[11px] text-muted-foreground">Viagens fora da região base.</p>
                    </div>
                    <Switch
                      checked={perfilTalento.aceitaViagens}
                      onCheckedChange={(val) =>
                        setPerfilTalento((prev) => ({ ...prev, aceitaViagens: val }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Restrições operacionais (JSON)</Label>
                  <Textarea
                    value={perfilTalento.restricoesOperacionais}
                    onChange={(e) =>
                      setPerfilTalento((prev) => ({ ...prev, restricoesOperacionais: e.target.value }))
                    }
                    rows={4}
                    className="mt-1 font-mono text-xs"
                    placeholder='Ex.: { "nao_aceita_carga_perigosa": true }'
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Campo livre em JSON. Deixe vazio para limpar as restrições.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => void salvarPerfilTalento()}
                    disabled={!p.id || salvandoPerfilTalento || loadingTalento}
                    className="gap-2"
                  >
                    {salvandoPerfilTalento ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA — DISPONIBILIDADE */}
          <TabsContent value="disponibilidade" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-primary" /> Janelas de disponibilidade
                  </CardTitle>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={adicionarJanelaTalento}>
                    <Plus className="h-4 w-4" /> Adicionar janela
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingTalento ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando disponibilidade...
                  </div>
                ) : disponibilidadeTalento.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma janela cadastrada. Adicione os dias e horários aceitos pelo prestador.
                  </p>
                ) : (
                  disponibilidadeTalento.map((janela) => (
                    <div
                      key={janela.key}
                      className="grid grid-cols-1 items-end gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                    >
                      <div>
                        <Label className="text-[11px] font-semibold">Dia</Label>
                        <Select
                          value={janela.diaSemana}
                          onValueChange={(val) =>
                            setDisponibilidadeTalento((prev) =>
                              prev.map((j) => (j.key === janela.key ? { ...j, diaSemana: val } : j)),
                            )
                          }
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIAS_SEMANA_TALENT.map((dia, idx) => (
                              <SelectItem key={dia} value={String(idx)}>
                                {dia}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold">Início</Label>
                        <Input
                          type="time"
                          value={janela.horaInicio}
                          onChange={(e) =>
                            setDisponibilidadeTalento((prev) =>
                              prev.map((j) =>
                                j.key === janela.key ? { ...j, horaInicio: e.target.value } : j,
                              ),
                            )
                          }
                          className="mt-1 h-9 w-[110px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold">Fim</Label>
                        <Input
                          type="time"
                          value={janela.horaFim}
                          onChange={(e) =>
                            setDisponibilidadeTalento((prev) =>
                              prev.map((j) =>
                                j.key === janela.key ? { ...j, horaFim: e.target.value } : j,
                              ),
                            )
                          }
                          className="mt-1 h-9 w-[110px]"
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1 pb-1">
                        <Label className="text-[11px] font-semibold">Ativa</Label>
                        <Switch
                          checked={janela.disponivel}
                          onCheckedChange={(val) =>
                            setDisponibilidadeTalento((prev) =>
                              prev.map((j) =>
                                j.key === janela.key ? { ...j, disponivel: val } : j,
                              ),
                            )
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setDisponibilidadeTalento((prev) => prev.filter((j) => j.key !== janela.key))
                        }
                        aria-label="Remover janela"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={() => void salvarDisponibilidadeTalento()}
                    disabled={!p.id || salvandoDisponibilidade || loadingTalento}
                    className="gap-2"
                  >
                    {salvandoDisponibilidade ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar disponibilidade
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA — AVALIAÇÃO SITUACIONAL */}
          <TabsContent value="avaliacao_situacional" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ClipboardCheck className="h-4 w-4 text-primary" /> Avaliações situacionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingTalento ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando avaliações...
                  </div>
                ) : avaliacoesTalento.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma avaliação situacional registrada para este prestador.
                  </p>
                ) : (
                  avaliacoesTalento.map((avaliacao) => (
                    <div key={avaliacao.id} className="space-y-2 rounded-lg border border-border/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-foreground">{avaliacao.cenarioTitulo}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {avaliacao.competencia || "Competência não informada"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {avaliacao.pontuacao !== null && (
                            <Badge
                              variant="outline"
                              className={
                                avaliacao.pontuacao >= 70
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : avaliacao.pontuacao >= 40
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-red-200 bg-red-50 text-red-700"
                              }
                            >
                              {avaliacao.pontuacao.toFixed(1)} pts
                            </Badge>
                          )}
                          {avaliacao.createdAt && (
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(avaliacao.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      {avaliacao.descricaoSituacao && (
                        <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                          {avaliacao.descricaoSituacao}
                        </p>
                      )}
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Resposta do candidato
                        </p>
                        <p className="mt-1 text-sm text-foreground">{avaliacao.resposta || "—"}</p>
                      </div>
                      {avaliacao.analise ? (
                        <details className="rounded-md border border-border/50 bg-muted/20 p-2">
                          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Análise IA
                          </summary>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                            {JSON.stringify(avaliacao.analise, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
      
      {/* BARRA FIXA INFERIOR */}
      <div className="fixed bottom-0 right-0 left-0 lg:left-64 bg-background/80 backdrop-blur-md border-t z-50 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-none flex justify-end items-center gap-3">
          <Button variant="outline" onClick={() => {
            if (isDirty) {
              setShowDiscardDialog(true);
            } else {
              onBack();
            }
          }} disabled={isLoading}>
            Cancelar / Voltar
          </Button>
          <Button className="min-w-[120px] shadow-lg shadow-primary/20" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Prestador"
            )}
          </Button>
        </div>
      </div>

      <div className="h-20" /> {/* Spacer para não esconder conteúdo atrás da barra */}

      {modalContratoOpen && (
         <ContratoPrestadorModal
            open={modalContratoOpen}
            onOpenChange={setModalContratoOpen}
            prestador={p as any}
         />
      )}

      <Dialog open={modalVeiculoOpen} onOpenChange={setModalVeiculoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{modoEdicaoVeiculo === "editar" ? "Editar Veículo do Prestador" : "Cadastro de Veículo do Prestador"}</DialogTitle>
                <p className="text-sm text-muted-foreground">Informe os dados operacionais, capacidade e documentação do veículo.</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Bloco 1: Identificação do Veículo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Identificação do Veículo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Placa *</Label>
                  <Input
                    value={novoVeiculo.placa || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                    placeholder="ABC-1234"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Veículo</Label>
                  <Select
                    value={novoVeiculo.tipoVeiculo || ""}
                    onValueChange={(val) => setNovoVeiculo(prev => ({ ...prev, tipoVeiculo: val as TipoVeiculo }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo de veículo" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_VEICULO_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ano</Label>
                  <Input
                    type="number"
                    value={novoVeiculo.ano || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, ano: parseInt(e.target.value) || 2024 }))}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Marca</Label>
                  <Input
                    value={novoVeiculo.marca || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, marca: e.target.value }))}
                    placeholder="Ex: Fiat"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    value={novoVeiculo.modelo || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, modelo: e.target.value }))}
                    placeholder="Ex: Fiorino"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Proprietário e Documentação */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <FileSignature className="w-4 h-4" /> Proprietário e Documentação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Proprietário (Nome)</Label>
                  <Input
                    value={novoVeiculo.proprietario || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, proprietario: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">CPF/CNPJ Proprietário</Label>
                  <Input
                    value={novoVeiculo.cpfCnpjProprietario || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, cpfCnpjProprietario: e.target.value }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">RENAVAM</Label>
                  <Input
                    value={novoVeiculo.renavam || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, renavam: e.target.value }))}
                    placeholder="Nº RENAVAM"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">ANTT</Label>
                  <Input
                    value={novoVeiculo.antt || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, antt: e.target.value }))}
                    placeholder="Nº ANTT"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 3: Capacidade e Dimensões */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Capacidade e Dimensões
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Capacidade (kg)</Label>
                  <Input
                    type="number"
                    value={novoVeiculo.capacidadeKg || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, capacidadeKg: parseInt(e.target.value) || 0 }))}
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Capacidade (m³)</Label>
                  <Input
                    type="number"
                    value={novoVeiculo.capacidadeM3 || ""}
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, capacidadeM3: parseInt(e.target.value) || 0 }))}
                    placeholder="10"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Comp. (m)</Label>
                    <Input type="number" step="0.1" placeholder="4.0" onChange={(e) => setNovoVeiculo(prev => ({ ...prev, comprimento: parseFloat(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Larg. (m)</Label>
                    <Input type="number" step="0.1" placeholder="2.0" onChange={(e) => setNovoVeiculo(prev => ({ ...prev, largura: parseFloat(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Alt. (m)</Label>
                    <Input type="number" step="0.1" placeholder="2.0" onChange={(e) => setNovoVeiculo(prev => ({ ...prev, altura: parseFloat(e.target.value) }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 4: Refrigeração / Tipo de Carga */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Refrigeração / Tipo de Carga
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Carga</Label>
                  <Select onValueChange={(val) => setNovoVeiculo(prev => ({ ...prev, tipoCarga: val as any }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="congelado">Congelado</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Temp. Mínima (°C)</Label>
                  <Input type="number" step="1" placeholder="13" onChange={(e) => setNovoVeiculo(prev => ({ ...prev, tempMin: parseInt(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Temp. Máxima (°C)</Label>
                  <Input type="number" step="1" placeholder="16" onChange={(e) => setNovoVeiculo(prev => ({ ...prev, tempMax: parseInt(e.target.value) }))} />
                </div>
              </div>
            </div>

            {/* Bloco 5: Rastreador, Seguro e Restrições */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Rastreador, Seguro e Restrições
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-6 p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Switch onCheckedChange={(val) => setNovoVeiculo(prev => ({ ...prev, rastreador: val ? "Sim" : "" }))} />
                    <Label className="text-sm">Rastreador</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch onCheckedChange={(val) => setNovoVeiculo(prev => ({ ...prev, possuiSeguro: val }))} />
                    <Label className="text-sm">Seguro</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Restrições de Região</Label>
                  <Input
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, restricoesRegiao: e.target.value }))}
                    placeholder="Ex: Não atende Centro SP..."
                  />
                </div>
                <div className="col-span-full space-y-2">
                  <Label className="text-xs">Observações Operacionais</Label>
                  <Textarea 
                    onChange={(e) => setNovoVeiculo(prev => ({ ...prev, observacoesOperacionais: e.target.value }))}
                    placeholder="Ex: Cuidados específicos com carga, preferências de rota..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background p-4 -mx-6 -mb-4">
            <Button variant="outline" className="flex-1" onClick={() => setModalVeiculoOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={() => modoEdicaoVeiculo === "editar" ? handleUpdateVeiculo(novoVeiculo) : handleAddVeiculo(novoVeiculo)} disabled={!novoVeiculo.placa || !novoVeiculo.tipoVeiculo}>
              <Truck className="w-4 h-4 mr-2" /> {modoEdicaoVeiculo === "editar" ? "Atualizar Veículo" : "Salvar Veículo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={modalOcorrenciaOpen} onOpenChange={setModalOcorrenciaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Ocorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={novaOcorrencia.data} onChange={e => setNovaOcorrencia({ ...novaOcorrencia, data: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={novaOcorrencia.tipo} onValueChange={val => setNovaOcorrencia({ ...novaOcorrencia, tipo: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Atraso">Atraso</SelectItem>
                    <SelectItem value="Falta">Falta</SelectItem>
                    <SelectItem value="Avaria">Avaria</SelectItem>
                    <SelectItem value="Reclamação">Reclamação</SelectItem>
                    <SelectItem value="Elogio">Elogio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gravidade</Label>
                <Select value={novaOcorrencia.gravidade} onValueChange={val => setNovaOcorrencia({ ...novaOcorrencia, gravidade: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Detalhes da ocorrência..." value={novaOcorrencia.descricao} onChange={e => setNovaOcorrencia({ ...novaOcorrencia, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Registrado por</Label>
              <Input value={novaOcorrencia.registradoPor} onChange={e => setNovaOcorrencia({ ...novaOcorrencia, registradoPor: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOcorrenciaOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              const prestadorId = p.id;
              if (!prestadorId) {
                toast.warning("Salve o prestador primeiro para registrar ocorrências.");
                setModalOcorrenciaOpen(false);
                return;
              }

              try {
                const payloadOcorrencia = {
                  prestador_id: prestadorId,
                  prestador: p.nomeCompleto || null,
                  tipo: novaOcorrencia.tipo,
                  severidade: novaOcorrencia.gravidade,
                  status: 'pendente',
                  descricao: novaOcorrencia.descricao,
                  metadata: {
                    data: novaOcorrencia.data || new Date().toISOString().split('T')[0],
                    registrado_por: novaOcorrencia.registradoPor || 'Sistema',
                  },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                const { data: ocorrenciaResult, error: ocorrenciaError } = await supabase
                  .from('ocorrencias')
                  .insert(payloadOcorrencia)
                  .select();

                if (ocorrenciaError) {
                  console.error("Erro ao salvar ocorrência:", ocorrenciaError);
                  if (ocorrenciaError.message.includes('does not exist') || ocorrenciaError.code === 'PGRST116') {
                    toast.error("Tabela de ocorrências não encontrada. Configure o banco de dados.");
                  } else {
                    toast.warning("Erro ao salvar ocorrência no banco: " + ocorrenciaError.message);
                  }
                } else if (!ocorrenciaResult || ocorrenciaResult.length === 0) {
                  toast.error("Nenhuma ocorrência foi salva. Verifique permissões e tente novamente.");
                } else {
                  // Releitura: buscar ocorrências reais do banco após INSERT confirmado
                  const { data: refreshed } = await supabase
                    .from("ocorrencias")
                    .select("*")
                    .eq("prestador_id", prestadorId)
                    .order("created_at", { ascending: false });
                  setOcorrenciasReais(refreshed || []);
                  toast.success("Ocorrência salva com sucesso!");
                }
              } catch (error) {
                console.error("Erro ao salvar ocorrência:", error);
                toast.error("Erro ao salvar ocorrência");
              }
              
              setModalOcorrenciaOpen(false);
            }}>
              Salvar Ocorrência
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DISCARD CHANGES DIALOG */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterações não salvas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Você tem alterações não salvas. Deseja salvar como rascunho e sair, ou descartar as alterações?
          </p>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={handleCancelClick}>
              Continuar editando
            </Button>
            <Button variant="destructive" onClick={handleDiscardClick}>
              Descartar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrestadorDetalhe;

import { useState } from "react";
import { ArrowLeft, Star, FileSignature, Upload, Plus, Trash2, Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "./types";
import { DocumentoAnalyzer } from "@/components/documentos/AnaliseDocumentoIA";
import ContratoPrestadorModal from "./ContratoPrestadorModal";

interface Props {
  prestador?: Prestador;
  onBack: () => void;
}

const DOC_STATUS_STYLE: Record<StatusDocumento, string> = {
  valido: "bg-green-100 text-green-700",
  vencendo: "bg-yellow-100 text-yellow-700",
  vencido: "bg-red-100 text-red-700",
  pendente: "bg-gray-100 text-gray-600",
};
const DOC_STATUS_LABEL: Record<StatusDocumento, string> = {
  valido: "Válido", vencendo: "Vencendo", vencido: "Vencido", pendente: "Pendente",
};

const DOCS_TIPOS = [
  "CNH Frente", "CNH Verso", "Documento Pessoal", "Comprovante de Residência",
  "Comprovante Bancário", "Contrato", "CRLV", "Documento do Veículo", "ANTT",
  "Apólice de Seguro", "Outros",
];

const renderStars = (score: number, size = "w-5 h-5") => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`${size} ${s <= Math.round(score) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
    ))}
  </div>
);

const fmt = (v?: number) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const PrestadorDetalhe = ({ prestador: initial, onBack }: Props) => {
  const isNew = !initial;
  const [p, setP] = useState<Partial<Prestador>>(initial || {
    status: "analise",
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
  } as Partial<Prestador>);
  const [isLoading, setIsLoading] = useState(false);
  const [docToAnalyze, setDocToAnalyze] = useState<string | null>(null);
  const [modalContratoOpen, setModalContratoOpen] = useState(false);

  // Helper to handle input changes
  const handleChange = (field: keyof Prestador, value: any) => {
    setP(prev => ({ ...prev, [field]: value }));
  };

  const handleChangeAddress = (field: string, value: string) => {
    setP(prev => ({ ...prev, endereco: { ...prev.endereco, [field]: value } as any }));
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      // Ensure we have an ID for updates, or let Supabase generate one for inserts
      const isUpdate = !!initial?.id;
      const dataToSave = { ...p };
      
      let query;
      if (isUpdate) {
        query = supabase.from('prestadores').update(dataToSave).eq('id', p.id);
      } else {
        query = supabase.from('prestadores').insert([dataToSave]);
      }

      const { error } = await query;
      
      if (error) throw error;
      
      toast.success(isNew ? "Prestador cadastrado com sucesso!" : "Prestador atualizado com sucesso!");
      onBack();
    } catch (error) {
      console.error("Erro ao salvar prestador:", error);
      toast.error("Erro ao salvar dados no Supabase. Verifique a configuração da rede ou do banco de dados.");
    } finally {
      setIsLoading(false);
    }
  };

  const docGeral = () => {
    if (!p.documentos?.length) return { label: "Pendente ⚠️", cls: "bg-yellow-100 text-yellow-700" };
    if (p.documentos.some((d) => d.status === "vencido")) return { label: "Vencido 🔴", cls: "bg-red-100 text-red-700" };
    if (p.documentos.some((d) => d.status === "pendente" || d.status === "vencendo")) return { label: "Pendente ⚠️", cls: "bg-yellow-100 text-yellow-700" };
    return { label: "Completo ✅", cls: "bg-green-100 text-green-700" };
  };

  return (
    <div className="space-y-4">
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
              Modelos de Contrato
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Abas principais */}
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
            <TabsTrigger value="documentacao">Documentação</TabsTrigger>
            <TabsTrigger value="veiculos">Veículos</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          </TabsList>

          {/* ABA 1 - DADOS GERAIS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><Label className="text-xs">Nome completo / Razão social</Label><Input defaultValue={p.nomeCompleto} /></div>
                <div><Label className="text-xs">Nome fantasia</Label><Input defaultValue={p.nomeFantasia} /></div>
                <div><Label className="text-xs">CPF / CNPJ</Label><Input defaultValue={p.cpfCnpj} /></div>
                <div><Label className="text-xs">RG / IE</Label><Input defaultValue={p.rgIe} /></div>
                <div><Label className="text-xs">Data de nascimento</Label><Input type="date" defaultValue={p.dataNascimento} /></div>
                <div><Label className="text-xs">Telefone principal</Label><Input defaultValue={p.telefone} /></div>
                <div><Label className="text-xs">WhatsApp</Label><Input defaultValue={p.whatsapp} /></div>
                <div><Label className="text-xs">E-mail</Label><Input defaultValue={p.email} /></div>
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
                  {(Object.entries(STATUS_LABEL) as [StatusPrestador, string][]).map(([key, label]) => (
                    <label key={key} onClick={() => handleChange('status', key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${p.status === key ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:bg-muted"}`}>
                      <div className={`w-3 h-3 rounded-full ${STATUS_COR[key].split(" ")[0]}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><Label className="text-xs">CEP</Label><Input defaultValue={p.endereco?.cep} placeholder="00000-000" /></div>
                <div className="lg:col-span-2"><Label className="text-xs">Rua</Label><Input defaultValue={p.endereco?.rua} /></div>
                <div><Label className="text-xs">Número</Label><Input defaultValue={p.endereco?.numero} /></div>
                <div><Label className="text-xs">Complemento</Label><Input defaultValue={p.endereco?.complemento} /></div>
                <div><Label className="text-xs">Bairro</Label><Input defaultValue={p.endereco?.bairro} /></div>
                <div><Label className="text-xs">Cidade</Label><Input defaultValue={p.endereco?.cidade} /></div>
                <div><Label className="text-xs">Estado</Label><Input defaultValue={p.endereco?.estado} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Região e Operação</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Região principal</Label>
                  <Select defaultValue={p.regiaoPrincipal}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["Grande SP", "ABC Paulista", "Interior SP", "Litoral SP", "Rio de Janeiro", "Belo Horizonte", "Paraná", "Santa Catarina"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Regiões secundárias</Label><Input defaultValue={p.regioesSecundarias?.join(", ")} /></div>
                <div><Label className="text-xs">Origem do cadastro</Label><Input defaultValue={p.origemCadastro} /></div>
                <div><Label className="text-xs">Indicação</Label><Input defaultValue={p.indicacao} /></div>
                <div><Label className="text-xs">Disponibilidade padrão</Label><Input defaultValue={p.disponibilidade} /></div>
                <div><Label className="text-xs">Turnos preferenciais</Label><Input defaultValue={p.turnosPreferenciais} /></div>
                <div className="md:col-span-2"><Label className="text-xs">Restrições operacionais</Label><Textarea defaultValue={p.restricoesOperacionais} rows={2} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Preferências</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Aceita refrigerada", field: "aceitaRefrigerada", val: p.aceitaRefrigerada },
                  { label: "Aceita urbana", field: "aceitaUrbana", val: p.aceitaUrbana },
                  { label: "Aceita dedicada", field: "aceitaDedicada", val: p.aceitaDedicada },
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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DOC_STATUS_STYLE[doc?.status || "pendente"]}`}>
                          {DOC_STATUS_LABEL[doc?.status || "pendente"]}
                        </span>
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
                              handleChange("dataValidadeCNH" as any, validade);
                            }
                            setDocToAnalyze(null);
                          }}
                        />
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <Upload className="w-3 h-3" /> Upload
                        </Button>
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
              <span className="text-sm font-medium">{p.veiculos?.length || 0} veículo(s) vinculado(s)</span>
              <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Adicionar Veículo</Button>
            </div>
            {(p.veiculos || []).map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{v.marca} {v.modelo} ({v.ano})</p>
                      <p className="text-xs text-muted-foreground">Placa: {v.placa} • {TIPO_VEICULO_LABEL[v.tipoVeiculo]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${v.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {v.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div><Label className="text-xs">Tipo</Label>
                      <Select defaultValue={v.tipoVeiculo}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(TIPO_VEICULO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Subcategoria</Label><Input className="h-8 text-xs" defaultValue={v.subcategoria} /></div>
                    <div><Label className="text-xs">Carroceria</Label><Input className="h-8 text-xs" defaultValue={v.tipoCarroceria} /></div>
                    <div><Label className="text-xs">Térmico</Label><Input className="h-8 text-xs" defaultValue={v.classificacaoTermica} /></div>
                    <div><Label className="text-xs">RENAVAM</Label><Input className="h-8 text-xs" defaultValue={v.renavam} /></div>
                    <div><Label className="text-xs">Cor</Label><Input className="h-8 text-xs" defaultValue={v.cor} /></div>
                    <div><Label className="text-xs">Capacidade (kg)</Label><Input className="h-8 text-xs" type="number" defaultValue={v.capacidadeKg} /></div>
                    <div><Label className="text-xs">Capacidade (m³)</Label><Input className="h-8 text-xs" type="number" defaultValue={v.capacidadeM3} /></div>
                    <div><Label className="text-xs">Comprimento (m)</Label><Input className="h-8 text-xs" type="number" defaultValue={v.comprimento} /></div>
                    <div><Label className="text-xs">Largura (m)</Label><Input className="h-8 text-xs" type="number" defaultValue={v.largura} /></div>
                    <div><Label className="text-xs">Altura (m)</Label><Input className="h-8 text-xs" type="number" defaultValue={v.altura} /></div>
                    <div><Label className="text-xs">Pallets</Label><Input className="h-8 text-xs" type="number" defaultValue={v.qtdPallets} /></div>
                    <div><Label className="text-xs">Proprietário</Label><Input className="h-8 text-xs" defaultValue={v.proprietario} /></div>
                    <div><Label className="text-xs">Rastreador</Label><Input className="h-8 text-xs" defaultValue={v.rastreador} /></div>
                    <div><Label className="text-xs">Seguradora</Label><Input className="h-8 text-xs" defaultValue={v.seguradora} /></div>
                    <div><Label className="text-xs">Val. documental</Label><Input className="h-8 text-xs" type="date" defaultValue={v.validadeDocumental} /></div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs"><Camera className="w-3 h-3" /> Fotos do veículo</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ABA 4 - FINANCEIRO */}
          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Dados Bancários</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label className="text-xs">Banco</Label><Input defaultValue={p.banco} /></div>
                <div><Label className="text-xs">Agência</Label><Input defaultValue={p.agencia} /></div>
                <div><Label className="text-xs">Conta</Label><Input defaultValue={p.conta} /></div>
                <div><Label className="text-xs">Dígito</Label><Input defaultValue={p.digito} /></div>
                <div><Label className="text-xs">Tipo de conta</Label>
                  <Select defaultValue={p.tipoConta || "Corrente"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Corrente">Corrente</SelectItem><SelectItem value="Poupança">Poupança</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Favorecido</Label><Input defaultValue={p.favorecido} /></div>
                <div><Label className="text-xs">CPF/CNPJ favorecido</Label><Input defaultValue={p.cpfCnpjFavorecido} /></div>
                <div><Label className="text-xs">Chave Pix</Label><Input defaultValue={p.chavePix} /></div>
                <div><Label className="text-xs">Tipo chave Pix</Label>
                  <Select defaultValue={p.tipoChavePix || ""}>
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
                {[
                  { label: "Diária", val: p.valorDiaria },
                  { label: "Km", val: p.valorKm },
                  { label: "Saída", val: p.valorSaida },
                  { label: "Fixo mensal", val: p.fixoMensal },
                  { label: "Ajudante", val: p.valorAjudante },
                  { label: "Espera", val: p.valorEspera },
                  { label: "Reentrega", val: p.valorReentrega },
                  { label: "Devolução", val: p.valorDevolucao },
                ].map((v) => (
                  <div key={v.label}><Label className="text-xs">{v.label}</Label><Input type="number" defaultValue={v.val} placeholder="R$" /></div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Pagamento</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><Label className="text-xs">Periodicidade</Label>
                  <Select defaultValue={p.periodicidadePagamento || ""}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["Semanal", "Quinzenal", "Mensal", "Por operação"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Prazo de pagamento</Label><Input defaultValue={p.prazoPagamento} /></div>
                <div><Label className="text-xs">Forma preferencial</Label>
                  <Select defaultValue={p.formaPreferencialPagamento || ""}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["Transferência", "Pix", "Boleto", "Depósito"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Conta contábil</Label><Input defaultValue={p.contaContabil} /></div>
                <div><Label className="text-xs">Centro de custo</Label><Input defaultValue={p.centroCusto} /></div>
                <div><Label className="text-xs">Retenções/Descontos</Label><Input defaultValue={p.retencoes} /></div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch checked={!!p.conferenciManual} onCheckedChange={(val) => handleChange('conferenciManual', val)} />
                  <Label className="text-xs">Conferência manual</Label>
                </div>
                <div className="md:col-span-2"><Label className="text-xs">Observações financeiras</Label><Textarea defaultValue={p.observacoesFinanceiras} rows={2} /></div>
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
                    <p className="text-3xl font-bold">{p.qtdOperacoes || 0}</p>
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
        </Tabs>

        {/* CARD LATERAL */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="relative mb-3">
                <Avatar className="w-28 h-28 border-4 border-muted">
                  <AvatarFallback className="text-2xl bg-muted">{p.nomeCompleto?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}</AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              {p.status && (
                <div className="flex flex-col items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold mb-1 ${STATUS_COR[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.observacoesTorre?.includes("Contrato") && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 gap-1 text-[10px] uppercase font-bold hover:bg-blue-100 mb-2">
                       <FileSignature className="w-3 h-3"/> Contrato Ativo
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 mb-1">{renderStars(p.scoreInterno || 0, "w-5 h-5")}</div>
              <p className="text-xs text-muted-foreground">{p.scoreInterno?.toFixed(1) || "0"} / 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Desde</span><span className="text-xs font-medium">{p.dataCadastro ? new Date(p.dataCadastro).toLocaleDateString("pt-BR") : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Aprovação</span><span className="text-xs font-medium">{p.dataAprovacao ? new Date(p.dataAprovacao).toLocaleDateString("pt-BR") : "Pendente"}</span></div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avaliação operacional</p>
                <div className="flex items-center gap-1">{renderStars(p.scoreInterno || 0, "w-4 h-4")}</div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observações da Torre de Controle</p>
                <Textarea defaultValue={p.observacoesTorre} rows={3} className="text-xs" />
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Última atualização</span>
                <span className="text-xs">{p.ultimaAtualizacao ? new Date(p.ultimaAtualizacao).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Por</span>
                <span className="text-xs">{p.ultimoUsuario || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {p.historicoAlteracoes && p.historicoAlteracoes.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Últimas alterações</CardTitle></CardHeader>
              <CardContent className="p-3 space-y-2">
                {p.historicoAlteracoes.slice(0, 5).map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-primary/30 pl-2">
                    <p className="font-medium">{h.campo}: {h.depois}</p>
                    <p className="text-muted-foreground">{new Date(h.data).toLocaleDateString("pt-BR")} — {h.usuario}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {modalContratoOpen && (
         <ContratoPrestadorModal
            open={modalContratoOpen}
            onOpenChange={setModalContratoOpen}
            prestador={p}
         />
      )}
    </div>
  );
};

export default PrestadorDetalhe;

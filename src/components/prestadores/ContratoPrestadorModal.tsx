import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileSignature, Download, Loader2, Edit3, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLogo } from "@/hooks/useLogo";
import { buscarModelosContratos, criarContrato, gerarHashDocumento } from "@/services/contratosService";
import { generateContractPDF, generateContractPDFBase64 } from "@/services/contratosPdfService";
import { ContratoModelo } from "@/services/contratosService";

const EMPRESA_NOME = "Conexão Express Transportes LTDA";
const EMPRESA_CNPJ_CORRETO = "31.227.975/0001-80";
const EMPRESA_ENDERECO = "Avenida Goitacazes, nº 45, Sala 22, São Caetano do Sul/SP";

function getPrestadorDocumento(p: any): string {
  return p?.cpf_cnpj || p?.cpfCnpj || p?.cpf || p?.cnpj || p?.documento || p?.rg || "";
}

function getPrestadorTelefone(p: any): string {
  return p?.telefone || p?.telefone_principal || p?.telefonePrincipal || p?.whatsapp || p?.celular || "";
}

function formatarCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}

function formatCurrency(v: any): string {
  if (v === undefined || v === null || v === '' || v === 0) return "A DEFINIR";
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatNumber(v: any, suffix = ""): string {
  if (v === undefined || v === null || v === '') return "Não informado";
  return `${v}${suffix}`;
}

export default function ContratoPrestadorModal({
  open,
  onOpenChange,
  prestador
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  prestador: any
}) {
  const [loading, setLoading] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [modelos, setModelos] = useState<ContratoModelo[]>([]);
  const [selectedModeloId, setSelectedModeloId] = useState("");
  const [content, setContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [numeroContrato, setNumeroContrato] = useState("");
  const [hashDocumento, setHashDocumento] = useState("");
  const [veiculoData, setVeiculoData] = useState<any>(null);
  const { config, getLogo, getNomeFantasia } = useLogo();

  useEffect(() => {
    if (open && prestador?.id) {
      carregarModelos();
      gerarNumero();
      carregarVeiculo();
    }
  }, [open, prestador?.id]);

  useEffect(() => {
    if (open) {
      setContent("");
      setSelectedModeloId("");
      setHashDocumento("");
    }
  }, [open]);

  const carregarVeiculo = async () => {
    if (!prestador?.id) return;
    try {
      const { data } = await supabase
        .from('veiculos')
        .select('*')
        .eq('prestador_vinculado', prestador.id)
        .limit(1)
        .single();
      if (data) {
        setVeiculoData(data);
      }
    } catch {
      // fallback: usar veiculos do objeto prestador
      console.log("[ContratoModal] Veículo não encontrado no banco, usando fallback local");
    }
  };

  const carregarModelos = async () => {
    setLoadingModelos(true);
    try {
      const modelosDb = await buscarModelosContratos();
      if (modelosDb.length > 0) {
        setModelos(modelosDb);
      } else {
        await inserirModeloTAC();
        const novos = await buscarModelosContratos();
        setModelos(novos);
      }
    } catch (e) {
      console.error("[ContratoModal] Erro ao carregar modelos:", e);
      toast.error("Erro ao carregar modelos de contrato.");
    } finally {
      setLoadingModelos(false);
    }
  };

  const inserirModeloTAC = async () => {
    try {
      const { data, error } = await supabase.from('contratos_modelos').insert([{
        nome: "Contrato TAC/ETC — Prestador Transporte",
        tipo: "Prestador",
        conteudo_base: `CONTRATO DE TRANSPORTE AUTÔNOMO DE CARGA - TAC/ETC

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}
ENDEREÇO: {{empresa_endereco}}

CONTRATADO: {{prestador_nome}}
{{prestador_documento}}
RNTRC/ANTT: {{prestador_rntrc}}
ENDEREÇO: {{prestador_endereco_completo}}
TELEFONE: {{prestador_telefone}}
WHATSAPP: {{prestador_whatsapp}}
E-MAIL: {{prestador_email}}

VEÍCULO: {{veiculo_placa}} - {{veiculo_marca}} {{veiculo_modelo}}
Tipo: {{veiculo_tipo}}
Carga: {{veiculo_tipo_carga}}
Capacidade: {{veiculo_capacidade_kg}} / {{veiculo_capacidade_m3}}

CONDIÇÕES COMERCIAIS:
Valor Saída: {{valor_saida}}
Valor Diária: {{valor_diaria}}
Franquia KM: {{franquia_km}}
Valor KM Excedente: {{valor_km_excedente}}

DADOS BANCÁRIOS:
Banco: {{banco}}
Agência: {{agencia}}
Conta: {{conta}}
Chave PIX: {{chave_pix}}
Favorecido: {{favorecido}}

PAGAMENTO:
Forma: {{forma_pagamento}}
Periodicidade: {{periodicidade_pagamento}}
Prazo: {{prazo_pagamento}}

DATA: {{data_atual}}
NÚMERO: {{numero_contrato}}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem como objeto a prestação de serviços de transporte de cargas pelo Contratado, utilizando veículo próprio ou agregado, em regime de execução autônoma, nos termos da Lei 11.442/2007 (ANTT) e regulamentações da ETC/EFF.

CLÁUSULA 2ª - DAS OBRIGAÇÕES DO CONTRATADO
2.1 - Realizar o transporte com diligência e segurança, zelando pela integridade da carga.
2.2 - Manter o veículo em perfeito estado de conservação e com documentação regular (CRLV, seguro, RNTRC).
2.3 - Cumprir rigorosamente os prazos e rotas acordadas.
2.4 - Responsabilizar-se civil e criminalmente pela carga transportada.

CLÁUSULA 3ª - DO VALOR E PAGAMENTO
3.1 - O Contratante pagará ao Contratado o valor de {{valor_saida}} por viagem/saída realizada.
3.2 - Pagamento: {{forma_pagamento}} | Periodicidade: {{periodicidade_pagamento}} | Prazo: {{prazo_pagamento}}
3.3 - Dados bancários: Banco {{banco}}, Agência {{agencia}}, Conta {{conta}}, Pix {{chave_pix}}

CLÁUSULA 4ª - DO VÍNCULO
4.1 - O presente contrato não gera vínculo empregatício entre as partes.

CLÁUSULA 5ª - DO ACEITE ELETRÔNICO
5.1 - O aceite deste contrato via WhatsApp ou assinatura eletrônica tem valor jurídico.

CLÁUSULA 6ª - DO FORO
6.1 - Fica eleito o foro da Comarca de São Caetano do Sul/SP.

HASH DE VALIDAÇÃO: {{hash_documento}}`,
        variaveis: [
          "{{empresa_nome}}", "{{empresa_cnpj}}", "{{empresa_endereco}}",
          "{{prestador_nome}}", "{{prestador_documento}}", "{{prestador_rntrc}}",
          "{{prestador_endereco_completo}}", "{{prestador_telefone}}", "{{prestador_whatsapp}}", "{{prestador_email}}",
          "{{veiculo_placa}}", "{{veiculo_marca}}", "{{veiculo_modelo}}", "{{veiculo_tipo}}",
          "{{veiculo_tipo_carga}}", "{{veiculo_capacidade_kg}}", "{{veiculo_capacidade_m3}}",
          "{{valor_saida}}", "{{valor_diaria}}", "{{franquia_km}}", "{{valor_km_excedente}}",
          "{{banco}}", "{{agencia}}", "{{conta}}", "{{chave_pix}}", "{{favorecido}}",
          "{{forma_pagamento}}", "{{periodicidade_pagamento}}", "{{prazo_pagamento}}",
          "{{data_atual}}", "{{numero_contrato}}", "{{hash_documento}}"
        ],
        ativa: true,
      }]).select();

      if (error) {
        console.error('[ContratoModal] Erro ao inserir modelo TAC:', error);
      }
    } catch (e) {
      console.error("[ContratoModal] Erro ao inserir modelo TAC:", e);
    }
  };

  const gerarNumero = async () => {
    try {
      const { data } = await supabase
        .from('contratos_gerados')
        .select('numero_contrato')
        .order('numero_contrato', { ascending: false })
        .limit(1);

      const BASE = 869;
      let next = BASE;
      if (data && data.length > 0) {
        const lastNum = parseInt(data[0].numero_contrato.split('-').pop() || "0");
        next = Math.max(BASE, lastNum + 1);
      }
      const ano = new Date().getFullYear();
      setNumeroContrato(`CTR-${ano}-${String(next).padStart(6, '0')}`);
    } catch {
      setNumeroContrato(`CTR-${new Date().getFullYear()}-000869`);
    }
  };

  const modelosFiltrados = modelos;

  useEffect(() => {
    if (modelos.length > 0 && !selectedModeloId) {
      setSelectedModeloId(modelos[0].id);
    }
  }, [modelos, selectedModeloId]);

  const getVeiculo = () => {
    if (veiculoData) {
      return {
        placa: veiculoData.placa || "",
        modelo: veiculoData.modelo || "",
        marca: veiculoData.marca || "",
        tipoVeiculo: veiculoData.tipo_veiculo || "",
        tipoCarga: veiculoData.tipo_carga || "",
        capacidadeKg: veiculoData.capacidade_kg || "",
        capacidadeM3: veiculoData.capacidade_m3 || "",
        antt: veiculoData.antt || "",
        rntrc: veiculoData.rntrc || "",
      };
    }
    if (prestador?.veiculos && prestador.veiculos.length > 0) {
      const v = prestador.veiculos[0];
      return {
        placa: v.placa || "",
        modelo: v.modelo || "",
        marca: v.marca || "",
        tipoVeiculo: v.tipoVeiculo || "",
        tipoCarga: v.tipoCarga || "",
        capacidadeKg: v.capacidadeKg || "",
        capacidadeM3: v.capacidadeM3 || "",
        antt: v.antt || "",
        rntrc: v.rntrc || "",
      };
    }
    return { placa: "", modelo: "", marca: "", tipoVeiculo: "", tipoCarga: "", capacidadeKg: "", capacidadeM3: "", antt: "", rntrc: "" };
  };

  const getRntrc = (): string => {
    const v = getVeiculo();
    return prestador?.rntrc || prestador?.antt || prestador?.rntrcAntt || v.rntrc || v.antt || "";
  };

  const getValorSaida = (): string => {
    const financeiro = prestador?.dadosFinanceiros || prestador?.financeiro;
    const v = prestador?.valor_saida || prestador?.valorSaida || prestador?.valor_diaria || prestador?.valorDiaria ||
      financeiro?.valor_saida || financeiro?.valor_diaria || prestador?.diaria || financeiro?.valorSaida || financeiro?.valorDiaria;
    return formatCurrency(v);
  };

  const getValorDiaria = (): string => {
    const v = prestador?.valor_diaria || prestador?.valorDiaria || prestador?.diaria;
    return formatCurrency(v);
  };

  const getValorKm = (): string => {
    const v = prestador?.valor_km || prestador?.valorKm;
    return formatCurrency(v);
  };

  const getFranquiaKm = (): string => {
    const v = prestador?.franquia_km || prestador?.franquiaKm;
    if (v !== undefined && v !== null && v !== '') {
      return `${v} km`;
    }
    return "0 km";
  };

  const getDocumento = (): { linha: string, documento: string } => {
    const doc = getPrestadorDocumento(prestador);
    const docFormatado = formatarCPFCNPJ(doc);
    const digits = doc.replace(/\D/g, '');
    if (digits.length <= 11) {
      return { linha: `CPF: ${docFormatado}`, documento: `CPF: ${docFormatado}` };
    }
    return { linha: `CNPJ: ${docFormatado}`, documento: `CNPJ: ${docFormatado}` };
  };

  const getEnderecoCompleto = (): string => {
    const e = prestador?.endereco || {};
    const parts = [
      e?.rua,
      e?.numero ? `nº ${e.numero}` : "",
      e?.complemento,
      e?.bairro,
      e?.cidade,
      e?.estado,
      e?.cep ? `CEP: ${e.cep}` : ""
    ].filter(Boolean);
    return parts.join(", ") || "Não informado";
  };

  const substituirVariaveisContrato = (template: string): string => {
    const veiculo = getVeiculo();
    const endereco = prestador?.endereco || {};
    const empresaFinal = getNomeFantasia() || EMPRESA_NOME;
    const documento = getDocumento();
    const rntrcValue = getRntrc();

    const ano = new Date().getFullYear();
    const numContratoBase = numeroContrato || `CTR-${ano}-000869`;
    const numAnexo = numContratoBase.replace('CTR', 'ANX') + '-01';

    const franquia = Number(prestador?.franquiaKm || prestador?.franquia_km || 0);
    const idaVoltaText = franquia > 0
      ? `A franquia considera o trajeto completo de ida e volta.`
      : "";

    const replacements: Record<string, string> = {
      '{{empresa_nome}}': empresaFinal,
      '{{empresa_cnpj}}': EMPRESA_CNPJ_CORRETO,
      '{{empresa_endereco}}': EMPRESA_ENDERECO,
      '{{empresa_cidade}}': 'São Caetano do Sul/SP',
      '{{hash_empresa}}': `CE-EMPRESA-${EMPRESA_CNPJ_CORRETO.replace(/\D/g, '')}`,

      '{{prestador_nome}}': prestador?.nomeCompleto || prestador?.nomeFantasia || prestador?.nome || "Não informado",
      '{{prestador_documento}}': documento.documento || "Não informado",
      '{{prestador_documento_linha}}': documento.linha || "Não informado",
      '{{prestador_cpf}}': formatarCPFCNPJ(getPrestadorDocumento(prestador)) || "Não informado",
      '{{prestador_cnpj}}': formatarCPFCNPJ(prestador?.cnpj || '') || "Não informado",
      '{{prestador_cpf_cnpj}}': formatarCPFCNPJ(getPrestadorDocumento(prestador)) || "Não informado",
      '{{prestador_rntrc}}': rntrcValue || "Não informado",
      '{{prestador_rg}}': prestador?.rgIe || prestador?.rg || "Não informado",
      '{{prestador_telefone}}': getPrestadorTelefone(prestador) || "Não informado",
      '{{prestador_whatsapp}}': getPrestadorTelefone(prestador) || "Não informado",
      '{{prestador_email}}': prestador?.email || "Não informado",
      '{{prestador_endereco}}': `${endereco?.rua || ''}, ${endereco?.numero || 'S/N'} - ${endereco?.bairro || ''}, ${endereco?.cidade || ''}/${endereco?.estado || ''} - CEP: ${endereco?.cep || ''}`.trim(),
      '{{prestador_endereco_completo}}': getEnderecoCompleto(),
      '{{prestador_pix}}': prestador?.chavePix || prestador?.chave_pix || "Não informado",
      '{{prestador_banco}}': prestador?.banco || "Não informado",

      '{{veiculo_placa}}': veiculo.placa || "Não informado",
      '{{veiculo_modelo}}': veiculo.modelo || "Não informado",
      '{{veiculo_marca}}': veiculo.marca || "Não informado",
      '{{veiculo_tipo}}': veiculo.tipoVeiculo || "Não informado",
      '{{veiculo_tipo_carga}}': veiculo.tipoCarga || "Diversos",
      '{{veiculo_capacidade_kg}}': formatNumber(veiculo.capacidadeKg, " kg"),
      '{{veiculo_capacidade_m3}}': formatNumber(veiculo.capacidadeM3, " m³"),

      '{{valor_saida}}': getValorSaida(),
      '{{prestador_valor_saida}}': getValorSaida(),
      '{{valor_diaria}}': getValorDiaria(),
      '{{franquia_km}}': `${franquia} km${idaVoltaText ? ` (${idaVoltaText})` : ""}`,
      '{{valor_km_excedente}}': getValorKm(),

      '{{banco}}': prestador?.banco || "Não informado",
      '{{agencia}}': prestador?.agencia || "Não informado",
      '{{conta}}': prestador?.conta || "Não informado",
      '{{chave_pix}}': prestador?.chavePix || prestador?.chave_pix || "Não informado",
      '{{favorecido}}': prestador?.favorecido || "Não informado",

      '{{forma_pagamento}}': prestador?.formaPreferencialPagamento || prestador?.forma_preferencial_pagamento || "Pix",
      '{{periodicidade_pagamento}}': prestador?.periodicidadePagamento || "Quinzenal",
      '{{pagamento_prazo}}': prestador?.prazoPagamento || "30 dias",
      '{{prazo_pagamento}}': prestador?.prazoPagamento || "30 dias",

      '{{data_atual}}': new Date().toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' }),
      '{{numero_contrato}}': numContratoBase,
      '{{numero_anexo}}': numAnexo,
      '{{hash_documento}}': hashDocumento || "[HASH DE VALIDAÇÃO]",
    };

    let parsed = template;
    for (const [key, value] of Object.entries(replacements)) {
      if (value.startsWith("R$ ") && (parsed.includes(`R$ ${key}`) || parsed.includes(`R$${key}`))) {
        parsed = parsed.split(`R$ ${key}`).join(value);
        parsed = parsed.split(`R$${key}`).join(value);
      } else {
        parsed = parsed.split(key).join(value);
      }
    }

    parsed = parsed.replace(/\{\{[^}]+\}\}/g, "Não informado");

    return parsed;
  };

  const handleSelectModelo = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    const mod = modelos.find(m => m.id === modeloId);
    if (!mod) return;
    setContent(substituirVariaveisContrato(mod.conteudo_base));
    setEditMode(false);
  };

  useEffect(() => {
    if (selectedModeloId && modelos.length > 0) {
      const mod = modelos.find(m => m.id === selectedModeloId);
      if (mod) {
        setContent(substituirVariaveisContrato(mod.conteudo_base));
      }
    }
  }, [selectedModeloId, modelos, hashDocumento, numeroContrato, veiculoData]);

  useEffect(() => {
    const verificarVariaveisPendentes = () => {
      if (!content) return;
      const pendentes = content.match(/\{\{[^}]+\}\}/g);
      if (pendentes && pendentes.length > 0) {
        console.warn('[ContratoModal] Variáveis pendentes detectadas:', pendentes);
      }
    };
    verificarVariaveisPendentes();
  }, [content]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const modeloSelecionado = modelos.find(m => m.id === selectedModeloId);
      const conteudoFinal = editMode ? content : substituirVariaveisContrato(modeloSelecionado?.conteudo_base || '');

      const hash = await gerarHashDocumento(conteudoFinal);
      setHashDocumento(hash);

      const veiculo = getVeiculo();
      const financeiro = prestador?.dadosFinanceiros || prestador?.financeiro;
      const valorOriginal = prestador?.valor_saida || prestador?.valor_diaria || financeiro?.valor_saida || financeiro?.valor_diaria || prestador?.diaria;
      const documentoFormatado = getDocumento().documento;
      const telefoneFormatado = getPrestadorTelefone(prestador);

      const novoContrato = await criarContrato({
        id: prestador.id,
        nome: prestador.nomeCompleto || prestador.nomeFantasia || prestador.nome,
        cpf: documentoFormatado,
        cnpj: prestador.cnpj,
        rntrc: getRntrc(),
        telefone: telefoneFormatado,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        tipo_veiculo: veiculo.tipoVeiculo,
        tipo_carga: veiculo.tipoCarga,
        valor_saida: valorOriginal,
        valor_diaria: prestador?.valor_diaria || prestador?.valorDiaria || prestador?.diaria,
      }, modeloSelecionado?.tipo || 'TAC');

      if (!novoContrato) {
        toast.error("Erro ao registrar contrato no banco.");
        return;
      }

      const contratoFinal = {
        ...novoContrato,
        conteudo_html: conteudoFinal
      };

      const logoBase64 = await getLogo();
      const pdfBytes = await generateContractPDF(contratoFinal, {
        logoBase64,
        empresaNome: EMPRESA_NOME,
        empresaCnpj: EMPRESA_CNPJ_CORRETO,
        empresaEndereco: EMPRESA_ENDERECO
      });

      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      const safeNumero = (novoContrato.numero_contrato || "CTR").replace(/[^a-zA-Z0-9-_]/g, "_");
      const filePath = `${prestador.id}/${safeNumero}.pdf`;

      let storageSuccess = false;
      try {
        const { error: uploadError } = await supabase.storage
          .from('contratos')
          .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('contratos').getPublicUrl(filePath);
          await supabase.from('contratos_gerados').update({
            pdf_url: publicUrl,
            status: 'gerado'
          }).eq('id', novoContrato.id);
          storageSuccess = true;
        } else {
          console.error('[ContratoModal] Erro upload storage:', uploadError);
          await supabase.from('contratos_gerados').update({
            status: 'pendente'
          }).eq('id', novoContrato.id);
          toast.warning("PDF gerado, mas não foi possível enviar ao servidor (Storage).");
        }
      } catch (storageErr) {
        console.error('[ContratoModal] Erro storage:', storageErr);
        await supabase.from('contratos_gerados').update({
          status: 'pendente'
        }).eq('id', novoContrato.id);
        toast.warning("PDF gerado, mas houve falha na comunicação com o Storage.");
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Contrato_${novoContrato.numero_contrato}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast.success(`Contrato ${novoContrato.numero_contrato} gerado com sucesso!`);
      onOpenChange(false);
    } catch (e) {
      console.error('[ContratoModal] ERRO GERAL:', e);
      toast.error("Erro ao gerar contrato: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="w-5 h-5 text-primary"/> Gerar Contrato Automatizado</DialogTitle>
          <DialogDescription>
            Geração de contrato de prestação de serviços TAC/ETC para {prestador?.nomeCompleto} ({prestador?.tipoParceiro})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden py-2">
           <div className="shrink-0 space-y-2">
              <p className="text-sm font-bold text-slate-700">Selecione o Modelo Base</p>
              <Select value={selectedModeloId} onValueChange={handleSelectModelo} disabled={loadingModelos}>
                 <SelectTrigger><SelectValue placeholder={loadingModelos ? "Carregando modelos..." : "Escolha um modelo..."}/></SelectTrigger>
                 <SelectContent>
                    {modelosFiltrados.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                    {modelosFiltrados.length === 0 && !loadingModelos && (
                      <SelectItem value="0" disabled>Nenhum modelo disponível para prestador</SelectItem>
                    )}
                 </SelectContent>
              </Select>
              {modelosFiltrados.length > 0 && (
                <p className="text-xs text-green-600">
                  {modelosFiltrados.length} modelo(s) encontrado(s) para prestador
                </p>
              )}
           </div>

           {content && (
               <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-slate-50 relative">
                  <div className="flex justify-between items-center p-2 border-b bg-white">
                     <span className="text-xs font-bold text-slate-500 uppercase">Preview Inteligente do Documento</span>
                     <div className="flex items-center gap-2">
                        {numeroContrato && (
                          <span className="text-xs font-mono text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                            Contrato nº {numeroContrato}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditMode(!editMode)}>
                           {editMode ? <><Save className="w-3.5 h-3.5"/> Salvar Edição</> : <><Edit3 className="w-3.5 h-3.5"/> Editar antes de gerar</>}
                        </Button>
                     </div>
                  </div>
                  {editMode ? (
                    <Textarea
                      className="flex-1 border-0 rounded-none resize-none bg-white p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-0"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                    />
                  ) : (
                    <div className="flex-1 p-6 overflow-y-auto font-serif text-sm bg-white m-2 shadow-sm whitespace-pre-wrap leading-relaxed">
                       {content}
                    </div>
                  )}
               </div>
            )}
            {!content && !loadingModelos && (
               <div className="flex-1 border-2 border-dashed rounded-md flex items-center justify-center text-slate-400 p-8 text-center text-sm">
                  Selecione um modelo no topo para iniciar a mesclagem automática com os dados cadastrais.
               </div>
            )}
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!content || loading} onClick={handleGenerate} className="gap-2 focus:ring-2 focus:ring-offset-2">
             {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
             Gerar & Ativar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

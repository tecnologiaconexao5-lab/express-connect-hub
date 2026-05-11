import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileSignature, Download, Loader2, Edit3, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import { useLogo } from "@/hooks/useLogo";
import { buscarModelosContratos, criarContrato, gerarHashDocumento } from "@/services/contratosService";
import { generateContractPDF, generateContractPDFBase64 } from "@/services/contratosPdfService";
import { ContratoModelo } from "@/services/contratosService";

const EMPRESA_NOME = "Conexão Express Transportes LTDA";
const EMPRESA_CNPJ_CORRETO = "31.227.975/0001-80";
const EMPRESA_ENDERECO = "Avenida Goitacazes, nº 45, Sala 22, São Caetano do Sul/SP";

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
  const { config, getLogo, getNomeFantasia, shouldShowLogo } = useLogo();

  useEffect(() => {
    if (open && prestador?.id) {
      carregarModelos();
      gerarNumero();
    }
  }, [open, prestador?.id]);

  useEffect(() => {
    if (open) {
      setContent("");
      setSelectedModeloId("");
      setHashDocumento("");
    }
  }, [open]);

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
RNTRC: {{prestador_rntrc}}
ENDEREÇO: {{prestador_endereco}}
TELEFONE: {{prestador_telefone}}
WHATSAPP: {{prestador_whatsapp}}
E-MAIL: {{prestador_email}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

CONDIÇÕES COMERCIAIS:
Valor por Viagem/Saída: {{valor_saida}}
Tipo de Carga: {{veiculo_tipo_carga}}

DATA: {{data_atual}}
NÚMERO: {{numero_contrato}}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem como objeto a prestação de serviços de transporte de cargas pelo Contratado, utilizando veículo próprio ou agregado, em regime de execução autônoma, nos termos da Lei 11.442/2007 (ANTT) e regulamentações da ETC/EFF.

CLÁUSULA 2ª - DAS OBRIGAÇÕES DO CONTRATADO
2.1 - Realizar o transporte com diligence e segurança, zelando pela integridade da carga.
2.2 - Manter o veículo em perfeito estado de conservação e com documentação regular (CRLV, seguro, RNTRC).
2.3 - Cumprir rigorosamente os prazos e rotas acordadas.
2.4 - Respeitar as normas internas da Contratante e os procedimentos operacionais estabelecidos.
2.5 - Responsabilizar-se civil e criminalmente pela carga transportada.

CLÁUSULA 3ª - DAS OBRIGAÇÕES DO CONTRATANTE
3.1 - Fornecer as informações necessárias para a execução dos serviços.
3.2 - Efetuar o pagamento dos valores acordados nos prazos estipulados.
3.3 - Disponibilizar suporte operacional para dúvidas e orientações.

CLÁUSULA 4ª - DO VALOR E PAGAMENTO
4.1 - O Contratante pagará ao Contratado o valor de {{valor_saida}} por viagem/saída realizada.
4.2 - O pagamento será efetuado em até {{pagamento_prazo}} dias após a conclusão do serviço.
4.3 - Dados para pagamento: Chave PIX {{prestador_pix}} / Banco {{prestador_banco}}

CLÁUSULA 5ª - DO VÍNCULO
5.1 - O presente contrato não gera vínculo empregatício entre as partes, sendo a relação de natureza exclusivamente civil e comercial.
5.2 - O Contratado atua como prestador de serviços autônomo, assumindo todos os encargos trabalhistas, tributários e previdenciários.

CLÁUSULA 6ª - DA VIGÊNCIA
6.1 - O presente contrato vigorará a partir da data de sua assinatura pelo prazo de 12 (doze) meses, podendo ser renovado automaticamente por igual período, caso nenhuma das partes manifeste intenção contrária com antecedência mínima de 30 (trinta) dias.

CLÁUSULA 7ª - DA RESCISÃO
7.1 - O contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias.
7.2 - A rescisão imediata poderá ocorrer em caso de descumprimento das obrigações contratuais.

CLÁUSULA 8ª - DO ACEITE ELETRÔNICO
8.1 - O aceite deste contrato via WhatsApp ou assinatura eletrônica tem valor jurídico equivalente à assinatura física, conforme Medida Provisória nº 2.200-2/2001 e Lei nº 11.419/2006.

CLÁUSULA 9ª - DO FORO
9.1 - Fica eleito o foro da Comarca de São Caetano do Sul/SP para dirimir quaisquer controvérsias.

DECLARAMOS QUE LI E ACEITO todas as cláusulas e condições deste contrato, reconhecendo-o como título executivo extrajudicial.

_______________________________________          _______________________________________
{{empresa_nome}}
CNPJ: {{empresa_cnpj}}                              {{prestador_nome}}
                                                 {{prestador_documento_linha}}

HASH DE VALIDAÇÃO: {{hash_documento}}
Documento gerado em {{data_atual}}`,
        variaveis: [
          "{{empresa_nome}}", "{{empresa_cnpj}}", "{{empresa_endereco}}",
          "{{prestador_nome}}", "{{prestador_documento}}", "{{prestador_documento_linha}}",
          "{{prestador_rntrc}}", "{{prestador_endereco}}", "{{prestador_telefone}}",
          "{{prestador_whatsapp}}", "{{prestador_email}}", "{{prestador_pix}}", "{{prestador_banco}}",
          "{{veiculo_placa}}", "{{veiculo_modelo}}", "{{veiculo_tipo}}", "{{veiculo_tipo_carga}}",
          "{{valor_saida}}", "{{pagamento_prazo}}",
          "{{data_atual}}", "{{numero_contrato}}", "{{hash_documento}}"
        ],
        ativa: true,
      }]).select();

      if (error) {
        console.error('[ContratoModal] Erro ao inserir modelo TAC:', error);
      } else {
        console.log('[ContratoModal] Modelo TAC inserido:', data);
      }
    } catch (e) {
      console.error("[ContratoModal] Erro ao inserir modelo TAC:", e);
    }
  };

  const gerarNumero = async () => {
    // O número será gerado pelo serviço ao criar o contrato
    // mas se quisermos mostrar no preview:
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
    } catch (e) {
      setNumeroContrato(`CTR-${new Date().getFullYear()}-000869`);
    }
  };

  const modelosFiltrados = modelos;

  useEffect(() => {
    if (modelos.length > 0 && !selectedModeloId) {
      setSelectedModeloId(modelos[0].id);
    }
  }, [modelos, selectedModeloId]);

  const getPrimeiroVeiculo = () => {
    if (prestador?.veiculos && prestador.veiculos.length > 0) {
      return prestador.veiculos[0];
    }
    return { placa: "NÃO INFORMADO", modelo: "NÃO INFORMADO", tipoVeiculo: "NÃO INFORMADO", tipoCarga: "NÃO INFORMADO" };
  };

  const getPrestadorDocumento = (p: any) => {
    return p?.cpf_cnpj
      || p?.cpfCnpj
      || p?.cpf
      || p?.cnpj
      || p?.documento
      || p?.rg
      || "";
  };

  const getPrestadorTelefone = (p: any) => {
    return p?.telefone
      || p?.telefone_principal
      || p?.telefonePrincipal
      || p?.whatsapp
      || p?.celular
      || "";
  };

  const getValorSaida = (): string => {
    const financeiro = prestador?.dadosFinanceiros || prestador?.financeiro;
    
    const v =
      prestador?.valor_saida ||
      prestador?.valor_diaria ||
      financeiro?.valor_saida ||
      financeiro?.valor_diaria ||
      prestador?.diaria ||
      prestador?.valorSaida ||
      prestador?.valorDiaria ||
      financeiro?.valorSaida ||
      financeiro?.valorDiaria;

    if (v !== undefined && v !== null && v !== '' && v !== 0) {
      return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    return "A DEFINIR";
  };

  const getDocumento = (): { linha: string, documento: string } => {
    const doc = getPrestadorDocumento(prestador);
    const docFormatado = formatarCPFCNPJ(doc);
    const digits = doc.replace(/\D/g, '');
    
    if (digits.length <= 11) {
      return { linha: `CPF: ${docFormatado}`, documento: `CPF: ${docFormatado}` };
    } else {
      return { linha: `CNPJ: ${docFormatado}`, documento: `CNPJ: ${docFormatado}` };
    }
  };

  const formatarCPFCNPJ = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  const formatCurrency = (v: any) => {
    if (v === undefined || v === null || v === '' || v === 0) return "A DEFINIR";
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const substituirVariaveisContrato = (template: string): string => {
    const veiculo = getPrimeiroVeiculo();
    const endereco = prestador?.endereco || {};
    const empresaFinal = getNomeFantasia() || EMPRESA_NOME;
    const documento = getDocumento();
    
    const ano = new Date().getFullYear();
    const numContratoBase = numeroContrato || `CTR-${ano}-000869`;
    const numAnexo = numContratoBase.replace('CTR', 'ANX') + '-01';
    
    const franquia = Number(prestador?.franquiaKm || 0);
    const idaVoltaText = franquia > 0 
      ? `\nA franquia considera o trajeto completo de ida e volta. Exemplo: ${franquia} km de franquia equivalem a aproximadamente ${franquia / 2} km de ida + ${franquia / 2} km de volta.`
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
      '{{prestador_rntrc}}': prestador?.rntrcAntt || prestador?.rntrc || "Não informado",
      '{{prestador_rg}}': prestador?.rgIe || prestador?.rg || "Não informado",
      '{{prestador_telefone}}': getPrestadorTelefone(prestador) || "Não informado",
      '{{prestador_whatsapp}}': getPrestadorTelefone(prestador) || "Não informado",
      '{{prestador_email}}': prestador?.email || "Não informado",
      '{{prestador_endereco}}': `${endereco?.rua || ''}, ${endereco?.numero || 'S/N'} - ${endereco?.bairro || ''}, ${endereco?.cidade || ''}/${endereco?.estado || ''} - CEP: ${endereco?.cep || ''}`.trim(),
      '{{prestador_pix}}': prestador?.chavePix || "Não informado",
      '{{prestador_banco}}': prestador?.dadosBancarios?.banco || prestador?.banco || "Não informado",

      '{{veiculo_placa}}': veiculo.placa || "Não informado",
      '{{veiculo_modelo}}': veiculo.modelo || "Não informado",
      '{{veiculo_tipo}}': veiculo.tipoVeiculo || "Não informado",
      '{{veiculo_tipo_carga}}': veiculo.tipoCarga || "Diversos",

      '{{valor_saida}}': getValorSaida(),
      '{{prestador_valor_saida}}': getValorSaida(),
      '{{valor_diaria}}': formatCurrency(prestador?.valorDiaria || prestador?.diaria),
      '{{franquia_km}}': `${franquia} km rodados${idaVoltaText}`,
      '{{valor_km_excedente}}': formatCurrency(prestador?.valorKm),
      '{{forma_pagamento}}': prestador?.formaPreferencialPagamento || prestador?.forma_pagamento || "Pix",
      '{{periodicidade_pagamento}}': prestador?.periodicidadePagamento || "Quinzenal",
      '{{pagamento_prazo}}': prestador?.prazoPagamento || "30 dias",
      
      '{{data_atual}}': new Date().toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' }),
      '{{numero_contrato}}': numContratoBase,
      '{{numero_anexo}}': numAnexo,
      '{{hash_documento}}': hashDocumento || "[HASH DE VALIDAÇÃO]",
    };

    let parsed = template;
    for (const [key, value] of Object.entries(replacements)) {
      // Previne "R$ R$ 0,00" caso o template já tenha o prefixo R$
      if (value.startsWith("R$ ") && (parsed.includes(`R$ ${key}`) || parsed.includes(`R$${key}`))) {
        parsed = parsed.split(`R$ ${key}`).join(value);
        parsed = parsed.split(`R$${key}`).join(value);
      } else {
        parsed = parsed.split(key).join(value);
      }
    }

    // Limpeza final de variáveis não preenchidas
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
  }, [selectedModeloId, modelos, hashDocumento, numeroContrato]);

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

      console.log("[CONTRATO DEBUG PRESTADOR]", {
        cpf_cnpj: prestador.cpf_cnpj,
        cpfCnpj: prestador.cpfCnpj,
        telefone: prestador.telefone,
        telefone_principal: prestador.telefone_principal,
        whatsapp: prestador.whatsapp,
        documento_extraido: getPrestadorDocumento(prestador),
        telefone_extraido: getPrestadorTelefone(prestador)
      });

      // 1. Criar contrato no banco
      const veiculo = getPrimeiroVeiculo();
      const financeiro = prestador?.dadosFinanceiros || prestador?.financeiro;
      const valorOriginal = prestador?.valor_saida || prestador?.valor_diaria || financeiro?.valor_saida || financeiro?.valor_diaria || prestador?.diaria;

      const documentoFormatado = getDocumento().documento;
      const telefoneFormatado = getPrestadorTelefone(prestador);

      const novoContrato = await criarContrato({
        id: prestador.id,
        nome: prestador.nomeCompleto || prestador.nomeFantasia || prestador.nome,
        cpf: documentoFormatado,
        cnpj: prestador.cnpj,
        rntrc: prestador.rntrcAntt || prestador.rntrc,
        telefone: telefoneFormatado,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        tipo_veiculo: veiculo.tipoVeiculo,
        tipo_carga: veiculo.tipoCarga,
        valor_saida: valorOriginal
      }, modeloSelecionado?.tipo || 'TAC');

      if (!novoContrato) {
        toast.error("Erro ao registrar contrato no banco.");
        return;
      }

      // Atualizar o conteúdo com o número final e hash
      const contratoFinal = {
        ...novoContrato,
        conteudo_html: conteudoFinal
      };

      // 2. Gerar PDF real (Binary Blob para evitar corrupção)
      const logoBase64 = await getLogo();
      const pdfBytes = await generateContractPDF(contratoFinal, {
        logoBase64,
        empresaNome: EMPRESA_NOME,
        empresaCnpj: EMPRESA_CNPJ_CORRETO,
        empresaEndereco: EMPRESA_ENDERECO
      });

      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // 3. Salvar PDF no Storage com Caminho Seguro
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
          toast.warning("PDF gerado, mas não foi possível enviar ao servidor (Storage 400/Falha).");
        }
      } catch (storageErr) {
        console.error('[ContratoModal] Erro storage:', storageErr);
        toast.warning("PDF gerado, mas houve falha na comunicação com o Storage.");
      }

      // 4. Download / Abertura Local (Garante que o usuário receba o arquivo mesmo com erro de storage)
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
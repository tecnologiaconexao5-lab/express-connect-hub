import { supabase } from "@/lib/supabase";

export interface DocumentAnalysisResult {
  success: boolean;
  data?: {
    dados_extraidos: Record<string, any>;
    divergencias: string[];
    confianca_pct: number;
    observacoes: string;
    recomendacao: "aprovar" | "rejeitar" | "revisar";
  };
  error?: string;
}

export type TipoDocumento = 
  | "cnh" 
  | "crlv" 
  | "rntrc" 
  | "antt" 
  | "comprovante_bancario" 
  | "comprovante_residencia" 
  | "apolice_seguro"
  | "contrato"
  | "outro";

interface PrestadorData {
  nomeCompleto?: string;
  cpfCnpj?: string;
  dataNascimento?: string;
}

interface VeiculoData {
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  renavam?: string;
}

const PROMPTS_BY_TYPE: Record<TipoDocumento, string> = {
  cnh: `Analise esta CNH (Carteira Nacional de Habilitação). Extraia e retorne JSON com:
{
  "nome_completo": "string",
  "cpf": "string (apenas números)",
  "data_nascimento": "DD/MM/YYYY",
  "numero_registro": "string",
  "categorias": ["A","B","C","D","E","AB","AC","AD","AE"],
  "validade": "DD/MM/YYYY",
  "local_emissao": "string",
  "observacoes": "string (EAR, ACC, etc)",
  "data_primeira_habilitacao": "DD/MM/YYYY"
}
Retorne APENAS o JSON.`,
  
  crlv: `Analise este CRLV (Certificado de Registro e Licenciamento de Veículo). Extraia e retorne JSON com:
{
  "placa": "string",
  "renavam": "string",
  "marca": "string",
  "modelo": "string",
  "ano_fabricacao": "number",
  "ano_modelo": "number",
  "proprietario": "string",
  "cpf_cnpj_proprietario": "string",
  "validade_licenciamento": "DD/MM/YYYY",
  "restricoes": "string ou null"
}
Retorne APENAS o JSON.`,
  
  rntrc: `Analise este RNTRC (Registro Nacional de Transportadores Rodoviários de Cargas). Extraia e retorne JSON com:
{
  "numero_registro": "string",
  "categoria": "ETC|CTC|TAC",
  "cpf_cnpj": "string",
  "razao_social": "string",
  "validade": "DD/MM/YYYY",
  "status": "ATIVO|SUSPENSO|CANCELADO"
}
Retorne APENAS o JSON.`,
  
  antt: `Analise este documento ANTT. Extraia e retorne JSON com:
{
  "numero_registro": "string",
  "categoria": "ETC|CTC|TAC",
  "cpf_cnpj": "string",
  "razao_social": "string",
  "validade": "DD/MM/YYYY",
  "status": "string"
}
Retorne APENAS o JSON.`,
  
  comprovante_bancario: `Analise este comprovante bancário. Extraia e retorne JSON com:
{
  "nome_banco": "string",
  "codigo_banco": "number",
  "agencia": "string",
  "conta": "string",
  "digito_conta": "string",
  "titular": "string",
  "cpf_cnpj_titular": "string",
  "tipo_conta": "CORRENTE|POUPANÇA",
  "chave_pix": "string ou null",
  "tipo_chave_pix": "CPF|EMAIL|TELEFONE|ALEATORIA ou null"
}
Retorne APENAS o JSON.`,
  
  comprovante_residencia: `Analise este comprovante de residência. Extraia e retorne JSON com:
{
  "nome_titular": "string",
  "endereco_completo": "string",
  "cep": "string",
  "cidade": "string",
  "estado": "string",
  "data_documento": "DD/MM/YYYY",
  "tipo_documento": "conta_luz|conta_agua|conta_telefone|conta_banco|outro",
  "nome_fornecedor": "string"
}
Retorne APENAS o JSON.`,
  
  apolice_seguro: `Analise esta apólice de seguro. Extraia e retorne JSON com:
{
  "seguradora": "string",
  "numero_apolice": "string",
  "veiculo_segurado": "string",
  "placa": "string",
  "vigencia_inicio": "DD/MM/YYYY",
  "vigencia_fim": "DD/MM/YYYY",
  "tipo_cobertura": "string",
  "valor_segurado": "number",
  "franquia": "number ou null"
}
Retorne APENAS o JSON.`,
  
  contrato: `Analise este contrato. Extraia e retorne JSON com:
{
  "tipo_contrato": "string",
  "partes": ["string"],
  "vigencia_inicio": "DD/MM/YYYY",
  "vigencia_fim": "DD/MM/YYYY",
  "objetivo": "string",
  "valor": "number ou null"
}
Retorne APENAS o JSON.`,
  
  outro: `Analise este documento. Extraia todos os dados legíveis em texto e retorne JSON com:
{
  "tipo_identificado": "string",
  "dados_principais": {},
  "data_documento": "DD/MM/YYYY ou null",
  "observacoes": "string"
}
Retorne APENAS o JSON.`
};

export async function analyzeDocument(
  imageBase64: string,
  tipoDoc: TipoDocumento,
  prestadorData?: PrestadorData,
  veiculoData?: VeiculoData
): Promise<DocumentAnalysisResult> {
  const apiKey = localStorage.getItem("anthropic_api_key");
  
  if (!apiKey) {
    return {
      success: false,
      error: "Chave da API Anthropic não configurada"
    };
  }

  try {
    const prompt = PROMPTS_BY_TYPE[tipoDoc] || PROMPTS_BY_TYPE.outro;
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageBase64
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch {
      return {
        success: false,
        error: "Falha ao analisar documento. Tente novamente com imagem mais legível."
      };
    }

    const divergencias: string[] = [];
    
    if (prestadorData) {
      if (parsedData.nome_completo && prestadorData.nomeCompleto) {
        const nomeDoc = parsedData.nome_completo.toLowerCase().trim();
        const nomeCad = prestadorData.nomeCompleto.toLowerCase().trim();
        if (!nomeDoc.includes(nomeCad.split(" ")[0]) && !nomeCad.includes(nomeDoc.split(" ")[0])) {
          divergencias.push(`Nome divergente: DOC "${parsedData.nome_completo}" vs CAD "${prestadorData.nomeCompleto}"`);
        }
      }
      
      if (parsedData.cpf && prestadorData.cpfCnpj) {
        const cpfDoc = parsedData.cpf.replace(/\D/g, "");
        const cpfCad = prestadorData.cpfCnpj.replace(/\D/g, "");
        if (cpfDoc.length === 11 && cpfCad.length === 11 && cpfDoc !== cpfCad) {
          divergencias.push(`CPF divergente: DOC "${parsedData.cpf}" vs CAD "${prestadorData.cpfCnpj}"`);
        }
      }
    }

    if (veiculoData && tipoDoc === "crlv") {
      if (parsedData.placa && veiculoData.placa) {
        const placaDoc = parsedData.placa.toUpperCase().replace(/-/g, "");
        const placaCad = veiculoData.placa.toUpperCase().replace(/-/g, "");
        if (placaDoc !== placaCad) {
          divergencias.push(`Placa divergente: DOC "${parsedData.placa}" vs CAD "${veiculoData.placa}"`);
        }
      }
      
      if (parsedData.renavam && veiculoData.renavam) {
        if (parsedData.renavam !== veiculoData.renavam) {
          divergencias.push(`RENAVAM divergente`);
        }
      }
    }

    let recomendacao: "aprovar" | "rejeitar" | "revisar" = "aprovar";
    if (divergencias.length > 0) {
      recomendacao = "revisar";
    }
    if (parsedData.validade || parsedData.validade_licenciamento || parsedData.vigencia_fim) {
      const validadeStr = parsedData.validade || parsedData.validade_licenciamento || parsedData.vigencia_fim;
      const [dia, mes, ano] = validadeStr.split("/").map(Number);
      const dataValidade = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      if (dataValidade < hoje) {
        recomendacao = "rejeitar";
        divergencias.push("Documento vencido");
      }
    }

    const confianca = data.stop_reason === "end_turn" ? 95 : 70;

    return {
      success: true,
      data: {
        dados_extraidos: parsedData,
        divergencias,
        confianca_pct: confianca,
        observacoes: `Documento ${tipoDoc.toUpperCase()} analisado com ${confianca}% de confiança.`,
        recomendacao
      }
    };
  } catch (err: any) {
    console.error("Erro na análise de documento:", err);
    return {
      success: false,
      error: err.message || "Erro ao analisar documento"
    };
  }
}

export async function saveDocumentAnalysis(
  prestadorId: string,
  documentoId: string | null,
  tipoDoc: string,
  arquivoUrl: string,
  dadosExtraidos: Record<string, any>,
  divergencias: string[],
  confianca: number,
  statusIa: string,
  observacoesIa: string
) {
  const { data, error } = await supabase.from("documento_analises").insert([{
    prestador_id: prestadorId,
    documento_id: documentoId,
    tipo_doc: tipoDoc,
    arquivo_url: arquivoUrl,
    dados_extraidos: dadosExtraidos,
    divergencias: divergencias,
    confianca_pct: confianca,
    status_ia: statusIa,
    status_final: "pendente",
    observacoes_ia: observacoesIa
  }]).select().single();

  if (error) throw error;
  return data;
}

export async function approveDocumentAnalysis(
  analiseId: string,
  usuarioId: string
) {
  const { error } = await supabase
    .from("documento_analises")
    .update({ 
      status_final: "aprovado", 
      aprovado_por: usuarioId 
    })
    .eq("id", analiseId);

  if (error) throw error;
  
  await supabase.from("activity_logs").insert([{
    modulo: "documento_analises",
    acao: "APROVAR_DOCUMENTO_IA",
    detalhes: { analise_id: analiseId },
    user_id: usuarioId
  }]);
}

export async function rejectDocumentAnalysis(
  analiseId: string,
  motivo: string,
  usuarioId: string
) {
  const { error } = await supabase
    .from("documento_analises")
    .update({ 
      status_final: "rejeitado", 
      motivo_rejeicao: motivo 
    })
    .eq("id", analiseId);

  if (error) throw error;
  
  await supabase.from("activity_logs").insert([{
    modulo: "documento_analises",
    acao: "REJEITAR_DOCUMENTO_IA",
    detalhes: { analise_id: analiseId, motivo },
    user_id: usuarioId
  }]);
}

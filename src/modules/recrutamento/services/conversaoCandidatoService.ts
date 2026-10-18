import { supabase } from '@/lib/supabase'
import { prestadoresService } from './prestadoresService'
import { enterpriseKanbanService } from '../components/enterprise-kanban/enterpriseKanbanService'
import type { EnterpriseCandidate } from '../components/enterprise-kanban/enterpriseKanbanTypes'
import type { Prestador, DocumentoPrestador, ScorePrestador, TipoDocumento, StatusDocumento } from '../types/recrutamento'

const CANDIDATOS_TABLE = 'recrutamento_candidatos'

const TIPO_DOC_MAP: Record<string, TipoDocumento> = {
  'CNH': 'cnh',
  'CNPJ': 'cnpj',
  'Certidão Federal': 'certidao_federal',
  'Certidão Estadual': 'certidao_estadual',
  'Certidão Municipal': 'certidao_municipal',
  'CRLV': 'crlv',
  'Seguro': 'seguro',
  'ANTT': 'antt',
  'Curso MOPP': 'certificado_curso_mopp',
  'Contrato Social': 'contrato_social',
  'Comprovante Endereço': 'comprovante_endereco',
  'Certidão Trabalhista': 'certidao_trabalhista',
}

const STATUS_DOC_MAP: Record<string, StatusDocumento> = {
  'ok': 'aprovado',
  'pendente': 'pendente',
  'vencido': 'vencido',
}

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '')
}

function mapearDocumentos(docs: { nome: string; status: string; dataValidade?: string; observacao?: string }[], prestadorId: string): DocumentoPrestador[] {
  return docs.map((d, i) => ({
    id: `conv_doc_${Date.now()}_${i}`,
    prestadorId,
    tipo: TIPO_DOC_MAP[d.nome] ?? 'outro',
    status: STATUS_DOC_MAP[d.status] ?? 'pendente',
    url: '',
    nomeArquivo: d.nome,
    dataEnvio: new Date().toISOString(),
    dataValidade: d.dataValidade ?? '',
    dataAprovacao: '',
    aprovadoPor: '',
    observacao: d.observacao ?? '',
    versao: 1,
  }))
}

function mapearScore(score: number): ScorePrestador {
  const now = new Date().toISOString()
  const clampedScore = Math.min(100, Math.max(0, score))
  return {
    geral: clampedScore,
    documentacao: Math.round(clampedScore * 0.8),
    experiencia: Math.round(clampedScore * 0.7),
    reputacao: Math.round(clampedScore * 0.6),
    regularidade: Math.round(clampedScore * 0.6),
    perfil: Math.round(clampedScore * 0.8),
    tendencia: Math.round(clampedScore * 0.75),
    ultimaAtualizacao: now,
    historico: [{ data: now, score: clampedScore, motivo: 'Conversão do Pipeline Enterprise' }],
  }
}

function determinarStatusPrestador(stage: string): 'novo' | 'em_analise' | 'aprovado' | 'reserva' | 'agregado' | 'bloqueado' {
  if (stage === 'ativo' || stage === 'aprovado') return 'aprovado'
  if (stage === 'bloqueado') return 'bloqueado'
  if (stage === 'reprovado') return 'bloqueado'
  if (stage === 'em_treinamento' || stage === 'entrevista' || stage === 'em_validacao') return 'em_analise'
  return 'novo'
}

const ORIGENS_CONHECIDAS = ['whatsapp', 'indicacao', 'site', 'anuncio', 'fretebras', 'facebook', 'linkedin', 'manual', 'outro']

function extrairOrigem(tags: string[]): string {
  for (const tag of tags) {
    const normalized = tag.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (ORIGENS_CONHECIDAS.includes(normalized)) return normalized
  }
  return 'manual'
}

function determinarDisponibilidade(tags: string[]): string {
  if (tags.includes('disponivel_imediato')) return 'Imediata'
  return 'Disponível'
}

export interface ResultadoConversao {
  success: boolean
  prestadorId?: string
  candidatoId: string
  mensagem: string
  tipo: 'criado' | 'atualizado' | 'ja_existente' | 'erro'
}

export const conversaoCandidatoService = {
  async converterCandidatoParaPrestador(candidatoId: string): Promise<ResultadoConversao> {
    try {
      const candidate = await enterpriseKanbanService.getCandidateById(candidatoId)
      if (!candidate) {
        return { success: false, candidatoId, mensagem: 'Candidato não encontrado', tipo: 'erro' }
      }

      if (!candidate.telefone) {
        return { success: false, candidatoId, mensagem: 'Candidato sem telefone — necessário para conversão', tipo: 'erro' }
      }

      const stagesPermitidos = ['aprovado', 'ativo', 'prestador_apto']
      if (!stagesPermitidos.includes(candidate.stage)) {
        return {
          success: false,
          candidatoId,
          mensagem: `Candidato em estágio "${candidate.stage}" — conversão permitida apenas para aprovados`,
          tipo: 'erro',
        }
      }

      // AG-07J.11 — GATE DOCUMENTAL TMS (fail-closed)
      // Reutiliza statusDocumental pré-computado por calcularStatusDocumentalOperacional()
      // durante normalizeCandidate() em getCandidateById().
      // Somente "completo" permite conversão; todos os demais estados bloqueiam.
      if (candidate.statusDocumental !== 'completo') {
        return {
          success: false,
          candidatoId,
          mensagem: 'Documentação obrigatória incompleta ou inválida — conversão bloqueada',
          tipo: 'erro',
        }
      }

      const duplicata = await this.buscarDuplicata(candidate)
      if (duplicata) {
        await this.atualizarCandidatoAposConversao(candidatoId, duplicata.id)
        return {
          success: true,
          prestadorId: duplicata.id,
          candidatoId,
          mensagem: `Prestador já existente: ${duplicata.nome} (vínculo reutilizado)`,
          tipo: 'ja_existente',
        }
      }

      const now = new Date().toISOString()
      const prestadorData: Partial<Prestador> = {
        nome: candidate.nome,
        razaoSocial: candidate.nome,
        cpfCnpj: '',
        rg: '',
        dataNascimento: '',
        contatos: [
          { tipo: 'telefone', valor: candidate.telefone, principal: true },
          { tipo: 'email', valor: candidate.email || '', principal: false },
        ],
        endereco: {
          cep: '',
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: candidate.cidade || '',
          uf: candidate.uf || '',
        },
        tipoVeiculo: candidate.veiculo || '',
        placaVeiculo: candidate.placa || '',
        eixos: 2,
        capacidadeKg: 0,
        capacidadeM3: 0,
        tipoCargaVeiculo: 'seco',
        disponibilidade: determinarDisponibilidade(candidate.tags),
        regioesAtuacao: candidate.cidade ? [candidate.cidade] : [],
        origemCadastro: extrairOrigem(candidate.tags),
        status: determinarStatusPrestador(candidate.stage),
        score: mapearScore(candidate.score),
        documentos: mapearDocumentos(candidate.documentos, ''),
        onboarding: 'nao_iniciado',
        canalCaptacao: extrairOrigem(candidate.tags),
        indicadoPor: '',
        historico: {
          jaCarregouConosco: false,
          quantidadeOperacoes: 0,
          ultimaOperacao: '',
          clientesAtendidos: [],
          mediaPontualidade: 100,
          mediaOcorrencias: 0,
          avaliacaoOperacional: 5,
          melhorPerfilOperacao: '',
        },
        dataCadastro: candidate.dataEntrada || now,
        dataAtivacao: '',
        ultimaAtividade: candidate.dataAtualizacao || now,
        observacoes: candidate.observacoesIA || '',
        tags: candidate.tags,
      }

      const prestador = await prestadoresService.criar(prestadorData)

      await this.sincronizarComOperacao(candidate, prestador)

      await this.atualizarCandidatoAposConversao(candidatoId, prestador.id)

      return {
        success: true,
        prestadorId: prestador.id,
        candidatoId,
        mensagem: `Prestador criado: ${prestador.nome}`,
        tipo: 'criado',
      }
    } catch (error) {
      console.error('[Conversão] Erro:', error)
      return {
        success: false,
        candidatoId,
        mensagem: `Erro na conversão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        tipo: 'erro',
      }
    }
  },

  async buscarDuplicata(candidate: EnterpriseCandidate): Promise<Prestador | null> {
    const telLimpo = normalizarTelefone(candidate.telefone)
    if (!telLimpo) return null

    try {
      const { data: prestadores, error } = await supabase
        .from('recrutamento_prestadores')
        .select('*')

      if (!error && prestadores) {
        const todos = prestadores.map((row: any) => {
          const { id, nome } = row
          return { id, nome, contatos: row.contatos ?? [] }
        })

        for (const p of todos) {
          const contatos = Array.isArray(p.contatos) ? p.contatos : []
          for (const c of contatos) {
            if (c.tipo === 'telefone' && normalizarTelefone(c.valor) === telLimpo) {
              const prestador = await prestadoresService.obter(p.id)
              if (prestador) return prestador
            }
            if (c.tipo === 'email' && candidate.email && c.valor.toLowerCase() === candidate.email.toLowerCase()) {
              const prestador = await prestadoresService.obter(p.id)
              if (prestador) return prestador
            }
          }
        }
      }
    } catch { }

    try {
      const local = await prestadoresService.listar()
      for (const p of local) {
        for (const c of p.contatos) {
          if (c.tipo === 'telefone' && normalizarTelefone(c.valor) === telLimpo) return p
          if (c.tipo === 'email' && candidate.email && c.valor.toLowerCase() === candidate.email.toLowerCase()) return p
        }
      }
    } catch { }

    return null
  },

  async atualizarCandidatoAposConversao(candidatoId: string, prestadorId: string): Promise<void> {
    const now = new Date().toISOString()

    await enterpriseKanbanService.mover(candidatoId, 'ativo')

    const { error } = await supabase
      .from(CANDIDATOS_TABLE)
      .update({
        prestador_id: prestadorId,
        data_atualizacao: now,
        updated_at: now,
      })
      .eq('id', candidatoId)

    if (error) throw error

    await enterpriseKanbanService.registrarEvento(candidatoId, {
      tipo: 'convertido',
      descricao: `Candidato convertido em prestador (ID: ${prestadorId})`,
      data: now,
    })
  },

  async sincronizarComOperacao(candidate: EnterpriseCandidate, prestador: Prestador): Promise<void> {
    try {
      const origemVinculo = `recrutamento:${prestador.id}`
      const statusOperacional = candidate.stage === 'aprovado' || candidate.stage === 'ativo' ? 'ativo' : 'analise'

      // AG-07G — REUTILIZA o prestador operacional existente (ex.: criado pelo
      // App com CPF real) em vez de criar uma segunda pessoa.
      const { buscarPrestadorOperacionalExistente } = await import('./identidadePrestadorService')
      const existente = await buscarPrestadorOperacionalExistente({
        telefone: candidate.telefone,
        email: candidate.email,
        origemCadastro: origemVinculo,
      })

      if (existente) {
        const patch: Record<string, unknown> = {
          status: statusOperacional,
          liberado_app: statusOperacional === 'ativo',
          origem_cadastro: origemVinculo,
        }
        // Preenche SOMENTE lacunas — nunca sobrescreve dados mais completos
        // do App (CNH, telefone, endereço, veículo, documentos, CPF real).
        if (!String(existente.nome_completo || '').trim()) patch.nome_completo = candidate.nome
        if (!String(existente.telefone || '').trim()) patch.telefone = candidate.telefone
        if (!String(existente.whatsapp || '').trim()) patch.whatsapp = candidate.telefone
        if (!String(existente.email || '').trim() && candidate.email) patch.email = candidate.email
        await supabase.from('prestadores').update(patch).eq('id', existente.id)
        return
      }

      // Nenhum existente → cria. CPF real preservado se conhecido; REC_ somente
      // como último recurso (candidato não possui CPF real no contrato atual).
      const telLimpo = (candidate.telefone || '').replace(/\D/g, '')
      const cpfUnico = `REC_${telLimpo.slice(0, 11)}`

      const { error: insertError } = await supabase
        .from('prestadores')
        .insert({
          nome_completo: candidate.nome,
          nome_fantasia: candidate.nome,
          cpf_cnpj: cpfUnico,
          tipo_parceiro: candidate.veiculo || 'carreteiro',
          status: statusOperacional,
          liberado_app: statusOperacional === 'ativo',
          telefone: candidate.telefone,
          whatsapp: candidate.telefone,
          email: candidate.email || null,
          origem_cadastro: origemVinculo,
          endereco: {
            cidade: candidate.cidade || '',
            estado: candidate.uf || '',
          },
          veiculos: [{
            tipo: candidate.veiculo || '',
            placa: candidate.placa || '',
          }],
        })

      if (insertError) {
        console.error('[Sincronização] Erro ao inserir em prestadores:', insertError.message)
      }
    } catch (err) {
      console.error('[Sincronização] Falha crítica na sincronização com operação:', err)
    }
  },
}

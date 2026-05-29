/**
 * OperacaoFormLogistica.tsx
 * 
 * Exemplo de integração dos novos campos de Logística no formulário
 * Demonstra como usar useFinanceiroInteligente e mostrar preview em tempo real
 * 
 * INTEGRAÇÃO NO FORMULÁRIO EXISTENTE:
 * 1. Importar useFinanceiroInteligente, useLogisticaOperacional
 * 2. Adicionar aba "Logística" ao formulário multi-step
 * 3. Adicionar aba "Valores Avançados" para campos financeiros expandidos
 * 4. Adicionar componente OperationJobPreview como preview lateral
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useFinanceiroInteligente, useLogisticaOperacional } from '../hooks/useFinanceiroInteligente'
import { OperationJobPreview, OperationJobPreviewCompacto } from './OperationJobPreview'
import type { Operacao } from '../types/recrutamento'
import type { LogisticaOperacao } from '../types/operationAnnouncement'

interface OperacaoFormLogisticaProps {
  operacao: Operacao
  onSave: (operacao: Operacao, logistica: LogisticaOperacao) => void
  onCancel: () => void
}

/**
 * Componente principal com todas as abas
 */
export function OperacaoFormLogistica({
  operacao,
  onSave,
  onCancel,
}: OperacaoFormLogisticaProps) {
  const [abaAtiva, setAbaAtiva] = useState<'logistica' | 'financeiro'>('logistica')

  // Hooks inteligentes
  const financeiro = useFinanceiroInteligente(operacao.financeiro, {
    delayMs: 500,
  })

  const logistica = useLogisticaOperacional(operacao.logistica || {})

  const handleSalvar = () => {
    const operacaoAtualizada = {
      ...operacao,
      financeiro: financeiro.estado,
      logistica: logistica.estado,
    }
    onSave(operacaoAtualizada, logistica.estado)
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      {/* ABAS PRINCIPALE */}
      <div className="lg:col-span-2 space-y-4">
        {/* SELETOR DE ABAS */}
        <div className="flex gap-2 border-b">
          <Button
            variant={abaAtiva === 'logistica' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAbaAtiva('logistica')}
            className="rounded-none"
          >
            📦 Logística
          </Button>
          <Button
            variant={abaAtiva === 'financeiro' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAbaAtiva('financeiro')}
            className="rounded-none"
          >
            💰 Financeiro Avançado
          </Button>
        </div>

        {/* ABA LOGÍSTICA */}
        {abaAtiva === 'logistica' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>🛻 Características do Veículo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Veículo Detalhado</Label>
                    <Input
                      placeholder="Ex: Van refrigerada 1.500kg"
                      value={logistica.estado.tipoVeiculoDetalhado || ''}
                      onChange={(e) =>
                        logistica.atualizarCampo('tipoVeiculoDetalhado', e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Será exibido no anúncio do prestador
                    </p>
                  </div>

                  <div>
                    <Label>Volume (m³)</Label>
                    <Input
                      type="number"
                      placeholder="8"
                      value={logistica.estado.volumeM3 || ''}
                      onChange={(e) =>
                        logistica.atualizarCampo('volumeM3', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipos de Carga Aceitos</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="termo"
                        checked={logistica.estado.aceitaTermo || false}
                        onCheckedChange={(checked) =>
                          logistica.atualizarCampo('aceitaTermo', checked)
                        }
                      />
                      <Label htmlFor="termo" className="cursor-pointer">
                        Térmico
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="refrigerado"
                        checked={logistica.estado.aceitaRefrigerado || false}
                        onCheckedChange={(checked) =>
                          logistica.atualizarCampo('aceitaRefrigerado', checked)
                        }
                      />
                      <Label htmlFor="refrigerado" className="cursor-pointer">
                        Refrigerado
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>📦 Perfil da Operação</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tipo de Operação</Label>
                  <select
                    value={logistica.estado.tipoOperacao || ''}
                    onChange={(e) =>
                      logistica.atualizarCampo(
                        'tipoOperacao',
                        e.target.value as any
                      )
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Selecionar...</option>
                    <option value="fixa">Operação Fixa</option>
                    <option value="recorrente">Recorrente</option>
                    <option value="esporadica">Esporádica</option>
                    <option value="customizada">Customizada</option>
                  </select>
                </div>

                <div>
                  <Label>Perfil da Carga</Label>
                  <Input
                    placeholder="Ex: Cestas básicas, Frutas/Verduras"
                    value={logistica.estado.perfilCarga || ''}
                    onChange={(e) =>
                      logistica.atualizarCampo('perfilCarga', e.target.value)
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Temperatura Mínima (°C)</Label>
                    <Input
                      type="number"
                      placeholder="2"
                      value={logistica.estado.temperaturaMinima || ''}
                      onChange={(e) =>
                        logistica.atualizarCampo(
                          'temperaturaMinima',
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Temperatura Máxima (°C)</Label>
                    <Input
                      type="number"
                      placeholder="8"
                      value={logistica.estado.temperaturaMaxima || ''}
                      onChange={(e) =>
                        logistica.atualizarCampo(
                          'temperaturaMaxima',
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Média de Paradas por Saída</Label>
                  <Input
                    type="number"
                    placeholder="10-18"
                    value={logistica.estado.quantidadeMediaParadas || ''}
                    onChange={(e) =>
                      logistica.atualizarCampo(
                        'quantidadeMediaParadas',
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Texto Resumido Operacional</Label>
                  <Textarea
                    placeholder="Descrição narrativa da operação (será mostrada no anúncio)"
                    value={logistica.estado.textoResumidoOperacional || ''}
                    onChange={(e) =>
                      logistica.atualizarCampo('textoResumidoOperacional', e.target.value)
                    }
                    className="min-h-20"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>⏰ Programação Operacional</span>
                  <Button
                    size="sm"
                    onClick={() => {
                      logistica.adicionarProgramacao({
                        saida: '10:00',
                        tipoEntrega: 'D+0',
                      })
                      toast.success('Programação adicionada')
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {logistica.estado.programacaoOperacional?.map((prog, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="border rounded p-3 bg-gray-50 space-y-3"
                  >
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Saída</Label>
                        <Input
                          type="time"
                          value={prog.saida}
                          onChange={(e) =>
                            logistica.atualizarProgramacao(idx, {
                              ...prog,
                              saida: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Retorno</Label>
                        <Input
                          type="time"
                          value={prog.retorno || ''}
                          onChange={(e) =>
                            logistica.atualizarProgramacao(idx, {
                              ...prog,
                              retorno: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo Entrega</Label>
                        <select
                          value={prog.tipoEntrega}
                          onChange={(e) =>
                            logistica.atualizarProgramacao(idx, {
                              ...prog,
                              tipoEntrega: e.target.value as any,
                            })
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          <option value="D+0">D+0</option>
                          <option value="D+1">D+1</option>
                          <option value="D+2">D+2</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Observação</Label>
                        <Input
                          placeholder="Opcional"
                          value={prog.observacao || ''}
                          onChange={(e) =>
                            logistica.atualizarProgramacao(idx, {
                              ...prog,
                              observacao: e.target.value,
                            })
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          logistica.removerProgramacao(idx)
                          toast.success('Programação removida')
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ABA FINANCEIRO AVANÇADO */}
        {abaAtiva === 'financeiro' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  💰 Sincronização Automática de Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Cliente</Label>
                    <Input
                      placeholder="0,00"
                      value={financeiro.estado.valorCliente || ''}
                      onChange={(e) =>
                        financeiro.setValorCliente(e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label>
                      Valor Prestador{' '}
                      <Badge variant="outline" className="ml-2">
                        Auto-sync
                      </Badge>
                    </Label>
                    <Input
                      placeholder="0,00"
                      value={
                        financeiro.estado.valorPrestador > 0
                          ? `R$ ${financeiro.estado.valorPrestador.toFixed(2)}`
                          : ''
                      }
                      onChange={(e) =>
                        financeiro.setValorPrestador(e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>
                      % Prestador vs Cliente{' '}
                      <Badge variant="outline" className="ml-2">
                        Auto-calc
                      </Badge>
                    </Label>
                    <Input
                      placeholder="0,00%"
                      value={
                        financeiro.estado.percentualPrestadorVsCliente
                          ? `${financeiro.estado.percentualPrestadorVsCliente.toFixed(2)}%`
                          : ''
                      }
                      onChange={(e) =>
                        financeiro.setPercentualPrestador(e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Warnings */}
                {financeiro.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800 space-y-1">
                    {financeiro.warnings.map((w, i) => (
                      <div key={i}>⚠️ {w}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  🚀 KM Excedente Bidirecional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>KM Excedente Cliente</Label>
                    <Input
                      placeholder="0,00"
                      value={
                        financeiro.estado.kmExcedenteCliente || ''
                      }
                      onChange={(e) =>
                        financeiro.setKmExcedenteCliente(e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label>
                      KM Excedente Prestador{' '}
                      <Badge variant="outline" className="ml-2">
                        Auto-sync
                      </Badge>
                    </Label>
                    <Input
                      placeholder="0,00"
                      value={
                        financeiro.estado.kmExcedentePrestador > 0
                          ? `R$ ${financeiro.estado.kmExcedentePrestador.toFixed(2)}`
                          : ''
                      }
                      onChange={(e) =>
                        financeiro.setKmExcedentePrestador(e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    % KM Excedente Prestador{' '}
                    <Badge variant="outline" className="ml-2">
                      Auto-calc
                    </Badge>
                  </Label>
                  <Input
                    placeholder="0,00%"
                    value={
                      financeiro.estado.percentualKmExcedentePrestador
                        ? `${financeiro.estado.percentualKmExcedentePrestador.toFixed(2)}%`
                        : ''
                    }
                    onChange={(e) =>
                      financeiro.setPercentualKmExcedente(e.target.value)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} className="bg-purple-600">
            Salvar Operação
          </Button>
        </div>
      </div>

      {/* PREVIEW LATERAL */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          {operacao && (
            <OperationJobPreviewCompacto
              operacao={{ ...operacao, financeiro: financeiro.estado, logistica: logistica.estado }}
              logistica={logistica.estado}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default OperacaoFormLogistica

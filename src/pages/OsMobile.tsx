import React, { useState } from 'react';

export default function OsMobile() {
  const [tab, setTab] = useState<'nova' | 'aberto' | 'financeiro'>('nova');
  const [retornoOrigem, setRetornoOrigem] = useState(false);
  const [tempoEspera, setTempoEspera] = useState(0);
  const [taxaChuva, setTaxaChuva] = useState(false);
  const [valorCliente] = useState(0);
  
  const [recebedor, setRecebedor] = useState('');
  const [documentoRecebedor, setDocumentoRecebedor] = useState('');
  const [localEntrega, setLocalEntrega] = useState('Portaria');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <h1 className="font-bold text-lg text-gray-800">Conexão Express — Campo</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('nova')} className={px-3 py-1.5 rounded-lg text-sm font-medium }>Nova OS</button>
          <button onClick={() => setTab('aberto')} className={px-3 py-1.5 rounded-lg text-sm font-medium }>Em Aberto</button>
          <button onClick={() => setTab('financeiro')} className={px-3 py-1.5 rounded-lg text-sm font-medium }>Financeiro</button>
        </div>
      </header>

      <main className="p-4 flex-1 max-w-2xl mx-auto w-full">
        {tab === 'nova' && (
          <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm border">
            <h2 className="font-bold text-md text-orange-600">Nova Ordem de Serviço (Mobile)</h2>
            
            <div className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between">
              <div>
                <span className="font-medium text-sm block text-gray-700">Retorno à origem</span>
                <span className="text-xs text-gray-500">Calcula KM de volta automaticamente no Mapbox</span>
              </div>
              <input type="checkbox" checked={retornoOrigem} onChange={(e) => setRetornoOrigem(e.target.checked)} className="w-5 h-5 accent-orange-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Espera (min)</label>
                <input type="number" value={tempoEspera} onChange={(e) => setTempoEspera(Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={taxaChuva} onChange={(e) => setTaxaChuva(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                  Taxa de Chuva
                </label>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 flex justify-between items-center">
              <div>
                <span className="text-xs text-orange-700 block font-semibold">VALOR TOTAL CLIENTE</span>
                <span className="text-xl font-bold text-orange-900">R$ {(valorCliente + (tempoEspera * 0.5) + (taxaChuva ? 20 : 0)).toFixed(2)}</span>
              </div>
              <button className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow hover:bg-orange-700">Criar OS</button>
            </div>
          </div>
        )}

        {tab === 'aberto' && (
          <div className="space-y-4">
            <h2 className="font-bold text-md text-gray-800">OS em Aberto / Baixa de Campo</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-sm text-gray-700">OS-202610-257431</span>
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded font-medium">Pendente</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block">Quem recebeu:</label>
                  <input type="text" value={recebedor} onChange={e => setRecebedor(e.target.value)} placeholder="Ex: João Silva" className="w-full border rounded p-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block">Documento (RG/CPF):</label>
                    <input type="text" value={documentoRecebedor} onChange={e => setDocumentoRecebedor(e.target.value)} placeholder="Opcional" className="w-full border rounded p-1.5" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block">Local:</label>
                    <select value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} className="w-full border rounded p-1.5">
                      <option value="Portaria">Portaria</option>
                      <option value="Recepcao">Recepção</option>
                      <option value="Familiar">Familiar</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
                <button className="w-full bg-green-600 text-white py-2 rounded-lg font-bold mt-2 shadow">Concluir Baixa & Enviar WhatsApp</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'financeiro' && (
          <div className="space-y-4">
            <h2 className="font-bold text-md text-gray-800">Financeiro — Integração TMS</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <p className="text-sm text-gray-600">Controle de repasses específicos para OS Mobile e fechamento de caixa diário.</p>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
                <span className="text-sm font-semibold">Total Pendente Repasse</span>
                <span className="text-lg font-bold text-red-600">R$ 30.177,00</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const fs = require('fs');
let code = fs.readFileSync('src/components/financeiro/PagamentoPrestadores.tsx', 'utf8');

const regexPrestador = /<Select value=\{novoPagamento\.prestadorId\} onValueChange=\{v => setNovoPagamento\(p => \(\{ \.\.\.p, prestadorId: v \}\)\)\}>[\s\S]*?<SelectTrigger><SelectValue placeholder="Selecione o prestador" \/><\/SelectTrigger>[\s\S]*?<SelectContent>[\s\S]*?\{prestadores\.map\(p => \([\s\S]*?<SelectItem key=\{p\.id\} value=\{p\.id\}>\{p\.nome_completo\}<\/SelectItem>[\s\S]*?\)\)\}[\s\S]*?<\/SelectContent>[\s\S]*?<\/Select>/m;

const replacementPrestador = `<Select value={novoPagamento.prestadorId} onValueChange={v => setNovoPagamento(p => ({ ...p, prestadorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o prestador" /></SelectTrigger>
                    <SelectContent>
                      {prestadores.length === 0 ? (
                        <div className="p-3 text-sm text-red-500 font-medium text-center">
                          Nenhum prestador encontrado. Cadastre um prestador antes de lançar pagamento.
                        </div>
                      ) : (
                        prestadores.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>`;

code = code.replace(regexPrestador, replacementPrestador);

const regexTipo = /<Select value=\{novoPagamento\.tipoLancamento\} onValueChange=\{v => setNovoPagamento\(p => \(\{ \.\.\.p, tipoLancamento: v \}\)\)\}>[\s\S]*?<SelectTrigger><SelectValue \/><\/SelectTrigger>[\s\S]*?<SelectContent>[\s\S]*?<\/SelectContent>[\s\S]*?<\/Select>/m;

const replacementTipo = `<Select value={novoPagamento.tipoLancamento} onValueChange={v => setNovoPagamento(p => ({ ...p, tipoLancamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Serviço OS">Serviço OS</SelectItem>
                      <SelectItem value="Avulso">Avulso</SelectItem>
                      <SelectItem value="Reembolso">Reembolso</SelectItem>
                      <SelectItem value="Pedágio">Pedágio</SelectItem>
                      <SelectItem value="Estacionamento">Estacionamento</SelectItem>
                      <SelectItem value="Combustível">Combustível</SelectItem>
                      <SelectItem value="Diária">Diária</SelectItem>
                      <SelectItem value="Ajudante">Ajudante</SelectItem>
                      <SelectItem value="Adicional">Adicional</SelectItem>
                      <SelectItem value="Desconto">Desconto</SelectItem>
                      <SelectItem value="Adiantamento">Adiantamento</SelectItem>
                      <SelectItem value="Multa">Multa</SelectItem>
                      <SelectItem value="Ajuste">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>`;

code = code.replace(regexTipo, replacementTipo);

fs.writeFileSync('src/components/financeiro/PagamentoPrestadores.tsx', code);
console.log('Update done.');

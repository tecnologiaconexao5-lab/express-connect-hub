const fs = require('fs');
let code = fs.readFileSync('src/pages/Financeiro.tsx', 'utf8');

const newDialog = `                      <DialogTrigger asChild>
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"><Plus className="w-4 h-4 mr-2"/> Nova Despesa (Contas a Pagar)</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-orange-600"/> Lançamento de Contas a Pagar</DialogTitle></DialogHeader>
                        
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1">
                               <Label className="text-xs">Origem do Pagamento / Fornecedor</Label>
                               <Select>
                                 <SelectTrigger><SelectValue placeholder="Selecione o favorecido..." /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="prestador">Prestador Cadastrado</SelectItem>
                                   <SelectItem value="fornecedor">Fornecedor Geral</SelectItem>
                                   <SelectItem value="fixa">Despesa Fixa Recorrente</SelectItem>
                                   <SelectItem value="outro">Outro (Avulso)</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Buscar Favorecido</Label>
                               <Input placeholder="Digite o nome, cnpj ou cpf..." disabled={false} />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Categoria / Plano de Contas</Label>
                               <Select>
                                 <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="energia">Energia elétrica</SelectItem>
                                   <SelectItem value="agua">Água</SelectItem>
                                   <SelectItem value="aluguel">Aluguel / Condomínio</SelectItem>
                                   <SelectItem value="manutencao">Manutenção Frota</SelectItem>
                                   <SelectItem value="combustivel">Combustível</SelectItem>
                                   <SelectItem value="folha">Folha de Pagamento</SelectItem>
                                   <SelectItem value="impostos">Impostos Diversos</SelectItem>
                                   <SelectItem value="outros">Outros</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Centro de Custo / Unidade</Label>
                               <Select defaultValue="matriz">
                                 <SelectTrigger><SelectValue placeholder="Unidade..." /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="matriz">Matriz (SP) - Administrativo</SelectItem>
                                   <SelectItem value="frota">Frota Própria</SelectItem>
                                   <SelectItem value="op">Operacional Base</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                          </div>

                          <div className="border border-orange-100 bg-orange-50/50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="col-span-2 md:col-span-1 space-y-1">
                               <Label className="text-xs">Valor Original (R$)</Label>
                               <Input type="number" placeholder="0,00" className="font-mono font-bold text-orange-700 text-lg" />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Acres/Multa/Juros (+)</Label>
                               <Input type="number" placeholder="0,00" className="font-mono text-red-600" />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Descontos (-)</Label>
                               <Input type="number" placeholder="0,00" className="font-mono text-green-600" />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Valor Total Pagar</Label>
                               <Input disabled type="text" value="R$ 0,00" className="font-mono font-bold text-orange-700 bg-transparent border-none p-0 text-lg" />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                             <div className="space-y-1">
                               <Label className="text-xs">Documento/NF</Label>
                               <Input placeholder="Nº Documento" />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Vencimento</Label>
                               <Input type="date" />
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Competência</Label>
                               <Input placeholder="MM/AAAA" />
                             </div>
                             <div className="space-y-1 col-span-2">
                               <Label className="text-xs">Forma de Pagamento</Label>
                               <Select>
                                 <SelectTrigger><SelectValue placeholder="PIX/Boleto..." /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="boleto">Boleto Bancário</SelectItem>
                                   <SelectItem value="pix">PIX</SelectItem>
                                   <SelectItem value="ted">TED / Transferência</SelectItem>
                                   <SelectItem value="debito">Débito Automático</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1 flex flex-col justify-end">
                               <Label className="text-xs mb-2">Lote CNAB</Label>
                               <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
                                  <input type="checkbox" id="cnab" className="w-4 h-4 cursor-pointer" />
                                  <Label htmlFor="cnab" className="cursor-pointer">Gerar para remessa em lote (CNAB)</Label>
                               </div>
                             </div>
                             <div className="space-y-1">
                               <Label className="text-xs">Conta Bancária de Saída</Label>
                               <Select>
                                 <SelectTrigger><SelectValue placeholder="De onde o dinheiro sairá?" /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="itau">Conta Corrente Principal Itaú</SelectItem>
                                   <SelectItem value="poupanca">Conta Poupança Bradesco</SelectItem>
                                   <SelectItem value="caixa">Caixa Físico Interno</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs">Observações / Histórico</Label>
                             <Textarea placeholder="Descreva os detalhes desta despesa..." className="resize-none" />
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button variant="outline">Cancelar</Button>
                          <Button className="bg-orange-600 hover:bg-orange-700 font-bold gap-2"><Check className="w-4 h-4"/> Salvar Despesa</Button>
                        </DialogFooter>
                      </DialogContent>`;

const startIdx = code.indexOf('<DialogTrigger asChild>', code.indexOf('Nova Despesa') - 100);
const endIdx = code.indexOf('</DialogContent>', startIdx) + '</DialogContent>'.length;

if (startIdx === -1 || endIdx === -1) {
  console.log('Failed to find replace block');
} else {
  code = code.substring(0, startIdx) + newDialog + code.substring(endIdx);
  fs.writeFileSync('src/pages/Financeiro.tsx', code);
  console.log('Successfully updated Financeiro.tsx');
}

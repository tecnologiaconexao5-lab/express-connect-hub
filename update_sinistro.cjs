const fs = require('fs');

let fileStr = fs.readFileSync('src/components/financeiro/SegurosFinanceiro.tsx', 'utf8');

// 1. Insert State
const sinistroState = `  const [showModalSinistro, setShowModalSinistro] = useState(false);
  const [sinistros, setSinistros] = useState<any[]>([
    { id: "1", data: "20/03/2026", os: "OS-10450-3200", tipo: "Tombamento", estimativa: 45000, protocolo: "P-923184/26", status: "Em Análise Técnica" },
    { id: "2", data: "05/02/2026", os: "OS-990-22", tipo: "Roubo / Assalto", estimativa: 120000, protocolo: "P-011234/26", status: "Indenizado (Pago)" }
  ]);
  const [formSinistro, setFormSinistro] = useState({
    os_id: '',
    tipo_sinistro: '',
    data_evento: new Date().toISOString().split('T')[0],
    valor_estimado: 0,
    seguradora: '',
    descricao: ''
  });

  const handleSalvarSinistro = async () => {
    try {
      const payload = {
        ...formSinistro,
        status: 'em_analise'
      };
      const { error } = await supabase.from('sinistros').insert([payload]);
      if (error && error.code !== '42P01') throw error;
      
      toast.success('Sinistro registrado com sucesso!');
      setShowModalSinistro(false);
      setSinistros([{
        id: Math.random().toString(),
        data: new Date(formSinistro.data_evento).toLocaleDateString('pt-BR'),
        os: formSinistro.os_id,
        tipo: formSinistro.tipo_sinistro,
        estimativa: formSinistro.valor_estimado,
        protocolo: 'Aguardando',
        status: 'Em Análise Inicial'
      }, ...sinistros]);
    } catch (e: any) {
      toast.error('Erro ao registrar sinistro: ' + e.message);
    }
  };
`;

if (!fileStr.includes('handleSalvarSinistro')) {
    fileStr = fileStr.replace('const [showModalApolice, setShowModalApolice] = useState(false);', sinistroState + '\n  const [showModalApolice, setShowModalApolice] = useState(false);');
}

// 2. Change Button
const oldBtnSinistro = '<Button className="bg-red-600 hover:bg-red-700 text-white"><Plus className="w-4 h-4 mr-1"/> Abrir Sinistro</Button>';
const newBtnSinistro = '<Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowModalSinistro(true)}><Plus className="w-4 h-4 mr-1"/> Abrir Sinistro</Button>';
fileStr = fileStr.replace(oldBtnSinistro, newBtnSinistro);

// 3. Render list based on state
const oldTableBody = `<TableBody>
                  <TableRow>
                    <TableCell className="text-sm">20/03/2026</TableCell>
                    <TableCell className="font-bold">OS-10450-3200</TableCell>
                    <TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Tombamento</Badge></TableCell>
                    <TableCell className="text-right font-medium text-red-600">{fmtFin(45000)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">P-923184/26</TableCell>
                    <TableCell><Badge variant="outline" className="text-blue-700 bg-blue-50">Em Análise Técnica</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">05/02/2026</TableCell>
                    <TableCell className="font-bold">OS-990-22</TableCell>
                    <TableCell><Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Roubo / Assalto</Badge></TableCell>
                    <TableCell className="text-right font-medium text-red-600">{fmtFin(120000)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">P-011234/26</TableCell>
                    <TableCell><Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">Indenizado (Pago)</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                  </TableRow>
                </TableBody>`;

const newTableBody = `<TableBody>
                  {sinistros.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.data}</TableCell>
                      <TableCell className="font-bold">{s.os}</TableCell>
                      <TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">{s.tipo}</Badge></TableCell>
                      <TableCell className="text-right font-medium text-red-600">{fmtFin(s.estimativa)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.protocolo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-blue-700 bg-blue-50">{s.status}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>`;

fileStr = fileStr.replace(oldTableBody, newTableBody);

// 4. Modal UI
const modalUISinistro = `
      <Dialog open={showModalSinistro} onOpenChange={setShowModalSinistro}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Abertura de Sinistro</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>OS Vinculada *</Label>
              <Input value={formSinistro.os_id} onChange={e => setFormSinistro({...formSinistro, os_id: e.target.value})} placeholder="Busque a OS" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Sinistro *</Label>
              <Select value={formSinistro.tipo_sinistro} onValueChange={v => setFormSinistro({...formSinistro, tipo_sinistro: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="roubo">Roubo / Assalto</SelectItem>
                  <SelectItem value="avaria">Avaria de Carga</SelectItem>
                  <SelectItem value="tombamento">Tombamento</SelectItem>
                  <SelectItem value="extravio">Extravio / Sumiço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do Evento *</Label>
              <Input type="date" value={formSinistro.data_evento} onChange={e => setFormSinistro({...formSinistro, data_evento: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Estimativa de Prejuízo (R$)</Label>
              <Input type="number" value={formSinistro.valor_estimado || ''} onChange={e => setFormSinistro({...formSinistro, valor_estimado: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Seguradora (Apólice Acionada) *</Label>
              <Select value={formSinistro.seguradora} onValueChange={v => setFormSinistro({...formSinistro, seguradora: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione a seguradora ativa"/></SelectTrigger>
                <SelectContent>
                  {apolices.map(a => (
                    <SelectItem key={a.id} value={a.seguradora}>{a.seguradora} - {a.tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição do Ocorrido</Label>
              <Input value={formSinistro.descricao} onChange={e => setFormSinistro({...formSinistro, descricao: e.target.value})} placeholder="Relato breve do incidente" />
            </div>
            <div className="space-y-2 col-span-2 mt-2 p-4 border border-dashed rounded flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100">
              <Upload className="w-6 h-6 text-slate-400 mb-2"/>
              <span className="text-sm text-slate-600 font-medium">Anexar BO, Fotos ou Relatórios</span>
              <span className="text-xs text-slate-400">Arraste os arquivos ou clique para buscar</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalSinistro(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleSalvarSinistro}>Registrar Sinistro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
`;

if (!fileStr.includes('Abertura de Sinistro</DialogTitle>')) {
  fileStr = fileStr.replace('</DialogContent>\n      </Dialog>', '</DialogContent>\n      </Dialog>\n' + modalUISinistro);
}

fs.writeFileSync('src/components/financeiro/SegurosFinanceiro.tsx', fileStr);
console.log('Done');

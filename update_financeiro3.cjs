const fs = require('fs');

// 1. Update Financeiro.tsx
let fin = fs.readFileSync('src/pages/Financeiro.tsx', 'utf8');
fin = fin.replace('value="seguros"', 'value="seguros-auto"'); // first occurrence
fin = fin.replace('value="seguros"', 'value="seguros-auto"'); // second occurrence
fin = fin.replace('<TabsTrigger value="seguros-auto" className="gap-2"><DollarSign className="w-4 h-4"/>Seguros</TabsTrigger>', '<TabsTrigger value="seguros-auto" className="gap-2"><ShieldCheck className="w-4 h-4"/>Seguros Auto</TabsTrigger>');
fs.writeFileSync('src/pages/Financeiro.tsx', fin);

// 2. Update SegurosFinanceiro.tsx
let seg = fs.readFileSync('src/components/financeiro/SegurosFinanceiro.tsx', 'utf8');

const importToast = 'import { toast } from "sonner";\nimport { supabase } from "@/lib/supabase";';
if (!seg.includes('toast')) {
    seg = seg.replace('import { Label } from "@/components/ui/label";', 'import { Label } from "@/components/ui/label";\n' + importToast);
}

const modalState = `  const [showModalApolice, setShowModalApolice] = useState(false);
  const [formApolice, setFormApolice] = useState({
    seguradora: '',
    numero_apolice: '',
    tipo_seguro: '',
    veiculo_id: '',
    vigencia_inicio: '',
    vigencia_fim: '',
    valor_premio: 0,
    forma_pagamento: '',
    status: 'ativa',
    observacao: ''
  });

  const handleSalvarApolice = async () => {
    try {
      const payload = {
        ...formApolice,
        veiculo_id: formApolice.veiculo_id || null
      };
      const { error } = await supabase.from('seguros_auto_apolices').insert([payload]);
      if (error && error.code !== '42P01') {
         throw error;
      }
      toast.success('Apólice salva com sucesso!');
      setShowModalApolice(false);
      setApolices([...apolices, {
        id: Math.random().toString(),
        seguradora: formApolice.seguradora,
        numero: formApolice.numero_apolice,
        tipo: formApolice.tipo_seguro,
        vigencia: formApolice.vigencia_inicio + ' até ' + formApolice.vigencia_fim,
        valorCobertura: 0,
        premioMensal: formApolice.valor_premio,
        percentualPremio: 0,
        valorMinimoAverbacao: 0,
        formaCalculo: 'valor_fixo',
        status: formApolice.status as any
      }]);
    } catch (e: any) {
      toast.error('Erro ao salvar apólice: ' + e.message);
    }
  };
`;

if (!seg.includes('handleSalvarApolice')) {
  seg = seg.replace('const [novaAverbacao, setNovaAverbacao] = useState({', modalState + '\n  const [novaAverbacao, setNovaAverbacao] = useState({');
}

const btnOld = '<Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Nova Apólice</Button>';
const btnNew = '<Button className="bg-blue-600" onClick={() => setShowModalApolice(true)}><Plus className="w-4 h-4 mr-1"/> Nova Apólice</Button>';
seg = seg.replace(btnOld, btnNew);

const modalUI = `
      <Dialog open={showModalApolice} onOpenChange={setShowModalApolice}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Apólice</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Seguradora *</Label>
              <Input value={formApolice.seguradora} onChange={e => setFormApolice({...formApolice, seguradora: e.target.value})} placeholder="Nome da Seguradora" />
            </div>
            <div className="space-y-2">
              <Label>Número da Apólice *</Label>
              <Input value={formApolice.numero_apolice} onChange={e => setFormApolice({...formApolice, numero_apolice: e.target.value})} placeholder="Ex: 123456789" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Seguro</Label>
              <Input value={formApolice.tipo_seguro} onChange={e => setFormApolice({...formApolice, tipo_seguro: e.target.value})} placeholder="RCTR-C, Frota, etc." />
            </div>
            <div className="space-y-2">
              <Label>Veículo Vinculado (Opcional)</Label>
              <Input value={formApolice.veiculo_id} onChange={e => setFormApolice({...formApolice, veiculo_id: e.target.value})} placeholder="ID do Veículo" />
            </div>
            <div className="space-y-2">
              <Label>Vigência Início *</Label>
              <Input type="date" value={formApolice.vigencia_inicio} onChange={e => setFormApolice({...formApolice, vigencia_inicio: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Vigência Fim *</Label>
              <Input type="date" value={formApolice.vigencia_fim} onChange={e => setFormApolice({...formApolice, vigencia_fim: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Valor Prêmio (R$)</Label>
              <Input type="number" value={formApolice.valor_premio || ''} onChange={e => setFormApolice({...formApolice, valor_premio: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formApolice.forma_pagamento} onValueChange={v => setFormApolice({...formApolice, forma_pagamento: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Débito em Conta">Débito em Conta</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formApolice.status} onValueChange={v => setFormApolice({...formApolice, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observação</Label>
              <Input value={formApolice.observacao} onChange={e => setFormApolice({...formApolice, observacao: e.target.value})} placeholder="Anotações gerais" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalApolice(false)}>Cancelar</Button>
            <Button className="bg-green-600" onClick={handleSalvarApolice}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
`;

if (!seg.includes('Nova Apólice</DialogTitle>')) {
  seg = seg.replace('</div>\n      )}', '</div>\n      )}\n' + modalUI);
}

fs.writeFileSync('src/components/financeiro/SegurosFinanceiro.tsx', seg);
console.log('Update done.');

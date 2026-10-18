import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'components', 'operacao', 'OrdemServicoForm.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add time inputs for "Serviço Programado?"
const blockToReplace = `<Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                          <Field label="Observações"><Textarea value={data.observacaoTorre} readOnly={readOnly} onChange={(e) => update("observacaoTorre", e.target.value)} rows={2} /></Field>`;

const replacementBlock = `<Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Horário Início *">
                              <Input type="time" required={!!data.dataProgramada} value={data.previsaoInicio || ""} readOnly={readOnly} onChange={(e) => update("previsaoInicio", e.target.value)} />
                            </Field>
                            <Field label="Horário Fim (Janela)">
                              <Input type="time" value={data.previsaoTermino || ""} readOnly={readOnly} onChange={(e) => update("previsaoTermino", e.target.value)} />
                            </Field>
                          </div>
                          <Field label="Observações"><Textarea value={data.observacaoTorre} readOnly={readOnly} onChange={(e) => update("observacaoTorre", e.target.value)} rows={2} /></Field>`;

content = content.replace(blockToReplace, replacementBlock);

fs.writeFileSync(filePath, content);
console.log('Fixed OrdemServicoForm.tsx');

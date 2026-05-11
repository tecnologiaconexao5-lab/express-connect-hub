const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/prestadores/PrestadorDetalhe.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<Input type="date" className="h-7 text-xs w-36" defaultValue=\{doc\?\.dataVencimento\} placeholder="Vencimento" \/>/g;
const replace = `<div className="flex gap-1 ml-auto">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-muted-foreground leading-none">Envio</span>
                            <Input type="date" className="h-7 text-xs w-[110px]" value={doc?.dataEnvio || ""} onChange={(e) => {
                              const newDocs = [...(p.documentos || [])];
                              const idx = newDocs.findIndex(d => d.tipo === tipo);
                              if(idx >= 0) {
                                newDocs[idx] = { ...newDocs[idx], dataEnvio: e.target.value };
                                setP(prev => ({...prev, documentos: newDocs}));
                              }
                            }} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-muted-foreground leading-none">Validade</span>
                            <Input type="date" className="h-7 text-xs w-[110px]" value={doc?.dataVencimento || ""} onChange={(e) => {
                              const newDocs = [...(p.documentos || [])];
                              const idx = newDocs.findIndex(d => d.tipo === tipo);
                              if(idx >= 0) {
                                newDocs[idx] = { ...newDocs[idx], dataVencimento: e.target.value };
                                setP(prev => ({...prev, documentos: newDocs}));
                              }
                            }} />
                          </div>
                        </div>`;

content = content.replace(regex, replace);

fs.writeFileSync(file, content, 'utf8');
console.log('Script applied.');

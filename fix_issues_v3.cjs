const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// Fix 1: Resumo do dia calculations and display
const regexTotalDia = /const totalDia = diariaCalculada \+ valorKmExcedente \+ totals\.totalAdicionais - totals\.totalDescontos;/;
if (regexTotalDia.test(code)) {
   code = code.replace(regexTotalDia, `const adicionaisManuais = Math.max(totals.totalAdicionais - valorKmExcedente, 0);\n                    const totalDia = diariaCalculada + valorKmExcedente + adicionaisManuais - totals.totalDescontos;`);
}

const regexAdicionais = /<span>\+ Adicionais Financeiros:<\/span>\s*<span className="font-medium text-slate-800">R\$ \{totals\.totalAdicionais\.toLocaleString\('pt-BR', \{ minimumFractionDigits: 2 \}\)}<\/span>/g;
code = code.replace(regexAdicionais, `<span>+ Adicionais Financeiros:</span>\n                          <span className="font-medium text-slate-800">R$ {adicionaisManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`);


// Fix 2: Aba Status da Entrega placement
// Let's check where it is currently.
const statusCode = code.match(/<TabsContent value="status"[\s\S]*?<\/TabsContent>/);
if (statusCode) {
    // It's there. Let's make sure it's inside the correct <Tabs>.
    // The correct <Tabs> is the one starting at line ~1797 (which is inside the right column).
    // The inner Tabs ends just before the outer div ends.
    // Wait, let's remove it from wherever it is, and put it right after the </TabsContent> of "resumo".
    code = code.replace(/<TabsContent value="status"[\s\S]*?<\/TabsContent>/g, '');
    
    // Find the end of "resumo"
    const resumoEndRegex = /<\/TabsContent>\s*<\/Tabs>/;
    // We will place it right before the last </Tabs> in the component, or specifically after Resumo do dia.
    // Let's find exactly the </TabsContent> that closes "resumo".
    // It's the one before `</Tabs>`
    // Wait, I can just append it before `            </Tabs>` at the bottom of the modal.
    const modalTabsEnd = `              </TabsContent>
            </Tabs>
`;
    if (code.includes(modalTabsEnd)) {
        code = code.replace(modalTabsEnd, `              </TabsContent>\n${statusCode[0]}\n            </Tabs>\n`);
    } else {
        // Fallback: just put it before the very last `</Tabs>` that belongs to the modal
        const lastTabsMatch = code.lastIndexOf('</Tabs>');
        if (lastTabsMatch !== -1) {
            code = code.substring(0, lastTabsMatch) + statusCode[0] + '\n            </Tabs>' + code.substring(lastTabsMatch + 7);
        }
    }
}

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fixed duplicidade and status tab position');

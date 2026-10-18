import { readFileSync, writeFileSync, readdirSync } from 'fs';

const dir = 'tests/e2e';
const files = readdirSync(dir).filter(f => f.endsWith('.spec.ts'));

let modified = 0;

for (const file of files) {
  const fp = dir + '/' + file;
  let content = readFileSync(fp, 'utf-8');
  const original = content;

  // Fix: lines that start with a comment and have code after the comment
  // Pattern: "// comment\ncode" became "// comment    code" on one line
  // We need to split these: keep the comment, put code back on new line
  
  // Find lines that are ONLY a comment (ending without code):
  // Already OK
  
  // Find lines that have a comment followed by code:
  // Pattern: "    // comment text    code goes here"
  // The `//` makes everything after it a comment until end of line
  // So we need to extract code after the comment and put it on the next line
  
  const lines = content.split('\n');
  let newLines = [];
  let lineFixed = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line has a comment followed by code on the same line
    const commentMatch = line.match(/^(\s*)\/\/.*?(\b\w+.*)$/);
    
    if (commentMatch) {
      // Check if the code after the comment looks like valid JS/TS
      const codePart = commentMatch[2].trim();
      // Only fix if code starts with a valid JS keyword or identifier
      if (/^(const|let|var|await|expect|if|for|while|return|function|import|export|test|page|console|supabase|fs|path|process|\{|\}|\))/.test(codePart) || 
          /^\w[\w.]*\(/.test(codePart)) {
        // This is comment + code on same line - split them
        // Extract just the comment part (up to the code starting)
        const indent = commentMatch[1];
        const commentEnd = line.indexOf('//');
        const afterComment = line.slice(commentEnd + 2); // after //
        
        // Find where code starts (after the comment text and whitespace)
        // The code starts at the position of the first valid keyword
        const codeIndex = afterComment.search(/\b(const|let|var|await|expect|if|for|while|return|function|import|export|test|page|console|supabase|fs|path)\b|\w+\s*\(/);
        
        if (codeIndex > 0) {
          // Split: comment text is before codeIndex
          const commentText = afterComment.slice(0, codeIndex).trim();
          const codeText = afterComment.slice(codeIndex);
          newLines.push(indent + '// ' + commentText);
          newLines.push(indent + codeText);
          lineFixed = true;
          continue;
        }
      }
    }
    
    // Fix: // comment ===  ===    await code -> split
    const eqMatch = line.match(/^(\s*)\/\/.*?={3,}.*?\b(await|const|let|var|expect)\b/);
    if (eqMatch) {
      const indent = eqMatch[1];
      const codeIdx = line.search(/\b(await|const|let|var|expect)\b[^]*$/);
      if (codeIdx >= 0) {
        const codePart = line.slice(codeIdx);
        newLines.push(line.slice(0, codeIdx).replace(/\s+$/, ''));
        newLines.push(indent + codePart);
        lineFixed = true;
        continue;
      }
    }
    
    newLines.push(line);
  }
  
  if (lineFixed) {
    content = newLines.join('\n');
  }

  // Fix 2: Remove stray = at start of indented lines (from === ornaments)
  content = content.replace(/^((?:\s*\n)*\s*)=\s+/gm, (match, indent) => {
    // Only fix if the = is at a position that doesn't make sense (assignment)
    const trimmed = match.trim();
    if (trimmed.startsWith('=') && trimmed.length < 10) {
      return match.replace(/^(\s*)=\s+/, '$1');
    }
    return match;
  });
  content = content.replace(/^(\s*)=\s+(await|const|let|var|expect|\{)/gm, '$1$2');

  // Fix 3: Unterminated regex .toLowerCase() /  
  content = content.replace(/\.toLowerCase\(\)\s*\/\s*$/gm, '.toLowerCase()');

  if (content !== original) {
    writeFileSync(fp, content, 'utf-8');
    modified++;
  }
}

console.log(`Modified: ${modified} files`);

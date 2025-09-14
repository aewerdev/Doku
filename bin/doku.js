#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToFile } from '../lib/compiler.js';
import { buildProject } from '../lib/builder.js';
import { generateProject } from '../lib/generator.js';

function printHelp(){
  console.log(`Doku CLI

Usage:
  doku new <dir>
  doku build [projectDir] [--format=html|doku]
  doku compile <input.doku> <output.html>
  doku help
`);
}

async function main(){
  const args = process.argv.slice(2);
  const cmd = args[0];
  if(!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h'){
    printHelp();
    process.exit(0);
  }
  if(cmd === 'new'){
    const dir = args[1];
    if(!dir){ console.error('Usage: doku new <dir>'); process.exit(1); }
    const abs = path.resolve(process.cwd(), dir);
    await generateProject(abs, { name: path.basename(abs) });
    console.log('Doku project created at', abs);
    return;
  }
  if(cmd === 'build'){
    const dirArg = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    const dir = dirArg ? path.resolve(process.cwd(), dirArg) : process.cwd();
    const formatArg = (args.find(a=>a.startsWith('--format=')) || '').split('=')[1];
    const format = (formatArg && /^(html|doku)$/i.test(formatArg)) ? formatArg.toLowerCase() : 'html';
    const res = await buildProject(dir, { format });
    console.log('Doku built:', res);
    return;
  }
  if(cmd === 'compile'){
    const input = args[1];
    const output = args[2];
    if(!input || !output){ console.error('Usage: doku compile <input.doku> <output.html>'); process.exit(1); }
    await compileToFile(path.resolve(process.cwd(), input), path.resolve(process.cwd(), output));
    console.log('Compiled to', path.resolve(process.cwd(), output));
    return;
  }
  console.error('Unknown command:', cmd);
  printHelp();
  process.exit(1);
}

main().catch(e=>{ console.error(e); process.exit(1); });

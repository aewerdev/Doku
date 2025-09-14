#!/usr/bin/env node
import { compileToFile } from '../lib/compiler.js';
import path from 'node:path';

async function main(){
  const [,, input, output] = process.argv;
  if(!input || !output){
    console.error('Usage: doku-compile <input.doku> <output.html>');
    process.exit(1);
  }
  const out = path.resolve(process.cwd(), output);
  await compileToFile(path.resolve(process.cwd(), input), out);
  console.log('Compiled to', out);
}

main().catch(e=>{ console.error(e); process.exit(1); });

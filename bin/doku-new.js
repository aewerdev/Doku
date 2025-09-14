#!/usr/bin/env node
import path from 'node:path';
import { generateProject } from '../lib/generator.js';

async function main(){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: doku-new <directory>');
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), target);
  await generateProject(abs, { name: path.basename(abs) });
  console.log('Doku project created at', abs);
}

main().catch(e=>{ console.error(e); process.exit(1); });

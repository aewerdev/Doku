#!/usr/bin/env node
import path from 'node:path';
import { buildProject } from '../lib/builder.js';

async function main(){
  const args = process.argv.slice(2);
  const projectDirArg = args.find(a=>!a.startsWith('--'));
  const projectDir = projectDirArg ? path.resolve(process.cwd(), projectDirArg) : process.cwd();
  const formatArg = (args.find(a=>a.startsWith('--format=')) || '').split('=')[1];
  const format = (formatArg && /^(html|doku)$/i.test(formatArg)) ? formatArg.toLowerCase() : 'html';
  const res = await buildProject(projectDir, { format });
  console.log('Doku built:', res);
}

main().catch(e=>{ console.error(e); process.exit(1); });

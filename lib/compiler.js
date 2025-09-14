// Core Doku compiler (Node). Compiles a .doku file/string into HTML and metadata.
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import toml from 'toml';
import { marked } from 'marked';
import hljs from 'highlight.js';

function parseFrontmatter(text){
  // Auto-detect YAML (---) vs TOML (+++) and configure gray-matter engine accordingly.
  const isYaml = text.startsWith('---\n');
  const isToml = text.startsWith('+++\n');
  if(isToml){
    return matter(text, { language: 'toml', engines: { toml: (s)=>toml.parse(s) } });
  }
  if(isYaml){
    return matter(text, { language: 'yaml', engines: { yaml: (s)=>yaml.load(s) } });
  }
  // fallback to YAML engine by default
  return matter(text, { language: 'yaml', engines: { yaml: (s)=>yaml.load(s) } });
}

export function compileString(dokuText, opts={}){
  const { data, content } = parseFrontmatter(dokuText);
  // Configure marked with highlight.js if not already configured by caller
  const markedOptions = {
    highlight(code, lang){
      if(lang && hljs.getLanguage(lang)){
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    langPrefix: 'hljs language-',
    ...(opts.marked || {})
  };
  const html = marked.parse(content, markedOptions);
  const title = data?.title || (content.match(/^#\s+(.+)/m)?.[1]) || 'Document';
  return { html, meta: data || {}, title };
}

export async function compileFile(filePath, opts={}){
  const text = await fs.readFile(filePath, 'utf-8');
  const res = compileString(text, opts);
  res.inputPath = filePath;
  return res;
}

export async function compileToFile(inputFile, outputFile, opts={}){
  const { html, title, meta } = await compileFile(inputFile, opts);
  const docHtml = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n<main class="doku">\n${html}\n</main>\n</body>\n</html>`;
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, docHtml, 'utf-8');
  return { outputFile, title, meta };
}

function escapeHtml(s){
  return String(s).replace(/[&<>]/g, c=>({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

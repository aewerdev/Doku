// Doku project generator: scaffolds a new Doku project
import fs from 'node:fs/promises';
import path from 'node:path';

export async function generateProject(targetDir, opts={}){
  const name = opts.name || path.basename(path.resolve(targetDir));
  await fs.mkdir(targetDir, { recursive: true });
  const files = {
    'doku.toml': `title = "${name}"
[author]
name = "Your Name"
`,
    'version.yaml': `version: 0.1.0
build: dev
`,
    'config.json': JSON.stringify({ title: name, buildIdPrefix: 'build' }, null, 2) + '\n',
    'index.html': `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${name}</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style>
  </head>
<body>
  <h1>${name}</h1>
  <p>This is a Doku project. Edit Markdown files in <code>src/</code> and navigation in <code>src/result.yaml</code>. Then run:</p>
  <pre><code>npx doku-build</code></pre>
  <p>Open the generated file in <code>res/</code> named <code>index_&lt;buildid&gt;.html</code>.</p>
  <hr/>
  <p>To embed a compiled <code>.doku</code> file directly in a website, include <code>dokujs.js</code> and add:
  </p>
  <pre><code>&lt;script src="/path/to/dokujs.js"&gt;&lt;/script&gt;
&lt;doku src="/path/to/file.doku"&gt;&lt;/doku&gt;</code></pre>
  </body>
</html>
`,
    'src/result.yaml': `title: ${name}
repo: https://github.com/your/repo
author:
  name: Your Name
  url: https://example.com
  avatar: https://avatars.githubusercontent.com/u/9919?v=4
theme:
  primary: "#0f62fe"
  accent: "#f1c21b"
logo: assets/logo.svg
languages:
  - code: en
    label: English
  - code: ru
    label: Русский
socials:
  - icon: github
    url: https://github.com/your
  - icon: x
    url: https://x.com/your
nav:
  en:
    - text: Introduction
      file: intro.md
    - text: First Chapter
      file: chapter1.md
  ru:
    - text: Введение
      file: intro.ru.md
    - text: Первая глава
      file: chapter1.ru.md
`,
    'src/intro.md': `---
title: Introduction
---
# Welcome to ${name}

This is your new Doku project. Edit files in \`src/\` and manage navigation and socials in \`src/result.yaml\`.

Code sample:

\`\`\`js
function hello(name){
  console.log('Hello, ' + name);
}
hello('Doku');
\`\`\`
`,
    'src/chapter1.md': `---
title: First Chapter
---
# First Steps

Write your guide content in Markdown within .md files.

- Use \`src/result.yaml\` to control nav and theme
- Use frontmatter in each page to define \`title\`
`
    ,
    'src/intro.ru.md': `---
title: Введение
---
# Добро пожаловать в ${name}

Это ваш новый проект Doku. Редактируйте файлы в каталоге \`src/\` и управляйте навигацией и соцсетями в \`src/result.yaml\`.

Пример кода:

\`\`\`js
function hello(name){
  console.log('Привет, ' + name);
}
hello('Doku');
\`\`\`
`,
    'src/chapter1.ru.md': `---
title: Первая глава
---
# Первые шаги

Пишите контент руководства в Markdown (.md).

- Используйте \`src/result.yaml\` для управления навигацией и темой
- Используйте фронтматтер для задания \`title\` на странице
`
    ,
    'src/assets/logo.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f62fe"/>
      <stop offset="100%" stop-color="#f1c21b"/>
    </linearGradient>
  </defs>
  <rect rx="16" ry="16" width="128" height="128" fill="url(#g)"/>
  <g fill="#fff">
    <path d="M32 32h46a10 10 0 0 1 10 10v8H42a10 10 0 0 0-10 10v36h-0V42a10 10 0 0 1 10-10z" opacity=".9"/>
    <path d="M42 54h54v42a10 10 0 0 1-10 10H42V54z" opacity=".95"/>
    <rect x="48" y="62" width="40" height="6" rx="3"/>
    <rect x="48" y="74" width="34" height="6" rx="3"/>
    <rect x="48" y="86" width="28" height="6" rx="3"/>
  </g>
</svg>
`
  };
  for(const [rel, content] of Object.entries(files)){
    const f = path.join(targetDir, rel);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, content, 'utf-8');
  }
  return { dir: targetDir };
}

// Doku project builder: reads doku.toml, version.yaml, config.json, src/result.yaml and builds res/index_<buildid>.{html,js}
import fs from 'node:fs/promises';
import path from 'node:path';
import toml from 'toml';
import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import { compileString } from './compiler.js';

async function readIfExists(p){
  try { return await fs.readFile(p, 'utf-8'); } catch { return null; }
}

export async function buildProject(projectDir, options = {}){
  const dokuTomlPath = path.join(projectDir, 'doku.toml');
  const versionYamlPath = path.join(projectDir, 'version.yaml');
  const configJsonPath = path.join(projectDir, 'config.json');
  const indexHtmlPath = path.join(projectDir, 'index.html');
  const srcDir = path.join(projectDir, 'src');
  const resDir = path.join(projectDir, 'res');
  const orderYamlPath = path.join(srcDir, 'result.yaml');
  const assetsSrcDir = path.join(srcDir, 'assets');
  const assetsOutDir = path.join(resDir, 'assets');

  const [dokuToml, versionYaml, configJson, indexHtml, orderYaml] = await Promise.all([
    readIfExists(dokuTomlPath), readIfExists(versionYamlPath), readIfExists(configJsonPath), readIfExists(indexHtmlPath), readIfExists(orderYamlPath)
  ]);

  const dokuCfg = dokuToml ? toml.parse(dokuToml) : {};
  const ver = versionYaml ? yaml.load(versionYaml) : {};
  const cfg = configJson ? JSON.parse(configJson) : {};
  const site = orderYaml ? (yaml.load(orderYaml) || {}) : {};
  const socials = Array.isArray(site.socials) ? site.socials : [];
  const repo = site.repo || cfg.repo || dokuCfg.repo || null;
  const theme = site.theme || {};
  const primary = theme.primary || '#0f62fe';
  const accent = theme.accent || '#f1c21b';
  const titleText = site.title || dokuCfg.title || cfg.title || 'Doku Site';
  const logoPath = site.logo ? String(site.logo).replace(/^\.?\/?/, '') : null; // e.g., assets/logo.svg
  const languages = Array.isArray(site.languages) && site.languages.length
    ? site.languages.map(l=>({ code: String(l.code || l).trim(), label: l.label || String(l).toUpperCase() }))
    : [{ code: 'en', label: 'English' }];
  const navConfig = site.nav || [];
  const navByLang = {};
  if(Array.isArray(navConfig)){
    for(const {code} of languages){ navByLang[code] = navConfig; }
  } else if (navConfig && typeof navConfig === 'object'){
    for(const {code} of languages){ navByLang[code] = Array.isArray(navConfig[code]) ? navConfig[code] : []; }
  } else {
    for(const {code} of languages){ navByLang[code] = []; }
  }

  // Load markdown pages per language (relative to src/)
  const pagesByLang = {};
  for(const {code} of languages){
    const nav = navByLang[code] || [];
    const list = [];
    for(let i=0; i<nav.length; i++){
      const item = nav[i];
      if(!item || !item.file) continue;
      const rel = item.file;
      const p = path.join(srcDir, rel);
      const text = await fs.readFile(p, 'utf-8');
      const { html, title, meta } = compileString(text);
      list.push({ rel, html, title: item.text || title, meta, raw: text });
    }
    pagesByLang[code] = list;
  }

  // Build combined TOC and body for each language
  const tocByLang = {};
  const bodyByLang = {};
  for(const {code} of languages){
    const pages = pagesByLang[code] || [];
    tocByLang[code] = pages.map((p,i)=>`<li><a href="#sec-${code}-${i}">${escapeHtml(p.title)}</a></li>`).join('');
    bodyByLang[code] = pages.map((p,i)=>`<section id="sec-${code}-${i}" class="doku-section" data-lang="${code}">\n<h1>${escapeHtml(p.title)}</h1>\n${p.html}\n</section>`).join('\n');
  }

  const buildId = (cfg.buildIdPrefix || 'build') + '_' + nanoid(8);
  await fs.mkdir(resDir, { recursive: true });

  // Copy assets folder if present and build manifest { id: nanoid, path: relative }
  const assetsManifest = {};
  async function walk(dir, relBase){
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for(const ent of entries){
      const abs = path.join(dir, ent.name);
      const rel = path.posix.join(relBase, ent.name);
      if(ent.isDirectory()){
        await fs.mkdir(path.join(assetsOutDir, rel), { recursive: true });
        await walk(abs, rel);
      } else if(ent.isFile()){
        const out = path.join(assetsOutDir, rel);
        await fs.mkdir(path.dirname(out), { recursive: true });
        await fs.copyFile(abs, out);
        const id = nanoid(10);
        assetsManifest[rel] = { id, path: `assets/${rel}` };
      }
    }
  }
  try {
    // If assets directory exists, copy it
    await fs.mkdir(assetsOutDir, { recursive: true });
    const stat = await fs.stat(assetsSrcDir).catch(()=>null);
    if(stat && stat.isDirectory()){
      await walk(assetsSrcDir, '');
      await fs.writeFile(path.join(resDir, 'assets-manifest.json'), JSON.stringify(assetsManifest, null, 2), 'utf-8');
    }
  } catch {}

  const finalHtml = `<!doctype html>\n<html lang="en" data-theme="light">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<title>${escapeHtml(titleText)}</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">\n<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer"/>\n<link id="hljs-light" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" crossorigin="anonymous" referrerpolicy="no-referrer"/>\n<link id="hljs-dark" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" disabled/>\n<style>
  :root{ --primary:${primary}; --accent:${accent}; }
  *{ box-sizing:border-box }
  body{ font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin:0; color:#111; background:#fff; }
  a{ color: var(--primary); text-decoration:none }
  a:hover{ text-decoration:underline }
  header.doku-header{ position:sticky; top:0; backdrop-filter:saturate(180%) blur(8px); background:rgba(255,255,255,.85); border-bottom:1px solid #eee; z-index:10 }
  .doku-container{ max-width:1100px; margin:0 auto; padding:12px 20px; display:flex; align-items:center; gap:18px }
  .brand{ display:flex; align-items:center; gap:10px; font-weight:700; color:#111 }
  .brand .fa-book{ color: var(--primary); }
  nav.doku-nav{ margin-left:auto }
  nav.doku-nav ul{ display:flex; gap:14px; list-style:none; padding:0; margin:0 }
  nav.doku-nav a{ color:#111; font-weight:600 }
  .doku-socials{ display:flex; gap:10px; margin-left:16px }
  .doku-socials a{ color:#555 }
  .doku-socials a:hover{ color:#111 }
  main{ max-width: 1100px; margin: 0 auto; padding: 24px 20px; display:grid; grid-template-columns: 250px 1fr; gap: 28px }
  .toc{ position:sticky; top:64px; align-self:start; border-right:1px solid #eee; padding-right:16px }
  .toc ul{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px }
  .toc a{ color:#333 }
  .doku-content{ min-width:0 }
  .doku-section{ margin: 0 0 32px 0 }
  h1,h2,h3{ line-height:1.25 }
  pre, code, kbd, samp{ font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace }
  pre{ background:#f6f8fa; padding:14px; border-radius:8px; overflow:auto; border:1px solid #eee }
  .repo-link{ margin-left:8px; color:#555 }
  .author{ display:flex; align-items:center; gap:8px; margin-left:8px }
  .author img{ width:24px; height:24px; border-radius:50% }
  .theme-toggle{ margin-left:8px; cursor:pointer }
  .lang-dropdown .w3-button{ display:flex; align-items:center; gap:8px }
  .lang-dropdown .w3-dropdown-content{ min-width:180px; border-radius:10px; overflow:hidden; padding:6px }
  .lang-dropdown .w3-bar-item{ display:flex; align-items:center; gap:10px; border-radius:8px }
  .lang-ico{ width:18px; display:inline-flex; justify-content:center }
  .lang-code{ font-size:11px; padding:2px 6px; border:1px solid #ddd; border-radius:6px; color:#555 }
  .flag-emoji{ display:inline-block; width:1.25em; text-align:center }
  footer.doku-footer{ background:transparent; color: rgba(0,0,0,.45); border-top: none; }
  footer.doku-footer .copy{ font-size:12px; line-height:1.4 }
  footer.doku-footer a{ color: inherit; text-decoration: underline }
  /* Dark theme */
  html[data-theme='dark'] body{ color:#e5e5e5; background:#111 }
  html[data-theme='dark'] header.doku-header{ background: rgba(20,20,20,.8); border-bottom-color:#222 }
  html[data-theme='dark'] .toc{ border-right-color:#222 }
  html[data-theme='dark'] .doku-socials a{ color:#aaa }
  html[data-theme='dark'] nav.doku-nav a{ color:#f0f0f0 }
  html[data-theme='dark'] .brand{ color:#f5f5f5 }
  html[data-theme='dark'] pre{ background:#0d1117; border-color:#222 }
  html[data-theme='dark'] footer.doku-footer{ background:transparent; color: rgba(255,255,255,.55) }
  @media (max-width: 900px){ main{ grid-template-columns: 1fr } .toc{ display:none } }
  .lang-dropdown .w3-dropdown-content .w3-bar-item {
    padding: 8px 16px;
    border-radius: 8px;
    transition: background-color 0.2s ease-in-out;
  }
  .lang-dropdown .w3-dropdown-content .w3-bar-item:hover {
    background-color: #f0f0f0;
  }
  .lang-dropdown .w3-dropdown-content .w3-bar-item:active {
  </style>\n</head>\n<body>\n<header class="doku-header">\n  <div class="doku-container">\n    <div class="brand">${logoPath ? `<img src="${escapeAttr(logoPath.startsWith('assets/') ? logoPath : 'assets/' + logoPath)}" alt="logo" style="height:24px;width:auto"/>` : `<i class="fa-solid fa-book"></i>`}<span>${escapeHtml(titleText)}</span></div>\n    <nav class="doku-nav"><ul>${(navByLang[languages[0].code]||[]).map((n,i)=>`<li><a data-langlink="${languages[0].code}" href="#sec-${languages[0].code}-${i}">${escapeHtml(n.text || `Section ${i+1}`)}</a></li>`).join('')}</ul></nav>\n    <div class="doku-socials">${[repo ? `<a class="repo-link" href="${escapeAttr(repo)}" title="Repository"><i class="fa-brands fa-github"></i></a>` : '', ...socials.map(s=>socialIconLink(s))].join('')}</div>\n    ${site.author ? `<div class="author">${site.author.avatar ? `<img src="${escapeAttr(site.author.avatar)}" alt="${escapeAttr(site.author.name||'')}"/>` : ''}<a href="${escapeAttr(site.author.url||'#')}">${escapeHtml(site.author.name||'')}</a></div>` : ''}
    <div class="w3-dropdown-hover lang-dropdown">
      <button class="w3-button w3-round w3-small" id="lang-btn">${flagIcon(languages[0].code)} ${escapeHtml(languages[0].label)} <span class="lang-code">${escapeHtml(languages[0].code.toUpperCase())}</span></button>
      <div class="w3-dropdown-content w3-bar-block w3-card w3-white">
        ${languages.map(l=>`<a class="w3-bar-item w3-button" data-pick-lang="${l.code}"><span class="lang-ico">${flagIcon(l.code)}</span> ${escapeHtml(l.label)} <span class="lang-code">${escapeHtml(String(l.code).toUpperCase())}</span></a>`).join('')}
      </div>
    </div>
\n    <button class="w3-button w3-round w3-small theme-toggle" title="Toggle theme"><i class="fa-solid fa-moon"></i></button>
  </div>\n</header>\n<main class="w3-animate-opacity">\n  <aside class="toc">${languages.map(l=>`<ul data-lang="${l.code}" style="display:${l.code===languages[0].code?'block':'none'}">${tocByLang[l.code]||''}</ul>`).join('')}</aside>\n  <article class="doku-content">${languages.map(l=>`<div data-lang="${l.code}" style="display:${l.code===languages[0].code?'block':'none'}">${bodyByLang[l.code]||''}</div>`).join('')}</article>\n </main>\n<script>\n  // Language switching and persistence\n  (function(){\n    const langKey = 'doku-lang';\n    const defaultLang = ${JSON.stringify(languages[0].code)};\n    const languages = ${JSON.stringify(languages)};\n    const navByLang = ${JSON.stringify(navByLang)};\n    const flagByCode = ${JSON.stringify(Object.fromEntries(languages.map(l=>[l.code, flagIcon(l.code)])))};\n    function setLang(lang){\n      document.documentElement.setAttribute('lang', lang);\n      // Toggle visible content\n      document.querySelectorAll('[data-lang]').forEach(el=>{ el.style.display = (el.getAttribute('data-lang')===lang)?'block':'none'; });\n      // Update header nav\n      const ul = document.querySelector('nav.doku-nav ul');\n      if(ul){\n        ul.innerHTML = (navByLang[lang]||[]).map(function(n,i){\n          return '<li><a data-langlink="'+lang+'" href="#sec-'+lang+'-'+i+'">'+(n.text || ('Section '+(i+1)))+'</a></li>';\n        }).join('');\n      }\n\n      // Update dropdown label\n      const btn = document.getElementById('lang-btn');\n      const l = languages.find(x=>x.code===lang);\n      if(btn && l){ btn.innerHTML = (flagByCode[lang]||'🌐') + ' ' + l.label + ' <span class="lang-code">'+lang.toUpperCase()+'</span>'; }\n      localStorage.setItem(langKey, lang);\n    }\n\n    const saved = localStorage.getItem(langKey) || defaultLang;\n    setLang(saved);\n    document.querySelectorAll('[data-pick-lang]').forEach(a=>a.addEventListener('click', (e)=>{ e.preventDefault(); setLang(a.getAttribute('data-pick-lang')); }));\n  })();\n</script>\n<script type="module">\n  // Theme persistence and toggle + switch hljs theme\n  const root = document.documentElement;\n  const DARK = 'dark';\n  const LIGHT = 'light';\n  const key = 'doku-theme';\n  const saved = localStorage.getItem(key);\n  const iconEl = () => document.querySelector('.theme-toggle i');\n  const setTheme = (t)=>{ \n    root.setAttribute('data-theme', t);\n    const light = document.getElementById('hljs-light');\n    const dark = document.getElementById('hljs-dark');\n    if(light && dark){ if(t===DARK){ light.disabled = true; dark.disabled = false; } else { light.disabled = false; dark.disabled = true; } }\n    const i = iconEl();\n    if(i){ if(t===DARK){ i.classList.remove('fa-moon'); i.classList.add('fa-sun'); } else { i.classList.remove('fa-sun'); i.classList.add('fa-moon'); } }\n  };\n  setTheme(saved===DARK?DARK:LIGHT);\n  document.querySelectorAll('.theme-toggle').forEach(btn=>btn.addEventListener('click', ()=>{ const next = (root.getAttribute('data-theme')===DARK)?LIGHT:DARK; setTheme(next); localStorage.setItem(key, next); }));\n</script>\n<script src="index_${buildId}.js" type="module"></script>\n</body>\n</html>`;
  };\n  setTheme(saved===DARK?DARK:LIGHT);\n  document.querySelectorAll('.theme-toggle').forEach(btn=>btn.addEventListener('click', ()=>{ const next = (root.getAttribute('data-theme')===DARK)?LIGHT:DARK; setTheme(next); localStorage.setItem(key, next); }));\n</script>\n<script src="index_${buildId}.js" type="module"></script>\n</body>\n</html>`;

  const finalJs = `// Doku runtime metadata for ${buildId}\nexport const doku = ${JSON.stringify({ doku: dokuCfg, version: ver, config: cfg, site, assets: assetsManifest, pages: Object.values(pagesByLang).flat().map(p=>({ rel: p.rel, title: p.title, meta: p.meta })) }, null, 2)};\nconsole.log('Doku build', ${JSON.stringify(buildId)}, doku);\n`;

  const outHtmlPath = path.join(resDir, `index_${buildId}.html`);
  const outJsPath = path.join(resDir, `index_${buildId}.js`);
  await fs.writeFile(outHtmlPath, finalHtml, 'utf-8');
  await fs.writeFile(outJsPath, finalJs, 'utf-8');

  // Optional DOKU output: emit .doku pages and a doku-based index that uses the browser runtime
  let dokuIndexPath = null;
  if(String(options.format || '').toLowerCase() === 'doku'){
    const pagesRoot = path.join(resDir, 'pages');
    for(const {code} of languages){
      const langDir = path.join(pagesRoot, code);
      await fs.mkdir(langDir, { recursive: true });
      for(const pg of pagesByLang[code] || []){
        const base = pg.rel.replace(/\.[^./]+$/, '');
        const out = path.join(langDir, base + '.doku');
        await fs.writeFile(out, pg.raw, 'utf-8');
      }
    }
    const firstLang = languages[0].code;
    const firstPage = (pagesByLang[firstLang] && pagesByLang[firstLang][0]) ? pagesByLang[firstLang][0].rel.replace(/\.[^./]+$/, '') : null;
    const dokuIndex = `<!doctype html>\n<html lang="${escapeAttr(firstLang)}">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<title>${escapeHtml(titleText)} — Doku</title>\n<script src="../dokujs.js"></script>\n<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">\n<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"/>\n<style>body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px}</style>\n</head>\n<body>\n<header class="w3-padding">${escapeHtml(titleText)} <span class="w3-small w3-text-gray">(Doku client render)</span></header>\n<nav class="w3-bar w3-small">${languages.map(l=>`<a class=\"w3-bar-item w3-button\" href=\"./pages/${l.code}/${firstPage || ''}.doku\">${escapeHtml(l.label)}</a>`).join('')}</nav>\n${firstPage ? `<doku src="./pages/${firstLang}/${firstPage}.doku"></doku>` : '<div>No pages</div>'}\n</body>\n</html>`;
    dokuIndexPath = path.join(resDir, `index_doku_${buildId}.html`);
    await fs.writeFile(dokuIndexPath, dokuIndex, 'utf-8');
  }

  return { buildId, html: outHtmlPath, js: outJsPath, dokuIndex: dokuIndexPath };
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>]/g, c=>({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escapeAttr(s){
  return String(s ?? '').replace(/['"<>]/g, c=>({ '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c]));
}

function socialIconLink(s){
  if(!s || !s.url) return '';
  const icon = s.icon || 'link';
  const map = {
    github: 'fa-brands fa-github',
    gitlab: 'fa-brands fa-gitlab',
    x: 'fa-brands fa-x-twitter',
    twitter: 'fa-brands fa-x-twitter',
    linkedin: 'fa-brands fa-linkedin',
    youtube: 'fa-brands fa-youtube',
    discord: 'fa-brands fa-discord',
    slack: 'fa-brands fa-slack',
    mastodon: 'fa-brands fa-mastodon',
    globe: 'fa-solid fa-globe',
    link: 'fa-solid fa-link'
  };
  const cls = map[icon] || map.link;
  const title = s.title || icon;
  return `<a href="${escapeAttr(s.url)}" title="${escapeAttr(title)}"><i class="${cls}"></i></a>`;
}

// Language flag icon helper. Uses emoji by default, supports custom assets at assets/flags/<code>.svg/png if present in site config.
function flagIcon(code){
  const c = String(code || '').toLowerCase();
  const map = {
    en: '🇺🇸',
    ru: '🇷🇺',
    es: '🇲🇽',
    pt: '🇧🇷',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹',
    zh: '🇨🇳',
    ja: '🇯🇵',
    ko: '🇰🇷',
    ar: '🇪🇬',
    hi: '🇮🇳',
    bn: '🇧🇩',
    tr: '🇹🇷',
    fa: '🇮🇷',
    ur: '🇵🇰',
    id: '🇮🇩',
    vi: '🇻🇳',
    th: '🇹🇭',
    pl: '🇵🇱',
    uk: '🇺🇦',
    nl: '🇳🇱',
    sv: '🇸🇪',
    no: '🇳🇴',
    da: '🇩🇰',
    cs: '🇨🇿',
    el: '🇬🇷',
    he: '🇮🇱',
    sk: '🇸🇰',
    ro: '🇷🇴',
    hu: '🇭🇺',
    // fun / fictional
    pirate: '🏴\u200d☠️',
    hacker: '🧑\u200d💻',
    emoticon: '🙂',
    lolcat: '😺',
    klingon: '🛸',
    elvish: '🍃',
  };
  const emoji = map[c] || '🏳️';
  return `<span class="flag-emoji" aria-hidden="true">${emoji}</span>`;
}

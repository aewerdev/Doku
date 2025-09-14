/* Doku browser runtime: processes <doku src="..."></doku> tags and renders compiled HTML.
 * No external deps; includes a tiny frontmatter+markdown parser good enough for docs.
 */
(function(){
  function parseFrontmatter(text){
    // Supports YAML (---) and TOML (+++) fences; returns {data, content}
    const trimBOM = (s)=> s.replace(/^\uFEFF/, "");
    text = trimBOM(text);
    const yamlMatch = text.startsWith('---\n') ? text.indexOf('\n---', 4) : -1;
    const tomlMatch = text.startsWith('+++\n') ? text.indexOf('\n+++', 4) : -1;
    if(yamlMatch !== -1){
      const fm = text.slice(4, yamlMatch);
      const content = text.slice(yamlMatch+4).replace(/^\n/, '');
      return { data: simpleYaml(fm), content };
    }
    if(tomlMatch !== -1){
      const fm = text.slice(4, tomlMatch);
      const content = text.slice(tomlMatch+4).replace(/^\n/, '');
      return { data: simpleToml(fm), content };
    }
    return { data: {}, content: text };
  }
  function simpleYaml(y){
    // Extremely small YAML subset: key: value, nested via dot in key, strings, numbers, booleans, arrays [a,b]
    const obj = {};
    const lines = y.split(/\r?\n/);
    for(const line of lines){
      const m = line.match(/^\s*([^:#]+):\s*(.*)$/);
      if(!m) continue;
      const key = m[1].trim();
      const raw = m[2].trim();
      setDeep(obj, key, parseScalar(raw));
    }
    return obj;
  }
  function simpleToml(t){
    const obj = {};
    const lines = t.split(/\r?\n/);
    for(const line of lines){
      const m = line.match(/^\s*([^=]+)=\s*(.*)$/);
      if(!m) continue;
      const key = m[1].trim();
      const raw = m[2].trim();
      setDeep(obj, key, parseScalar(raw));
    }
    return obj;
  }
  function setDeep(obj, key, val){
    const parts = key.split('.');
    let cur = obj;
    for(let i=0;i<parts.length-1;i++){
      const k = parts[i];
      if(!(k in cur)) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length-1]] = val;
  }
  function parseScalar(s){
    if((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
    if(s === 'true') return true;
    if(s === 'false') return false;
    if(/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
    if(s.startsWith('[') && s.endsWith(']')){
      const inner = s.slice(1,-1).trim();
      if(!inner) return [];
      return inner.split(',').map(x=>parseScalar(x.trim()));
    }
    return s;
  }
  function mdToHtml(md){
    // A tiny markdown renderer: headings, code blocks, inline code, bold, italics, links, lists, paragraphs
    md = md.replace(/\r\n/g, '\n');
    // Escape HTML
    const esc = (s)=>s.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    // Code blocks ```
    md = md.replace(/```([\s\S]*?)```/g, (m, code)=>`<pre><code>${esc(code)}</code></pre>`);
    // Inline code `code`
    md = md.replace(/`([^`]+)`/g, (m, c)=>`<code>${esc(c)}</code>`);
    // Bold **text**
    md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Links [text](url)
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Headings
    md = md.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
           .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
           .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
           .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    // Lists
    md = md.replace(/^(?:-\s+.+\n?)+/gm, (block)=>{
      const items = block.trim().split(/\n/).map(l=>l.replace(/^[-*]\s+/, ''));
      return `<ul>${items.map(it=>`<li>${it}</li>`).join('')}</ul>`;
    });
    // Paragraphs: wrap lines that are not HTML blocks
    const lines = md.split(/\n{2,}/).map(chunk=>{
      if(/^\s*<\/?(h\d|ul|pre|blockquote|p|table|ol)/.test(chunk) || chunk.startsWith('<')) return chunk;
      return `<p>${chunk.replace(/\n/g,'<br>')}</p>`;
    });
    return lines.join('\n');
  }
  async function fetchText(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.text();
  }
  async function processDoku(el){
    const src = el.getAttribute('src');
    if(!src) return;
    try{
      const text = await fetchText(src);
      const {data, content} = parseFrontmatter(text);
      const html = mdToHtml(content);
      const title = data.title || (content.match(/^#\s+(.+)/)?.[1]) || 'Document';
      const container = document.createElement('div');
      container.className = 'doku-container';
      container.innerHTML = html;
      el.replaceWith(container);
      if(!document.title || document.title === 'Document'){ document.title = title; }
      // Load highlight.js (CSS+JS) if not present and highlight blocks
      ensureHljs().then(()=>{
        if(window.hljs && typeof window.hljs.highlightAll === 'function'){
          window.hljs.highlightAll();
        }
      }).catch(()=>{});
    }catch(e){
      const pre = document.createElement('pre');
      pre.textContent = 'Doku error: ' + e.message;
      el.replaceWith(pre);
    }
  }
  function ensureHljs(){
    if(window.hljs && typeof window.hljs.highlightAll === 'function') return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const cssId = 'doku-hljs-css';
      if(!document.getElementById(cssId)){
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        document.head.appendChild(link);
      }
      const jsId = 'doku-hljs-js';
      if(document.getElementById(jsId)) return resolve();
      const script = document.createElement('script');
      script.id = jsId;
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
      script.onload = ()=>resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  function boot(){
    document.querySelectorAll('doku[src]').forEach(processDoku);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

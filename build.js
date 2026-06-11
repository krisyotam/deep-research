const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');
const fm = require('front-matter');
const Database = require('better-sqlite3');

const DIST = path.join(__dirname, 'dist');
const CONTENT = path.join(__dirname, 'content');
const STATIC = path.join(__dirname, 'static');
const PAGES = path.join(__dirname, 'pages');
const BASE = process.env.BASE_PATH || '';

// ── Helpers ──

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// ── Icons (inline SVG) ──
const icons = {
  arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  textSearch: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M10 12H3"/><path d="M10 18H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/></svg>',
  waypoints: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.5"/><path d="m10.2 6.3-3.9 3.9"/><circle cx="4.5" cy="12" r="2.5"/><path d="M7 12h10"/><circle cx="19.5" cy="12" r="2.5"/><path d="m13.8 17.7 3.9-3.9"/><circle cx="12" cy="19.5" r="2.5"/></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};

// ── Load DBs ──
let sourcesDb;
try {
  sourcesDb = new Database(path.join(__dirname, 'sources.db'), { readonly: true });
} catch {
  sourcesDb = null;
}

let promptsDb;
try {
  promptsDb = new Database(path.join(__dirname, 'prompts.db'), { readonly: true });
} catch {
  promptsDb = null;
}

function getRelated(slug) {
  if (!promptsDb) return [];
  try {
    const row = promptsDb.prepare('SELECT related FROM prompts WHERE slug = ?').get(slug);
    return row ? JSON.parse(row.related || '[]') : [];
  } catch { return []; }
}

function getSources(slug) {
  if (!sourcesDb) return [];
  try {
    return sourcesDb.prepare('SELECT position, title, url FROM sources WHERE slug = ? ORDER BY position').all(slug);
  } catch { return []; }
}

// ── Markdown setup ──
const marked = new Marked();

function formatDate(d) {
  if (!d) return '';
  // YYYY.MM.DD — used everywhere date is shown to the reader.
  let y, m, day;
  if (typeof d === 'string') {
    // Expect YYYY-MM-DD; if anything else, just substitute dashes for dots.
    const m1 = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) { y = m1[1]; m = m1[2]; day = m1[3]; }
    else return d.replace(/-/g, '.');
  } else {
    y = String(d.getUTCFullYear());
    m = String(d.getUTCMonth() + 1).padStart(2, '0');
    day = String(d.getUTCDate()).padStart(2, '0');
  }
  return `${y}.${m}.${day}`;
}

function extractHeadings(markdown) {
  const headings = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      const text = m[2].replace(/`/g, '');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      headings.push({ level, text, id });
    }
  }
  return headings;
}

function addHeadingIds(html, headings) {
  let idx = 0;
  return html.replace(/<(h[23])>/g, (match, tag) => {
    if (idx < headings.length) {
      return `<${tag} id="${headings[idx++].id}">`;
    }
    return match;
  });
}

// ── Templates ──

function entryPage(data, bodyHtml, headings, sources, rawMarkdown) {
  // Left sidebar: keep the original minimal dot+tooltip pattern.
  const tocHtml = headings.map(h =>
    `<li><a href="#${h.id}"></a><span class="toc-tooltip">${h.text}</span></li>`
  ).join('\n        ');

  const sourcesHtml = sources.map(s => {
    let host = s.url;
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) {}
    const favicon = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    return `<a class="source-item" href="${s.url}" target="_blank" rel="noopener">
      <img class="source-icon" src="${favicon}" alt="" width="20" height="20" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
      <div class="source-body">
        <div class="source-title">${s.title}</div>
        <div class="source-url">${host}</div>
      </div>
    </a>`;
  }).join('\n');

  const sourceCount = sources.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title} — Deep Research</title>
  <script>(function(){try{var t=localStorage.getItem('dr-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/static/style.css">
</head>
<body data-slug="${data.slug}" data-base="${BASE}">
  <div class="layout">
    <nav class="sidebar">
      <a href="${BASE}/" class="sidebar-back" title="Back to index">${icons.arrowLeft}</a>
      <ul class="toc">
        ${tocHtml}
      </ul>
    </nav>

    <main class="main">
      <div class="content">
        <h1>${data.title}</h1>
        <div class="content-meta">
          <time datetime="${data.date instanceof Date ? data.date.toISOString().slice(0,10) : data.date}">${formatDate(data.date)}</time>
          <span class="sep">&middot;</span>
          <span>${data.model}</span>
          ${Array.isArray(data.tags) && data.tags.length
            ? `<span class="sep">&middot;</span><span class="meta-tags">${data.tags.join(', ')}</span>`
            : (typeof data.tags === 'string' && data.tags
              ? `<span class="sep">&middot;</span><span class="meta-tags">${data.tags}</span>`
              : '')}
        </div>
        ${bodyHtml}
      </div>
    </main>
  </div>

  <div class="toolbar">
    <div style="position:relative">
      <button class="toolbar-btn" id="download-btn" title="Export">${icons.download}</button>
      <div class="download-menu" id="download-menu">
        <button onclick="copyContents()">Copy contents</button>
        <button onclick="exportMarkdown()">Export to Markdown</button>
        <button onclick="exportWord()">Export to Word</button>
        <button onclick="exportPDF()">Export to PDF</button>
      </div>
    </div>
    <button class="toolbar-btn" id="sources-btn" title="Sources (${sourceCount})">${icons.textSearch}</button>
    <button class="toolbar-btn" id="graph-btn" title="Graph">${icons.waypoints}</button>
    <button class="toolbar-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  </div>

  <aside class="sources-panel" id="sources-panel">
    <div class="sources-header">
      <div class="sources-header-text">
        <h3>Sources <span class="count">${sourceCount}</span></h3>
        <div class="sources-header-sub">cited references</div>
      </div>
      <button class="sources-close" id="sources-close" aria-label="Close sources">${icons.x}</button>
    </div>
    <div class="sources-list">
      ${sourcesHtml}
    </div>
  </aside>

  <div class="graph-backdrop" id="graph-backdrop">
    <div class="graph-modal" id="graph-modal">
      <div class="graph-modal-tooltip" id="graph-tooltip"></div>
      <svg id="graph-svg"></svg>
    </div>
  </div>

  <script id="raw-markdown" type="text/plain">${rawMarkdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</script>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="${BASE}/static/app.js"></script>
</body>
</html>`;
}

function indexPage(entries) {
  // Names-only table — drops description, tags, date, model from the index.
  // Reading those forces a click into the entry.
  const rowsHtml = entries
    .slice()
    .sort((a, b) => {
      const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date || 0).getTime();
      const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date || 0).getTime();
      return db - da;
    })
    .map(e => {
      const hay = (e.title + ' ' + (e.model || '') + ' ' + (e.preview || '')).toLowerCase();
      return `<tr data-search="${hay.replace(/"/g, '&quot;')}">`
           + `<td class="name"><a href="${BASE}/${e.slug}/">${e.title}</a></td>`
           + `</tr>`;
    })
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Deep Research</title>
  <meta name="description" content="Long-form research reports paired with the sources they pulled from.">
  <script>(function(){try{var t=localStorage.getItem('dr-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/static/index.css">
</head>
<body>
 <div class="page">
  <div class="grow">
  <main class="shell">
    <div class="head">
      <div class="brand">
        <h1>deep research</h1>
        <p>long-form research reports paired with the sources they pulled from</p>
      </div>
      <button class="toggle" data-theme-toggle aria-label="Switch to dark" type="button">
        <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      </button>
    </div>

    <nav class="nav-row">
      <a href="${BASE}/about/">about</a>
      <a href="${BASE}/faq/">faq</a>
      <a href="${BASE}/graph/">graph</a>
    </nav>

    <div class="search">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
      <input id="q" type="text" placeholder="search" autocomplete="off" spellcheck="false">
      <kbd class="search-kbd">/</kbd>
    </div>

    <table class="entries" id="entries">
      <tbody>
      ${rowsHtml}
      </tbody>
    </table>

    <p class="empty">nothing matches.</p>
  </main>
  </div>

  <footer class="shell-footer">
    <div class="foot-inner">
      <span><span data-visible-count>${entries.length}</span> / <span data-total-count>${entries.length}</span> reports</span>
      <span><a href="https://github.com/krisyotam/deep-research" rel="noopener">github.com/krisyotam/deep-research</a></span>
    </div>
  </footer>
 </div>

<script>
  // theme toggle — flips between data-theme="light" and "dark"
  (function () {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function paintLabel() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light' : 'Switch to dark');
    }
    paintLabel();
    btn.addEventListener('click', function () {
      var h = document.documentElement;
      var dark = h.getAttribute('data-theme') === 'dark';
      var next = dark ? 'light' : 'dark';
      h.setAttribute('data-theme', next);
      try { localStorage.setItem('dr-theme', next); } catch (e) {}
      paintLabel();
    });
  })();

  // search filter — same pattern as share / tools / anki
  (function () {
    var input = document.getElementById('q');
    if (!input) return;
    var empty = document.querySelector('.empty');
    var visEl = document.querySelector('[data-visible-count]');
    var tbody = document.querySelector('#entries tbody');
    function filter() {
      var q = input.value.trim().toLowerCase();
      var rows = tbody.querySelectorAll('tr');
      var visible = 0;
      rows.forEach(function (tr) {
        if (!q) { tr.classList.remove('hidden'); visible++; return; }
        var hay = tr.getAttribute('data-search') || '';
        var match = hay.indexOf(q) !== -1;
        tr.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      if (visEl) visEl.textContent = visible;
      if (empty) empty.classList.toggle('show', visible === 0);
    }
    input.addEventListener('input', filter);
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
      if (e.key === 'Escape' && document.activeElement === input) { input.value = ''; filter(); input.blur(); }
    });
    filter();
  })();
</script>
</body>
</html>`;
}

function wrapStaticPage(title, bodyPath) {
  const body = fs.readFileSync(bodyPath, 'utf-8');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Deep Research</title>
  <script>(function(){try{var t=localStorage.getItem('dr-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/static/style.css">
</head>
<body>
  <button class="page-theme-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  <div class="page-container">
    <nav class="page-nav"><a href="${BASE}/">&larr; Index</a></nav>
    ${body}
  </div>
  <script src="${BASE}/static/app.js"></script>
</body>
</html>`;
}

function buildFaqPage(mdPath) {
  const raw = fs.readFileSync(mdPath, 'utf-8');
  const { attributes: data, body } = fm(raw);
  const headings = extractHeadings(body);
  let html = marked.parse(body);
  html = addHeadingIds(html, headings);

  const tocHtml = headings.map((h, i) =>
    `<li><a href="#${h.id}">${i + 1}. ${h.text}</a></li>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title} — Deep Research</title>
  <script>(function(){try{var t=localStorage.getItem('dr-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/static/style.css">
</head>
<body>
  <button class="page-theme-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  <div class="faq-container">
    <nav class="page-nav"><a href="${BASE}/">&larr; Index</a></nav>
    <header class="faq-header">
      <h1>${data.title}</h1>
      <div class="faq-meta">
        <span>First version: ${data.first_version}</span>
        <span>Last update: ${data.last_update}</span>
      </div>
    </header>
    <nav class="faq-toc">
      <h2>Contents</h2>
      <ol>${tocHtml}</ol>
    </nav>
    <div class="faq-body">
      ${html}
    </div>
  </div>
  <script src="${BASE}/static/app.js"></script>
</body>
</html>`;
}

// ── Build ──

ensureDir(DIST);
ensureDir(path.join(DIST, 'static'));

// Copy static assets
copyFile(path.join(STATIC, 'style.css'), path.join(DIST, 'static', 'style.css'));
copyFile(path.join(STATIC, 'index.css'), path.join(DIST, 'static', 'index.css'));
copyFile(path.join(STATIC, 'app.js'), path.join(DIST, 'static', 'app.js'));

// Build entries
const files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md'));
const entries = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(CONTENT, file), 'utf-8');
  const { attributes: data, body } = fm(raw);
  const slug = data.slug || file.replace('.md', '');

  const headings = extractHeadings(body);
  let html = marked.parse(body);
  html = addHeadingIds(html, headings);
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  const sources = getSources(slug);

  const page = entryPage(data, html, headings, sources, body);

  const entryDir = path.join(DIST, slug);
  ensureDir(entryDir);
  fs.writeFileSync(path.join(entryDir, 'index.html'), page);

  entries.push({ ...data, body, slug });
  console.log(`  Built: /${slug}/`);
}

// Sort entries by date descending
entries.sort((a, b) => {
  const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date || 0).getTime();
  const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date || 0).getTime();
  return db - da;
});

// Build index
fs.writeFileSync(path.join(DIST, 'index.html'), indexPage(entries));
console.log('  Built: /index.html');

// Build about page
const aboutPath = path.join(PAGES, 'about.md');
if (fs.existsSync(aboutPath)) {
  const aboutDir = path.join(DIST, 'about');
  ensureDir(aboutDir);
  fs.writeFileSync(path.join(aboutDir, 'index.html'), buildFaqPage(aboutPath));
  console.log('  Built: /about/');
}

// Build FAQ page
const faqPath = path.join(PAGES, 'faq.md');
if (fs.existsSync(faqPath)) {
  const faqDir = path.join(DIST, 'faq');
  ensureDir(faqDir);
  fs.writeFileSync(path.join(faqDir, 'index.html'), buildFaqPage(faqPath));
  console.log('  Built: /faq/');
}

// Build graph data
const graphNodes = entries.map(e => ({
  id: e.slug,
  title: e.title,
  model: e.model,
}));

const graphLinks = [];
for (const e of entries) {
  const related = getRelated(e.slug);
  for (const target of related) {
    if (entries.some(n => n.slug === target)) {
      graphLinks.push({ source: e.slug, target });
    }
  }
}

const graphDir = path.join(DIST, 'graph');
ensureDir(graphDir);
fs.writeFileSync(path.join(graphDir, 'data.json'), JSON.stringify({ nodes: graphNodes, links: graphLinks }));
console.log('  Built: /graph/data.json');

// Build graph page
const graphPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Graph — Deep Research</title>
  <script>(function(){try{var t=localStorage.getItem('dr-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/static/style.css">
  <style>
    body { overflow: hidden; }
    .graph-wrap { position: fixed; inset: 0; background: var(--bg-color); }
    .graph-wrap svg { width: 100%; height: 100%; }
    .graph-back { position: fixed; top: 18px; left: 18px; z-index: 10; }
    .graph-back a {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-default);
      background: var(--bg-color);
      color: var(--fg-muted); text-decoration: none;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .graph-back a:hover { background: var(--bg-surface); color: var(--fg-color); border-color: var(--rule-color); }
    .graph-back svg { width: 15px; height: 15px; }
    .graph-tooltip {
      position: fixed; pointer-events: none;
      background: var(--bg-color); border: 1px solid var(--border-color);
      color: var(--fg-color);
      padding: 6px 12px;
      border-radius: var(--radius-default);
      font-family: var(--font-ui);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: -0.005em;
      opacity: 0; transition: opacity 180ms ease;
      white-space: nowrap; z-index: 50;
    }
    .graph-tooltip.visible { opacity: 1; }
  </style>
</head>
<body>
  <div class="graph-back"><a href="${BASE}/" title="Back to index">${icons.arrowLeft}</a></div>
  <div class="graph-tooltip" id="tooltip"></div>
  <div class="graph-wrap"><svg id="graph"></svg></div>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
  (function() {
    const svg = d3.select('#graph');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const tooltip = document.getElementById('tooltip');

    fetch('${BASE}/graph/data.json').then(r => r.json()).then(data => {
      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(110).strength(0.25))
        .force('charge', d3.forceManyBody().strength(-220).distanceMax(520))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide(22).strength(0.7))
        .alphaDecay(0.02);

      const g = svg.append('g');

      // Monochrome OpenAI style: Stone edges, Carbon nodes, system-ui labels.
      const link = g.append('g')
        .selectAll('line')
        .data(data.links)
        .join('line')
        .attr('stroke', 'var(--color-stone)')
        .attr('stroke-width', 0.7)
        .attr('stroke-opacity', 0.3);

      const node = g.append('g')
        .selectAll('circle')
        .data(data.nodes)
        .join('circle')
        .attr('r', 5)
        .attr('fill', 'var(--fg-color)')
        .attr('stroke', 'var(--bg-color)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .style('transition', 'r 160ms ease')
        .call(d3.drag()
          .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
        );

      const label = g.append('g')
        .selectAll('text')
        .data(data.nodes)
        .join('text')
        .text(d => d.title.length > 34 ? d.title.slice(0, 32) + '\u2026' : d.title)
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .attr('fill', 'var(--fg-color)')
        .attr('text-anchor', 'middle')
        .attr('dy', -12)
        .style('pointer-events', 'none')
        .style('font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .style('letter-spacing', '-0.005em')
        .style('opacity', 0.85);

      node.on('mouseover', function (e, d) {
        d3.select(this).attr('r', 8);
        link.attr('stroke-opacity', l => (l.source === d || l.target === d) ? 0.85 : 0.1);
        tooltip.textContent = d.title;
        tooltip.classList.add('visible');
      }).on('mousemove', e => {
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 8) + 'px';
      }).on('mouseout', function () {
        d3.select(this).attr('r', 5);
        link.attr('stroke-opacity', 0.3);
        tooltip.classList.remove('visible');
      }).on('click', (e, d) => {
        window.location.href = '${BASE}/' + d.id + '/';
      });

      simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
      });

      const zoom = d3.zoom().scaleExtent([0.1, 6]).on('zoom', e => g.attr('transform', e.transform));
      svg.call(zoom);
    });
  })();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(graphDir, 'index.html'), graphPage);
console.log('  Built: /graph/');

if (promptsDb) promptsDb.close();
if (sourcesDb) sourcesDb.close();
console.log('\nDone.');

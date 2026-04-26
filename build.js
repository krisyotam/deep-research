const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');
const fm = require('front-matter');
const Database = require('better-sqlite3');

const DIST = path.join(__dirname, 'dist');
const CONTENT = path.join(__dirname, 'content');
const STATIC = path.join(__dirname, 'static');
const PAGES = path.join(__dirname, 'pages');

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
  if (typeof d === 'string') return d;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
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
  const tocHtml = headings.map(h =>
    `<li><a href="#${h.id}"></a><span class="toc-tooltip">${h.text}</span></li>`
  ).join('\n');

  const sourcesHtml = sources.map(s =>
    `<a class="source-item" href="${s.url}" target="_blank" rel="noopener">
      <div class="source-num">${s.position}</div>
      <div class="source-title">${s.title}</div>
      <div class="source-url">${s.url}</div>
    </a>`
  ).join('\n');

  const sourceCount = sources.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title} — Deep Research</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body data-slug="${data.slug}">
  <div class="layout">
    <nav class="sidebar">
      <a href="/" class="sidebar-back" title="Back to index">${icons.arrowLeft}</a>
      <ul class="toc">
        ${tocHtml}
      </ul>
    </nav>

    <main class="main">
      <div class="content">
        <h1>${data.title}</h1>
        <div class="content-meta">
          ${formatDate(data.date)}<span class="model-badge">${data.model}</span>
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
      <h3>Sources <span class="count">${sourceCount}</span></h3>
      <button class="sources-close" id="sources-close">${icons.x}</button>
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
  <script src="/static/app.js"></script>
</body>
</html>`;
}

function indexPage(entries) {
  const listHtml = entries.map(e => {
    return `<li class="entry-item">
      <a href="/${e.slug}/">
        <div class="entry-title">${e.title}</div>
        ${e.preview ? `<div class="entry-excerpt">${e.preview}</div>` : ''}
        <div class="entry-meta">
          <span>${formatDate(e.date)}</span>
          <span>${e.model}</span>
        </div>
      </a>
    </li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Deep Research</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <button class="page-theme-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  <div class="page-container">
    <div class="index-header">
      <h1>Deep Research</h1>
      <div class="epigraph">
        <blockquote>I resolved to reject as absolutely false everything in which I could imagine the least doubt&hellip; and to suppose that everything I saw was false; to believe that none of the things represented to me by my memory ever existed&hellip; Thus, because our senses sometimes deceive us, I wished to suppose that nothing was such as they made us imagine it to be&hellip; But immediately afterward I noticed that while I thus wished to think all things false, it must necessarily be that I, who thought this, was something.</blockquote>
        <cite>Ren&eacute; Descartes, <em>Discourse on the Method</em> (1637)</cite>
      </div>
    </div>
    <nav class="index-nav">
      <a href="/about/">About</a>
      <a href="/faq/">FAQ</a>
      <a href="/graph/">Graph</a>
    </nav>
    <ul class="entry-list">
      ${listHtml}
    </ul>
  </div>
  <script src="/static/app.js"></script>
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
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <button class="page-theme-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  <div class="page-container">
    <nav class="page-nav"><a href="/">&larr; Index</a></nav>
    ${body}
  </div>
  <script src="/static/app.js"></script>
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
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <button class="page-theme-btn" id="theme-btn" title="Toggle theme"><span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span></button>
  <div class="faq-container">
    <nav class="page-nav"><a href="/">&larr; Index</a></nav>
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
  <script src="/static/app.js"></script>
</body>
</html>`;
}

// ── Build ──

ensureDir(DIST);
ensureDir(path.join(DIST, 'static'));

// Copy static assets
copyFile(path.join(STATIC, 'style.css'), path.join(DIST, 'static', 'style.css'));
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
  <link rel="stylesheet" href="/static/style.css">
  <style>
    body { overflow: hidden; }
    .graph-wrap { position: fixed; inset: 0; background: var(--bg); }
    .graph-wrap svg { width: 100%; height: 100%; }
    .graph-back { position: fixed; top: 16px; left: 16px; z-index: 10; }
    .graph-back a {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%;
      color: var(--text-muted); text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .graph-back a:hover { background: var(--bg-hover); color: var(--text); }
    .graph-back svg { width: 18px; height: 18px; }
    .graph-tooltip {
      position: fixed; pointer-events: none;
      background: var(--bg-surface); border: 1px solid var(--border);
      color: var(--text); padding: 6px 12px; border-radius: 8px;
      font-size: 0.8rem; opacity: 0; transition: opacity 0.15s;
      white-space: nowrap; z-index: 50;
    }
    .graph-tooltip.visible { opacity: 1; }
  </style>
</head>
<body>
  <div class="graph-back"><a href="/" title="Back to index">${icons.arrowLeft}</a></div>
  <div class="graph-tooltip" id="tooltip"></div>
  <div class="graph-wrap"><svg id="graph"></svg></div>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
  (function() {
    const svg = d3.select('#graph');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const tooltip = document.getElementById('tooltip');

    fetch('/graph/data.json').then(r => r.json()).then(data => {
      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(100).strength(0.3))
        .force('charge', d3.forceManyBody().strength(-200).distanceMax(500))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide(20).strength(0.7))
        .alphaDecay(0.02);

      const g = svg.append('g');

      const link = g.append('g')
        .selectAll('line')
        .data(data.links)
        .join('line')
        .attr('stroke', 'var(--text-dim)')
        .attr('stroke-width', 0.8)
        .attr('stroke-opacity', 0.4);

      const node = g.append('g')
        .selectAll('circle')
        .data(data.nodes)
        .join('circle')
        .attr('r', 6)
        .attr('fill', 'var(--link)')
        .attr('stroke', 'var(--bg)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
        );

      const label = g.append('g')
        .selectAll('text')
        .data(data.nodes)
        .join('text')
        .text(d => d.title)
        .attr('font-size', '9px')
        .attr('fill', 'var(--text-muted)')
        .attr('text-anchor', 'middle')
        .attr('dy', -12)
        .style('pointer-events', 'none');

      node.on('mouseover', (e, d) => {
        tooltip.textContent = d.title + ' (' + d.model + ')';
        tooltip.classList.add('visible');
      }).on('mousemove', e => {
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 8) + 'px';
      }).on('mouseout', () => {
        tooltip.classList.remove('visible');
      }).on('click', (e, d) => {
        window.location.href = '/' + d.id + '/';
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

// Deep Research — vanilla JS interactions

(function () {
  'use strict';

  const BASE = document.body.dataset.base || '';

  // ── TOC scroll-spy ──
  const tocLinks = document.querySelectorAll('.toc a');
  const sections = [];

  tocLinks.forEach(link => {
    const id = link.getAttribute('href');
    if (id) {
      const el = document.querySelector(id);
      if (el) sections.push({ el, link });
    }
  });

  if (sections.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(l => l.classList.remove('active'));
          const match = sections.find(s => s.el === entry.target);
          if (match) match.link.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(s => observer.observe(s.el));
  }

  // ── Download menu ──
  const dlBtn = document.getElementById('download-btn');
  const dlMenu = document.getElementById('download-menu');

  if (dlBtn && dlMenu) {
    dlBtn.addEventListener('click', e => {
      e.stopPropagation();
      dlMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => dlMenu.classList.remove('open'));
    dlMenu.addEventListener('click', e => e.stopPropagation());
  }

  // Copy contents
  window.copyContents = function () {
    const content = document.querySelector('.content');
    if (!content) return;
    navigator.clipboard.writeText(content.innerText).then(() => {
      dlMenu.classList.remove('open');
      showToast('Copied to clipboard');
    });
  };

  // Export markdown — download the raw .md
  window.exportMarkdown = function () {
    const slug = document.body.dataset.slug;
    if (!slug) return;
    // The raw md is embedded in a hidden element
    const raw = document.getElementById('raw-markdown');
    if (!raw) return;
    const blob = new Blob([raw.textContent], { type: 'text/markdown' });
    downloadBlob(blob, slug + '.md');
    dlMenu.classList.remove('open');
  };

  // Export Word (.docx is complex; we export as .html renamed to .doc which Word opens)
  window.exportWord = function () {
    const content = document.querySelector('.content');
    if (!content) return;
    const slug = document.body.dataset.slug || 'document';
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:serif;max-width:700px;margin:40px auto;line-height:1.8;}code{background:#f4f4f4;padding:2px 4px;border-radius:3px;}pre{background:#f4f4f4;padding:16px;border-radius:6px;overflow-x:auto;}</style></head><body>${content.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    downloadBlob(blob, slug + '.doc');
    dlMenu.classList.remove('open');
  };

  // Export PDF — use print
  window.exportPDF = function () {
    dlMenu.classList.remove('open');
    window.print();
  };

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#333', color: '#e8e8e8', padding: '8px 20px', borderRadius: '8px',
      fontSize: '0.85rem', zIndex: '999', opacity: '0', transition: 'opacity 0.2s'
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 1800);
  }

  // ── Sources panel ──
  const srcBtn = document.getElementById('sources-btn');
  const srcPanel = document.getElementById('sources-panel');
  const srcClose = document.getElementById('sources-close');

  if (srcBtn && srcPanel) {
    srcBtn.addEventListener('click', () => srcPanel.classList.toggle('open'));
  }
  if (srcClose && srcPanel) {
    srcClose.addEventListener('click', () => srcPanel.classList.remove('open'));
  }

  // Click citation ref [n] to open panel
  document.querySelectorAll('.cite-ref').forEach(ref => {
    ref.addEventListener('click', () => {
      if (srcPanel) srcPanel.classList.add('open');
    });
  });

  // ── Graph modal ──
  const graphBtn = document.getElementById('graph-btn');
  const graphBackdrop = document.getElementById('graph-backdrop');
  const graphModal = document.getElementById('graph-modal');
  const graphTooltip = document.getElementById('graph-tooltip');
  let graphLoaded = false;

  function openGraph() {
    if (!graphBackdrop) return;
    graphBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!graphLoaded) {
      graphLoaded = true;
      initGraph();
    }
  }

  function closeGraph() {
    if (!graphBackdrop) return;
    graphBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (graphBtn) {
    graphBtn.addEventListener('click', openGraph);
  }
  if (graphBackdrop) {
    graphBackdrop.addEventListener('click', closeGraph);
  }
  if (graphModal) {
    graphModal.addEventListener('click', e => e.stopPropagation());
  }

  function initGraph() {
    const svgEl = document.getElementById('graph-svg');
    if (!svgEl || typeof d3 === 'undefined') return;

    const rect = graphModal.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    fetch(BASE + '/graph/data.json').then(r => r.json()).then(data => {
      if (!data.nodes.length) {
        svg.append('text')
          .attr('x', width / 2).attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--text-dim)')
          .attr('font-size', '14px')
          .text('No connections yet');
        return;
      }

      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(70).strength(0.25))
        .force('charge', d3.forceManyBody().strength(-140).distanceMax(420))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide(12).strength(0.7))
        .force('x', d3.forceX(width / 2).strength(0.03))
        .force('y', d3.forceY(height / 2).strength(0.03))
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
        .attr('r', 4.5)
        .attr('fill', 'var(--fg-color)')
        .attr('stroke', 'var(--bg-color)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .style('transition', 'r 160ms ease, fill 160ms ease')
        .call(d3.drag()
          .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
        );

      const label = g.append('g')
        .selectAll('text')
        .data(data.nodes)
        .join('text')
        .text(d => d.title.length > 32 ? d.title.slice(0, 30) + '\u2026' : d.title)
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .attr('fill', 'var(--fg-color)')
        .attr('text-anchor', 'middle')
        .attr('dy', -10)
        .style('pointer-events', 'none')
        .style('font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .style('letter-spacing', '-0.005em')
        .style('opacity', 0);

      node.on('mouseover', function (e, d) {
        d3.select(this).attr('r', 7);
        // Highlight adjacent edges
        link.attr('stroke-opacity', l => (l.source === d || l.target === d) ? 0.85 : 0.12);
        graphTooltip.textContent = d.title;
        graphTooltip.classList.add('visible');
      }).on('mouseout', function () {
        d3.select(this).attr('r', 4.5);
        link.attr('stroke-opacity', 0.3);
        graphTooltip.classList.remove('visible');
      }).on('click', (e, d) => {
        window.location.href = BASE + '/' + d.id + '/';
      });

      simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
      });

      const zoom = d3.zoom()
        .scaleExtent([0.1, 6])
        .on('zoom', e => {
          g.attr('transform', e.transform);
          // fade labels based on zoom
          const k = e.transform.k;
          if (k <= 1.5) {
            label.style('opacity', 0);
          } else {
            label.style('opacity', Math.min(1, (k - 1.5) * 2));
          }
        });

      svg.call(zoom);
      svg.call(zoom.transform, d3.zoomIdentity.translate(width * 0.1, height * 0.1).scale(0.8));
    });
  }

  // ── Theme toggle ──
  const themeBtn = document.getElementById('theme-btn');
  const root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('dr-theme', theme);
  }

  // Load saved theme
  const saved = localStorage.getItem('dr-theme');
  if (saved) setTheme(saved);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Escape key ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeGraph();
      if (srcPanel) srcPanel.classList.remove('open');
    }
  });
})();

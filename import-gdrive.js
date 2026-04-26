#!/usr/bin/env node
// import-gdrive.js
// Reads downloaded Google Drive article JSON files from tool-results directory,
// matches each to article metadata, cleans content, and writes markdown with frontmatter.

const fs = require('fs');
const path = require('path');

const TOOL_RESULTS_DIR = '/home/krisyotam/.claude/projects/-home-krisyotam/3f94890d-1fb4-4e18-964f-69106740e6db/tool-results';
const OUTPUT_DIR = '/home/krisyotam/dev/deep-research/content';

// Article manifest: each entry has a match function and metadata
const ARTICLES = [
  {
    slug: 'openai-deep-research-mode',
    title: "Analyzing OpenAI's Deep Research Mode",
    date: '2025-05-16',
    preview: "A technical breakdown of capabilities, architecture, and competitive implications of OpenAI's agentic research tool.",
    match: (c) => c.includes("OpenAI's Deep Research Mode") && c.includes("Executive Summary"),
  },
  {
    slug: 'ballet-studies-viewing-list',
    title: 'The Ultimate Ballet Studies Viewing List',
    date: '2025-07-08',
    preview: "A chronological curriculum through ballet's key inflection points, from court ritual to postmodern deconstruction.",
    match: (c) => c.includes('Ultimate Ballet Studies Viewing List'),
  },
  {
    slug: 'manga-studies-reading-list',
    title: 'Manga Studies Reading List',
    date: '2025-07-08',
    preview: "A curated academic reading list tracing manga's evolution as a narrative art form.",
    match: (c) => c.includes('Manga Studies Reading List') || (c.toLowerCase().includes('manga') && c.toLowerCase().includes('watchlist')),
  },
  {
    slug: 'silk-road-technical-dossier',
    title: 'The Silk Road Technical Dossier',
    date: '2025-07-07',
    preview: 'An OPSEC autopsy of the first modern darknet market, from Tor architecture to the arrest of Dread Pirate Roberts.',
    match: (c) => c.includes('Silk Road') && c.includes('Technical Dossier'),
  },
  {
    slug: 'japanese-literary-blogs',
    title: 'A Guide to Japanese Literary Resources',
    date: '2025-05-14',
    preview: 'Curated online resources for Japanese classics, literature, and poetry across English and Japanese.',
    match: (c) => c.includes('Curated Guide to Online Resources for Japanese Classics') && c.includes('Navigating the Digital Landscape of Japanese Literary Studies'),
  },
  {
    slug: 'physics-from-your-computer',
    title: 'Physics Classes from Your Computer',
    date: '2025-07-21',
    preview: 'A free self-study path through undergraduate physics, from mechanics to quantum mechanics II.',
    match: (c) => c.includes('Physics Classes Right From Your Computer'),
  },
  {
    slug: 'math-classes-you-need',
    title: 'All the Math Classes You Need',
    date: '2025-07-21',
    preview: 'A complete self-study curriculum from precalculus through topology, with lectures, textbooks, and problem sets.',
    match: (c) => c.includes('How to Take all the Math Classes'),
  },
  {
    slug: 'film-criticism-online',
    title: 'Scholarly Film Criticism Online',
    date: '2025-07-02',
    preview: 'A curated map of serious digital film criticism, from academic journals to essay-driven personal sites.',
    match: (c) => c.includes('Curated Guide to Scholarly and Cinephilic Film Criticism'),
  },
  {
    slug: 'openai-operator-analysis',
    title: 'Analyzing OpenAI Operator',
    date: '2025-05-16',
    preview: "A deep analysis of OpenAI's web automation agent, its architecture, capabilities, and implications for agentic AI.",
    match: (c) => c.includes('OpenAI Operator') && c.includes('Web Automation'),
  },
  {
    slug: 'western-eastern-literature-curricula',
    title: 'Western and Eastern Literature Curricula',
    date: '2025-07-01',
    preview: 'A comparative analysis of how elite universities structure their literature programs across traditions.',
    match: (c) => c.includes('Analysis of Literature Curricula at Elite Anglophone'),
  },
  {
    slug: 'japanese-literature-blog-discovery',
    title: 'Japanese Literature Blog Discovery',
    date: '2025-06-13',
    preview: 'A comprehensive analysis of high-quality online resources for Japanese classics, literature, and poetry.',
    match: (c) => c.includes('Comprehensive Analysis of High-Quality Online Resources for Japanese'),
  },
  {
    slug: 'pure-mathematics-curricula',
    title: 'Elite Pure Mathematics Curricula',
    date: '2025-07-01',
    preview: 'An expert comparison of pure mathematics programs at Oxford, Cambridge, and the Ivy League.',
    match: (c) => c.includes('Expert Report on Pure Mathematics Curricula'),
  },
  {
    slug: 'chinese-classics-blogs',
    title: 'Blogs on Chinese Classics and Poetry',
    date: '2025-05-14',
    preview: 'A curated exploration of digital resources for Chinese literature, Confucian texts, and classical poetry.',
    match: (c) => c.includes('Navigating the Digital Scroll') && c.includes('Chinese'),
  },
  {
    slug: 'global-literature-curricula',
    title: 'Global Literature Curricula Compared',
    date: '2025-05-14',
    preview: 'How Oxford, Cambridge, and the Ivy League structure their literature degrees and what the differences reveal.',
    match: (c) => c.includes('Comparative Analysis of Global Literature Curricula'),
  },
  {
    slug: 'cambridge-ultralearning-blueprint',
    title: 'The Cambridge Math Ultralearning Blueprint',
    date: '2025-05-15',
    preview: "An intensive self-study plan built on Scott Young's ultralearning method and the Cambridge Mathematical Tripos.",
    match: (c) => c.includes('Cambridge Pure Mathematics Ultralearning Blueprint'),
  },
  {
    slug: 'anime-studies-watchlist',
    title: 'The Ultimate Anime Studies Watchlist',
    date: '2025-07-08',
    preview: "An academic curriculum through anime's inflection points, from 1917 silent shorts to globally streamed series.",
    match: (c) => c.includes('Ultimate Anime Studies Watchlist'),
  },
  {
    slug: 'cambridge-mathematics-evolution',
    title: 'Evolution of Cambridge Mathematics Curricula',
    date: '2025-05-14',
    preview: 'Tracing the Mathematical Tripos from 1900s wrangler culture to contemporary global qualifications.',
    match: (c) => c.includes('Evolution of Cambridge Mathematics Curricula'),
  },
  {
    slug: 'global-philosophy-curricula',
    title: 'Global Philosophy Curricula Compared',
    date: '2025-05-15',
    preview: 'A comparative analysis of philosophy programs at leading universities worldwide.',
    match: (c) => c.includes('Comparative Analysis of Global Philosophy Curricula'),
  },
  {
    slug: 'opera-canon-curriculum',
    title: 'An Invitation to the Opera Canon',
    date: '2025-05-15',
    preview: 'A self-education curriculum through the great operas, from Monteverdi to the modern stage.',
    match: (c) => c.includes('Invitation to the Opera Canon'),
  },
  {
    slug: 'ballet-canon-syllabus',
    title: 'A Self-Education Syllabus in Ballet',
    date: '2025-05-15',
    preview: 'A structured program for developing ballet literacy through critical viewing and analysis.',
    match: (c) => c.includes('Illuminated Path') && c.includes('Ballet Canon'),
  },
  {
    slug: 'critical-review-writing',
    title: 'Structuring Critical Reviews Across Media',
    date: '2025-05-14',
    preview: 'A comprehensive guide to writing analytical reviews of books, film, anime, manga, and television.',
    match: (c) => c.includes('Comprehensive Guide to Structuring and Practicing Critical Review Writing'),
  },
  {
    slug: 'media-review-writing',
    title: 'The Art of Media Review Writing',
    date: '2025-06-13',
    preview: 'Methodologies for crafting structured, engaging reviews across literature, anime, manga, film, and TV.',
    match: (c) => c.includes('Art and Science of Media Criticism') && c.includes('Structured, Engaging'),
  },
  {
    slug: 'media-rating-systems',
    title: 'Deconstructing Media Rating Systems',
    date: '2025-06-13',
    preview: 'An analysis of evaluation systems, inflationary bias, and community frameworks across digital media platforms.',
    match: (c) => c.includes('Deconstructing Digital Discourse') && c.includes('Media Evaluation Systems'),
  },
  {
    slug: 'scp-writing-guide',
    title: 'Canonical SCP Foundation Writing',
    date: '2025-06-13',
    preview: 'Format, tone, and pseudoscientific realism for crafting SCP entries that pass community muster.',
    match: (c) => c.includes('Canonical SCP Foundation Entry Writing'),
  },
  {
    slug: 'creepypasta-writing-guide',
    title: 'Crafting High-Quality Creepypasta',
    date: '2025-06-13',
    preview: 'A masterclass in digital dread: format, tone, psychological horror, and the art of fast fiction.',
    match: (c) => c.includes('Crafting High-Quality Creepypasta'),
  },
  {
    slug: 'mathematical-blogosphere',
    title: 'Survey of the Mathematical Blogosphere',
    date: '2025-05-14',
    preview: 'An extensive catalog of 100+ math blogs across platforms, audiences, and content levels.',
    match: (c) => c.includes('Comprehensive Survey of the Mathematical Blogosphere'),
  },
  {
    slug: 'oxford-curriculum-materials',
    title: "Oxford's Publicly Accessible Curricula",
    date: '2025-05-14',
    preview: 'A disciplinary review of publicly available curriculum materials from the University of Oxford, 2000-2025.',
    match: (c) => c.includes('Publicly Accessible Curriculum Materials at the University of Oxford'),
  },
  {
    slug: 'western-symphonic-music-curriculum',
    title: 'Self-Education in Western Symphonic Music',
    date: '2025-05-15',
    preview: 'A structured curriculum through the Western classical music canon, from medieval chant to contemporary composition.',
    match: (c) => c.includes('Curriculum for Self-Education in Western Symphonic Music'),
  },
  {
    slug: 'western-classics-blogs',
    title: 'Blogs on Western Classics and Formal Poetry',
    date: '2025-05-14',
    preview: 'A directory of blogs focused on the Great Books tradition, classical literature, and formal verse.',
    match: (c) => c.includes('Comprehensive Directory of Blogs Focused on Western Classics'),
  },
  {
    slug: 'digital-salon-polymaths',
    title: 'The New Digital Salon',
    date: '2025-07-05',
    preview: 'A report on 300 independent researchers and radical polymaths thriving in the AI era\'s decentralized web.',
    match: (c) => c.includes('New Digital Salon') && c.includes('Independent Researchers'),
  },
];

function cleanContent(raw) {
  let content = raw;

  // Remove works cited section (everything from the header onward)
  content = content.replace(/#{1,6}\s*\*{0,2}Works [Cc]ited\*{0,2}[\s\S]*$/i, '');
  content = content.replace(/#{1,6}\s*\*{0,2}Works? [Cc]ited\*{0,2}[\s\S]*$/i, '');
  content = content.replace(/\*{0,2}Works [Cc]ited\*{0,2}\s*\n[\s\S]*$/i, '');

  // Strip inline citation numbers: digits that appear as standalone references
  // Pattern: a number (1-3 digits) that follows punctuation or text inline
  // e.g. "sentence.1" "sentence,2" "word 3 word" where 3 is a citation
  // More targeted: remove superscript-style citations like word[1] or word1 at end of clauses
  content = content.replace(/(\w|[.,;!?])\[(\d{1,3})\]/g, '$1');
  // Remove bare number references after punctuation: "word.1 " or "word,2\n"
  content = content.replace(/([.,;:!?])(\d{1,3})(\s)/g, '$1$3');
  content = content.replace(/([.,;:!?])(\d{1,3})$/gm, '$1');

  // Collapse 3+ consecutive newlines to 2
  content = content.replace(/\n{3,}/g, '\n\n');

  // Strip leading blank lines
  content = content.replace(/^\n+/, '');

  // Strip trailing whitespace on each line
  content = content.replace(/[ \t]+$/gm, '');

  return content.trim();
}

function buildFrontmatter(article) {
  return `---
title: "${article.title.replace(/"/g, '\\"')}"
date: ${article.date}
model: chatgpt-deep-research
slug: ${article.slug}
preview: "${article.preview.replace(/"/g, '\\"')}"
---

`;
}

function run() {
  // Read all .txt files in the tool-results directory
  const files = fs.readdirSync(TOOL_RESULTS_DIR).filter(f => f.endsWith('.txt'));

  console.log(`Found ${files.length} .txt files in tool-results directory.`);

  const matched = new Set();
  const usedSlugs = new Set();
  const failed = [];
  const written = [];

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(TOOL_RESULTS_DIR, file);
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      console.error(`  ERROR reading ${file}: ${e.message}`);
      continue;
    }

    // Parse JSON — the file may be wrapped in persisted-output tags or be plain JSON
    let fileContent;
    try {
      // Strip any persisted-output wrapper if present
      const jsonMatch = raw.match(/\{"fileContent"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        fileContent = parsed.fileContent;
      } else {
        // Try direct parse
        const parsed = JSON.parse(raw);
        fileContent = parsed.fileContent;
      }
    } catch (e) {
      // Not JSON or not the right structure — skip silently (may be unrelated files)
      continue;
    }

    if (!fileContent || typeof fileContent !== 'string') continue;

    // Find matching article
    const article = ARTICLES.find(a => {
      if (usedSlugs.has(a.slug)) return false;
      return a.match(fileContent);
    });

    if (!article) {
      // Not matched — log for diagnostics
      const preview = fileContent.substring(0, 120).replace(/\n/g, ' ');
      failed.push({ file, preview });
      continue;
    }

    usedSlugs.add(article.slug);
    matched.add(article.slug);

    const cleaned = cleanContent(fileContent);
    const output = buildFrontmatter(article) + cleaned;
    const outPath = path.join(OUTPUT_DIR, `${article.slug}.md`);

    try {
      fs.writeFileSync(outPath, output, 'utf8');
      written.push({ slug: article.slug, file, outPath });
      console.log(`  [OK] ${article.slug} <- ${file}`);
    } catch (e) {
      console.error(`  ERROR writing ${outPath}: ${e.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Written: ${written.length} / ${ARTICLES.length} articles`);

  if (written.length < ARTICLES.length) {
    const unmatched = ARTICLES.filter(a => !usedSlugs.has(a.slug));
    console.log('\nUnmatched articles (no source file found):');
    for (const a of unmatched) {
      console.log(`  - ${a.slug}`);
    }
  }

  if (failed.length > 0) {
    console.log('\nFiles with fileContent that did not match any article:');
    for (const f of failed) {
      console.log(`  - ${f.file}: "${f.preview}..."`);
    }
  }
}

run();

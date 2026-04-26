#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const TOOL_RESULTS_DIR = '/home/krisyotam/.claude/projects/-home-krisyotam/3f94890d-1fb4-4e18-964f-69106740e6db/tool-results/';
const DB_PATH = path.join(__dirname, 'sources.db');

// Map each slug to a set of content strings that must ALL appear in the file
const SLUG_MATCHERS = [
  { slug: 'openai-deep-research-mode',            must: ["OpenAI's Deep Research Mode", "Executive Summary"] },
  { slug: 'ballet-studies-viewing-list',           must: ["Ultimate Ballet Studies Viewing List"] },
  { slug: 'manga-studies-reading-list',            must: ["Ultimate Manga Studies Reading List"] },
  { slug: 'silk-road-technical-dossier',           must: ["Silk Road", "Technical Dossier"] },
  { slug: 'japanese-literary-blogs',               must: ["Curated Guide to Online Resources for Japanese Classics"] },
  { slug: 'film-criticism-online',                 must: ["Curated Guide to Scholarly and Cinephilic Film Criticism"] },
  { slug: 'openai-operator-analysis',              must: ["OpenAI Operator", "Web Automation"] },
  { slug: 'western-eastern-literature-curricula',  must: ["Analysis of Literature Curricula at Elite Anglophone"] },
  { slug: 'japanese-literature-blog-discovery',    must: ["Comprehensive Analysis of High-Quality Online Resources for Japanese"] },
  { slug: 'pure-mathematics-curricula',            must: ["Expert Report on Pure Mathematics Curricula"] },
  { slug: 'chinese-classics-blogs',               must: ["Navigating the Digital Scroll", "Chinese"] },
  { slug: 'global-literature-curricula',          must: ["Comparative Analysis of Global Literature Curricula"] },
  { slug: 'cambridge-ultralearning-blueprint',    must: ["Cambridge Pure Mathematics Ultralearning Blueprint"] },
  { slug: 'anime-studies-watchlist',              must: ["Ultimate Anime Studies Watchlist"] },
  { slug: 'cambridge-mathematics-evolution',      must: ["Evolution of Cambridge Mathematics Curricula"] },
  { slug: 'global-philosophy-curricula',          must: ["Comparative Analysis of Global Philosophy Curricula"] },
  { slug: 'opera-canon-curriculum',               must: ["Invitation to the Opera Canon"] },
  { slug: 'ballet-canon-syllabus',                must: ["Illuminated Path", "Ballet Canon"] },
  { slug: 'critical-review-writing',              must: ["Comprehensive Guide to Structuring and Practicing Critical Review Writing"] },
  { slug: 'media-review-writing',                 must: ["Art and Science of Media Criticism"] },
  { slug: 'media-rating-systems',                 must: ["Deconstructing Digital Discourse", "Media Evaluation Systems"] },
  { slug: 'scp-writing-guide',                    must: ["Canonical SCP Foundation Entry Writing"] },
  { slug: 'creepypasta-writing-guide',            must: ["Crafting High-Quality Creepypasta"] },
  { slug: 'mathematical-blogosphere',             must: ["Comprehensive Survey of the Mathematical Blogosphere"] },
  { slug: 'oxford-curriculum-materials',          must: ["Publicly Accessible Curriculum Materials at the University of Oxford"] },
  { slug: 'western-symphonic-music-curriculum',   must: ["Curriculum for Self-Education in Western Symphonic Music"] },
  { slug: 'western-classics-blogs',               must: ["Comprehensive Directory of Blogs Focused on Western Classics"] },
  { slug: 'digital-salon-polymaths',              must: ["New Digital Salon", "Independent Researchers"] },
];

// Given file content, return the matching slug or null
function matchSlug(content) {
  for (const { slug, must } of SLUG_MATCHERS) {
    if (must.every(s => content.includes(s))) {
      return slug;
    }
  }
  return null;
}

// Extract the "Works cited" section from content
function extractWorksCited(content) {
  const lower = content.toLowerCase();
  const idx = lower.indexOf('works cited');
  if (idx === -1) return null;
  // Start from after the "Works cited" header line
  const sectionStart = content.indexOf('\n', idx);
  if (sectionStart === -1) return null;
  return content.slice(sectionStart).trim();
}

// Parse citation entries from the Works cited section.
// Returns array of { position, title, url }
function parseCitations(section) {
  const results = [];

  // Split on lines that begin with a citation number (1-3 digits, period(s), space)
  // Use a lookahead to keep the delimiter with each entry
  const entryPattern = /(?:^|\n)(\d{1,3})\.+\s+/g;

  // Find all entry starts
  const starts = [];
  let m;
  while ((m = entryPattern.exec(section)) !== null) {
    starts.push({ index: m.index, position: parseInt(m[1], 10), contentStart: m.index + m[0].length });
  }

  for (let i = 0; i < starts.length; i++) {
    const { position, contentStart } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : section.length;
    let entryText = section.slice(contentStart, end).trim();

    // Replace literal \n sequences and normalize whitespace within the entry
    // (content may have actual newlines that split multi-line entries)
    entryText = entryText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract URL - prefer angle-bracket form, fall back to bare URL
    let url = null;
    let titleText = entryText;

    // Pattern: <https://...> or <http://...>
    const angleBracketMatch = entryText.match(/<(https?:\/\/[^>]+)>/);
    if (angleBracketMatch) {
      url = angleBracketMatch[1];
      titleText = entryText.slice(0, angleBracketMatch.index).trim();
    } else {
      // Pattern: bare https:// or http:// URL at end of text
      const bareUrlMatch = entryText.match(/(https?:\/\/\S+)\s*$/);
      if (bareUrlMatch) {
        url = bareUrlMatch[1];
        titleText = entryText.slice(0, bareUrlMatch.index).trim();
      }
    }

    if (!url) {
      // Skip entries with no URL
      continue;
    }

    // Clean up URL - remove trailing punctuation
    url = url.replace(/[.,)>\]]+$/, '');

    // Clean up title text
    // Remove trailing ", accessed Month DD, YYYY," pattern
    titleText = titleText.replace(/,?\s*accessed\s+\w+\s+\d{1,2},\s+\d{4},?\s*$/i, '').trim();
    // Remove trailing commas, periods, dashes
    titleText = titleText.replace(/[,.\s\-–]+$/, '').trim();
    // Remove escaped exclamation marks (common artifact: \!)
    titleText = titleText.replace(/\\!/g, '!');
    // Collapse multiple spaces
    titleText = titleText.replace(/\s+/g, ' ').trim();

    if (!titleText) {
      // Use URL hostname as fallback title
      try {
        titleText = new URL(url).hostname;
      } catch {
        titleText = url;
      }
    }

    results.push({ position, title: titleText, url });
  }

  return results;
}

function main() {
  const db = new Database(DB_PATH);

  // Prepare insert statement - ignore conflicts (skip existing rows)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO sources (slug, position, title, url)
    VALUES (?, ?, ?, ?)
  `);

  const files = fs.readdirSync(TOOL_RESULTS_DIR).filter(f => f.endsWith('.txt'));

  const stats = {}; // slug -> count inserted
  const noSources = [];
  const noMatch = [];
  const duplicateSlugs = {}; // slug -> [files]

  // Track which slugs have already been processed (to detect duplicate files for same slug)
  const processedSlugs = new Set();

  for (const file of files.sort()) {
    const filePath = path.join(TOOL_RESULTS_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');

    // Only process files that start with JSON
    if (!raw.trimStart().startsWith('{')) {
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`  WARN: Could not parse JSON in ${file}`);
      continue;
    }

    const content = data.fileContent;
    if (!content) {
      console.warn(`  WARN: No fileContent in ${file}`);
      continue;
    }

    const slug = matchSlug(content);
    if (!slug) {
      noMatch.push(file);
      continue;
    }

    // Skip duplicates - only process first occurrence of each slug
    if (processedSlugs.has(slug)) {
      if (!duplicateSlugs[slug]) duplicateSlugs[slug] = [];
      duplicateSlugs[slug].push(file);
      continue;
    }
    processedSlugs.add(slug);

    const section = extractWorksCited(content);
    if (!section) {
      noSources.push(slug);
      console.log(`  [${slug}] No "Works cited" section found in ${file}`);
      continue;
    }

    const citations = parseCitations(section);
    if (citations.length === 0) {
      noSources.push(slug);
      console.log(`  [${slug}] Works cited found but 0 entries parsed in ${file}`);
      continue;
    }

    // Insert all citations in a transaction
    const insertMany = db.transaction((rows) => {
      let count = 0;
      for (const { position, title, url } of rows) {
        const result = insert.run(slug, position, title, url);
        count += result.changes;
      }
      return count;
    });

    const inserted = insertMany(citations);
    stats[slug] = { parsed: citations.length, inserted };
    console.log(`  [${slug}] ${citations.length} parsed, ${inserted} inserted (${file})`);
  }

  console.log('\n--- Summary ---');
  console.log(`Slugs with sources inserted: ${Object.keys(stats).length}`);
  let totalInserted = 0;
  for (const [slug, { parsed, inserted }] of Object.entries(stats).sort()) {
    console.log(`  ${slug}: ${parsed} citations, ${inserted} new rows`);
    totalInserted += inserted;
  }
  console.log(`Total rows inserted: ${totalInserted}`);

  if (noSources.length > 0) {
    console.log(`\nSlugs with no sources extracted (${noSources.length}):`);
    for (const s of noSources) console.log(`  - ${s}`);
  }

  if (noMatch.length > 0) {
    console.log(`\nFiles with no slug match (${noMatch.length}):`);
    for (const f of noMatch) console.log(`  - ${f}`);
  }

  if (Object.keys(duplicateSlugs).length > 0) {
    console.log('\nDuplicate files skipped:');
    for (const [slug, files] of Object.entries(duplicateSlugs)) {
      console.log(`  ${slug}: ${files.join(', ')}`);
    }
  }

  const missingSlugs = SLUG_MATCHERS
    .filter(({ slug }) => slug !== 'shell-comparison-for-suckless-workflow')
    .filter(({ slug }) => !processedSlugs.has(slug));
  if (missingSlugs.length > 0) {
    console.log(`\nSlugs with no matching file found (${missingSlugs.length}):`);
    for (const { slug } of missingSlugs) console.log(`  - ${slug}`);
  }

  db.close();
}

main();

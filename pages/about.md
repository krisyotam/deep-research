---
title: "About"
first_version: 2026-04-26
last_update: 2026-04-26
---

## What is Deep Research?

Deep Research is an experiment in using AI deep research capabilities as a learning method. Each entry is a report generated through extended AI research sessions that dig into primary sources, cross-reference documentation, and produce thorough analysis of a topic.

## Method

Each report starts with a specific question or decision. The AI research model spends time reading primary sources, documentation, papers, and technical references before producing its analysis. The prompt that generated each report is stored alongside it. The sources panel on each entry links to every document the model consulted.

## Why

This is not summarization. These reports trace claims back to original documentation, compare implementations directly, and build arguments from evidence rather than consensus. The AI does the tedious work of reading everything; the human does the work of asking the right questions.

Traditional learning asks you to read everything yourself, which is noble but slow. Shallow summaries give you the gist but miss the details that matter. Deep research sits in between: thorough enough to trust, efficient enough to scale.

## Structure

Each report includes YAML frontmatter with title, date, model used, and a preview line. Sources are stored in a separate database, linked by slug. Prompts are stored the same way. The entire site is static HTML generated from markdown at build time.

const Database = require('better-sqlite3');

const prompts = new Database('prompts.db');
prompts.exec(`
  CREATE TABLE IF NOT EXISTS prompts (
    slug TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    model TEXT,
    date TEXT,
    related TEXT DEFAULT '[]'
  );
`);
prompts.close();

const sources = new Database('sources.db');
sources.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    slug TEXT NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (slug, position)
  );
  CREATE INDEX IF NOT EXISTS idx_sources_slug ON sources(slug);
`);
sources.close();

console.log('Initialized prompts.db and sources.db');

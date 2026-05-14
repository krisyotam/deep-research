# Deep Research — agent notes

A static site of long-form, AI-assisted research reports, mounted at
`krisyotam.com/deep-research`. Content lives in `content/*.md` with
frontmatter (`title`, `date`, `model`, `slug`, `preview`, optional
`tags: [a, b, c]`). `sources.db` and `prompts.db` carry per-entry source
lists and related-entry edges. `build.js` walks `content/`, renders each
entry, and writes `dist/`.

No framework. No bundler. `marked` for Markdown, `react-dom/server` —
actually no, plain string templates in `build.js`. `better-sqlite3`
for the two DBs.

## Pages

| Page    | Where                                  | Design language                    |
| ------- | -------------------------------------- | ---------------------------------- |
| Index   | `indexPage()` in `build.js`            | `static/index.css` — shares/tools  |
| Entry   | `entryPage()` in `build.js`            | `static/style.css` — OpenAI below  |
| About   | `wrapStaticPage('About', 'about.md')`  | `static/style.css`                 |
| FAQ     | `buildFaqPage('faq.md')`               | `static/style.css`                 |
| Graph   | inline template in `build.js`          | `static/style.css` + d3            |

The **index page** uses the krisyotam/share design language (Lora +
Inter + JetBrains Mono, HSL grayscale tokens, 640px shell). Treated as
a navigation surface — see `~/dev/share/.claude/CLAUDE.md`.

The **entry / about / faq / graph** pages use the OpenAI design
language below. Treated as the reading surface.

---

## Entry-page design language — OpenAI (ChatGPT) reference

> Frosted glass workstation. An environment of quiet focus, where soft
> grays frame crisp textual interaction.

**Theme:** light by default; `[data-theme="dark"]` flips the surface
tokens. `dr-theme` localStorage key.

Austere, functional, achromatic. Content takes precedence. Rounded forms
are reserved for interactive elements. Type weights never exceed 600.
No explicit shadows — depth comes from background shifts (Snow → Fog).

### Tokens — colors

| Name        | Hex       | Token                 | Role                                                                   |
| ----------- | --------- | --------------------- | ---------------------------------------------------------------------- |
| Carbon      | `#0d0d0d` | `--color-carbon`      | Primary text, critical headings, icons                                 |
| Snow        | `#ffffff` | `--color-snow`        | Page background, card surfaces, button fills                           |
| Fog         | `#f9f9f9` | `--color-fog`         | Sidebar / secondary background, subtly differentiating panels          |
| Pewter      | `#5d5d5d` | `--color-pewter`      | Secondary text, placeholder text                                       |
| Stone       | `#8f8f8f` | `--color-stone`       | Inactive icons, subtle borders                                         |
| Arctic Mist | `#ececec` | `--color-arctic-mist` | Ghost button hover background                                          |
| Link Blue   | `#007aff` | `--color-link-blue`   | Interactive elements, links                                            |

### Tokens — typography

**Primary UI font** — `ui-sans-serif` system stack. Used for body,
navigation, buttons.

```
font-family: ui-sans-serif, system-ui, -apple-system,
             BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
font-feature-settings: "liga" 0;
weights: 400, 500, 600;
```

**Primary prompt / hero** — OpenAI Sans, 18px weight 600, line-height
1.56, letter-spacing -0.015em. Use the system-ui fallback if the font
file isn't loaded.

### Type scale

| Role        | Size  | Line height | Token              |
| ----------- | ----- | ----------- | ------------------ |
| caption     | 14px  | 1.43        | `--text-caption`   |
| body        | 16px  | 1.5         | `--text-body`      |
| subheading  | 18px  | 1.56        | `--text-subheading`|
| heading     | 24px  | 1           | `--text-heading`   |

### Spacing scale

`4 · 6 · 8 · 10 · 12 · 16 · 20 · 60 · 64 · 127`. Don't deviate.

### Radii

`10px` (buttons, default) · `16px` (pill button) · `28px` (input field).
No sharp corners on interactives.

### Layout

- Page max-width **1150px**
- Section gap **64px**
- Card padding **20px**
- Element gap **4px**
- Two-column: sidebar + main. Subtle background shift (Snow → Fog) on
  the sidebar, no border-divider required.

### Dos

- Carbon `#0d0d0d` for all primary text.
- Snow `#ffffff` for page background; Fog `#f9f9f9` for sidebars.
- Generous border radii on interactive elements (10/16/28).
- Pewter `#5d5d5d` for all secondary, descriptive, placeholder text.

### Don'ts

- No colors outside neutrals + Link Blue.
- No sharp corners on buttons or inputs.
- No type weights above 600.
- No explicit shadows — use background-color shifts instead.
- No deviation from the spacing scale.
- No full-bleed content sections; respect the 1150px max-width.

---

## Local divergence from the spec

A few intentional departures, all to fit a long-form reading surface
inside the OpenAI language:

- **Entry title (`h1`) is Lora serif**, not ui-sans-serif. The serif
  is the only typographic distinction between the title and body — it
  signals "this is an editorial document" the way OpenAI Sans signals
  "this is the hero prompt" on chatgpt.com. Sized at the OpenAI heading
  rung but with Lora weight 500.
- **Body line-height pushed to 1.7** (vs OpenAI's 1.5) for long
  reading. The 1.5 is correct for chat-message bursts; 1.7 reads better
  for 5000-word reports.
- **Tables break out of the 720px content column**, up to 1100px wide,
  centered within `.main`. Long data tables aren't readable squeezed
  into the reading column. Never crosses the 56px left sidebar.
- **Left sidebar is a 56px dot rail with hover tooltips**, not the
  240px OpenAI nav. The dots are the project's signature. Sidebar
  background is Fog, matching the OpenAI hierarchy.
- **Sources panel** (right) follows the OpenAI density model: rounded
  10px hit-targets, Pewter URLs, Fog hover, no drop shadows beyond a
  whisper.

---

## What NOT to do

- Don't introduce a second accent color besides Link Blue.
- Don't write any content. Kris drafts entries with a model and pastes
  the markdown. Your job is templates, build, design.
- Don't run `npm run build` without explicit instruction.
- Don't move the index off Inter/Lora — it lives in the share/tools
  language by design.

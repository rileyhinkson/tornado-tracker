# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static website that visualizes every tornado in the NOAA Storm Prediction
Center (SPC) severe weather database, 1950–present. No framework, no build
step, no package.json — plain HTML/CSS/JS, hosted on GitHub Pages via
GitHub Actions.

## Commands

There is no build/lint/test tooling. The only script is the data pipeline:

```bash
python3 scripts/build_data.py
```

Regenerates `data/index.json` and all `data/years/<year>.json` from
`data-source/spc_tornadoes.csv`. Run this whenever `spc_tornadoes.csv` is
updated or `build_data.py`'s parsing logic changes — the JSON files are
committed to the repo (not generated at deploy time), so regeneration is a
manual, explicit step.

To preview the site locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

There's no headless browser tool (no node/chromium-cli/selenium) in the
default dev environment — Firefox is present and `firefox --headless
--screenshot=out.png --window-size=W,H URL` works for visual smoke checks,
but note `--screenshot` does **not** reliably wait for async `fetch()` to
resolve before capturing (confirmed by direct test) — a blank stat grid or
table in such a screenshot is a tooling race, not necessarily a bug. Trust
`curl` status checks + code review for data-loading logic; use screenshots
mainly to verify layout/CSS.

## Data pipeline & a unit gotcha

`data-source/spc_tornadoes.csv` is the raw NOAA SPC export. Column meanings
are in NOAA's `SPC_severe_database_description.pdf`. Key nuance already
handled in `build_data.py::format_loss`:

- Pre-1996: `loss` is a coded 0–9 damage category, not a dollar figure
  (`LOSS_CATEGORY` table).
- **1996–2006: `loss` is in millions of dollars** (e.g. `50.0` → $50M).
- **2007 onward: `loss` is in raw dollars** (e.g. `250000000` → $250M).

This transition was reverse-engineered from known real-world damage figures
(Greensburg KS 2007 EF5 ≈ $250M, Moore OK 2013 EF5 ≈ $2B, 1999
Bridge Creek–Moore OK F5 ≈ $1B) since it isn't called out in the SPC PDF as
clearly as the pre/post-1996 category change. If loss figures ever look off
by ~10⁶ again for a range of years, suspect this boundary first.

Each `data/years/<year>.json` record's shape (see `build_data.py` for the
authoritative field list): `id, date, time, state, stateName, magnitude,
magnitudeRaw, injuries, fatalities, propertyLoss, lengthMiles, widthYards,
startLat, startLon, endLat, endLon`. `data/index.json` is a per-year summary
(`count, fatalities, injuries, strongest`) used to build the homepage without
loading every year file.

## Site architecture

Two hand-rolled pages, no router, no templating:

- `index.html` (repo root) — landing page. Fetches `data/index.json` only.
  Renders stat tiles, an SVG bar chart (tornadoes/year), and a sortable/
  filterable table of years. All logic in `js/home.js`.
- `years/index.html` — year detail page, driven entirely by the `?y=YYYY`
  query param (no per-year static pages are generated). Fetches
  `data/index.json` (for the year switcher + prev/next) and
  `data/years/<year>.json` (for the record table) via `Promise.all`. All
  logic in `js/year.js`.

Because `years/index.html` is one file for every year, links to it always
look like `years/index.html?y=2011` — don't add per-year HTML files.

`js/common.js` is shared by both pages: the phosphor theme toggle (see
below) and two small helpers (`formatNumber`, `magnitudeRank`) that both
`home.js` and `year.js` depend on — load order matters
(`common.js` before `home.js`/`year.js` in each HTML file).

All chart/table rendering builds DOM nodes directly (`createElement` /
`textContent`), not `innerHTML`, since state/magnitude/label values
ultimately come from a third-party CSV — keep it that way if you touch this
code.

## Visual theme

Deliberate green/amber "terminal" aesthetic (cult-of-the-dead-cow-style BBS
intro), not a conventional light/dark site theme:

- Pure black background, high-contrast neon green foreground by default
  (`css/style.css` `:root`); an amber phosphor alternate lives under
  `:root[data-theme="amber"]`. The toggle button (`#theme-toggle`, wired in
  `common.js`) cycles between the two by setting/removing that attribute —
  there is intentionally no light theme.
- Everything is `var(--font-mono)` (system monospace stack). Bordered
  panels use the `.term-box` component (CSS `::before`/`::after` plus
  `.tb-tr`/`.tb-br` spans render `+` corner marks — see `css/style.css`).
- The homepage hero has a hand-built ASCII block-letter banner and a
  tornado funnel ASCII art (`index.html`); both are literal `<pre>` text,
  not generated at runtime — if the banner text ever needs to change,
  regenerate it rather than hand-editing (see the block-letter font map
  used to build it, in this session's history) to keep columns aligned.

## Deployment

`.github/workflows/pages.yml` deploys the whole repo as-is to GitHub Pages
on every push to `main` (via `actions/upload-pages-artifact` +
`actions/deploy-pages`) — there is no build step in CI; whatever is
committed (including `data/*.json`) is what ships. `data-source/` and
`scripts/` get deployed too (harmless, just unused by the site) since the
artifact upload doesn't filter paths.

# GitHub Trending — Web Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Live: **https://trends.softween.com** — GitHub Trending repolarının günlük Türkçe AI özeti. Open source, Cloudflare üzerinde çalışır.

Public Turkish website showing GitHub Trending repositories with AI-powered summaries. Reads data from a shared D1 database populated by `softween-trending-mailer`.

> See [`CLAUDE.md`](./CLAUDE.md) for the short architecture summary.

## Tech Stack

- **Framework**: Astro 5 (SSR)
- **SSR adapter**: `@astrojs/cloudflare`
- **Styling**: Tailwind CSS v4
- **Database**: Cloudflare D1 — shared with `softween-trending-mailer`
- **Hosting**: Cloudflare Pages

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Local dev server
npm run build        # Production build
npm run deploy       # Build + deploy to Cloudflare Pages
```

## Data Flow

The `softween-trending-mailer` Worker runs a daily cron, scrapes GitHub Trending, summarizes each repo with Cloudflare Workers AI, and writes the results into a shared D1 database. This site reads from the same D1 and renders a public Turkish-language dashboard.

## Setup

1. `cp .dev.vars.example .dev.vars` (web için app secret'ı yok; D1 binding yeterli).
2. `npm install`
3. `npm run dev`

## Contributing

Issue / PR açabilirsin. Yeni kullanıcı-görünür string eklerken TR + EN (`src/lib/i18n.ts`).

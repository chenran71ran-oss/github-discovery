# CLAUDE.md

## Project Overview

Public Turkish website showing GitHub Trending repos with AI-powered summaries. Reads data from a shared D1 database populated by github-trending-mailer Worker.

## Commands

npm install          # Install dependencies
npm run dev          # Local dev server
npm run build        # Build for production
npm run deploy       # Build + deploy to Cloudflare Pages

## Tech Stack

- Framework: Astro 5 SSR
- Adapter: @astrojs/cloudflare
- Styling: Tailwind CSS v4
- Database: Cloudflare D1 (shared with github-trending-mailer)
- Deploy: Cloudflare Pages

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

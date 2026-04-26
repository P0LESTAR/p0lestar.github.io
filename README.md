# p0lestar.github.io

Custom Jekyll theme for [p0lestar.github.io](https://p0lestar.github.io).

## Features

- Bilingual (KO / EN) with `/ko/` and `/en/` paths
- Light / dark mode (respects system, togglable, persisted)
- Syntax highlighting (Rouge, GitHub-light + One-dark palettes)
- Tag pages, archive, auto table of contents
- Client-side search (simple-jekyll-search)
- Google Analytics (production only)

## Run locally

```bash
bundle install
bundle exec jekyll serve --livereload
```

Open http://localhost:4000.

## Deploy

1. Push this repo to `p0lestar/p0lestar.github.io`.
2. GitHub Pages builds automatically on push to `main`.

## Writing posts

Create files under `_posts/ko/` or `_posts/en/` with:

```yaml
---
title: Post title
description: Short summary for cards and meta tags
date: 2026-04-24 10:00:00 +0900
categories: ko        # or "en"
tags: [tag1, tag2]
ref: unique-slug      # shared across languages for language toggle
---
```

## Structure

```
_config.yml            Site settings
_data/i18n.yml         UI strings (ko / en)
_layouts/              default, home, post, page, tag, archive
_includes/             head, header, footer, post-card, toc, search
_sass/                 tokens, reset, typography, layout, components, post, syntax
assets/css/main.scss   Entry stylesheet
assets/js/             theme.js, lang.js, search.js
_posts/ko _posts/en    Posts
ko/ en/                Language-specific pages
index.html             Root redirect
search.json            Search index (generated)
```

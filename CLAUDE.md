# MotionLens

## Overview

Chrome extension that reverse-engineers website animations, interactions, and micro-interactions into AI-ready implementation instructions.

**Tagline:** See it. Decode it. Recreate it.

## Tech Stack

- **Chrome Extension:** Plasmo, Manifest V3
- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Next.js, tRPC, Prisma
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis
- **Auth:** Supabase Auth (v1) — Clerk considered post-v1
- **Payments:** Stripe (post-v1 — v1 ships free, no pricing)
- **AI:** Claude API (primary), OpenAI (secondary)
- **Infrastructure:** Vercel, Railway

## Architecture

Four major systems:

1. **Chrome Extension** — Content scripts, popup, side panel
2. **Analysis Engine** — Capture engine, motion graph builder, framework detection
3. **AI Generation Platform** — Prompt generation for Claude, Cursor, Framer, v0, Lovable, Webflow
4. **Validation Engine** — Side-by-side comparison, match scoring

## Key Design Principles

- Premium, fast, technical, minimal, motion-first
- Inspiration: Raycast, Framer, Arc Browser, Linear, Figma Inspect
- Never modify target website (read-only)
- Respect CSP policies
- Minimal permissions (activeTab, scripting, storage, sidePanel)

## Project Structure

```
motionlens/
├── extension/          # Chrome extension (Plasmo)
│   ├── src/
│   │   ├── popup/      # Popup UI
│   │   ├── sidepanel/  # Side panel UI
│   │   ├── background/ # Service worker
│   │   ├── contents/   # Content scripts
│   │   └── lib/        # Shared utilities
│   └── ...
├── web/                # Next.js web app + API
│   ├── src/
│   │   ├── app/        # App router pages
│   │   ├── server/     # tRPC routers
│   │   └── lib/        # Shared utilities
│   └── ...
├── packages/           # Shared packages
│   ├── analysis/       # Analysis engine
│   ├── motion-graph/   # Motion graph schema + builder
│   ├── prompts/        # Prompt templates + generator
│   └── validation/     # Validation engine
└── docs/               # Documentation
```

## Commands

- `npm run dev:ext` — Start extension development
- `npm run dev:web` — Start web app development
- `npm run build` — Build all packages
- `npm run test` — Run all tests

# MotionLens Roadmap

## Milestone 1: Foundation & Core Capture (MVP Alpha)

**Goal:** Working Chrome extension that can select elements, capture interactions, and display raw motion data.

### Phase 1: Project Scaffolding

- Monorepo setup (Turborepo)
- Plasmo Chrome extension scaffold
- Next.js web app scaffold
- Shared packages structure (analysis, motion-graph, prompts, validation)
- TypeScript config, ESLint, Prettier
- CI/CD pipeline (GitHub Actions)

### Phase 2: Extension Shell

- Manifest V3 configuration (activeTab, scripting, storage, sidePanel)
- Popup UI — activation toggle, status indicator
- Side panel UI — empty state, layout skeleton
- Background service worker — message routing between popup/sidepanel/content scripts
- Content script injection — basic DOM access confirmed
- Extension icon & branding

### Phase 3: Element Selection System

- Element picker overlay (hover highlight, click to select)
- Element info display (tag, classes, dimensions, position)
- Selection persistence across interactions
- Multi-element selection support
- Escape to cancel, click outside to deselect
- Visual feedback (outline, tooltip)

### Phase 4: Event Capture Engine

- MutationObserver — track DOM changes (node add/remove, attribute changes)
- Computed style snapshots at 60fps (transform, opacity, filter, shadow, color, position)
- Event listener detection (hover, click, scroll, focus)
- Recording start/stop controls
- Raw capture data structure (timestamped frames)
- Performance guard (cap memory usage, auto-stop after 10s)

### Phase 5: Raw Data Display

- Timeline view — scrollable frame-by-frame display
- Property change list — which properties changed, from → to
- Duration & delay display
- Basic trigger detection (hover/click/scroll)
- Export raw data as JSON

---

## Milestone 2: Analysis Engine & Motion Graph

**Goal:** Transform raw capture data into structured, human-readable motion analysis.

### Phase 6: Motion Graph Builder

- MotionGraph JSON schema definition
- Transform raw frames into motion graph nodes
- Detect start state → end state for each property
- Calculate duration, delay per property
- Build element hierarchy (parent → child relationships)
- Handle staggered/chained animations

### Phase 7: Motion Classifiers

- Motion type classifier (fade, scale, translate, rotate, blur, shadow, color, layout shift)
- Trigger classifier (hover, click, scroll, load, focus, mouse movement)
- Sequence classifier (stagger, chained, parallel)
- Easing detection — fit captured curves to known easing functions (ease-in, ease-out, ease-in-out, cubic-bezier, spring)
- Confidence scores for classifications

### Phase 8: Framework Detection

- Runtime object detection (window.gsap, window.Motion, window.\_\_framer, etc.)
- Script tag analysis (loaded animation libraries)
- DOM signature detection (framework-specific attributes/classes)
- Timing pattern fingerprinting
- Framework confidence scoring (e.g., GSAP: 89%, Framer Motion: 72%)

### Phase 9: Analysis UI

- Motion breakdown panel — clear summary of what happens
- Interactive timeline with playback controls (play, pause, scrub)
- Layer inspector — element hierarchy with motion relationships
- Easing curve visualizer
- Framework detection badge with confidence
- Property detail cards (from → to, duration, delay, easing)

---

## Milestone 3: AI Prompt Generation

**Goal:** Generate platform-specific, copy-paste-ready prompts that accurately recreate captured interactions.

### Phase 10: Prompt Engine Core

- MotionGraph → natural language summarizer
- Interaction description generator (what happens, in what order)
- Technical specification formatter (timing, easing, properties)
- Prompt template system (modular, composable sections)

### Phase 11: Platform-Specific Formatters

- **Claude prompt** — detailed instructions, HTML/CSS/JS code generation focus
- **Cursor prompt** — file-context-aware, inline code suggestions
- **Framer prompt** — Framer Motion component structure, variants, transitions
- **v0 prompt** — React + Tailwind component generation format
- **Lovable prompt** — full component with styling and animation
- **Webflow prompt** — Webflow Interactions 2.0 configuration steps

### Phase 12: Prompt UI

- Prompt preview panel with syntax highlighting
- Platform selector (tabs or dropdown)
- One-click copy to clipboard
- Prompt quality indicators
- Edit prompt before copying (optional refinement)

---

## Milestone 4: Validation Engine

**Goal:** Users can compare their recreation against the original and get an accuracy score.

### Phase 13: Recreation Capture

- "Validate" mode — capture recreation on user's implementation
- Support for localhost and deployed URLs
- Generate MotionGraph B from recreation

### Phase 14: Comparison Engine

- MotionGraph A vs B comparison algorithm
- Timing accuracy (duration, delay, stagger) — 30% weight
- Easing accuracy (curve shape, velocity) — 30% weight
- Spatial accuracy (position, scale, rotation) — 25% weight
- Visual accuracy (opacity, shadow, blur, color) — 15% weight
- Overall match score (0–100)

### Phase 15: Validation UI

- Side-by-side playback (original vs recreation)
- Synchronized playback controls (play, pause, slow-mo, frame step)
- Difference report — what's off, by how much
- Improvement suggestions — specific changes to get closer
- Score badge and progress tracking

---

## Milestone 5: History, Storage & Polish

**Goal:** Users can save, revisit, and manage their analyses. Product feels complete and premium.

### Phase 16: Analysis History

- Save analyses to local storage (extension)
- Analysis list view (thumbnail, site, date, score)
- Reopen saved analysis
- Delete analyses
- Export analysis (JSON, prompt text)

### Phase 17: Cloud Sync (Requires Backend)

- User authentication (Supabase Auth, magic links — Clerk deferred post-v1)
- PostgreSQL database setup (Supabase)
- Save analyses to cloud
- Sync across devices
- Analysis sharing (public links)

### Phase 18: Design Polish

- Premium UI skin — dark theme, motion-first feel
- Micro-interactions throughout the extension UI
- Loading states, empty states, error states
- Keyboard shortcuts
- Onboarding flow (first-use tutorial)
- Extension store listing (screenshots, description, demo video)

---

## Milestone 6: Premium & Monetization (Post-v1)

**Goal:** Paid features that unlock advanced capabilities. **Deferred — v1 ships free with no pricing.** The Motion Library, batch prompt generation, and single-page interaction discovery from Phase 20 already shipped free.

### Phase 19: Stripe Integration

- Pricing tiers (Free / Pro / Team)
- Stripe Checkout integration
- Subscription management
- Usage limits on free tier (e.g., 5 analyses/month)

### Phase 20: Premium Features

- **Motion Library** — organize, tag, search saved analyses
- **Full Site Audit** — crawl website, discover all interactions, generate motion inventory
- **Batch prompt generation** — generate prompts for multiple interactions at once
- **Priority AI models** — use Claude Opus for higher quality prompts

---

## Milestone 7: Future Expansion

**Goal:** Platform expansion beyond Chrome extension.

### Phase 21: Video Analysis

- Upload screen recording
- Frame extraction pipeline
- Motion tracking from video frames
- Generate MotionGraph from video

### Phase 22: Team Workspaces

- Shared analysis libraries
- Comments on analyses
- Team roles and permissions

### Phase 23: Framer Plugin

- Shared MotionGraph format
- Analyze in Chrome → apply in Framer
- Framer-native UI

---

## Priority Matrix

| Milestone                 | Priority          | Effort | Value                |
| ------------------------- | ----------------- | ------ | -------------------- |
| 1. Foundation & Capture   | P0 — Must have    | Large  | Core product         |
| 2. Analysis Engine        | P0 — Must have    | Large  | Core value prop      |
| 3. Prompt Generation      | P0 — Must have    | Medium | Key differentiator   |
| 4. Validation Engine      | P1 — Should have  | Medium | Retention driver     |
| 5. History & Polish       | P1 — Should have  | Medium | Product completeness |
| 6. Premium & Monetization | P2 — Nice to have | Medium | Revenue              |
| 7. Future Expansion       | P3 — Later        | Large  | Growth               |

---

## MVP Definition (Milestones 1–3)

The minimum viable product ships when a user can:

1. Select an element on any website
2. Trigger and record its interaction
3. See a structured motion analysis
4. Generate an AI prompt for at least one platform (Claude)
5. Copy the prompt and use it to recreate the interaction

Everything beyond that is enhancement.

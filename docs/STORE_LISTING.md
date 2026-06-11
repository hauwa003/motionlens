# Chrome Web Store Listing (Draft)

## Name

MotionLens — Decode Website Animations

## Summary (132 chars max)

Reverse-engineer any website animation into AI-ready implementation prompts. See it. Decode it. Recreate it.

## Description

MotionLens turns the animations you admire into animations you can ship.

Point it at any element on any website, record the interaction, and MotionLens
decodes exactly what happened: which properties animated, with what timing,
easing, and sequencing — even which animation framework the site uses.

Then it writes the implementation prompt for you. One click gives you a
copy-paste-ready prompt for Claude, Cursor, Framer, v0, Lovable, or Webflow
that recreates the interaction with measured fidelity.

**Decode**

- Element picker with hover inspection (like Figma Inspect, for motion)
- 60fps capture of transforms, opacity, filters, shadows, colors, and layout
- Automatic trigger detection (hover / click / scroll / load / focus)
- Easing curves fitted to real cubic-béziers, stagger and chain detection
- Framework detection with confidence scores (GSAP, Framer Motion, and more)

**Recreate**

- Platform-specific prompts with exact timing tables
- Prompt quality scoring so you know what to double-check
- Interactive playback timeline with scrubbing and easing visualizers

**Validate**

- Record your recreation (localhost works) and get a 0–100 match score
- Weighted across timing, easing, spatial, and visual accuracy
- A concrete "to get closer" list of fixes

**Respectful by design**

- Read-only: never modifies the sites you analyze
- Minimal permissions, no tracking, analyses stay on your device

## Category

Developer Tools

## Screenshots (to capture)

1. Element picker highlighting a card on a well-known site (hover tooltip visible)
2. Side panel motion breakdown with playback timeline and easing curves
3. Prompt panel with platform tabs and quality score
4. Validation view with match score and side-by-side playback
5. Library view with tags and search

## Demo video (~30s storyboard)

1. (0–5s) Hover a beautiful animation on a real site — "See it."
2. (5–15s) Select, record, breakdown appears with timeline — "Decode it."
3. (15–25s) Copy Claude prompt, paste, recreation appears — "Recreate it."
4. (25–30s) Validation score climbs to 96 — logo + tagline.

## Permission justifications (for review)

- `activeTab` / `scripting`: inject the inspection overlay on the page the
  user explicitly activates
- `storage`: keep analyses and settings on-device
- `sidePanel`: the analysis workspace UI
- Content script on `<all_urls>`: passive, read-only; does nothing until the
  user activates MotionLens on that tab

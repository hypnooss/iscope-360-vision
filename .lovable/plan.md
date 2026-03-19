

## Problem Diagnosis

The cards appear with the glass transparency effect during their entrance animation, then become opaque afterward. Here's why:

The `Section` component wraps every section in `relative z-10`. This creates a **stacking context** that sits above the WebGL globe (which is at `z-0`). When `backdrop-blur` is applied to a card inside a `z-10` section, it blurs the section's own background (empty/dark) instead of the globe particles behind it. The brief "glass flash" you see is actually the framer-motion opacity transition from 0 to 1 — during that fade, you glimpse the globe through the partially-transparent element.

The Features section has the same issue — no section actually shows the globe through the glass properly because they all use `z-10`.

## Why z-10 Exists

The `z-10` on sections is there to ensure they visually cover the `SteppedShowcase` component's sticky content (which uses `z-0`) when scrolling past it.

## Proposed Fix

1. **Remove `z-10` from the `Section` component** — change it to `relative z-0` so the globe (fixed, z-0) can be captured by `backdrop-blur` in all cards.

2. **Isolate the SteppedShowcase overlap** — give the `SteppedShowcase` a lower z-index (e.g. `z-[-1]`) so that sections at `z-0` still cover it naturally when scrolling past, without needing `z-10`.

3. **Remove the redundant `relative z-0`** added to individual cards in the previous change, since the section itself will no longer block the background.

### Files to Edit
- `src/pages/Index.tsx` — Section component: `z-10` → `z-0`; remove per-card `relative z-0`
- `src/components/landing/SteppedShowcase.tsx` — lower z-index to `z-[-1]` or similar


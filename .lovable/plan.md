

## Landing Page Refinement -- Vercel-Quality Spacing & No Screenshots

### Problems Identified

1. **Sections bleeding into each other** -- insufficient vertical separation between hero and dashboard mockup area (visible in screenshot with red arrow)
2. **Dashboard screenshots present** -- user explicitly doesn't want any system screenshots or simulated images
3. **Too many sections crammed together** -- typical single-page problem with poor vertical rhythm
4. **Typography scale needs refinement** -- needs more breathing room

### Approach

**Remove all screenshot/image sections entirely** (hero mockup, platform preview section). Replace dashboard mockup in hero with a more abstract visual element -- animated metrics/stats badges floating around the CTA area, or simply let the hero breathe with generous whitespace.

**Fix vertical rhythm** by using much more generous padding between sections and adding subtle visual dividers (gradient lines or opacity transitions).

### Changes

**`src/pages/Index.tsx`**:
- Remove `dashboardPreview` import and all `<img>` tags showing it
- Remove the entire "Platform Preview" section (lines 262-282)
- Remove the dashboard mockup block from hero (lines 131-145)
- Increase hero section vertical padding: `pt-32 pb-24 lg:pt-44 lg:pb-36` (hero needs to breathe, fill viewport)
- Add `min-h-[90vh]` to hero so it fills the screen properly without bleeding
- Increase all section padding to `py-24 lg:py-32` (currently `py-16 lg:py-24`)
- Add subtle `border-t border-border/10` between major sections for visual separation
- Features section: `py-28 lg:py-36`
- How it Works: `py-28 lg:py-36`
- Security: `py-28 lg:py-36`
- CTA: `py-24 lg:py-32`
- Credibility + Metrics: consolidate spacing, add divider
- Reduce content density -- fewer sections total (remove Platform Preview entirely)

**`src/index.css`**:
- Adjust `grid-fade` keyframe to be subtler (currently the grid oscillates too much between 0.4 and 1 opacity in the CSS keyframe at line 166 -- this conflicts with the tailwind config values of 0.02/0.06)
- Fix the grid-fade animation inconsistency

**`tailwind.config.ts`**:
- No major changes needed

### Final Section Structure (simplified)

1. Header (sticky, 72px)
2. Hero (min-h-[90vh], badge + H1 + sub + buttons, NO image)
3. Credibility logos + Metrics (combined, with divider above)
4. Features (3 cards, generous spacing)
5. How it Works (3 steps)
6. Security & Trust (2x2 grid)
7. CTA Final
8. Footer

Total: 6 content sections instead of 8 -- cleaner, more breathing room, no screenshots.


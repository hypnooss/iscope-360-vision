

## Rebuild: Landing Page Premium (Stripe/Linear/Vercel quality)

This is a significant rebuild of the landing page to achieve modern premium SaaS quality with motion-driven storytelling, proper typography hierarchy, and polished micro-interactions.

---

### Overview

The current page has good content but lacks the visual sophistication of reference sites. The rebuild will focus on: better scroll animations (framer-motion), upgraded typography, proper spacing (120px sections), two-column hero, new sections (Integrations, Social Proof), and refined micro-interactions throughout.

The existing Canvas 2D particle globe will be kept and optimized — it already performs well and matches the design memory. Replacing it with Three.js would add ~200KB of dependencies for marginal visual improvement given the current aesthetic works.

---

### New Dependencies

- `framer-motion` — scroll-triggered animations with proper easing, stagger, and viewport detection (replaces raw IntersectionObserver)

### Font Updates

**index.html**: Replace current Google Fonts import with:
- `Inter` (body, 300-700)
- `Plus Jakarta Sans` (headlines, 500-800) — replaces Space Grotesk for a more modern SaaS feel

**tailwind.config.ts**: Update `fontFamily.heading` to `Plus Jakarta Sans`

---

### File Changes

#### 1. `src/components/Header.tsx` — Enhanced Navbar

- Keep sticky 72px height with backdrop blur
- Add scroll-aware opacity transition (more opaque on scroll via state)
- Update nav links: **Produto**, **Features**, **Integrações**, **Docs**, **Contato**
- CTA button with `hover:translate-y-[-2px]` and soft shadow animation
- Smoother mobile menu with framer-motion AnimatePresence

#### 2. `src/pages/Index.tsx` — Full Rebuild

All sections get 120px vertical padding (`py-[120px]`), max-w-[1200px] centered container, and framer-motion `motion.div` with viewport-triggered animations using `cubic-bezier(0.22, 1, 0.36, 1)` easing.

**Section structure (10 sections):**

```text
 1. HERO            — Two-column: headline left + particle globe right
 2. SOCIAL PROOF    — Logo cloud (grayscale, hover to full opacity)
 3. PROBLEM         — Impact stats (21,500+ CVEs, 5 days, $4.88M)
 4. REAL PROBLEM    — False positives / alert fatigue (existing content)
 5. HOW IT WORKS    — 4-step flow (existing, refined spacing)
 6. FEATURES        — 3-column cards (existing, better hover effects)
 7. INTEGRATIONS    — Floating logos with animated connection lines
 8. COMPLIANCE      — Framework grid (existing, refined)
 9. TESTIMONIALS    — Refined quotes (existing content)
10. BLOG/INSIGHTS   — Article cards (existing content)
11. FINAL CTA       — Full-width with radial glow
12. FOOTER          — Refined with consistent links
```

**Key section details:**

**HERO (two-column)**:
- Left: H1 at 64px bold, subheadline 18px max-w-[520px], CTA button (48px height, radius 10px, hover translateY -2px)
- Right: The existing `<NetworkAnimation />` positioned within a container (no longer fixed full-screen — contained to hero right column)
- Grid: `grid-cols-[1fr_1.2fr]` on desktop, stacked on mobile

**SOCIAL PROOF (new)**:
- Title: "Utilizado por equipes de segurança em todo o Brasil"
- 6-8 company logos in grayscale (simulated with text badges since we have no real logos)
- `opacity-0.5 hover:opacity-1` transition

**INTEGRATIONS (new)**:
- Central iScope logo/badge
- Surrounding integration logos: AWS, Azure, GCP, Fortinet, Palo Alto, CrowdStrike, Tenable, Qualys
- Animated dashed lines connecting to center (CSS animation)
- Title: "Conecte com seu ecossistema existente"

**Micro-interactions across all cards:**
- `hover:translateY(-4px)` with `transition-transform duration-300`
- Soft glow on hover via `box-shadow`
- Button scale on hover: `hover:scale-[1.02]`
- Link underline animation on hover

#### 3. `src/components/NetworkAnimation.tsx` — Adaptation

- Change from `fixed inset-0` to `absolute` positioning so it can be contained within the hero right column
- Accept optional `className` prop for positioning
- Reduce particle count from 8000 to 4000 for performance (contained area is smaller)
- Remove scroll-based morphing (no longer full-page background)

#### 4. `src/index.css` — Refinements

- Add `scroll-behavior: smooth` to html
- Add subtle noise texture utility class
- Add radial gradient utility for section backgrounds
- Refine the `feature-card` hover to include `translateY(-4px)` and glow

#### 5. `tailwind.config.ts` — Typography update

- Update heading font to Plus Jakarta Sans
- Ensure animation keyframes include stagger-friendly variants

---

### Animation System (framer-motion)

Replace `SectionReveal` with a `motion.div` wrapper using:

```
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: "-100px" }}
transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
```

Stagger children with `staggerChildren: 0.1` in parent variants.

---

### Performance Considerations

- All animations use `transform` and `opacity` only (GPU-accelerated)
- Particle count reduced to 4000 in contained area
- `will-change: transform` on animated elements
- Passive scroll listeners
- Lazy viewport detection with `once: true`
- No heavy blur shadows; use pre-computed gradients

---

### What stays the same

- All existing content/copy (stats, testimonials, blog posts, frameworks)
- Color scheme and CSS variables
- Auth redirect logic
- Footer structure (links updated to match new sections)


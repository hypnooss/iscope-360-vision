

## Plan: Rewrite NetworkAnimation with MazeHQ's GPU Noise Shader

### What we learned
The MazeHQ globe uses a fundamentally different approach from our current implementation:
- **MazeHQ**: All animation runs on the GPU via 4D simplex noise (FBM) in the vertex shader. Particles are placed on a sphere once, then the shader displaces them with organic "blob" deformation each frame. Color is noise-driven, not position-driven.
- **Ours**: Animation runs on the CPU (updating 18,000 particles per frame in JS), with position-based color gradient and manual Fresnel calculations.

### Changes

**Rewrite `src/components/NetworkAnimation.tsx`:**

1. **New vertex shader** — Port the MazeHQ shader with:
   - 4D simplex noise (`snoise`) and FBM (`fbm`) for organic blob deformation
   - `uAmplitude` uniform controlling surface displacement intensity
   - `uFrequency` uniform for noise scale
   - `uTime` / `uSpeed` uniforms for animation
   - Noise-based color mixing between base color and noise color (cyan/magenta palette)
   - Distance-based alpha (`vAlpha = uAlpha * aAlpha * (300.0 / vDistance)`)
   - Remove the stream/funnel code (not needed for our globe mode)

2. **New fragment shader** — Soft circular particles using `gl_PointCoord` (keep similar to current but use the new varyings: `vColor`, `vAlpha`, `vNoise`)

3. **JS initialization** — Simplify dramatically:
   - Distribute particles on a sphere using golden angle (keep current distribution)
   - Set positions once at init; GPU handles all animation via noise displacement
   - Replace per-frame CPU loop with just updating `uTime` uniform each frame
   - Add uniforms: `uTime`, `uSpeed`, `uAmplitude`, `uFrequency`, `uSize`, `uAlpha`, `uPixelRatio`, `uScale`, `uDepth`, `uRcolor/uGcolor/uBcolor`, `uRnoise/uGnoise/uBnoise`
   - Add per-particle attributes: `aAlpha`, `aMove`, `aSpeed`, `aRandomness`, `aIndex`
   - Remove CPU-side color/alpha calculations entirely

4. **Uniform values** tuned to match MazeHQ's blob aesthetic:
   - Base colors: Cyan (#22D0DF) → Magenta (#B43CC8) via noise mixing
   - `uAmplitude`: ~0.15 for subtle organic deformation
   - `uFrequency`: ~1.5 for medium-scale noise features  
   - `uSpeed`: ~0.0003 for slow morphing
   - Keep slow Y-axis rotation

5. **Performance boost** — Moving all per-particle math to GPU eliminates the CPU bottleneck of updating 18,000 particles per frame.

No changes needed to `Index.tsx` or any other file — the component API stays the same.


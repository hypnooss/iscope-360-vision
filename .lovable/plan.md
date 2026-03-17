

## Analysis: MazeHQ vs Our Implementation

Now I have the exact MazeHQ shaders. Here's what differs and what we should update:

### Key Differences Found

1. **Fragment shader**: MazeHQ uses a **particle texture** (`texture2D(pointTexture, gl_PointCoord)`) for soft, glowy dots. We use a procedural circle with `smoothstep`. The texture gives a much softer, more organic look.

2. **Vertex displacement** (globe mode): MazeHQ's is simpler and cleaner:
   - `displaced *= (1.0 + uAmplitude * noise)` — blob wave
   - `displaced += scale * depth * aMove * aSpeed * snoise2d(...)` — surface drift
   - No tangent/bitangent calculation, no complex surface-constrained drift

3. **Globe config values**: `uFrequency: 0.01`, `uAmplitude: 0.1`, `uDepth: 0.3` — our values are `1.2`, `0.04`, `0.005`. MazeHQ uses much lower frequency (smoother noise) and higher depth (more particle scatter).

4. **Colors**: MazeHQ primary `(40, 197, 234)` vs ours `(34, 208, 223)` — close but slightly different. Noise color `(202, 50, 223)` vs ours `(180, 60, 200)`.

5. **Alpha**: MazeHQ uses `uAlpha * aAlpha * (300.0 / vDistance)` — simpler depth fade. We have extra morph-related alpha logic.

6. **Point size**: MazeHQ: `uSize * 100.0 / vDistance * pixelRatio`. Ours adds morph multipliers and depth scaling.

### Plan

**File: `src/components/NetworkAnimation.tsx`**

1. **Update fragment shader** — Replace procedural circle with a programmatic soft-glow falloff that mimics a particle texture (gaussian-like), since we can't load their texture file:
   ```glsl
   float dist = length(gl_PointCoord - vec2(0.5));
   float alpha = exp(-dist * dist * 8.0); // soft gaussian glow
   gl_FragColor = vec4(vColor, vAlpha * alpha);
   ```

2. **Simplify vertex displacement for globe state** — Match MazeHQ's approach:
   - Remove tangent/bitangent surface-constrained drift
   - Use direct `position *= (1.0 + uAmplitude * noise)` for blob wave
   - Use `position += uScale * uDepth * aMove * aSpeed * snoise2d(aIndex, uTime * uSpeed)` for scatter
   - Keep our morph system (sand transition) intact, but apply the simpler displacement to the sphere branch only

3. **Update uniform defaults** to match MazeHQ globe preset:
   - `uFrequency: 0.01` (was `1.2`)
   - `uAmplitude: 0.1` (was `0.04`)
   - `uDepth: 0.3` (was `0.005`)
   - `uRcolor: 40, uGcolor: 197, uBcolor: 234`
   - `uRnoise: 202, uGnoise: 50, uBnoise: 223`

4. **Simplify alpha/size calculations** for globe state to match MazeHQ's cleaner formulas, while preserving morph-specific adjustments for the sand transition.

### Technical Notes
- The sand morph system is our custom feature — MazeHQ doesn't have it. We preserve it but ensure the globe state now matches MazeHQ exactly.
- The biggest visual improvement will come from the frequency/depth/amplitude changes and the softer particle rendering.


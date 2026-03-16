

## Problem

The globe particles are too scattered ("carnaval") because the per-particle jitter displacement is too strong. The shader line:

```glsl
displaced += vec3(uScale * uDepth * aMove * aSpeed * snoise2d(...));
```

With `uScale=1.0`, `uDepth=0.3`, `aMove` up to ±1.0, `aSpeed` up to 2.0, each particle can drift up to ~0.6 units away from the sphere surface (on a unit-radius sphere). This scatters everything.

## Fix

Tune the uniforms to keep particles tight to the sphere surface while preserving the organic blob movement:

1. **Reduce `uDepth`** from `0.3` to `0.03` — cuts jitter by 10x, keeping particles near the sphere
2. **Reduce `uAmplitude`** from `0.15` to `0.08` — subtler blob deformation
3. **Increase `uSize`** from `2.5` to `3.0` — slightly larger particles for denser appearance
4. **Increase `uAlpha`** from `0.8` to `1.0` — brighter, more defined globe

These are single-line uniform value changes in `NetworkAnimation.tsx` (lines 266-271). No shader or structural changes needed.




## Root Cause

All previous issues stem from one architectural mismatch: our particles live on a **unit sphere (radius 1.0)** and get scaled via `points.scale.setScalar(~300)`. But Three.js applies scale in the **modelViewMatrix**, so the `position` attribute in the shader remains ~1.0. MazeHQ's .glb models have vertices already at the correct scale (~100-200), so their uniforms (`uFrequency: 0.01`, `uAmplitude: 0.1`, `uDepth: 0.3`) work directly on those positions.

With our unit sphere: `position * 0.01 = 0.01` -- near-zero noise. That's why the globe broke.

## Fix: Bake positions at real scale

Instead of unit sphere + runtime scale, generate particles at **radius 200** directly. Remove `points.scale.setScalar()`. Then MazeHQ's exact uniform values work without any translation.

### Changes to `src/components/NetworkAnimation.tsx`

1. **Particle positions**: Generate on sphere of radius **200** instead of 1.0
   - `r = 200 * rMul` instead of `1.0 * rMul`

2. **Flat positions**: Scale proportionally (multiply all flat coords by 200)
   - Width, depth, Y offset all ×200

3. **Remove `points.scale.setScalar(scale)`** from animate loop -- positions are already at the right scale

4. **Use MazeHQ's exact uniform values**:
   - `uFrequency: 0.01`, `uAmplitude: 0.1`, `uDepth: 0.3`
   - Colors: `(40, 197, 234)` / `(202, 50, 223)` (already set)

5. **Rotation**: Keep `ROTATION_SPEED = 0.00015`, ensure `points.rotation.y = elapsed * ROTATION_SPEED * 1000` is applied without being zeroed

6. **Sand morph adjustments**: Scale `points.position.y` offset for sand state to match the new coordinate space (no more `currentSphereRadius` dependency since positions are pre-scaled)

7. **Camera**: Keep at z=800, adjust sand-state camera offset proportionally

This is a single-file change to `NetworkAnimation.tsx`. The shader code stays exactly the same -- only the JS geometry generation and animate loop change.


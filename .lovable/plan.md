

## Plan: Tighten particles to globe and increase size

Two uniform changes in `src/components/NetworkAnimation.tsx`:

1. **Increase particle size**: `uSize` from `9.0` → `14.0` — particles will be much larger and overlap more, creating the dense cohesive surface like MazeHQ
2. **Reduce jitter depth**: `uDepth` from `0.008` → `0.002` — particles stay even tighter to the sphere surface
3. **Reduce amplitude**: `uAmplitude` from `0.06` → `0.03` — less noise-driven displacement from the sphere

Also tighten the atmosphere layer (lines ~232-236) so the 12% "atmosphere" particles don't spread as far:
- Change `rMul` for atmosphere from `1.01 + Math.random() * 0.1` → `1.005 + Math.random() * 0.03`
- Change core particles from `0.98 + Math.random() * 0.04` → `0.99 + Math.random() * 0.02`

This pulls all particles closer to a tight sphere while making them visually larger.


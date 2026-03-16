

## Problem Analysis

Comparing the MazeHQ reference with the current iScope globe:

1. **Animation too fast**: Two sources of speed:
   - `uTime = elapsed * 0.04` — FBM noise evolves too quickly (should be ~0.01)
   - `ROTATION_SPEED = 0.00006` multiplied by `* 1000` on line 319 = **0.06 rad/s** rotation — this is the main culprit. MazeHQ's globe barely rotates.

2. **Particles too small**: `uSize = 5.5` but MazeHQ uses much larger, denser particles that almost blend together forming a cohesive surface. Need ~8-10.

## Changes in `src/components/NetworkAnimation.tsx`

1. **Slow down noise evolution**: Change `elapsed * 0.04` → `elapsed * 0.008` (~5x slower FBM morphing)
2. **Slow down rotation**: Change `ROTATION_SPEED` from `0.00006` to `0.000015` (~4x slower rotation)
3. **Increase particle size**: Change `uSize` from `5.5` to `9.0` — particles will overlap more, creating the dense cohesive look from MazeHQ
4. **Reduce tilt oscillation**: Change `Math.sin(elapsed * 0.03) * 0.12` to `Math.sin(elapsed * 0.008) * 0.08` for subtler X-axis wobble


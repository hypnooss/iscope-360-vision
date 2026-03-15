import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  z: number;
  baseTheta: number;
  basePhi: number;
  radius: number;
  speed: number;
  phase: number;
}

const NODE_COUNT = 120;
const CONNECTION_DIST = 180;
const SPHERE_RADIUS = 320;
const ROTATION_SPEED = 0.00015;
const PERSPECTIVE = 800;

function createNodes(): Node[] {
  const nodes: Node[] = [];
  // Fibonacci sphere distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const t = i / NODE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);
    const r = SPHERE_RADIUS * (0.6 + Math.random() * 0.4);
    nodes.push({
      x: 0, y: 0, z: 0,
      baseTheta: theta,
      basePhi: phi,
      radius: r,
      speed: 0.8 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return nodes;
}

function projectNode(node: Node, time: number, cx: number, cy: number) {
  const theta = node.baseTheta + time * ROTATION_SPEED * node.speed;
  const phi = node.basePhi + Math.sin(time * 0.0003 + node.phase) * 0.1;
  const r = node.radius + Math.sin(time * 0.0005 + node.phase) * 15;

  const x3d = r * Math.sin(phi) * Math.cos(theta);
  const y3d = r * Math.cos(phi);
  const z3d = r * Math.sin(phi) * Math.sin(theta);

  const depth = z3d + PERSPECTIVE + SPHERE_RADIUS;
  const scale = PERSPECTIVE / depth;

  return {
    sx: cx + x3d * scale,
    sy: cy + y3d * scale,
    scale,
    z: z3d,
    alpha: Math.max(0.15, Math.min(1, (z3d + SPHERE_RADIUS) / (2 * SPHERE_RADIUS))),
  };
}

export function NetworkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>(createNodes());
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const nodes = nodesRef.current;
    let startTime = performance.now();

    const draw = (now: number) => {
      const time = now - startTime;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w * 0.5;
      const cy = h * 0.45;

      ctx.clearRect(0, 0, w, h);

      // Project all nodes
      const projected = nodes.map(n => projectNode(n, time, cx, cy));

      // Draw connections
      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const lineAlpha = (1 - dist / CONNECTION_DIST) * Math.min(a.alpha, b.alpha) * 0.35;
            ctx.strokeStyle = `rgba(20, 184, 166, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Draw nodes (sorted by z for depth)
      const sorted = [...projected].sort((a, b) => a.z - b.z);
      for (const p of sorted) {
        const r = Math.max(1, 2.5 * p.scale);
        const glowR = r * 4;

        // Glow
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glowR);
        grad.addColorStop(0, `rgba(20, 184, 166, ${p.alpha * 0.3})`);
        grad.addColorStop(1, 'rgba(20, 184, 166, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(20, 184, 166, ${p.alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.9 }}
    />
  );
}

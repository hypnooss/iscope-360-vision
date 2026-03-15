import { useEffect, useRef } from 'react';

interface Particle {
  baseTheta: number;
  basePhi: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

const PARTICLE_COUNT = 4000;
const ROTATION_SPEED = 0.00012;
const PERSPECTIVE = 900;

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);

    // Color variation: 70% teal, 20% cyan, 10% purple
    const roll = Math.random();
    let colorR: number, colorG: number, colorB: number;
    if (roll < 0.7) {
      // Teal
      colorR = 20; colorG = 184; colorB = 166;
    } else if (roll < 0.9) {
      // Cyan
      colorR = 6; colorG = 182; colorB = 212;
    } else {
      // Purple
      colorR = 139; colorG = 92; colorB = 246;
    }

    particles.push({ baseTheta: theta, basePhi: phi, colorR, colorG, colorB });
  }
  return particles;
}

export function NetworkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>(createParticles());
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

    const particles = particlesRef.current;
    const startTime = performance.now();

    const draw = (now: number) => {
      const time = now - startTime;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w * 0.5;
      const cy = h * 0.45;
      const sphereRadius = Math.min(w, h) * 0.42;

      ctx.clearRect(0, 0, w, h);

      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00008) * 0.15;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const sp = Math.sin(p.basePhi);
        let x = sphereRadius * sp * Math.cos(p.baseTheta);
        let y = sphereRadius * Math.cos(p.basePhi);
        let z = sphereRadius * sp * Math.sin(p.baseTheta);

        // Rotate Y
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        x = rx;
        z = rz;

        // Rotate X
        const ry = y * cosX - z * sinX;
        const rz2 = y * sinX + z * cosX;
        y = ry;
        z = rz2;

        // Perspective
        const depth = z + PERSPECTIVE + sphereRadius;
        const scale = PERSPECTIVE / depth;
        const sx = cx + x * scale;
        const sy = cy + y * scale;

        // Depth-based alpha and size
        const normalizedZ = (z + sphereRadius) / (2 * sphereRadius);
        const alpha = Math.max(0.05, normalizedZ * normalizedZ * 0.95);
        const size = Math.max(0.5, 2.2 * scale);

        ctx.fillStyle = `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow on front-facing particles (top 30% depth)
        if (normalizedZ > 0.7) {
          const glowAlpha = (normalizedZ - 0.7) * 3.33 * 0.2;
          const glowR = size * 5;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          grad.addColorStop(0, `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, ${glowAlpha})`);
          grad.addColorStop(1, `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
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
      style={{ opacity: 0.95 }}
    />
  );
}

import { useEffect, useRef } from 'react';

interface Particle {
  baseTheta: number;
  basePhi: number;
}

const PARTICLE_COUNT = 2500;
const ROTATION_SPEED = 0.00012;
const PERSPECTIVE = 900;

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);
    particles.push({ baseTheta: theta, basePhi: phi });
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
      const sphereRadius = Math.min(w, h) * 0.35;

      ctx.clearRect(0, 0, w, h);

      // Rotation angles
      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00008) * 0.15;

      // Precompute rotation matrix
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Spherical to cartesian
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

        // Perspective projection
        const depth = z + PERSPECTIVE + sphereRadius;
        const scale = PERSPECTIVE / depth;
        const sx = cx + x * scale;
        const sy = cy + y * scale;

        // Depth-based alpha and size
        const normalizedZ = (z + sphereRadius) / (2 * sphereRadius);
        const alpha = Math.max(0.03, normalizedZ * normalizedZ * 0.85);
        const size = Math.max(0.4, 1.8 * scale);

        // Draw particle
        ctx.fillStyle = `rgba(20, 184, 166, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow on front-facing particles (top 25% depth)
        if (normalizedZ > 0.75) {
          const glowAlpha = (normalizedZ - 0.75) * 4 * 0.15;
          const glowR = size * 5;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          grad.addColorStop(0, `rgba(20, 184, 166, ${glowAlpha})`);
          grad.addColorStop(1, 'rgba(20, 184, 166, 0)');
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

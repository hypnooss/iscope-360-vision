import { useEffect, useRef } from 'react';

interface Particle {
  // Spherical coords
  theta: number;
  phi: number;
  // Normalized radius (0.85-1.15 for diffuse edges)
  radiusMul: number;
  // Visual
  baseSize: number;
  colorR: number;
  colorG: number;
  colorB: number;
  brightnessBoost: number;
}

const PARTICLE_COUNT = 6000;
const ROTATION_SPEED = 0.00015;
const PERSPECTIVE = 800;

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);

    // Diffuse edges: most particles on surface, some scattered outward
    const rRoll = Math.random();
    let radiusMul: number;
    if (rRoll < 0.75) {
      radiusMul = 0.97 + Math.random() * 0.06; // tight on surface
    } else if (rRoll < 0.92) {
      radiusMul = 1.03 + Math.random() * 0.12; // slightly outside
    } else {
      radiusMul = 1.15 + Math.random() * 0.15; // scattered outer halo
    }

    // Size variation: mostly tiny, some medium, few bright
    const sizeRoll = Math.random();
    let baseSize: number;
    if (sizeRoll < 0.6) {
      baseSize = 0.3 + Math.random() * 0.4; // tiny specks
    } else if (sizeRoll < 0.9) {
      baseSize = 0.7 + Math.random() * 0.6; // medium
    } else {
      baseSize = 1.3 + Math.random() * 0.8; // bright dots
    }

    // Color: dark teal base, some cyan highlights, rare bright white-ish
    const colorRoll = Math.random();
    let colorR: number, colorG: number, colorB: number;
    let brightnessBoost = 0;
    if (colorRoll < 0.55) {
      // Dark teal
      colorR = 15; colorG = 140; colorB = 130;
    } else if (colorRoll < 0.80) {
      // Brighter teal
      colorR = 20; colorG = 184; colorB = 166;
    } else if (colorRoll < 0.92) {
      // Cyan
      colorR = 30; colorG = 200; colorB = 220;
      brightnessBoost = 0.1;
    } else {
      // Bright cyan-white highlights
      colorR = 120; colorG = 230; colorB = 240;
      brightnessBoost = 0.25;
    }

    particles.push({
      theta, phi, radiusMul, baseSize,
      colorR, colorG, colorB, brightnessBoost,
    });
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
      const cy = h * 0.46;
      const sphereRadius = Math.min(w, h) * 0.44;

      ctx.clearRect(0, 0, w, h);

      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00006) * 0.12;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const r = sphereRadius * p.radiusMul;

        const sp = Math.sin(p.phi);
        let x = r * sp * Math.cos(p.theta);
        let y = r * Math.cos(p.phi);
        let z = r * sp * Math.sin(p.theta);

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
        const maxR = sphereRadius * 1.3;
        const depth = z + PERSPECTIVE + maxR;
        const scale = PERSPECTIVE / depth;
        const sx = cx + x * scale;
        const sy = cy + y * scale;

        // Depth-based alpha: back = very dim, front = bright
        const normalizedZ = (z + maxR) / (2 * maxR);
        const depthAlpha = normalizedZ * normalizedZ;
        const alpha = Math.max(0.02, (depthAlpha * 0.85) + p.brightnessBoost);
        const clampedAlpha = Math.min(alpha, 1);
        const size = Math.max(0.2, p.baseSize * scale * 1.1);

        ctx.fillStyle = `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, ${clampedAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow on bright front-facing particles
        if (normalizedZ > 0.65 && p.brightnessBoost > 0.05) {
          const glowAlpha = (normalizedZ - 0.65) * 2.85 * 0.12;
          const glowR = size * 4;
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
    />
  );
}

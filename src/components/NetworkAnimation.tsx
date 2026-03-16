import { useEffect, useRef } from "react";

interface Particle {
  theta: number;
  phi: number;
  radiusMul: number;
  baseSize: number;
  colorSeed: number;
  brightnessBoost: number;
  disperseX: number;
  disperseY: number;
  thetaSpeed: number;
  phiSpeed: number;
}

const PARTICLE_COUNT = 8000;
const ROTATION_SPEED = 0.00015;
const PERSPECTIVE = 800;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);

    particles.push({
      theta,
      phi,
      radiusMul: 0.99 + Math.random() * 0.03,
      baseSize: 0.4 + Math.random() * 0.8,
      colorSeed: Math.random(),
      brightnessBoost: Math.random() < 0.05 ? 0.25 : 0,
      disperseX: (Math.random() - 0.5) * 2,
      disperseY: (Math.random() - 0.5) * 2,
      thetaSpeed: (Math.random() - 0.5) * 0.003,
      phiSpeed: (Math.random() - 0.5) * 0.0015,
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

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const particles = particlesRef.current;
    const startTime = performance.now();

    const draw = (now: number) => {
      const time = now - startTime;

      const w = window.innerWidth;
      const h = window.innerHeight;

      const scrollY = window.scrollY;
      const scrollProgress = scrollY / h;

      const flattenAmount = clamp((scrollProgress - 0.3) / 0.7, 0, 1);
      const disperseAmount = clamp((scrollProgress - 1.0) / 1.0, 0, 1);
      const fadeOut = clamp((scrollProgress - 2.5) / 0.5, 0, 1);

      const cx = w * 0.5;
      const cyBase = h * 0.48;
      const cy = cyBase + disperseAmount * h * 0.35;

      const sphereRadius = Math.min(w, h) * 0.55;

      ctx.clearRect(0, 0, w, h);

      const globalAlpha = 1 - fadeOut * 0.7;

      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00006) * 0.12 + disperseAmount * 0.65;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const t1 = time * 0.0012;
      const t2 = time * 0.0009;

      const disperseScale = 1 + disperseAmount * 3.2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.theta += p.thetaSpeed;
        p.phi += p.phiSpeed;

        if (p.phi < 0.05 || p.phi > Math.PI - 0.05) {
          p.phiSpeed = -p.phiSpeed;
          p.phi = clamp(p.phi, 0.05, Math.PI - 0.05);
        }

        const morphNoise = Math.sin(p.theta * 2 + time * 0.0005) * 0.15;

        const morphedPhi = p.phi + (Math.PI * 0.5 - p.phi) * flattenAmount * 0.35 + morphNoise * flattenAmount;

        const r = sphereRadius * p.radiusMul * disperseScale;

        const sp = Math.sin(morphedPhi);

        let x = r * sp * Math.cos(p.theta);
        let y = r * Math.cos(morphedPhi);
        let z = r * sp * Math.sin(p.theta);

        if (disperseAmount > 0) {
          x += p.disperseX * disperseAmount * w * 0.12;
          y += p.disperseY * disperseAmount * h * 0.08;
          z += p.disperseX * disperseAmount * w * 0.15;
        }

        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;

        x = rx;
        z = rz;

        const ry = y * cosX - z * sinX;
        const rz2 = y * sinX + z * cosX;

        y = ry;
        z = rz2;

        const maxR = sphereRadius * disperseScale * 1.3;

        const depth = z + PERSPECTIVE + maxR;
        const scale = PERSPECTIVE / depth;

        const sx = cx + x * scale;
        const sy = cy + y * scale;

        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

        const normalizedZ = (z + maxR) / (2 * maxR);

        const depthAlpha = normalizedZ * normalizedZ * normalizedZ;

        const alpha = Math.max(0.03, depthAlpha + p.brightnessBoost);

        const clampedAlpha = Math.min(alpha * globalAlpha, 1);

        const size = Math.max(0.2, p.baseSize * scale * 1.4);

        const wave = Math.sin(p.theta * 3 + t1) + Math.sin(p.phi * 4 + t2);

        const pulse = Math.sin(t1 + p.theta * 2) * 0.5 + 0.5;

        const shifted = (wave * 0.2 + pulse * 0.35 + p.colorSeed * 0.05) % 1;

        const zone = shifted * 3;

        let rC = 20;
        let gC = 184;
        let bC = 166;

        if (zone < 1) {
          const t = zone;
          rC = lerp(20, 30, t);
          gC = lerp(184, 200, t);
          bC = lerp(166, 230, t);
        } else if (zone < 2) {
          const t = zone - 1;
          rC = lerp(30, 170, t);
          gC = lerp(200, 60, t);
          bC = lerp(230, 180, t);
        } else {
          const t = zone - 2;
          rC = lerp(170, 20, t);
          gC = lerp(60, 184, t);
          bC = lerp(180, 166, t);
        }

        ctx.fillStyle = `rgba(${rC | 0},${gC | 0},${bC | 0},${clampedAlpha})`;

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        if (normalizedZ > 0.75 && p.brightnessBoost > 0.1 && disperseAmount < 0.3) {
          const glowR = size * 4;

          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);

          grad.addColorStop(0, `rgba(${rC | 0},${gC | 0},${bC | 0},0.15)`);

          grad.addColorStop(1, `rgba(${rC | 0},${gC | 0},${bC | 0},0)`);

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
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />;
}

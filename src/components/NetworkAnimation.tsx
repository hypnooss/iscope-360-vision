import { useEffect, useRef } from "react";

interface Particle {
  theta: number;
  phi: number;
  radiusMul: number;
  baseSize: number;
  thetaSpeed: number;
  phiSpeed: number;
}

const PARTICLE_COUNT = 25000;
const ROTATION_SPEED = 0.00008;
const PERSPECTIVE = 800;

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

    // 15% of particles spread beyond radius for atmospheric halo
    const isAtmosphere = Math.random() < 0.15;
    const radiusMul = isAtmosphere
      ? 1.01 + Math.random() * 0.11
      : 0.99 + Math.random() * 0.02;

    particles.push({
      theta,
      phi,
      radiusMul,
      baseSize: 0.3 + Math.random() * 0.5,
      thetaSpeed: (Math.random() - 0.5) * 0.002,
      phiSpeed: (Math.random() - 0.5) * 0.001,
    });
  }

  return particles;
}

interface NetworkAnimationProps {
  className?: string;
}

export function NetworkAnimation({ className = '' }: NetworkAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>(createParticles());
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width ?? window.innerWidth;
      const h = rect?.height ?? window.innerHeight;
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
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width ?? window.innerWidth;
      const h = rect?.height ?? window.innerHeight;

      const cx = w * 0.5;
      const cy = h * 0.48;
      const sphereRadius = Math.min(w, h) * 0.65;

      ctx.clearRect(0, 0, w, h);

      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00004) * 0.1;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.theta += p.thetaSpeed;
        p.phi += p.phiSpeed;

        if (p.phi < 0.05 || p.phi > Math.PI - 0.05) {
          p.phiSpeed = -p.phiSpeed;
          p.phi = clamp(p.phi, 0.05, Math.PI - 0.05);
        }

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

        const maxR = sphereRadius * 1.3;
        const depth = z + PERSPECTIVE + maxR;
        const scale = PERSPECTIVE / depth;

        const sx = cx + x * scale;
        const sy = cy + y * scale;

        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

        // Depth: normalizedZ 0=back, 1=front
        const normalizedZ = (z + maxR) / (2 * maxR);

        // Back face: nearly invisible
        if (normalizedZ < 0.25) {
          const alpha = normalizedZ * 0.08;
          if (alpha < 0.003) continue;
          ctx.fillStyle = `rgba(15,20,40,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.2, p.baseSize * scale), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Surface normal dot with view direction (Fresnel)
        const dist = Math.sqrt(x * x + y * y + z * z);
        const nz = z / (dist || 1);
        const edgeFactor = 1 - Math.abs(nz); // 0=facing camera, 1=edge

        // Diagonal gradient: top-left = cyan, bottom-right = magenta
        const diagonalMix = clamp((-x + y) / (2 * sphereRadius) + 0.5, 0, 1);

        // Color: lerp Magenta(180, 50, 200) → Cyan(30, 210, 230)
        const rC = 180 + (30 - 180) * diagonalMix;
        const gC = 50 + (210 - 50) * diagonalMix;
        const bC = 200 + (230 - 200) * diagonalMix;

        let alpha: number;

        if (edgeFactor >= 0.6) {
          // RIM: bright glow
          const rimIntensity = (edgeFactor - 0.6) / 0.4;
          alpha = 0.2 + rimIntensity * 0.8;
        } else {
          // CENTER: nearly invisible (fades into dark background)
          alpha = edgeFactor * 0.15;
        }

        // Depth fade: back face much darker
        alpha *= (0.1 + normalizedZ * 0.9);

        if (alpha < 0.003) continue;

        const size = Math.max(0.2, p.baseSize * scale);

        ctx.fillStyle = `rgba(${rC | 0},${gC | 0},${bC | 0},${clamp(alpha, 0, 1)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} />;
}

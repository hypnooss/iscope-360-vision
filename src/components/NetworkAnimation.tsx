import { useEffect, useRef } from "react";

interface Particle {
  theta: number;
  phi: number;
  radiusMul: number;
  baseSize: number;
  thetaSpeed: number;
  phiSpeed: number;
}

const PARTICLE_COUNT = 18000;
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

    // 10% of particles spread beyond radius for atmosphere
    const isAtmosphere = Math.random() < 0.1;
    const radiusMul = isAtmosphere
      ? 1.01 + Math.random() * 0.07
      : 0.99 + Math.random() * 0.02;

    particles.push({
      theta,
      phi,
      radiusMul,
      baseSize: 0.15 + Math.random() * 0.35,
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
      const sphereRadius = Math.min(w, h) * 0.55;

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

        // Back face nearly invisible
        if (normalizedZ < 0.3) {
          const alpha = normalizedZ * 0.08;
          if (alpha < 0.005) continue;
          ctx.fillStyle = `rgba(20,30,60,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.2, p.baseSize * scale), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Silhouette factor: how close to edge vs center
        // Use the original (pre-projection) position to compute normal dot with view dir
        const dist = Math.sqrt(x * x + y * y + z * z);
        const nz = z / (dist || 1); // normalized z component of surface normal
        const edgeFactor = 1 - Math.abs(nz); // 0=facing camera, 1=edge

        let rC: number, gC: number, bC: number, alpha: number;

        if (edgeFactor > 0.5) {
          // Edge/silhouette: cyan ↔ magenta based on vertical angle
          const verticalMix = clamp((y / (sphereRadius || 1)) * 0.5 + 0.5, 0, 1);
          const edgeIntensity = (edgeFactor - 0.5) * 2; // 0..1

          // Cyan (34, 208, 223) → Magenta (200, 80, 192)
          rC = 34 + (200 - 34) * verticalMix;
          gC = 208 + (80 - 208) * verticalMix;
          bC = 223 + (192 - 223) * verticalMix;

          alpha = 0.3 + edgeIntensity * 0.6;
          // Front face edges brighter
          alpha *= (0.4 + normalizedZ * 0.6);
        } else {
          // Center: navy with subtle teal tint
          const centerBlend = edgeFactor / 0.5; // 0=dead center, 1=transition zone
          rC = 15 + centerBlend * 15;
          gC = 30 + centerBlend * 60;
          bC = 60 + centerBlend * 40;

          alpha = 0.15 + normalizedZ * 0.25;
        }

        // Front-face size boost
        const sizeBoost = normalizedZ > 0.5 ? 1.0 + (normalizedZ - 0.5) * 0.5 : 1.0;
        const size = Math.max(0.2, p.baseSize * scale * sizeBoost);

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

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
  // Individual movement
  thetaSpeed: number;
  phiSpeed: number;
}

const PARTICLE_COUNT = 15000;
const ROTATION_SPEED = 0.00015;
const PERSPECTIVE = 800;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);

    // Diffuse edges
    const rRoll = Math.random();
    let radiusMul: number;
    if (rRoll < 0.75) {
      radiusMul = 0.97 + Math.random() * 0.06;
    } else if (rRoll < 0.92) {
      radiusMul = 1.03 + Math.random() * 0.12;
    } else {
      radiusMul = 1.15 + Math.random() * 0.15;
    }

    const sizeRoll = Math.random();
    let baseSize: number;
    if (sizeRoll < 0.7) {
      baseSize = 0.3 + Math.random() * 0.5;
    } else if (sizeRoll < 0.95) {
      baseSize = 0.8 + Math.random() * 0.4;
    } else {
      baseSize = 1.2 + Math.random() * 0.3;
    }

    const brightnessBoost = Math.random() < 0.05 ? 0.3 : Math.random() < 0.3 ? 0.08 : 0;

    particles.push({
      theta,
      phi,
      radiusMul,
      baseSize,
      colorSeed: Math.random(),
      brightnessBoost,
      disperseX: (Math.random() - 0.5) * 2,
      disperseY: (Math.random() - 0.5) * 2,
      thetaSpeed: (Math.random() - 0.5) * 0.004,
      phiSpeed: (Math.random() - 0.5) * 0.002,
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
    window.addEventListener("resize", resize);

    const particles = particlesRef.current;
    const startTime = performance.now();

    const draw = (now: number) => {
      const time = now - startTime;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scrollY = window.scrollY;
      const scrollProgress = scrollY / h;

      // Morphing phases
      const flattenAmount = clamp((scrollProgress - 0.3) / 0.7, 0, 1); // 0.3 → 1.0
      const disperseAmount = clamp((scrollProgress - 1.0) / 1.0, 0, 1); // 1.0 → 2.0
      const fadeOut = clamp((scrollProgress - 2.5) / 0.5, 0, 1); // 2.5 → 3.0

      const cx = w * 0.5;
      // Shift sphere up as user scrolls
      const cyBase = h * 0.48;
      const cy = cyBase - disperseAmount * h * 0.15;
      const sphereRadius = Math.min(w, h) * 0.55;

      ctx.clearRect(0, 0, w, h);

      // Global alpha for late-scroll fade
      const globalAlpha = 1 - fadeOut * 0.7;

      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00006) * 0.12;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Individual particle movement
        p.theta += p.thetaSpeed;
        p.phi += p.phiSpeed;
        // Bounce phi within [0.05, PI-0.05]
        if (p.phi < 0.05 || p.phi > Math.PI - 0.05) {
          p.phiSpeed = -p.phiSpeed;
          p.phi = clamp(p.phi, 0.05, Math.PI - 0.05);
        }

        // Apply morphing to phi: flatten toward equator
        const morphedPhi = lerp(p.phi, Math.PI * 0.5, flattenAmount * 0.85);

        // Apply disperse: expand radius and add random offset
        const disperseScale = 1 + disperseAmount * 2.5;
        const r = sphereRadius * p.radiusMul * disperseScale;

        const sp = Math.sin(morphedPhi);
        let x = r * sp * Math.cos(p.theta);
        let y = r * Math.cos(morphedPhi);
        let z = r * sp * Math.sin(p.theta);

        // Add random dispersion offset
        if (disperseAmount > 0) {
          x += p.disperseX * disperseAmount * w * 0.4;
          y += p.disperseY * disperseAmount * h * 0.3;
        }

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
        const maxR = sphereRadius * disperseScale * 1.3;
        const depth = z + PERSPECTIVE + maxR;
        const scale = PERSPECTIVE / depth;
        const sx = cx + x * scale;
        const sy = cy + y * scale;

        // Depth-based alpha: back very dim, front very bright
        const normalizedZ = (z + maxR) / (2 * maxR);
        const depthAlpha = normalizedZ * normalizedZ * normalizedZ; // cubic for more contrast
        const frontBoost = normalizedZ > 0.6 ? (normalizedZ - 0.6) * 2.5 : 0;
        const alpha = Math.max(0.03, depthAlpha * 1.0 + p.brightnessBoost + frontBoost * 0.3);
        const clampedAlpha = Math.min(alpha * globalAlpha, 1);

        // Size: slight front boost
        const frontSizeMul = normalizedZ > 0.5 ? 1 + (normalizedZ - 0.5) * 0.5 : 1;
        const size = Math.max(0.25, p.baseSize * scale * 1.2 * frontSizeMul);

        // Silhouette-based coloring: edges get dynamic color, center stays teal
        const dx = sx - cx;
        const dy = sy - cy;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const projectedRadius = sphereRadius * scale * 0.85;
        const edgeFactor = clamp(distFromCenter / projectedRadius, 0, 1);
        const edgePow = edgeFactor * edgeFactor * edgeFactor; // cubic for sharp edge transition

        // Edge color: use vertical angle for cyan vs magenta
        const vertAngle = Math.atan2(dy, dx); // angle on screen
        const vertNorm = (vertAngle + Math.PI) / (2 * Math.PI);
        const shifted = (vertNorm + p.colorSeed * 0.15) % 1;

        // Edge gradient: cyan ↔ magenta
        let edgeR: number, edgeG: number, edgeB: number;
        const zone = shifted * 3;
        if (zone < 1) {
          const t = zone;
          edgeR = lerp(20, 30, t);
          edgeG = lerp(184, 200, t);
          edgeB = lerp(166, 230, t);
        } else if (zone < 2) {
          const t = zone - 1;
          edgeR = lerp(30, 170, t);
          edgeG = lerp(200, 60, t);
          edgeB = lerp(230, 180, t);
        } else {
          const t = zone - 2;
          edgeR = lerp(170, 20, t);
          edgeG = lerp(60, 184, t);
          edgeB = lerp(180, 166, t);
        }

        // Blend: center=teal, edges=dynamic
        const cR = lerp(20, edgeR, edgePow);
        const cG = lerp(184, edgeG, edgePow);
        const cB = lerp(166, edgeB, edgePow);

        ctx.fillStyle = `rgba(${cR | 0}, ${cG | 0}, ${cB | 0}, ${clampedAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow on bright front-facing particles (top 35%)
        if (normalizedZ > 0.65 && p.brightnessBoost > 0.04 && disperseAmount < 0.5) {
          const glowIntensity = (normalizedZ - 0.65) * 2.85;
          const glowAlpha = glowIntensity * 0.18 * globalAlpha;
          const glowR = size * 5;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          grad.addColorStop(0, `rgba(${cR | 0}, ${cG | 0}, ${cB | 0}, ${glowAlpha})`);
          grad.addColorStop(1, `rgba(${cR | 0}, ${cG | 0}, ${cB | 0}, 0)`);
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

import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 18000;
const ROTATION_SPEED = 0.00006;

// Vertex shader: positions points and passes data to fragment
const vertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader: draws soft circular particles with color/alpha
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    // Circular point with soft edge
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float softEdge = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, vAlpha * softEdge);
  }
`;

interface NetworkAnimationProps {
  className?: string;
}

export function NetworkAnimation({ className = '' }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 2000);
    camera.position.z = 800;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = "none";

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    // Store spherical coords for animation
    const thetas = new Float32Array(PARTICLE_COUNT);
    const phis = new Float32Array(PARTICLE_COUNT);
    const radiusMuls = new Float32Array(PARTICLE_COUNT);
    const thetaSpeeds = new Float32Array(PARTICLE_COUNT);
    const phiSpeeds = new Float32Array(PARTICLE_COUNT);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      thetas[i] = goldenAngle * i;
      phis[i] = Math.acos(1 - 2 * t);

      const isAtmosphere = Math.random() < 0.12;
      radiusMuls[i] = isAtmosphere
        ? 1.01 + Math.random() * 0.1
        : 0.98 + Math.random() * 0.04;

      thetaSpeeds[i] = (Math.random() - 0.5) * 0.0015;
      phiSpeeds[i] = (Math.random() - 0.5) * 0.0008;

      sizes[i] = 1.5 + Math.random() * 2.5;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Resize handler
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // Animation
    let animId = 0;
    const startTime = performance.now();

    // Color constants (normalized 0-1)
    const cyanR = 34 / 255, cyanG = 208 / 255, cyanB = 223 / 255;
    const magentaR = 180 / 255, magentaG = 60 / 255, magentaB = 200 / 255;

    const animate = () => {
      const now = performance.now();
      const time = now - startTime;

      const rect = container.getBoundingClientRect();
      const sphereRadius = Math.min(rect.width, rect.height) * 0.38;

      // Slow global rotation
      const rotY = time * ROTATION_SPEED;
      const rotX = Math.sin(time * 0.00003) * 0.12;

      points.rotation.y = rotY;
      points.rotation.x = rotX;

      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = geometry.getAttribute("aColor") as THREE.BufferAttribute;
      const alphaAttr = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Animate individual particle movement
        thetas[i] += thetaSpeeds[i];
        phis[i] += phiSpeeds[i];

        if (phis[i] < 0.05 || phis[i] > Math.PI - 0.05) {
          phiSpeeds[i] = -phiSpeeds[i];
          phis[i] = Math.max(0.05, Math.min(Math.PI - 0.05, phis[i]));
        }

        const r = sphereRadius * radiusMuls[i];
        const sp = Math.sin(phis[i]);

        const x = r * sp * Math.cos(thetas[i]);
        const y = r * Math.cos(phis[i]);
        const z = r * sp * Math.sin(thetas[i]);

        posAttr.setXYZ(i, x, y, z);

        // Compute surface normal dot with view direction (before rotation)
        // For Fresnel/rim effect we use the local z
        const dist = Math.sqrt(x * x + y * y + z * z);
        const nz = z / (dist || 1);
        const edgeFactor = 1.0 - Math.abs(nz); // 0=center, 1=edge

        // Diagonal gradient: top-left = cyan, bottom-right = magenta
        const diagonalMix = Math.max(0, Math.min(1, (-x + y) / (2 * sphereRadius) + 0.5));

        // Lerp between magenta and cyan
        const cr = magentaR + (cyanR - magentaR) * diagonalMix;
        const cg = magentaG + (cyanG - magentaG) * diagonalMix;
        const cb = magentaB + (cyanB - magentaB) * diagonalMix;

        colAttr.setXYZ(i, cr, cg, cb);

        // Alpha: Fresnel rim effect — center nearly invisible, edges bright
        let alpha: number;
        if (edgeFactor >= 0.55) {
          // Rim: bright glow
          const rimIntensity = (edgeFactor - 0.55) / 0.45;
          alpha = 0.15 + rimIntensity * 0.7;
        } else {
          // Center: very faint
          alpha = edgeFactor * 0.12;
        }

        // Depth fade using local z (back face darker)
        const depthFade = (nz + 1.0) * 0.5; // 0=back, 1=front
        if (depthFade < 0.3) {
          alpha *= depthFade * 0.15;
        } else {
          alpha *= 0.15 + depthFade * 0.85;
        }

        alphaAttr.setX(i, Math.max(0, Math.min(1, alpha)));
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return <div ref={containerRef} className={`pointer-events-none ${className}`} />;
}

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NetworkAnimationProps {
  className?: string;
}

const PARTICLE_COUNT = 22000;
const HALO_COUNT = 3000;
const ROTATION_SPEED = 0.008;
const MAX_PIXEL_RATIO = 1.25;

const sphereVertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aPlanePos;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uMorph; // 0 = globe, 1 = terrain

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vNormal;
  varying float vMorph;

  void main() {
    vec3 sphereNormal = normalize(position);

    // Subtle organic breathing
    float breathe = sin(uTime * 0.25 + aSeed * 6.28318) * 0.008;
    vec3 displaced = position + sphereNormal * breathe;

    // Terrain position with time-based wave + drift animation
    vec3 terrainPos = aPlanePos;
    terrainPos.x += sin(uTime * 0.15 + aSeed * 6.28) * 0.12;
    terrainPos.z += cos(uTime * 0.1 + aSeed * 4.0) * 0.08;
    terrainPos.y += sin(uTime * 0.3 + aPlanePos.x * 0.5) * 0.12;
    terrainPos.y += cos(uTime * 0.2 + aPlanePos.z * 0.4) * 0.08;

    // Morph between sphere and terrain
    vec3 finalPos = mix(displaced, terrainPos, uMorph);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Rim glow - Fresnel effect (fade out during morph)
    vec3 viewDir = normalize(-mvPosition.xyz);
    float dotNV = abs(dot(sphereNormal, viewDir));
    vRim = pow(1.0 - dotNV, 2.8) * (1.0 - uMorph);

    // Back-face culling via alpha (disabled during terrain mode)
    float frontFade = mix(
      smoothstep(-0.3, 0.6, sphereNormal.z),
      1.0,
      uMorph
    );

    // Core suppression: fade out during morph
    float coreFade = mix(
      mix(0.35, 1.0, pow(max(vRim, 0.001), 0.3)),
      0.7,
      uMorph
    );
    vAlpha = aAlpha * frontFade * coreFade;

    // Accent color zone (reduce during morph for uniform terrain color)
    float magentaZone = smoothstep(-0.2, 0.8, position.x) * smoothstep(-0.2, 0.7, -position.y);
    vAccent = clamp(magentaZone + vRim * 0.15, 0.0, 1.0) * (1.0 - uMorph * 0.5);
    vNormal = sphereNormal;
    vMorph = uMorph;

    // Point size with distance attenuation
    float distanceScale = 28.0 / max(-mvPosition.z, 0.001);
    float morphSize = mix(1.0, 0.8, uMorph); // slightly smaller in terrain
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio * morphSize, 0.5, 2.2);
  }
`;

const sphereFragmentShader = `
  uniform sampler2D uPointTexture;
  uniform float uMorph;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vNormal;
  varying float vMorph;

  void main() {
    vec4 tex = texture2D(uPointTexture, gl_PointCoord);

    // MazeHQ-style color palette
    vec3 cyan    = vec3(0.08, 0.75, 0.92);
    vec3 deepBlue = vec3(0.06, 0.22, 0.65);
    vec3 magenta = vec3(0.65, 0.08, 0.85);

    // Vertical gradient: deep blue at bottom -> cyan at top
    float verticalMix = smoothstep(-1.0, 0.9, vNormal.y);
    vec3 color = mix(deepBlue, cyan, verticalMix);

    // Magenta accent in bottom-right
    color = mix(color, magenta, vAccent * 0.7);

    // Rim brightening (fades with morph)
    color += vec3(0.12, 0.28, 0.5) * vRim * 0.35;

    // In terrain mode, shift toward a more uniform cyan-blue
    vec3 terrainColor = mix(deepBlue * 1.2, cyan * 0.9, 0.5 + vNormal.y * 0.3);
    color = mix(color, terrainColor, vMorph * 0.6);

    gl_FragColor = vec4(color, vAlpha) * tex;
  }
`;

const haloVertexShader = `
  attribute float aAlpha;
  attribute float aSize;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uMorph;

  varying float vAlpha;

  void main() {
    vec3 displaced = position * (1.0 + sin(uTime * 0.18 + position.y * 2.5) * 0.008);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Fade out halo during morph
    vAlpha = aAlpha * (1.0 - uMorph);
    float distanceScale = 28.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.6, 3.0);
  }
`;

const haloFragmentShader = `
  uniform sampler2D uPointTexture;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uPointTexture, gl_PointCoord);
    vec3 haloColor = vec3(0.06, 0.55, 0.88);
    gl_FragColor = vec4(haloColor, vAlpha) * tex;
  }
`;

function createPointTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSphereGeometry(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const planePositions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * t);
    const radius = 1 + (Math.random() - 0.5) * 0.012;
    const sinPhi = Math.sin(phi);

    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);

    // Terrain plane positions - wide XZ spread with wavy Y
    const seed = Math.random();
    const px = (seed * 2 - 1) * 6.0; // seeded but deterministic per particle
    const pz = (Math.random() * 2 - 1) * 4.0;
    const py = Math.sin(px * 0.8) * Math.cos(pz * 0.6) * 0.3
             + Math.sin(px * 1.5 + pz * 0.9) * 0.15
             + Math.cos(pz * 1.2) * 0.1;

    planePositions[i * 3] = px;
    planePositions[i * 3 + 1] = py;
    planePositions[i * 3 + 2] = pz;

    alphas[i] = 0.4 + Math.random() * 0.5;
    sizes[i] = 0.7 + Math.random() * 1.0;
    seeds[i] = seed;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPlanePos", new THREE.BufferAttribute(planePositions, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

function createHaloGeometry(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const theta = goldenAngle * i * 3.1;
    const phi = Math.acos(1 - 2 * t);
    const radius = 1.06 + Math.random() * 0.14;
    const sinPhi = Math.sin(phi);

    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    alphas[i] = 0.02 + Math.random() * 0.06;
    sizes[i] = 0.8 + Math.random() * 1.2;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

// Smooth easing for morph transitions
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function NetworkAnimation({ className = "" }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 7.0;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
      premultipliedAlpha: true,
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const pointTexture = createPointTexture();
    const sphereGeometry = createSphereGeometry(PARTICLE_COUNT);
    const haloGeometry = createHaloGeometry(HALO_COUNT);

    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPointTexture: { value: pointTexture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO) },
        uTime: { value: 0 },
        uMorph: { value: 0 },
      },
    });

    const haloMaterial = new THREE.ShaderMaterial({
      vertexShader: haloVertexShader,
      fragmentShader: haloFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPointTexture: { value: pointTexture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO) },
        uTime: { value: 0 },
        uMorph: { value: 0 },
      },
    });

    const sphere = new THREE.Points(sphereGeometry, sphereMaterial);
    const halo = new THREE.Points(haloGeometry, haloMaterial);

    const GLOBE_SCALE = 3.8;
    sphere.scale.setScalar(GLOBE_SCALE);
    halo.scale.setScalar(GLOBE_SCALE * 1.04);

    const BASE_Y = -0.25;
    sphere.position.y = BASE_Y;
    halo.position.y = BASE_Y;

    scene.add(sphere);
    scene.add(halo);

    // Scroll state
    let scrollY = 0;
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    scrollY = window.scrollY;

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      sphereMaterial.uniforms.uPixelRatio.value = pixelRatio;
      haloMaterial.uniforms.uPixelRatio.value = pixelRatio;
    };

    resize();
    window.addEventListener("resize", resize);

    let frameId = 0;
    const start = performance.now();

    // Camera base values
    const CAM_BASE_Z = 7.0;
    const CAM_BASE_Y = 0;
    const CAM_BASE_ROT_X = 0;

    // Terrain camera targets
    const CAM_TERRAIN_Z = 8.5;
    const CAM_TERRAIN_Y = 2.5;
    const CAM_TERRAIN_ROT_X = -0.45; // look down at terrain

    const tick = () => {
      const elapsed = (performance.now() - start) * 0.001;
      sphereMaterial.uniforms.uTime.value = elapsed;
      haloMaterial.uniforms.uTime.value = elapsed;

      // Calculate morph from scroll
      const vh = window.innerHeight || 1;
      const scrollProgress = Math.min(scrollY / vh, 2.0);

      // Morph starts at 20% scroll, fully terrain at 80%
      const morphRaw = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.6));
      const morph = easeInOutCubic(morphRaw);

      sphereMaterial.uniforms.uMorph.value = morph;
      haloMaterial.uniforms.uMorph.value = morph;

      // Rotation: Y keeps spinning, X tilts for terrain perspective
      sphere.rotation.y = elapsed * ROTATION_SPEED * (1.0 - morph * 0.7); // slow down in terrain
      halo.rotation.y = sphere.rotation.y * 1.015;

      // Tilt: subtle oscillation in globe mode, fixed downward tilt in terrain
      const globeTiltX = Math.sin(elapsed * 0.12) * 0.035;
      sphere.rotation.x = globeTiltX * (1.0 - morph) + CAM_TERRAIN_ROT_X * morph * 0.3;
      halo.rotation.x = sphere.rotation.x;

      // Camera transitions smoothly
      camera.position.z = CAM_BASE_Z + (CAM_TERRAIN_Z - CAM_BASE_Z) * morph;
      camera.position.y = CAM_BASE_Y + (CAM_TERRAIN_Y - CAM_BASE_Y) * morph;
      camera.rotation.x = CAM_BASE_ROT_X + (CAM_TERRAIN_ROT_X - CAM_BASE_ROT_X) * morph;

      // Position: globe stays centered (no Y displacement like before)
      sphere.position.y = BASE_Y;
      halo.position.y = BASE_Y;

      renderer.render(scene, camera);

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      sphereGeometry.dispose();
      haloGeometry.dispose();
      sphereMaterial.dispose();
      haloMaterial.dispose();
      pointTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={`pointer-events-none ${className}`} />;
}

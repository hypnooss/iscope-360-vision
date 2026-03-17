import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NetworkAnimationProps {
  className?: string;
}

const PARTICLE_COUNT = 22000;
const HALO_COUNT = 3000;
const ROTATION_SPEED = 0.008;
const MAX_PIXEL_RATIO = 1.5;

const sphereVertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSeed;

  uniform float uPixelRatio;
  uniform float uTime;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vNormal;

  void main() {
    vec3 sphereNormal = normalize(position);

    // Subtle organic breathing
    float breathe = sin(uTime * 0.25 + aSeed * 6.28318) * 0.008;
    vec3 displaced = position + sphereNormal * breathe;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Rim glow - strong Fresnel effect (bright edges, transparent core)
    vec3 viewDir = normalize(-mvPosition.xyz);
    float dotNV = abs(dot(sphereNormal, viewDir));
    vRim = pow(1.0 - dotNV, 2.8);

    // Back-face culling via alpha
    float frontFade = smoothstep(-0.3, 0.6, sphereNormal.z);

    // Core suppression: center is very transparent, edges are bright
    float coreFade = mix(0.02, 1.0, pow(vRim, 0.6));
    vAlpha = aAlpha * frontFade * coreFade;

    // Accent color zone: bottom-right quadrant gets magenta
    float magentaZone = smoothstep(-0.2, 0.8, position.x) * smoothstep(-0.2, 0.7, -position.y);
    vAccent = clamp(magentaZone + vRim * 0.15, 0.0, 1.0);
    vNormal = sphereNormal;

    // Point size with distance attenuation
    float distanceScale = 28.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.5, 2.2);
  }
`;

const sphereFragmentShader = `
  uniform sampler2D uPointTexture;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vNormal;

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

    // Rim brightening
    color += vec3(0.12, 0.28, 0.5) * vRim * 0.35;

    gl_FragColor = vec4(color, vAlpha) * tex;
  }
`;

const haloVertexShader = `
  attribute float aAlpha;
  attribute float aSize;

  uniform float uPixelRatio;
  uniform float uTime;

  varying float vAlpha;

  void main() {
    vec3 displaced = position * (1.0 + sin(uTime * 0.18 + position.y * 2.5) * 0.008);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = aAlpha;
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
    alphas[i] = 0.15 + Math.random() * 0.35;
    sizes[i] = 0.7 + Math.random() * 1.0;
    seeds[i] = Math.random();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
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

export function NetworkAnimation({ className = "" }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    // Wider FOV to let the globe fill the viewport
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 3.6;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
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
      },
    });

    const sphere = new THREE.Points(sphereGeometry, sphereMaterial);
    const halo = new THREE.Points(haloGeometry, haloMaterial);

    // Globe fills most of the viewport — large scale
    const GLOBE_SCALE = 3.8;
    sphere.scale.setScalar(GLOBE_SCALE);
    halo.scale.setScalar(GLOBE_SCALE * 1.04);

    // Shift globe down slightly so it's centered-lower like MazeHQ
    sphere.position.y = -0.25;
    halo.position.y = -0.25;

    scene.add(sphere);
    scene.add(halo);

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

    const tick = () => {
      const elapsed = (performance.now() - start) * 0.001;
      sphereMaterial.uniforms.uTime.value = elapsed;
      haloMaterial.uniforms.uTime.value = elapsed;

      // Very slow rotation like MazeHQ
      sphere.rotation.y = elapsed * ROTATION_SPEED;
      halo.rotation.y = sphere.rotation.y * 1.015;

      // Subtle tilt oscillation
      sphere.rotation.x = Math.sin(elapsed * 0.12) * 0.035;
      halo.rotation.x = sphere.rotation.x;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
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

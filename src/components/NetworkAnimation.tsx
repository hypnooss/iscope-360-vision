import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NetworkAnimationProps {
  className?: string;
}

const PARTICLE_COUNT = 28000; 
const HALO_COUNT = 3000;
const ROTATION_SPEED = 0.02;
const MAX_PIXEL_RATIO = 1.25;

const sphereVertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aPlanePos;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uMorph;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vNormal;

  void main() {
    // 1) SPHERE LOGIC
    vec3 sphereNormal = normalize(position);
    float breathe = sin(uTime * 0.25 + aSeed * 6.28318) * 0.01;
    vec3 displacedGlobe = position + sphereNormal * breathe;

    // 2) TERRAIN LOGIC (Wavy data lines)
    vec3 terrainPos = aPlanePos;
    // Huge, rolling ocean of data waves spreading into the horizon
    float wave1 = sin(terrainPos.x * 0.08 + uTime * 0.15) * 2.5;
    float wave2 = cos(terrainPos.z * 0.05 - uTime * 0.1) * 2.0;
    float wave3 = sin((terrainPos.x + terrainPos.z) * 0.03 + uTime * 0.05) * 3.0;
    
    terrainPos.y += wave1 + wave2 + wave3 - 12.0;
    terrainPos.x += sin(uTime * 0.1 + aSeed * 5.0) * 0.5;

    // MORPH
    vec3 finalPos = mix(displacedGlobe, terrainPos, uMorph);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // COLOR SHADING LOGIC
    vec3 viewDir = normalize(-mvPosition.xyz);
    float dotNV = abs(dot(sphereNormal, viewDir));
    vRim = pow(1.0 - dotNV, 2.8) * (1.0 - uMorph * 0.5);

    // Fade culling slightly in terrain mode
    float frontFade = mix(smoothstep(-0.3, 0.6, sphereNormal.z), 1.0, uMorph);
    float coreFade = mix(0.4, 1.0, pow(max(vRim, 0.001), 0.3));

    vAlpha = aAlpha * frontFade * coreFade;

    // Accent logic (preserve some magenta streaks in terrain)
    float magentaZoneGlobe = smoothstep(-0.2, 0.8, position.x) * smoothstep(-0.2, 0.7, -position.y);
    float magentaZoneTerrain = sin(terrainPos.x * 0.5 + terrainPos.z * 0.2) * 0.5 + 0.5;
    
    float accentMix = mix(magentaZoneGlobe + vRim * 0.15, magentaZoneTerrain * 0.8, uMorph);
    vAccent = clamp(accentMix, 0.0, 1.0);
    
    vNormal = mix(sphereNormal, vec3(0.0, 1.0, 0.0), uMorph);

    float distanceScale = 28.0 / max(-mvPosition.z, 0.001);
    
    float targetSize = mix(2.6, 1.6, uMorph);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.5, targetSize);
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

    vec3 cyan    = vec3(0.08, 0.75, 0.95);
    vec3 deepBlue = vec3(0.04, 0.15, 0.55);
    vec3 magenta = vec3(0.75, 0.08, 0.95);

    float verticalMix = smoothstep(-1.0, 0.9, vNormal.y);
    vec3 color = mix(deepBlue, cyan, verticalMix);

    color = mix(color, magenta, vAccent);
    color += vec3(0.12, 0.35, 0.7) * vRim * 0.5;

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
    
    vAlpha = aAlpha * (1.0 - uMorph);

    float distanceScale = 28.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.6, 3.5);
  }
`;

const haloFragmentShader = `
  uniform sampler2D uPointTexture;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uPointTexture, gl_PointCoord);
    vec3 haloColor = vec3(0.06, 0.65, 0.98);
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

    // Distinct Wavy Lines stretching vastly into the vanishing point
    const numLines = 140;
    const lineIndex = i % numLines; 
    
    // Z stretches from very close (10.0) to extremely far horizon (-140.0)
    const pz = 10.0 - (lineIndex / numLines) * 150.0; 
    
    // X handles width, must be gigantic to fill screen sides at the far horizon
    const px = (Math.random() * 2.0 - 1.0) * 120.0;
    
    planePositions[i * 3] = px;
    planePositions[i * 3 + 1] = 0.0;
    planePositions[i * 3 + 2] = pz;

    alphas[i] = 0.4 + Math.random() * 0.6;
    sizes[i] = 0.8 + Math.random() * 1.2;
    seeds[i] = Math.random();
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
    alphas[i] = 0.03 + Math.random() * 0.07;
    sizes[i] = 0.9 + Math.random() * 1.5;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

export function NetworkAnimation({ className = "" }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 6.2;

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
        uMorph: { value: 0 }
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
        uMorph: { value: 0 }
      },
    });

    const sphere = new THREE.Points(sphereGeometry, sphereMaterial);
    const halo = new THREE.Points(haloGeometry, haloMaterial);

    const GLOBE_SCALE = 3.8;
    sphere.scale.setScalar(GLOBE_SCALE);
    halo.scale.setScalar(GLOBE_SCALE * 1.04);
    
    sphere.position.y = 0;
    halo.position.y = 0;

    scene.add(sphere);
    scene.add(halo);

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

    const CAM_BASE_Z = 6.2;
    const CAM_BASE_Y = 0.0;
    const CAM_BASE_ROT_X = 0;

    // Cinematic camera angle: sits slightly above the landscape and looks far into the horizon
    const CAM_TERRAIN_Z = 25.0; 
    const CAM_TERRAIN_Y = 5.0; 
    const CAM_TERRAIN_ROT_X = -0.15;

    const tick = () => {
      const elapsed = (performance.now() - start) * 0.001;
      
      sphereMaterial.uniforms.uTime.value = elapsed;
      haloMaterial.uniforms.uTime.value = elapsed;

      const vh = window.innerHeight || 1;
      const scrollRaw = Math.max(0, Math.min(1, scrollY / (vh * 1.3)));
      const morph = easeOutQuart(scrollRaw);

      sphereMaterial.uniforms.uMorph.value = morph;
      haloMaterial.uniforms.uMorph.value = morph;

      sphere.rotation.y = elapsed * ROTATION_SPEED * (1.0 - morph * 0.8);
      halo.rotation.y = sphere.rotation.y * 1.015;

      const globeTiltX = Math.sin(elapsed * 0.12) * 0.035;
      sphere.rotation.x = globeTiltX * (1.0 - morph);
      halo.rotation.x = sphere.rotation.x;

      camera.position.z = CAM_BASE_Z + (CAM_TERRAIN_Z - CAM_BASE_Z) * morph;
      camera.position.y = CAM_BASE_Y + (CAM_TERRAIN_Y - CAM_BASE_Y) * morph;
      camera.rotation.x = CAM_BASE_ROT_X + (CAM_TERRAIN_ROT_X - CAM_BASE_ROT_X) * morph;

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

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NetworkAnimationProps {
  className?: string;
  scrollProgress?: number;
}

const PARTICLE_COUNT = 9500;
const HALO_COUNT = 1400;
const ROTATION_SPEED = 0.018;
const MAX_PIXEL_RATIO = 1.2;

const sphereVertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSeed;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uStream;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vPosition;

  void main() {
    vec3 sphereNormal = normalize(position);
    float breathe = sin(uTime * 0.35 + aSeed * 6.28318) * 0.012;
    vec3 displaced = position + sphereNormal * breathe;

    float streamMix = smoothstep(0.0, 1.0, uStream);
    vec3 streamTarget = vec3(
      position.x * 0.25,
      position.y * 1.15,
      position.z * 0.42 + sin(aSeed * 10.0 + uTime * 0.8) * 0.08
    );
    displaced = mix(displaced, streamTarget, streamMix * 0.22);

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vec3 viewDir = normalize(-mvPosition.xyz);
    vRim = pow(1.0 - abs(dot(sphereNormal, viewDir)), 2.35);

    float frontFade = smoothstep(-0.45, 0.95, sphereNormal.z);
    float coreFade = mix(0.018, 1.0, vRim);
    vAlpha = aAlpha * frontFade * coreFade;

    float magentaZone = smoothstep(0.1, 0.95, position.x) * smoothstep(0.0, 1.0, -position.y + 0.32);
    vAccent = clamp(magentaZone + vRim * 0.22, 0.0, 1.0);
    vPosition = sphereNormal;

    float distanceScale = 24.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.7, 2.4);
  }
`;

const sphereFragmentShader = `
  uniform sampler2D uPointTexture;

  varying float vAlpha;
  varying float vAccent;
  varying float vRim;
  varying vec3 vPosition;

  void main() {
    vec4 tex = texture2D(uPointTexture, gl_PointCoord);

    vec3 cyan = vec3(0.05, 0.73, 0.95);
    vec3 blue = vec3(0.12, 0.32, 0.95);
    vec3 magenta = vec3(0.72, 0.10, 0.92);

    float verticalMix = smoothstep(-1.0, 0.85, vPosition.y);
    vec3 color = mix(blue, cyan, verticalMix);
    color = mix(color, magenta, vAccent * 0.85);
    color += vec3(0.16, 0.22, 0.45) * vRim * 0.22;

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
    vec3 displaced = position * (1.0 + sin(uTime * 0.22 + position.y * 3.0) * 0.01);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = aAlpha;
    float distanceScale = 24.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = clamp(aSize * distanceScale * uPixelRatio, 0.8, 2.8);
  }
`;

const haloFragmentShader = `
  uniform sampler2D uPointTexture;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uPointTexture, gl_PointCoord);
    vec3 haloColor = vec3(0.07, 0.62, 0.96);
    gl_FragColor = vec4(haloColor, vAlpha) * tex;
  }
`;

function createPointTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create point texture");
  }

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.9)");
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
    const radius = 1 + (Math.random() - 0.5) * 0.015;
    const sinPhi = Math.sin(phi);

    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    alphas[i] = 0.18 + Math.random() * 0.32;
    sizes[i] = 0.8 + Math.random() * 0.9;
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
    const radius = 1.04 + Math.random() * 0.1;
    const sinPhi = Math.sin(phi);

    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    alphas[i] = 0.03 + Math.random() * 0.08;
    sizes[i] = 0.8 + Math.random() * 0.8;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  return geometry;
}

export function NetworkAnimation({ className = "", scrollProgress = 0 }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);

  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.z = 4.8;

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
        uStream: { value: 0 },
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

    sphere.scale.setScalar(2.9);
    halo.scale.setScalar(3.05);
    sphere.position.y = -0.05;
    halo.position.y = -0.05;

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
      sphereMaterial.uniforms.uStream.value = scrollRef.current;

      const rotationFactor = 1 - scrollRef.current * 0.4;
      sphere.rotation.y = elapsed * ROTATION_SPEED * rotationFactor;
      halo.rotation.y = sphere.rotation.y * 1.02;
      sphere.rotation.x = Math.sin(elapsed * 0.18) * 0.045;
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

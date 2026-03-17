import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useIsMobile } from "@/hooks/use-mobile";

const PARTICLE_COUNT = 16384;
const ROTATION_SPEED = 0.02;

// ─── Vertex Shader (exact MazeHQ) ───
const vertexShader = `
  attribute float aAlpha;
  attribute float aIndex;
  attribute float aSelection;
  attribute float aStreamFreq;
  attribute float aFunnelNarrow;
  attribute float aFunnelThickness;
  attribute float aFunnelStartShift;
  attribute float aFunnelEndShift;
  attribute vec3 aMove;
  attribute vec3 aSpeed;
  attribute vec3 aRandomness;

  uniform bool uIsMobile;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uAlpha;
  uniform float uDepth;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uSelection;
  uniform float uWidth;
  uniform float uHeight;
  uniform float uStream;
  uniform float uFunnelStart;
  uniform float uFunnelEnd;
  uniform float uFunnelThick;
  uniform float uFunnelNarrow;
  uniform float uFunnelStartShift;
  uniform float uFunnelEndShift;
  uniform float uFunnelDistortion;
  uniform float uRcolor;
  uniform float uGcolor;
  uniform float uBcolor;
  uniform float uRnoise;
  uniform float uGnoise;
  uniform float uBnoise;

  varying float vAlpha;
  varying float vDistance;
  varying float vNoise;
  varying vec3 vColor;

  const float PI = 3.1415926535897932384626433832795;

  vec3 mod289_1_0(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  vec2 mod289_1_0(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  vec3 permute_1_1(vec3 x) {
    return mod289_1_0(((x*34.0)+1.0)*x);
  }

  float snoise_1_2(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289_1_0(i);
    vec3 p = permute_1_1( permute_1_1( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float permute(float x){ return floor(mod(((x * 34.0) + 1.0) * x, 289.0)); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float taylorInvSqrt(float r){ return 1.79284291400159 - 0.85373472095314 * r; }

  vec4 grad4(float j, vec4 ip){
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p, s;
    p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
    return p;
  }

  float snoise(vec4 v){
    const vec2 C = vec2(0.138196601125010504, 0.309016994374947451);
    vec4 i = floor(v + dot(v, C.yyyy));
    vec4 x0 = v - i + dot(i, C.xxxx);
    vec4 i0;
    vec3 isX = step(x0.yzw, x0.xxx);
    vec3 isYZ = step(x0.zww, x0.yyz);
    i0.x = isX.x + isX.y + isX.z;
    i0.yzw = 1.0 - isX;
    i0.y += isYZ.x + isYZ.y;
    i0.zw += 1.0 - isYZ.xy;
    i0.z += isYZ.z;
    i0.w += 1.0 - isYZ.z;
    vec4 i3 = clamp(i0, 0.0, 1.0);
    vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
    vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
    vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
    vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
    vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
    vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
    i = mod(i, 289.0);
    float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute(permute(permute(permute(
        i.w + vec4(i1.w, i2.w, i3.w, 1.0))
        + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
        + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
        + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
    vec4 p0 = grad4(j0, ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    p4 *= taylorInvSqrt(dot(p4, p4));
    vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
    m0 = m0 * m0; m1 = m1 * m1;
    return 49.0 * (dot(m0*m0, vec3(dot(p0,x0), dot(p1,x1), dot(p2,x2)))
        + dot(m1*m1, vec2(dot(p3,x3), dot(p4,x4))));
  }

  #define NUM_OCTAVES 5

  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100);
    for (int i = 0; i < NUM_OCTAVES; ++i) {
      v += a * snoise(vec4(x, uTime));
      x = x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vNoise = fbm(position * (uFrequency + aStreamFreq * uStream));

    float r, g, b;
    r = uRcolor / 255.0 + (clamp(vNoise, 0.0, 1.0) * 4.0 * (uRnoise - uRcolor) / 255.0);
    g = uGcolor / 255.0 + (clamp(vNoise, 0.0, 1.0) * 4.0 * (uGnoise - uGcolor) / 255.0);
    b = uBcolor / 255.0 + (clamp(vNoise, 0.0, 1.0) * 4.0 * (uBnoise - uGcolor) / 255.0);
    vColor = vec3(r, g, b);

    vec3 displaced = position;

    displaced *= (1.0 + (uAmplitude * vNoise));

    displaced += vec3(uScale * uDepth * aMove * aSpeed * snoise_1_2(vec2(aIndex, uTime * uSpeed)));

    if (uStream > 0.0) {
      displaced.x += uTime * uSpeed * uStream * 0.3;
      displaced.x = mod(displaced.x - uWidth * 0.5, uWidth) - uWidth * 0.5;
      float t = clamp((displaced.x - uFunnelStart) / (uFunnelEnd - uFunnelStart), 0.0, 1.0);
      float thickness = mix(uFunnelThick + aFunnelThickness, uFunnelNarrow + aFunnelNarrow, t);
      displaced.y += thickness * uHeight * aRandomness.y * uFunnelDistortion;
      displaced.y += (1.0 - t) * (uFunnelStartShift + aFunnelStartShift);
      displaced.y += t * (uFunnelEndShift + aFunnelEndShift);
      displaced.z += uHeight * aRandomness.z * (-1.0 * cos(displaced.x)) * uFunnelDistortion;
      mat2 rot = mat2(0.0, -1.0, 1.0, 0.0);
      if (uIsMobile) { displaced.xy = rot * displaced.xy; }
    }

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vDistance = -mvPosition.z;
    gl_PointSize = uSize;
    gl_PointSize *= 100.0 / vDistance;
    gl_PointSize *= uPixelRatio;
    clamp(gl_PointSize, 1.0, 100.0);

    vAlpha = uAlpha * aAlpha * (300.0 / vDistance);
    if (aSelection > uSelection) { vAlpha = 0.0; }
  }
`;

// ─── Fragment Shader (exact MazeHQ) ───
const fragmentShader = `
  uniform sampler2D pointTexture;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
    gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
  }
`;

/** Generate a radial gradient sprite texture programmatically */
function createPointTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface NetworkAnimationProps {
  className?: string;
  scrollProgress?: number; // 0 = globe, 1 = stream/funnel
}

export function NetworkAnimation({ className = '', scrollProgress = 0 }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  const isMobile = useIsMobile();

  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene setup ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
    camera.position.z = 400;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = "none";

    // ── Point texture ──
    const pointTexture = createPointTexture();

    // ── Geometry: particles on unit sphere ──
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const indices = new Float32Array(PARTICLE_COUNT);
    const selections = new Float32Array(PARTICLE_COUNT);
    const streamFreqs = new Float32Array(PARTICLE_COUNT);
    const funnelNarrows = new Float32Array(PARTICLE_COUNT);
    const funnelThicknesses = new Float32Array(PARTICLE_COUNT);
    const funnelStartShifts = new Float32Array(PARTICLE_COUNT);
    const funnelEndShifts = new Float32Array(PARTICLE_COUNT);
    const moves = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT * 3);
    const randomness = new Float32Array(PARTICLE_COUNT * 3);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const theta = goldenAngle * i;
      const phi = Math.acos(1 - 2 * t);

      // Unit sphere
      const sp = Math.sin(phi);
      positions[i * 3] = sp * Math.cos(theta);
      positions[i * 3 + 1] = Math.cos(phi);
      positions[i * 3 + 2] = sp * Math.sin(theta);

      alphas[i] = 0.3 + Math.random() * 0.7;
      indices[i] = i;
      selections[i] = Math.random();
      streamFreqs[i] = (Math.random() - 0.5) * 0.2;
      funnelNarrows[i] = (Math.random() - 0.5) * 0.1;
      funnelThicknesses[i] = (Math.random() - 0.5) * 0.1;
      funnelStartShifts[i] = (Math.random() - 0.5) * 0.05;
      funnelEndShifts[i] = (Math.random() - 0.5) * 0.05;

      moves[i * 3] = (Math.random() - 0.5) * 2.0;
      moves[i * 3 + 1] = (Math.random() - 0.5) * 2.0;
      moves[i * 3 + 2] = (Math.random() - 0.5) * 2.0;

      speeds[i * 3] = 0.5 + Math.random() * 1.5;
      speeds[i * 3 + 1] = 0.5 + Math.random() * 1.5;
      speeds[i * 3 + 2] = 0.5 + Math.random() * 1.5;

      randomness[i * 3] = Math.random() * 2.0 - 1.0;
      randomness[i * 3 + 1] = Math.random() * 2.0 - 1.0;
      randomness[i * 3 + 2] = Math.random() * 2.0 - 1.0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute("aSelection", new THREE.BufferAttribute(selections, 1));
    geometry.setAttribute("aStreamFreq", new THREE.BufferAttribute(streamFreqs, 1));
    geometry.setAttribute("aFunnelNarrow", new THREE.BufferAttribute(funnelNarrows, 1));
    geometry.setAttribute("aFunnelThickness", new THREE.BufferAttribute(funnelThicknesses, 1));
    geometry.setAttribute("aFunnelStartShift", new THREE.BufferAttribute(funnelStartShifts, 1));
    geometry.setAttribute("aFunnelEndShift", new THREE.BufferAttribute(funnelEndShifts, 1));
    geometry.setAttribute("aMove", new THREE.BufferAttribute(moves, 3));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 3));
    geometry.setAttribute("aRandomness", new THREE.BufferAttribute(randomness, 3));

    // ── Uniforms — exact MazeHQ values ──
    const uniforms = {
      pointTexture: { value: pointTexture },
      uIsMobile: { value: isMobile },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uScale: { value: 1.0 },
      uTime: { value: 0.0 },
      uSpeed: { value: 1.0 },
      uSize: { value: 10.0 },
      uAlpha: { value: 1.0 },
      uDepth: { value: 0.3 },
      uAmplitude: { value: 0.05 },
      uFrequency: { value: 0.5 },
      uSelection: { value: 1.0 },
      uWidth: { value: 6.0 },
      uHeight: { value: 1.0 },
      uStream: { value: 0.0 },
      uFunnelStart: { value: -2.0 },
      uFunnelEnd: { value: 2.0 },
      uFunnelThick: { value: 0.5 },
      uFunnelNarrow: { value: 0.1 },
      uFunnelStartShift: { value: 0.0 },
      uFunnelEndShift: { value: 0.0 },
      uFunnelDistortion: { value: 1.0 },
      // Cyan base → Magenta noise
      uRcolor: { value: 40.0 },
      uGcolor: { value: 197.0 },
      uBcolor: { value: 234.0 },
      uRnoise: { value: 202.0 },
      uGnoise: { value: 50.0 },
      uBnoise: { value: 223.0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Resize ──
    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Animation loop ──
    let animId = 0;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) * 0.001;
      uniforms.uTime.value = elapsed * 0.15;

      const stream = scrollRef.current;
      uniforms.uStream.value = stream;

      // Rotation — slow continuous spin, reduces in stream state
      const rotationFactor = 1.0 - stream * 0.8;
      points.rotation.y = elapsed * ROTATION_SPEED * rotationFactor;
      // Gentle tilt oscillation
      points.rotation.x = Math.sin(elapsed * 0.008) * 0.08 * (1.0 - stream);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      pointTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isMobile]);

  return <div ref={containerRef} className={`pointer-events-none ${className}`} />;
}

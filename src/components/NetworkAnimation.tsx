import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 18000;
const ROTATION_SPEED = 0.000015;

// === 4D Simplex Noise + FBM vertex shader (ported from MazeHQ) ===
const vertexShader = `
  attribute float aAlpha;
  attribute float aIndex;
  attribute vec3 aMove;
  attribute vec3 aSpeed;
  attribute vec3 aRandomness;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uAlpha;
  uniform float uDepth;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uScale;

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

  // --- 2D simplex noise ---
  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute3(vec3 x) { return mod289v3(((x * 34.0) + 1.0) * x); }

  float snoise2d(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // --- 4D simplex noise ---
  vec4 permute4(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float permute1(float x) { return floor(mod(((x * 34.0) + 1.0) * x, 289.0)); }
  vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float taylorInvSqrt1(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

  vec4 grad4(float j, vec4 ip) {
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p, s;
    p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
    return p;
  }

  float snoise4d(vec4 v) {
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
    vec4 x1 = x0 - i1 + C.xxxx;
    vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
    vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
    vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
    i = mod(i, 289.0);
    float j0 = permute1(permute1(permute1(permute1(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute4(permute4(permute4(permute4(
        i.w + vec4(i1.w, i2.w, i3.w, 1.0))
        + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
        + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
        + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
    vec4 p0 = grad4(j0, ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);
    vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    p4 *= taylorInvSqrt1(dot(p4, p4));
    vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
    m0 = m0 * m0; m1 = m1 * m1;
    return 49.0 * (dot(m0*m0, vec3(dot(p0,x0), dot(p1,x1), dot(p2,x2)))
        + dot(m1*m1, vec2(dot(p3,x3), dot(p4,x4))));
  }

  // --- FBM ---
  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; ++i) {
      v += a * snoise4d(vec4(x, uTime));
      x = x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Compute noise for this particle
    vNoise = fbm(position * uFrequency);

    // Noise-driven color mixing
    float noiseFactor = clamp(vNoise, 0.0, 1.0) * 4.0;
    float r = uRcolor / 255.0 + (noiseFactor * (uRnoise - uRcolor) / 255.0);
    float g = uGcolor / 255.0 + (noiseFactor * (uGnoise - uGcolor) / 255.0);
    float b = uBcolor / 255.0 + (noiseFactor * (uBnoise - uBcolor) / 255.0);
    vColor = vec3(r, g, b);

    // Blob deformation via noise
    vec3 displaced = position * (1.0 + uAmplitude * vNoise);

    // Per-particle jitter via 2D noise
    displaced += vec3(uScale * uDepth * aMove * aSpeed * snoise2d(vec2(aIndex, uTime * uSpeed)));

    // Final position
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size with distance attenuation
    vDistance = -mvPosition.z;
    gl_PointSize = uSize * (100.0 / vDistance) * uPixelRatio;
    gl_PointSize = clamp(gl_PointSize, 1.0, 100.0);

    // Alpha with distance attenuation
    vAlpha = uAlpha * aAlpha * (300.0 / vDistance);
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vDistance;
  varying float vNoise;
  varying vec3 vColor;

  void main() {
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

    // Create particle geometry — positions set once, GPU animates
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const indices = new Float32Array(PARTICLE_COUNT);
    const moves = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT * 3);
    const randomness = new Float32Array(PARTICLE_COUNT * 3);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const theta = goldenAngle * i;
      const phi = Math.acos(1 - 2 * t);

      // Sphere radius variation (atmosphere particles slightly further out)
      const isAtmosphere = Math.random() < 0.12;
      const rMul = isAtmosphere
        ? 1.005 + Math.random() * 0.03
        : 0.99 + Math.random() * 0.02;
      const r = 1.0 * rMul; // normalized, scaled by container in resize

      const sp = Math.sin(phi);
      positions[i * 3] = r * sp * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * sp * Math.sin(theta);

      // Per-particle attributes
      alphas[i] = 0.3 + Math.random() * 0.7;
      indices[i] = i;

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
    geometry.setAttribute("aMove", new THREE.BufferAttribute(moves, 3));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 3));
    geometry.setAttribute("aRandomness", new THREE.BufferAttribute(randomness, 3));

    // Uniforms — tuned for organic blob globe
    const uniforms = {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uTime: { value: 0.0 },
      uSpeed: { value: 0.00008 },
      uSize: { value: 14.0 },
      uAlpha: { value: 1.0 },
      uDepth: { value: 0.008 },
      uAmplitude: { value: 0.06 },
      uFrequency: { value: 1.2 },
      uScale: { value: 0.5 },
      // Base color: Cyan #22D0DF
      uRcolor: { value: 34.0 },
      uGcolor: { value: 208.0 },
      uBcolor: { value: 223.0 },
      // Noise color: Magenta #B43CC8
      uRnoise: { value: 180.0 },
      uGnoise: { value: 60.0 },
      uBnoise: { value: 200.0 },
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

    // Resize handler — scale sphere positions to container
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      const sphereRadius = Math.min(w, h) * 0.38;
      points.scale.setScalar(sphereRadius);
    };
    resize();
    window.addEventListener("resize", resize);

    // Animation — only update uniforms, GPU does the rest
    let animId = 0;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) * 0.001; // seconds
      uniforms.uTime.value = elapsed * 0.008; // very slow FBM noise evolution

      // Slow global rotation
      points.rotation.y = elapsed * ROTATION_SPEED * 1000;
      points.rotation.x = Math.sin(elapsed * 0.008) * 0.08;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={`pointer-events-none ${className}`} />;
}

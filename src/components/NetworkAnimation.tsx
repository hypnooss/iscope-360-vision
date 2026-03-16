import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 18000;
const ROTATION_SPEED = 0.000020;

const vertexShader = `
  attribute float aAlpha;
  attribute float aIndex;
  attribute vec3 aMove;
  attribute vec3 aSpeed;
  attribute vec3 aRandomness;
  attribute vec3 aFlatPosition;

  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uAlpha;
  uniform float uDepth;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uScale;
  uniform float uMorph;

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

    // --- Sphere position with tangential drift ---
    vec3 normal = normalize(position);
    float baseRadius = length(position);

    vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, normal));
    vec3 bitangent = cross(normal, tangent);

    float driftAngle = aRandomness.x * 6.2831853;
    float driftNoise1 = snoise2d(vec2(aIndex * 0.01, uTime * uSpeed));
    float driftNoise2 = snoise2d(vec2(aIndex * 0.01 + 100.0, uTime * uSpeed * 0.7));

    float driftAmount = uScale * uDepth * 8.0;
    vec3 surfaceOffset = tangent * (cos(driftAngle) * driftNoise1 * driftAmount * aSpeed.x)
                       + bitangent * (sin(driftAngle) * driftNoise2 * driftAmount * aSpeed.y);

    vec3 drifted = position + surfaceOffset;
    drifted = normalize(drifted) * baseRadius;

    vec3 spherePos = drifted * (1.0 + uAmplitude * vNoise * 0.3);

    // --- Flat "sand" position with subtle noise movement ---
    float flatNoise = snoise2d(vec2(aFlatPosition.x * 0.5 + uTime * 0.1, aFlatPosition.z * 0.5));
    vec3 flatPos = aFlatPosition + vec3(0.0, flatNoise * 0.008, 0.0);

    // --- Morph between sphere and flat ---
    // Use smoothstep for organic easing
    float morphEased = smoothstep(0.0, 1.0, uMorph);
    vec3 finalPos = mix(spherePos, flatPos, morphEased);

    // Final position
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size — smaller in sand state
    float sizeMultiplier = mix(1.0, 0.5, morphEased);
    vDistance = -mvPosition.z;
    gl_PointSize = uSize * sizeMultiplier * (100.0 / vDistance) * uPixelRatio;
    gl_PointSize = clamp(gl_PointSize, 1.0, 100.0);

    // Alpha — depth fade in sand state (particles further in Z fade out)
    // aFlatPosition.z ranges from -0.6 to 0.6; normalize to 0..1 depth factor
    float depthFade = 1.0 - smoothstep(-0.2, 0.6, aFlatPosition.z) * 0.7;
    float alphaMultiplier = mix(1.0, 0.6 * depthFade, morphEased);
    vAlpha = uAlpha * aAlpha * alphaMultiplier * (300.0 / vDistance);

    // Size — shrink distant particles in sand state for perspective
    float depthSize = mix(1.0, 0.6 + 0.4 * (1.0 - smoothstep(-0.2, 0.6, aFlatPosition.z)), morphEased);
    gl_PointSize *= depthSize;
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
  scrollProgress?: number; // 0 = globe, 1 = sand
}

export function NetworkAnimation({ className = '', scrollProgress = 0 }: NetworkAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);

  // Keep ref in sync with prop
  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const flatPositions = new Float32Array(PARTICLE_COUNT * 3);
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

      const isAtmosphere = Math.random() < 0.12;
      const rMul = isAtmosphere
        ? 1.01 + Math.random() * 0.1
        : 0.98 + Math.random() * 0.04;
      const r = 1.0 * rMul;

      const sp = Math.sin(phi);
      positions[i * 3] = r * sp * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * sp * Math.sin(theta);

      // Flat "sand" target positions — wide XZ plane
      // Spread across a 6x6 normalized area, with subtle Y variation
      const flatX = (Math.random() - 0.5) * 3.0;
      const flatZ = (Math.random() - 0.5) * 3.0;
      // Sinusoidal zig-zag dunes for beach sand effect
      const flatY = -0.3
        + Math.sin(flatX * 4.0) * 0.02
        + Math.sin(flatZ * 6.0) * 0.015
        + Math.sin(flatX * 9.0 + flatZ * 5.0) * 0.01
        + (Math.random() - 0.5) * 0.01;
      flatPositions[i * 3] = flatX;
      flatPositions[i * 3 + 1] = flatY;
      flatPositions[i * 3 + 2] = flatZ;

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
    geometry.setAttribute("aFlatPosition", new THREE.BufferAttribute(flatPositions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute("aMove", new THREE.BufferAttribute(moves, 3));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 3));
    geometry.setAttribute("aRandomness", new THREE.BufferAttribute(randomness, 3));

    const uniforms = {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uTime: { value: 0.0 },
      uSpeed: { value: 0.35 },
      uSize: { value: 16.0 },
      uAlpha: { value: 1.0 },
      uDepth: { value: 0.005 },
      uAmplitude: { value: 0.04 },
      uFrequency: { value: 1.2 },
      uScale: { value: 1.2 },
      uMorph: { value: 0.0 },
      uRcolor: { value: 34.0 },
      uGcolor: { value: 208.0 },
      uBcolor: { value: 223.0 },
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

    let currentSphereRadius = 300;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      currentSphereRadius = Math.min(w, h) * 0.38;
    };
    resize();
    window.addEventListener("resize", resize);

    let animId = 0;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) * 0.001;
      uniforms.uTime.value = elapsed * 0.15;

      const morph = scrollRef.current;
      uniforms.uMorph.value = morph;

      // Interpolate rotation — fade to 0 in sand state
      const rotationFactor = 1.0 - morph;
      points.rotation.y = elapsed * ROTATION_SPEED * 1000 * rotationFactor;
      const globeRotX = Math.sin(elapsed * 0.008) * 0.08;
      points.rotation.x = globeRotX * (1.0 - morph) + 0.6 * morph;

      // Offset Y downward in sand state
      points.position.y = -currentSphereRadius * 0.3 * morph;

      // Interpolate scale — globe radius → wide spread for sand
      const sandScale = currentSphereRadius * 1.2;
      const scale = currentSphereRadius + (sandScale - currentSphereRadius) * morph;
      points.scale.setScalar(scale);

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

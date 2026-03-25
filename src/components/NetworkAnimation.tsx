import { useEffect, useRef } from "react";
import * as THREE from "three";

export function NetworkAnimation(props: { className?: string }) {
  const className = props.className || "";
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    
    // Câmera perfeitamente posicionada para olhar as faixas no chão (Top-Down panorâmico)
    camera.position.set(0, 10, 30);
    camera.rotation.x = -0.15;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    // Geometria pura: 40.000 pontos em vias horizontais
    const count = 40000;
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const sizes = new Float32Array(count);
    
    const numLanes = 220;
    const particlesPerLane = Math.floor(count / numLanes);
    
    for (let i = 0; i < count; i++) {
      const laneIndex = i % numLanes;
      const depthIndex = Math.floor(i / numLanes);
      
      const zProgress = depthIndex / particlesPerLane;
      const pz = 25.0 - Math.pow(zProgress, 0.8) * 800.0;
      
      const laneProgress = laneIndex / numLanes;
      const basePx = (laneProgress * 2.0 - 1.0) * 600.0;
      
      const zigzag1 = Math.sin(pz * 0.02 + basePx * 0.01) * 35.0;
      const zigzag2 = Math.cos(pz * 0.012 - basePx * 0.008) * 45.0;
      
      const px = basePx + zigzag1 + zigzag2;
      
      positions[i * 3] = px;
      positions[i * 3 + 1] = -5.0;
      positions[i * 3 + 2] = pz;
      
      alphas[i] = 0.5 + Math.random() * 0.5;
      sizes[i] = 0.8 + Math.random() * 1.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const vertexShader = [
      "attribute float aAlpha;",
      "attribute float aSize;",
      "varying float vAlpha;",
      "varying vec3 vPos;",
      "void main() {",
      "  vec3 pos = position;",
      "  vPos = pos;",
      "  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);",
      "  gl_Position = projectionMatrix * mvPosition;",
      "  vAlpha = aAlpha;",
      "  float distanceScale = 140.0 / max(-mvPosition.z, 0.001);",
      "  gl_PointSize = clamp(aSize * distanceScale, 0.1, 28.0);",
      "}"
    ].join("\\n");

    const fragmentShader = [
      "varying float vAlpha;",
      "varying vec3 vPos;",
      "void main() {",
      "  vec2 coord = gl_PointCoord - vec2(0.5);",
      "  float dist = length(coord);",
      "  if (dist > 0.5) discard;",
      "  float glow = 1.0 - (dist * 2.0);",
      "  glow = smoothstep(0.0, 1.0, glow);",
      "  vec3 cyan = vec3(0.08, 0.75, 0.95);",
      "  vec3 magenta = vec3(0.75, 0.08, 0.95);",
      "  float colorMix = sin(vPos.x * 0.02 + vPos.z * 0.01) * 0.5 + 0.5;",
      "  vec3 finalColor = mix(cyan, magenta, colorMix);",
      "  gl_FragColor = vec4(finalColor, vAlpha * glow);",
      "}"
    ].join("\\n");

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={"pointer-events-none " + className} />;
}

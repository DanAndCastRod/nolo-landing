"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Bosque nocturno interactivo: fogata con llamas de shader, chispas y humo,
 * árboles low-poly instanciados con corteza procedural, luciérnagas, niebla
 * baja, luna y estrellas fugaces. Todo es procedural (texturas generadas en
 * canvas, sin descargar modelos) para que pese poco y cargue rápido tanto en
 * desktop como en mobile. Tocar la fogata la aviva (evento "nolo:fire-stoke").
 */

const SIMPLEX_2D = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
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
`;

/** Textura procedural en canvas: base de color con ruido granulado. */
function makeNoiseTexture(opts: {
  base: string;
  spots: { color: string; count: number; min: number; max: number; alpha: number }[];
  size?: number;
  streaks?: { color: string; count: number; alpha: number };
}) {
  const size = opts.size ?? 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = opts.base;
  g.fillRect(0, 0, size, size);
  for (const spot of opts.spots) {
    g.globalAlpha = spot.alpha;
    g.fillStyle = spot.color;
    for (let i = 0; i < spot.count; i++) {
      const r = spot.min + Math.random() * (spot.max - spot.min);
      g.beginPath();
      g.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (opts.streaks) {
    g.globalAlpha = opts.streaks.alpha;
    g.strokeStyle = opts.streaks.color;
    for (let i = 0; i < opts.streaks.count; i++) {
      const x = Math.random() * size;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(
        x + (Math.random() - 0.5) * 20, size * 0.33,
        x + (Math.random() - 0.5) * 20, size * 0.66,
        x + (Math.random() - 0.5) * 14, size
      );
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function ForestScene({ onReady }: { onReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // ---------- Renderer / escena / cámara ----------
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.75 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const shadowsOn = !isCoarse;
    if (shadowsOn) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080f);
    scene.fog = new THREE.FogExp2(0x0a1120, 0.026);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(5.5, 2.8, 7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.5;
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopAutoRotate);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(obj: T): T => {
      disposables.push(obj);
      return obj;
    };

    // ---------- Texturas procedurales ----------
    const groundTex = track(
      makeNoiseTexture({
        base: "#15231a",
        spots: [
          { color: "#1d3122", count: 260, min: 2, max: 12, alpha: 0.35 },
          { color: "#0d1710", count: 220, min: 2, max: 9, alpha: 0.4 },
          { color: "#2a2418", count: 90, min: 1, max: 5, alpha: 0.3 },
          { color: "#31502f", count: 60, min: 1, max: 3, alpha: 0.35 },
        ],
      })
    );
    groundTex.repeat.set(10, 10);

    const barkTex = track(
      makeNoiseTexture({
        base: "#3a2a1c",
        spots: [
          { color: "#2a1d12", count: 120, min: 1, max: 4, alpha: 0.5 },
          { color: "#4a3624", count: 80, min: 1, max: 3, alpha: 0.4 },
        ],
        streaks: { color: "#241709", count: 26, alpha: 0.5 },
      })
    );
    barkTex.repeat.set(2, 2);

    const stoneTex = track(
      makeNoiseTexture({
        base: "#555a63",
        spots: [
          { color: "#3f434b", count: 160, min: 1, max: 6, alpha: 0.45 },
          { color: "#6b7078", count: 90, min: 1, max: 4, alpha: 0.4 },
        ],
      })
    );

    const foliageTex = track(
      makeNoiseTexture({
        base: "#1a4327",
        spots: [
          { color: "#123020", count: 200, min: 1, max: 6, alpha: 0.45 },
          { color: "#265c36", count: 120, min: 1, max: 4, alpha: 0.4 },
        ],
      })
    );
    foliageTex.repeat.set(3, 2);

    // ---------- Luces ----------
    scene.add(new THREE.HemisphereLight(0x2a3b6e, 0x0c1408, 0.55));

    const moonLight = new THREE.DirectionalLight(0x8fa8ff, 0.4);
    moonLight.position.set(-30, 40, -20);
    scene.add(moonLight);

    const fireLight = new THREE.PointLight(0xff6b35, 34, 45, 2);
    fireLight.position.set(0, 1.2, 0);
    if (shadowsOn) {
      fireLight.castShadow = true;
      fireLight.shadow.mapSize.set(512, 512);
      fireLight.shadow.camera.near = 0.3;
      fireLight.shadow.camera.far = 35;
      fireLight.shadow.bias = -0.01;
    }
    scene.add(fireLight);

    // Rebote cálido sutil hacia abajo, para que el claro no quede negro
    const emberLight = new THREE.PointLight(0xff4d1a, 6, 6, 2);
    emberLight.position.set(0, 0.3, 0);
    scene.add(emberLight);

    // ---------- Cielo: estrellas (dos capas) y luna ----------
    const starLayers: THREE.PointsMaterial[] = [];
    for (const layer of [
      { count: 700, size: 0.5, opacity: 0.85 },
      { count: 200, size: 1.0, opacity: 1.0 },
    ]) {
      const positions = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i++) {
        const r = 90 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.95);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi) + 2;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = track(
        new THREE.PointsMaterial({
          color: 0xcdd8ff,
          size: layer.size,
          sizeAttenuation: true,
          fog: false,
          transparent: true,
          opacity: layer.opacity,
        })
      );
      starLayers.push(mat);
      scene.add(new THREE.Points(geo, mat));
    }

    const glowTexture = (() => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const g = canvas.getContext("2d")!;
      const grad = g.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
      );
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return track(new THREE.CanvasTexture(canvas));
    })();

    {
      const moon = new THREE.Mesh(
        track(new THREE.SphereGeometry(4, 24, 24)),
        track(new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }))
      );
      moon.position.set(-55, 45, -70);
      scene.add(moon);

      const halo = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xaebfff,
            transparent: true,
            opacity: 0.5,
            fog: false,
            depthWrite: false,
          })
        )
      );
      halo.scale.setScalar(26);
      halo.position.copy(moon.position);
      scene.add(halo);
    }

    // ---------- Estrella fugaz ocasional ----------
    const shootingStar = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.4, 0.05)),
      track(
        new THREE.MeshBasicMaterial({
          map: glowTexture,
          color: 0xdfe8ff,
          transparent: true,
          opacity: 0,
          fog: false,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
    );
    scene.add(shootingStar);
    const shootingState = { t: 2, active: false, next: 5 + Math.random() * 8 };
    const shootingDir = new THREE.Vector3();
    const shootingStartPos = new THREE.Vector3();

    // ---------- Suelo con relieve suave y textura ----------
    {
      const geo = track(new THREE.PlaneGeometry(140, 140, 72, 72));
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const dist = Math.hypot(x, y);
        const flatten = THREE.MathUtils.smoothstep(dist, 4, 14);
        const bump =
          Math.sin(x * 0.35) * Math.cos(y * 0.3) * 0.5 +
          Math.sin(x * 0.09 + y * 0.13) * 1.1;
        pos.setZ(i, bump * flatten);
      }
      geo.computeVertexNormals();
      const mat = track(
        new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
      );
      const ground = new THREE.Mesh(geo, mat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = shadowsOn;
      scene.add(ground);
    }

    // ---------- Pasto: matas instanciadas alrededor del claro ----------
    {
      const TUFTS = isCoarse ? 260 : 420;
      const tuftGeo = track(new THREE.ConeGeometry(0.028, 0.18, 4));
      tuftGeo.translate(0, 0.09, 0);
      const tuftMat = track(
        new THREE.MeshStandardMaterial({ color: 0x1c3524, roughness: 1 })
      );
      const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      for (let i = 0; i < TUFTS; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.8 + Math.pow(Math.random(), 0.8) * 12;
        e.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        q.setFromEuler(e);
        const s = 0.7 + Math.random() * 1.3;
        m.compose(
          new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
          q,
          new THREE.Vector3(s, s, s)
        );
        tufts.setMatrixAt(i, m);
      }
      scene.add(tufts);
    }

    // ---------- Bosque de pinos (instanciado, con corteza y follaje texturizados) ----------
    {
      const TREES = isCoarse ? 90 : 140;
      const trunkGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 1, 6));
      trunkGeo.translate(0, 0.5, 0);
      const trunkMat = track(
        new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1 })
      );
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
      trunks.castShadow = shadowsOn;

      const layers = [
        { radius: 1.15, height: 1.7, y: 0.9, tint: 0x8fa08f },
        { radius: 0.9, height: 1.5, y: 1.75, tint: 0xb5c4b0 },
        { radius: 0.62, height: 1.3, y: 2.6, tint: 0xd8e2d2 },
      ].map((l) => {
        const geo = track(new THREE.ConeGeometry(l.radius, l.height, 7));
        geo.translate(0, l.y + l.height / 2, 0);
        const mat = track(
          new THREE.MeshStandardMaterial({
            map: foliageTex,
            color: l.tint,
            roughness: 1,
          })
        );
        const mesh = new THREE.InstancedMesh(geo, mat, TREES);
        mesh.castShadow = shadowsOn;
        return mesh;
      });

      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < TREES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.pow(Math.random(), 0.7) * 40;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const s = 1 + Math.random() * 1.6;
        q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
        m.compose(
          new THREE.Vector3(x, 0, z),
          q,
          new THREE.Vector3(s * (0.8 + Math.random() * 0.4), s, s * (0.8 + Math.random() * 0.4))
        );
        trunks.setMatrixAt(i, m);
        layers.forEach((layer) => layer.setMatrixAt(i, m));
      }
      scene.add(trunks, ...layers);
    }

    // ---------- Fogata: piedras, troncos y brasas ----------
    {
      const STONES = 11;
      const stoneGeo = track(new THREE.DodecahedronGeometry(0.22, 0));
      const stoneMat = track(
        new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 })
      );
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, STONES);
      stones.castShadow = shadowsOn;
      stones.receiveShadow = shadowsOn;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < STONES; i++) {
        const a = (i / STONES) * Math.PI * 2 + Math.random() * 0.25;
        q.setFromEuler(
          new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        );
        const s = 0.8 + Math.random() * 0.6;
        m.compose(
          new THREE.Vector3(Math.cos(a) * 1.05, 0.1, Math.sin(a) * 1.05),
          q,
          new THREE.Vector3(s, s * 0.75, s)
        );
        stones.setMatrixAt(i, m);
      }
      scene.add(stones);
    }

    let embersMat: THREE.MeshBasicMaterial;
    {
      const logGeo = track(new THREE.CylinderGeometry(0.11, 0.13, 1.5, 6));
      const logMat = track(
        new THREE.MeshStandardMaterial({
          map: barkTex,
          color: 0x86664a,
          roughness: 1,
        })
      );
      const charMat = track(
        new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 })
      );
      const tipGeo = track(new THREE.CylinderGeometry(0.115, 0.115, 0.28, 6));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const log = new THREE.Mesh(logGeo, logMat);
        log.position.set(Math.cos(a) * 0.28, 0.32, Math.sin(a) * 0.28);
        log.rotation.z = Math.PI / 2.6;
        log.rotation.y = -a + Math.PI / 2;
        log.castShadow = shadowsOn;
        scene.add(log);
        // Punta carbonizada apuntando al centro
        const tip = new THREE.Mesh(tipGeo, charMat);
        tip.position.set(Math.cos(a) * 0.13, 0.62, Math.sin(a) * 0.13);
        tip.rotation.copy(log.rotation);
        scene.add(tip);
      }
      embersMat = track(
        new THREE.MeshBasicMaterial({
          color: 0xff4d1a,
          transparent: true,
          opacity: 0.85,
        })
      );
      const embers = new THREE.Mesh(
        track(new THREE.CircleGeometry(0.55, 16)),
        embersMat
      );
      embers.rotation.x = -Math.PI / 2;
      embers.position.y = 0.06;
      scene.add(embers);
    }

    // ---------- Llamas con shader (ruido simplex en vértices) ----------
    const flameUniforms = {
      uTime: { value: 0 },
      uStoke: { value: 0 },
    };
    const makeFlame = (radius: number, height: number, colorShift: number) => {
      const geo = track(new THREE.ConeGeometry(radius, height, 14, 10, true));
      geo.translate(0, height / 2, 0);
      const mat = track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: {
            ...flameUniforms,
            uHeight: { value: height },
            uShift: { value: colorShift },
          },
          vertexShader: /* glsl */ `
            uniform float uTime;
            uniform float uHeight;
            uniform float uStoke;
            varying float vH;
            varying float vNoise;
            ${SIMPLEX_2D}
            void main() {
              vec3 p = position;
              float hn = clamp(p.y / uHeight, 0.0, 1.0);
              float sway = 1.0 + uStoke * 0.6;
              float n = snoise(vec2(p.x * 2.5 + uTime * 0.6, p.y * 2.0 - uTime * (3.0 * sway)));
              float n2 = snoise(vec2(p.z * 2.5 - uTime * 0.8, p.y * 2.4 - uTime * (3.8 * sway)));
              p.x += n * 0.28 * hn * sway;
              p.z += n2 * 0.28 * hn * sway;
              p.y *= 1.0 + 0.12 * uStoke + n * 0.06 * hn;
              vH = hn;
              vNoise = n;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uShift;
            varying float vH;
            varying float vNoise;
            void main() {
              vec3 core = vec3(1.0, 0.86, 0.45);
              vec3 mid = vec3(1.0, 0.42, 0.21);
              vec3 tip = vec3(0.85, 0.24, 0.10);
              vec3 col = mix(core, mid, smoothstep(0.05, 0.5 + uShift, vH));
              col = mix(col, tip, smoothstep(0.4 + uShift, 1.0, vH));
              float alpha = (1.0 - vH) * (0.75 + vNoise * 0.25);
              alpha *= smoothstep(0.0, 0.08, vH) * 0.9;
              gl_FragColor = vec4(col, alpha);
            }
          `,
        })
      );
      const flame = new THREE.Mesh(geo, mat);
      flame.position.y = 0.28;
      scene.add(flame);
      return flame;
    };
    makeFlame(0.5, 1.7, 0.0);
    makeFlame(0.3, 1.15, -0.15);

    {
      const glow = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xff6b35,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      glow.scale.setScalar(4.5);
      glow.position.set(0, 0.9, 0);
      scene.add(glow);
    }

    // ---------- Chispas ----------
    const SPARKS = 90;
    const sparkData = new Float32Array(SPARKS * 4);
    const sparkGeo = track(new THREE.BufferGeometry());
    const sparkPositions = new Float32Array(SPARKS * 3);
    const resetSpark = (i: number, burst = false) => {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 1] = 0.3 + Math.random() * 0.3;
      sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      const boost = burst ? 1.8 : 1;
      sparkData[i * 4] = (Math.random() - 0.5) * 0.5 * boost;
      sparkData[i * 4 + 1] = (1.2 + Math.random() * 1.6) * boost;
      sparkData[i * 4 + 2] = (Math.random() - 0.5) * 0.5 * boost;
      sparkData[i * 4 + 3] = burst ? 0 : Math.random() * 2;
    };
    for (let i = 0; i < SPARKS; i++) resetSpark(i);
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = track(
      new THREE.PointsMaterial({
        color: 0xfbbf24,
        map: glowTexture,
        size: 0.09,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(new THREE.Points(sparkGeo, sparkMat));

    // ---------- Humo ----------
    const SMOKE = 26;
    const smokeGroup = new THREE.Group();
    const smokeMat = track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x8a8f9c,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      })
    );
    const smokeSprites: { sprite: THREE.Sprite; seed: number }[] = [];
    for (let i = 0; i < SMOKE; i++) {
      const sprite = new THREE.Sprite(smokeMat);
      const seed = Math.random();
      sprite.position.set(0, 1 + seed * 4, 0);
      smokeGroup.add(sprite);
      smokeSprites.push({ sprite, seed });
    }
    scene.add(smokeGroup);

    // ---------- Niebla baja que se arrastra ----------
    const MIST = 10;
    const mistMat = track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x6c7a94,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      })
    );
    const mistSprites: { sprite: THREE.Sprite; seed: number; r: number }[] = [];
    for (let i = 0; i < MIST; i++) {
      const sprite = new THREE.Sprite(mistMat);
      const seed = Math.random() * 100;
      const r = 5 + Math.random() * 14;
      sprite.scale.set(8 + Math.random() * 8, 2.2 + Math.random() * 1.5, 1);
      scene.add(sprite);
      mistSprites.push({ sprite, seed, r });
    }

    // ---------- Luciérnagas ----------
    const FIREFLIES = isCoarse ? 50 : 80;
    const fireflyGeo = track(new THREE.BufferGeometry());
    const fireflyPositions = new Float32Array(FIREFLIES * 3);
    const fireflySeeds = new Float32Array(FIREFLIES * 3);
    for (let i = 0; i < FIREFLIES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 17;
      fireflyPositions[i * 3] = Math.cos(a) * r;
      fireflyPositions[i * 3 + 1] = 0.6 + Math.random() * 2.6;
      fireflyPositions[i * 3 + 2] = Math.sin(a) * r;
      fireflySeeds[i * 3] = Math.random() * 100;
      fireflySeeds[i * 3 + 1] = Math.random() * 100;
      fireflySeeds[i * 3 + 2] = Math.random() * 100;
    }
    fireflyGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(fireflyPositions.slice(), 3)
    );
    const fireflyMat = track(
      new THREE.PointsMaterial({
        color: 0xfbbf24,
        map: glowTexture,
        size: 0.14,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(new THREE.Points(fireflyGeo, fireflyMat));

    // ---------- Avivar la fogata al tocarla ----------
    const stoke = { value: 0 };
    const raycaster = new THREE.Raycaster();
    const fireHitbox = new THREE.Mesh(
      track(new THREE.SphereGeometry(1.3, 8, 8)),
      track(new THREE.MeshBasicMaterial({ visible: false }))
    );
    fireHitbox.position.set(0, 0.8, 0);
    scene.add(fireHitbox);

    let downPos: { x: number; y: number; t: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      const elapsed = performance.now() - downPos.t;
      downPos = null;
      if (moved > 8 || elapsed > 350) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObject(fireHitbox).length > 0) {
        stoke.value = 1;
        for (let i = 0; i < SPARKS; i++) {
          if (Math.random() < 0.6) resetSpark(i, true);
        }
        window.dispatchEvent(new CustomEvent("nolo:fire-stoke"));
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // ---------- Bucle de animación ----------
    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;
    let notifiedReady = false;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      controls.update();

      stoke.value = Math.max(0, stoke.value - dt * 0.45);
      flameUniforms.uTime.value = t;
      flameUniforms.uStoke.value = stoke.value;

      // Luz del fuego: parpadeo natural + avivado
      const stokeBoost = 1 + stoke.value * 0.7;
      fireLight.intensity =
        (30 + Math.sin(t * 11) * 3 + Math.sin(t * 23 + 1.3) * 2 + Math.random() * 2) *
        stokeBoost;
      fireLight.position.x = Math.sin(t * 7.3) * 0.06;
      fireLight.position.z = Math.cos(t * 6.1) * 0.06;
      emberLight.intensity = (5 + Math.sin(t * 5) * 1.2) * stokeBoost;
      embersMat.opacity = 0.7 + Math.sin(t * 4) * 0.12 + stoke.value * 0.25;

      // Chispas que suben y se reinician
      for (let i = 0; i < SPARKS; i++) {
        sparkData[i * 4 + 3] += dt;
        if (sparkData[i * 4 + 3] > 1.6) {
          resetSpark(i);
          sparkData[i * 4 + 3] = 0;
          continue;
        }
        sparkPositions[i * 3] +=
          (sparkData[i * 4] + Math.sin(t * 4 + i) * 0.3) * dt;
        sparkPositions[i * 3 + 1] += sparkData[i * 4 + 1] * dt;
        sparkPositions[i * 3 + 2] +=
          (sparkData[i * 4 + 2] + Math.cos(t * 5 + i) * 0.3) * dt;
      }
      sparkGeo.attributes.position.needsUpdate = true;

      // Humo que asciende en espiral y se desvanece
      for (const { sprite, seed } of smokeSprites) {
        sprite.position.y += dt * (0.5 + seed * 0.4) * stokeBoost;
        if (sprite.position.y > 6) sprite.position.y = 1;
        const life = (sprite.position.y - 1) / 5;
        sprite.position.x = Math.sin(t * 0.7 + seed * 20) * (0.2 + life * 0.9);
        sprite.position.z = Math.cos(t * 0.6 + seed * 17) * (0.2 + life * 0.9);
        sprite.scale.setScalar(0.7 + life * 2.4);
      }

      // Niebla baja arrastrándose en círculos lentos
      for (const { sprite, seed, r } of mistSprites) {
        const a = t * 0.02 + seed;
        sprite.position.set(
          Math.cos(a) * r,
          0.5 + Math.sin(t * 0.15 + seed) * 0.25,
          Math.sin(a) * r
        );
      }

      // Luciérnagas errantes
      const fp = fireflyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < FIREFLIES; i++) {
        fp.setXYZ(
          i,
          fireflyPositions[i * 3] + Math.sin(t * 0.5 + fireflySeeds[i * 3]) * 0.9,
          fireflyPositions[i * 3 + 1] +
            Math.sin(t * 0.9 + fireflySeeds[i * 3 + 1]) * 0.5,
          fireflyPositions[i * 3 + 2] +
            Math.cos(t * 0.4 + fireflySeeds[i * 3 + 2]) * 0.9
        );
      }
      fp.needsUpdate = true;

      // Titileo sutil de estrellas
      starLayers[1].opacity = 0.75 + Math.sin(t * 2.1) * 0.2;

      // Estrella fugaz
      shootingState.t += dt;
      const starMat = shootingStar.material as THREE.MeshBasicMaterial;
      if (!shootingState.active && shootingState.t > shootingState.next) {
        shootingState.active = true;
        shootingState.t = 0;
        const a = Math.random() * Math.PI * 2;
        shootingStartPos.set(Math.cos(a) * 70, 55 + Math.random() * 25, Math.sin(a) * 70);
        shootingDir
          .set(Math.cos(a + 2), -0.35 - Math.random() * 0.3, Math.sin(a + 2))
          .normalize();
        shootingStar.position.copy(shootingStartPos);
        shootingStar.lookAt(shootingStartPos.clone().add(shootingDir));
      }
      if (shootingState.active) {
        const life = shootingState.t / 1.2;
        if (life >= 1) {
          shootingState.active = false;
          shootingState.t = 0;
          shootingState.next = 6 + Math.random() * 12;
          starMat.opacity = 0;
        } else {
          shootingStar.position.addScaledVector(shootingDir, dt * 55);
          starMat.opacity = Math.sin(life * Math.PI) * 0.9;
        }
      }

      renderer.render(scene, camera);

      if (!notifiedReady) {
        notifiedReady = true;
        onReadyRef.current?.();
      }
    };

    const start = () => {
      if (!running) {
        running = true;
        clock.start();
        animate();
      }
    };
    const stop = () => {
      if (running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    // Solo renderizar cuando la sección está visible y la pestaña activa
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.05 }
    );
    observer.observe(container);
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (container.getBoundingClientRect().top < window.innerHeight) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    start();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

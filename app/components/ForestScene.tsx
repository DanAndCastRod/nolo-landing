"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

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
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
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

export default function ForestScene({
  onReady,
  rain = false,
}: {
  onReady?: () => void;
  rain?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const rainRef = useRef(rain);
  rainRef.current = rain;

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

    // Bloom cinematográfico en desktop: el fuego y las luces resplandecen
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;

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

    if (!isCoarse) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.3,
        0.45,
        0.85
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      renderer.toneMappingExposure = 1.05;
    }

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

    // Relieve fino del suelo (bump map en escala de grises)
    const groundBump = track(
      makeNoiseTexture({
        base: "#808080",
        spots: [
          { color: "#4a4a4a", count: 400, min: 1, max: 6, alpha: 0.5 },
          { color: "#b8b8b8", count: 300, min: 1, max: 4, alpha: 0.5 },
        ],
      })
    );
    groundBump.colorSpace = THREE.NoColorSpace;
    groundBump.repeat.set(26, 26);

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

    // Nube suave para el humo (manchas superpuestas)
    const smokeTexture = (() => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const g = canvas.getContext("2d")!;
      for (let i = 0; i < 14; i++) {
        const x = 30 + Math.random() * 68;
        const y = 30 + Math.random() * 68;
        const r = 14 + Math.random() * 34;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(255,255,255,0.28)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      return track(new THREE.CanvasTexture(canvas));
    })();

    // Luna con mares y cráteres
    const moonTexture = (() => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const g = canvas.getContext("2d")!;
      g.fillStyle = "#e9edf7";
      g.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = 0.1 + Math.random() * 0.12;
        g.fillStyle = "#8e9ab8";
        const r = 3 + Math.random() * 15;
        g.beginPath();
        g.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      const tex = track(new THREE.CanvasTexture(canvas));
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

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
          map: glowTexture,
          size: layer.size,
          sizeAttenuation: true,
          fog: false,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      starLayers.push(mat);
      scene.add(new THREE.Points(geo, mat));
    }

    // Vía láctea: banda tenue cruzando el cielo
    {
      const band = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: smokeTexture,
            color: 0x9fb2e8,
            transparent: true,
            opacity: 0.1,
            fog: false,
            depthWrite: false,
            rotation: 0.5,
          })
        )
      );
      band.scale.set(220, 70, 1);
      band.position.set(20, 70, -90);
      scene.add(band);
    }

    {
      const moon = new THREE.Mesh(
        track(new THREE.SphereGeometry(4, 24, 24)),
        track(new THREE.MeshBasicMaterial({ map: moonTexture, fog: false }))
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
        new THREE.MeshStandardMaterial({
          map: groundTex,
          bumpMap: groundBump,
          bumpScale: 0.6,
          roughness: 1,
        })
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
        const geo = track(new THREE.ConeGeometry(l.radius, l.height, 9, 3));
        // Silueta irregular: cada anillo de vértices se desplaza con ruido
        {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const r = Math.hypot(x, z);
            if (r > 0.01) {
              const wobble =
                1 +
                Math.sin(x * 9.7 + z * 7.3) * 0.09 +
                Math.sin(z * 12.1 - x * 5.9) * 0.07;
              pos.setX(i, x * wobble);
              pos.setZ(i, z * wobble);
            }
          }
          geo.computeVertexNormals();
        }
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
      const e = new THREE.Euler();
      const tint = new THREE.Color();
      for (let i = 0; i < TREES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.pow(Math.random(), 0.7) * 40;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const s = 1 + Math.random() * 1.6;
        // Giro aleatorio + inclinación leve, como árboles reales
        e.set(
          (Math.random() - 0.5) * 0.09,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.09
        );
        q.setFromEuler(e);
        m.compose(
          new THREE.Vector3(x, 0, z),
          q,
          new THREE.Vector3(s * (0.8 + Math.random() * 0.4), s, s * (0.8 + Math.random() * 0.4))
        );
        trunks.setMatrixAt(i, m);
        // Variación de tono por árbol para romper la uniformidad
        const shade = 0.7 + Math.random() * 0.55;
        tint.setScalar(shade);
        trunks.setColorAt(i, tint);
        layers.forEach((layer) => {
          layer.setMatrixAt(i, m);
          layer.setColorAt(i, tint);
        });
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

    // ---------- Brasas incandescentes bajo la leña ----------
    let coalsMat: THREE.MeshStandardMaterial;
    {
      const COALS = 16;
      const coalGeo = track(new THREE.DodecahedronGeometry(0.09, 0));
      coalsMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x1a0d08,
          roughness: 1,
          emissive: 0xff3d00,
          emissiveIntensity: 1.6,
        })
      );
      const coals = new THREE.InstancedMesh(coalGeo, coalsMat, COALS);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < COALS; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.42;
        q.setFromEuler(
          new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        );
        const s = 0.6 + Math.random() * 1.1;
        m.compose(
          new THREE.Vector3(Math.cos(a) * r, 0.1 + Math.random() * 0.1, Math.sin(a) * r),
          q,
          new THREE.Vector3(s, s * 0.7, s)
        );
        coals.setMatrixAt(i, m);
      }
      scene.add(coals);

      // Ramas caídas dispersas por el claro
      const twigGeo = track(new THREE.CylinderGeometry(0.025, 0.04, 1, 5));
      const twigMat = track(
        new THREE.MeshStandardMaterial({ map: barkTex, color: 0x6b5138, roughness: 1 })
      );
      const TWIGS = 10;
      const twigs = new THREE.InstancedMesh(twigGeo, twigMat, TWIGS);
      for (let i = 0; i < TWIGS; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 9;
        q.setFromEuler(
          new THREE.Euler(Math.PI / 2 + (Math.random() - 0.5) * 0.2, 0, Math.random() * Math.PI)
        );
        const s = 0.6 + Math.random() * 1.2;
        m.compose(
          new THREE.Vector3(Math.cos(a) * r, 0.04, Math.sin(a) * r),
          q,
          new THREE.Vector3(s, s, s)
        );
        twigs.setMatrixAt(i, m);
      }
      scene.add(twigs);
    }

    // ---------- Fuego realista: quads cruzados con ruido FBM ----------
    const flameUniforms = {
      uTime: { value: 0 },
      uStoke: { value: 0 },
      uRain: { value: 0 },
    };
    {
      const fireMat = track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: flameUniforms,
          vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 p = position;
              // Vaivén suave del cuerpo de la llama
              p.x += sin(uTime * 2.1 + uv.y * 3.5) * 0.06 * uv.y;
              p.z += cos(uTime * 1.7 + uv.y * 2.8) * 0.05 * uv.y;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uStoke;
            uniform float uRain;
            varying vec2 vUv;
            ${SIMPLEX_2D}
            void main() {
              vec2 uv = vUv;
              float x = uv.x * 2.0 - 1.0;
              float speed = 1.5 + uStoke * 0.9;
              // Dos octavas de ruido ascendente: la lengua de fuego
              float n = fbm(vec2(uv.x * 3.2, uv.y * 2.1 - uTime * speed));
              n += 0.45 * fbm(vec2(uv.x * 7.5 + 3.7, uv.y * 4.6 - uTime * speed * 1.8));
              float body = (1.0 - uv.y) * (1.0 + uStoke * 0.3) * (1.0 - uRain * 0.32);
              float shape = body - abs(x) * (0.5 + 1.45 * uv.y) + n * 0.42;
              float d = smoothstep(0.02, 0.42, shape);
              if (d <= 0.01) discard;
              vec3 deep = vec3(0.62, 0.07, 0.02);
              vec3 mid = vec3(1.0, 0.42, 0.08);
              vec3 core = vec3(1.0, 0.88, 0.5);
              vec3 col = mix(deep, mid, smoothstep(0.08, 0.5, d));
              col = mix(col, core, smoothstep(0.6, 0.95, d));
              gl_FragColor = vec4(col, d * 0.55);
            }
          `,
        })
      );
      const fireGeo = track(new THREE.PlaneGeometry(1.2, 1.85, 6, 10));
      fireGeo.translate(0, 0.92, 0);
      for (let i = 0; i < 2; i++) {
        const quad = new THREE.Mesh(fireGeo, fireMat);
        quad.position.y = 0.18;
        quad.rotation.y = (i / 2) * Math.PI * 0.5 + 0.4;
        scene.add(quad);
      }
    }

    {
      const glow = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xff6b35,
            transparent: true,
            opacity: 0.28,
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
    // Varios materiales con rotaciones propias: el humo gira y se retuerce
    const smokeMats: { mat: THREE.SpriteMaterial; spin: number }[] = Array.from(
      { length: 5 },
      () => ({
        mat: track(
          new THREE.SpriteMaterial({
            map: smokeTexture,
            color: 0x9298a4,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            rotation: Math.random() * Math.PI * 2,
          })
        ),
        spin: (Math.random() - 0.5) * 0.5,
      })
    );
    const smokeSprites: { sprite: THREE.Sprite; seed: number }[] = [];
    for (let i = 0; i < SMOKE; i++) {
      const sprite = new THREE.Sprite(smokeMats[i % smokeMats.length].mat);
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

    // ---------- Lluvia ----------
    const RAIN_N = isCoarse ? 380 : 750;
    const rainGeo = track(new THREE.BufferGeometry());
    const rainPositions = new Float32Array(RAIN_N * 3);
    const rainSpeeds = new Float32Array(RAIN_N);
    for (let i = 0; i < RAIN_N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 18;
      rainPositions[i * 3] = Math.cos(a) * r;
      rainPositions[i * 3 + 1] = Math.random() * 12;
      rainPositions[i * 3 + 2] = Math.sin(a) * r;
      rainSpeeds[i] = 8 + Math.random() * 6;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = track(
      new THREE.PointsMaterial({
        color: 0xaebfd8,
        size: 0.05,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    rainPoints.visible = false;
    scene.add(rainPoints);
    let rainAmount = 0;

    // ---------- Búho en su árbol ----------
    const owlHead = new THREE.Group();
    const owlEyes: THREE.Sprite[] = [];
    const owlBlink = { next: 4, closing: 0 };
    {
      const barkMat = track(
        new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1 })
      );
      const trunk = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6)),
        barkMat
      );
      trunk.position.set(7.4, 1.6, -6.4);
      trunk.castShadow = shadowsOn;
      scene.add(trunk);
      const crown = new THREE.Mesh(
        track(new THREE.ConeGeometry(1.1, 2.4, 7)),
        track(
          new THREE.MeshStandardMaterial({
            map: foliageTex,
            color: 0x9fb39a,
            roughness: 1,
          })
        )
      );
      crown.position.set(7.4, 4.2, -6.4);
      crown.castShadow = shadowsOn;
      scene.add(crown);
      // Rama horizontal hacia el claro
      const branch = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.045, 0.07, 1.3, 5)),
        barkMat
      );
      branch.position.set(6.8, 2.3, -6.05);
      branch.rotation.z = Math.PI / 2.15;
      branch.rotation.y = 0.5;
      scene.add(branch);

      const owl = new THREE.Group();
      owl.position.set(6.35, 2.42, -5.8);
      const owlMat = track(
        new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 })
      );
      const body = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 10, 10)), owlMat);
      body.scale.set(1, 1.35, 0.9);
      owl.add(body);
      const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.095, 10, 10)), owlMat);
      owlHead.add(head);
      const tuftGeo = track(new THREE.ConeGeometry(0.025, 0.07, 4));
      for (const side of [-1, 1]) {
        const tuft = new THREE.Mesh(tuftGeo, owlMat);
        tuft.position.set(side * 0.06, 0.09, 0);
        owlHead.add(tuft);
        const eye = new THREE.Sprite(
          track(
            new THREE.SpriteMaterial({
              map: glowTexture,
              color: 0xfbbf24,
              transparent: true,
              opacity: 0.9,
              depthWrite: false,
            })
          )
        );
        eye.scale.setScalar(0.045);
        eye.position.set(side * 0.04, 0.015, 0.085);
        owlHead.add(eye);
        owlEyes.push(eye);
      }
      owlHead.position.y = 0.2;
      owl.add(owlHead);
      // Mirando hacia la fogata
      owl.rotation.y = Math.atan2(-owl.position.x, -owl.position.z);
      scene.add(owl);
    }

    // ---------- Ciervo a lo lejos ----------
    const deer = new THREE.Group();
    const deerLegs: THREE.Mesh[] = [];
    {
      const deerMat = track(
        new THREE.MeshStandardMaterial({ color: 0x131a24, roughness: 1 })
      );
      const body = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 10, 10)), deerMat);
      body.scale.set(1.4, 0.85, 0.6);
      body.position.y = 1.05;
      deer.add(body);
      const neck = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.09, 0.13, 0.7, 6)),
        deerMat
      );
      neck.position.set(0.52, 1.45, 0);
      neck.rotation.z = -0.5;
      deer.add(neck);
      const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 8, 8)), deerMat);
      head.scale.set(1.5, 0.9, 0.8);
      head.position.set(0.72, 1.72, 0);
      deer.add(head);
      const antlerGeo = track(new THREE.CylinderGeometry(0.015, 0.03, 0.5, 4));
      for (const side of [-1, 1]) {
        const antler = new THREE.Mesh(antlerGeo, deerMat);
        antler.position.set(0.68, 1.98, side * 0.09);
        antler.rotation.z = 0.4;
        antler.rotation.x = side * 0.5;
        deer.add(antler);
        const tine = new THREE.Mesh(antlerGeo, deerMat);
        tine.scale.setScalar(0.6);
        tine.position.set(0.62, 2.02, side * 0.14);
        tine.rotation.z = -0.3;
        tine.rotation.x = side * 0.9;
        deer.add(tine);
      }
      const legGeo = track(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 5));
      for (const [lx, lz] of [
        [0.42, 0.16],
        [0.42, -0.16],
        [-0.42, 0.16],
        [-0.42, -0.16],
      ]) {
        const leg = new THREE.Mesh(legGeo, deerMat);
        leg.position.set(lx, 0.48, lz);
        deer.add(leg);
        deerLegs.push(leg);
      }
      scene.add(deer);
    }

    // ---------- Humo que forma el wordmark NOLO al avivar ----------
    const WORD_N = 380;
    const wordTargets: THREE.Vector3[] = [];
    const wordGeo = track(new THREE.BufferGeometry());
    const wordPositions = new Float32Array(WORD_N * 3);
    const wordVel = new Float32Array(WORD_N * 3);
    wordGeo.setAttribute("position", new THREE.BufferAttribute(wordPositions, 3));
    const wordMat = track(
      new THREE.PointsMaterial({
        map: glowTexture,
        color: 0xb9bfca,
        size: 0.11,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    const wordPoints = new THREE.Points(wordGeo, wordMat);
    wordPoints.visible = false;
    scene.add(wordPoints);
    const wordState = { phase: "idle" as "idle" | "gather" | "hold" | "disperse", t: 0 };
    const wordWorldTargets: THREE.Vector3[] = Array.from(
      { length: WORD_N },
      () => new THREE.Vector3()
    );
    {
      // "NOLO" en trazo grueso: legible incluso formado por puntos de humo
      const w = 240;
      const h = 72;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d")!;
      g.font = "900 62px Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#fff";
      g.fillText("NOLO", w / 2, h / 2 + 4);
      const data = g.getImageData(0, 0, w, h).data;
      const all: [number, number][] = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (data[(y * w + x) * 4 + 3] > 100) all.push([x, y]);
        }
      }
      for (let i = 0; i < WORD_N && all.length > 0; i++) {
        const [x, y] = all[Math.floor(Math.random() * all.length)];
        wordTargets.push(
          new THREE.Vector3(
            (x / w - 0.5) * 4.4 + (Math.random() - 0.5) * 0.04,
            (0.5 - y / h) * 4.4 * (h / w) + (Math.random() - 0.5) * 0.04,
            0
          )
        );
      }
    }
    const startWordSmoke = () => {
      if (wordTargets.length === 0 || wordState.phase !== "idle") return;
      // Orienta el wordmark hacia la cámara (solo giro horizontal)
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0;
      right.normalize();
      const center = new THREE.Vector3(0, 3.0, 0);
      for (let i = 0; i < WORD_N; i++) {
        const target = wordTargets[i % wordTargets.length];
        wordWorldTargets[i]
          .copy(center)
          .addScaledVector(right, target.x)
          .add(new THREE.Vector3(0, target.y, 0));
        wordPositions[i * 3] = (Math.random() - 0.5) * 0.5;
        wordPositions[i * 3 + 1] = 1.2 + Math.random() * 0.5;
        wordPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        wordVel[i * 3] = (Math.random() - 0.5) * 0.4;
        wordVel[i * 3 + 1] = 0.4 + Math.random() * 0.5;
        wordVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      }
      wordState.phase = "gather";
      wordState.t = 0;
      wordPoints.visible = true;
    };

    // ---------- Avivar la fogata al tocarla ----------
    const stoke = { value: 0 };

    const sputter = { value: 0 };

    // La fogata late con la música de la trilogía
    const onMusicBeat = () => {
      stoke.value = Math.max(stoke.value, 0.3);
    };
    window.addEventListener("nolo:music-beat", onMusicBeat);
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
        startWordSmoke();
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

      // Transición de lluvia y chisporroteo del fuego
      const rainTarget = rainRef.current ? 1 : 0;
      rainAmount += (rainTarget - rainAmount) * Math.min(1, dt * 0.8);
      rainPoints.visible = rainAmount > 0.02;
      rainMat.opacity = 0.45 * rainAmount;
      (scene.fog as THREE.FogExp2).density = 0.026 + rainAmount * 0.012;
      starLayers[0].opacity = 0.85 * (1 - rainAmount * 0.85);
      if (rainAmount > 0.02) {
        for (let i = 0; i < RAIN_N; i++) {
          rainPositions[i * 3 + 1] -= rainSpeeds[i] * dt;
          if (rainPositions[i * 3 + 1] < 0) {
            rainPositions[i * 3 + 1] = 12;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      if (sputter.value > 0) sputter.value = Math.max(0, sputter.value - dt * 4);
      if (rainAmount > 0.4 && Math.random() < dt * 1.5) sputter.value = 1;

      flameUniforms.uTime.value = t;
      flameUniforms.uStoke.value = stoke.value;
      flameUniforms.uRain.value = rainAmount * (0.7 + sputter.value * 0.5);

      // Luz del fuego: parpadeo natural + avivado − lluvia
      const stokeBoost =
        (1 + stoke.value * 0.7) *
        (1 - rainAmount * 0.35) *
        (1 - sputter.value * 0.4);
      fireLight.intensity =
        (30 + Math.sin(t * 11) * 3 + Math.sin(t * 23 + 1.3) * 2 + Math.random() * 2) *
        stokeBoost;
      fireLight.position.x = Math.sin(t * 7.3) * 0.06;
      fireLight.position.z = Math.cos(t * 6.1) * 0.06;
      emberLight.intensity = (5 + Math.sin(t * 5) * 1.2) * stokeBoost;
      embersMat.opacity = 0.7 + Math.sin(t * 4) * 0.12 + stoke.value * 0.25;
      coalsMat.emissiveIntensity =
        (1.3 + Math.sin(t * 6.3) * 0.35 + Math.sin(t * 15.7) * 0.2) * stokeBoost;

      // El humo gira lentamente
      for (const { mat, spin } of smokeMats) {
        mat.rotation += spin * dt;
      }

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

      // Titileo sutil de estrellas (apagadas bajo la lluvia)
      starLayers[1].opacity =
        (0.75 + Math.sin(t * 2.1) * 0.2) * (1 - rainAmount * 0.85);

      // Búho: giro de cabeza y parpadeo
      owlHead.rotation.y = Math.sin(t * 0.35) * 0.7 + Math.sin(t * 0.13) * 0.3;
      owlBlink.next -= dt;
      if (owlBlink.next <= 0) {
        owlBlink.closing = 0.16;
        owlBlink.next = 3 + Math.random() * 5;
      }
      if (owlBlink.closing > 0) {
        owlBlink.closing -= dt;
        for (const eye of owlEyes) eye.scale.set(0.045, 0.008, 1);
      } else {
        for (const eye of owlEyes) eye.scale.set(0.045, 0.045, 1);
      }

      // Ciervo: paseo lento entre los árboles, pastando a ratos
      {
        const stroll = t * 0.08;
        const grazing = Math.sin(t * 0.11) > 0.45;
        deer.position.set(
          -17 + Math.cos(stroll) * 3.5,
          0,
          -13 + Math.sin(stroll) * 3.5
        );
        deer.rotation.y = -stroll + Math.PI / 2 + Math.PI;
        const swing = grazing ? 0 : Math.sin(t * 2.2) * 0.25;
        deerLegs.forEach((leg, i) => {
          leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1);
        });
        // Baja la cabeza cuando pasta
        deer.rotation.z = grazing ? -0.12 : 0;
      }

      // Humo del wordmark NOLO
      if (wordState.phase !== "idle") {
        wordState.t += dt;
        const wp = wordGeo.attributes.position as THREE.BufferAttribute;
        if (wordState.phase === "gather" || wordState.phase === "hold") {
          const k = Math.min(1, dt * (wordState.phase === "gather" ? 3.2 : 6));
          for (let i = 0; i < WORD_N; i++) {
            const target = wordWorldTargets[i];
            wordPositions[i * 3] += (target.x - wordPositions[i * 3]) * k;
            wordPositions[i * 3 + 1] +=
              (target.y - wordPositions[i * 3 + 1]) * k +
              Math.sin(t * 3 + i) * 0.0015;
            wordPositions[i * 3 + 2] += (target.z - wordPositions[i * 3 + 2]) * k;
          }
          if (wordState.phase === "gather") {
            wordMat.opacity = Math.min(0.9, wordState.t * 1.1);
            if (wordState.t > 1.3) {
              wordState.phase = "hold";
              wordState.t = 0;
            }
          } else if (wordState.t > 2.2) {
            wordState.phase = "disperse";
            wordState.t = 0;
          }
        } else {
          for (let i = 0; i < WORD_N; i++) {
            wordPositions[i * 3] += wordVel[i * 3] * dt;
            wordPositions[i * 3 + 1] += wordVel[i * 3 + 1] * dt;
            wordPositions[i * 3 + 2] += wordVel[i * 3 + 2] * dt;
          }
          wordMat.opacity = Math.max(0, 0.9 - wordState.t * 0.8);
          if (wordState.t > 1.3) {
            wordState.phase = "idle";
            wordPoints.visible = false;
          }
        }
        wp.needsUpdate = true;
      }

      // Estrella fugaz (no aparece bajo la lluvia)
      shootingState.t += dt;
      const starMat = shootingStar.material as THREE.MeshBasicMaterial;
      if (rainAmount > 0.3 && !shootingState.active) shootingState.t = 0;
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

      if (composer) composer.render();
      else renderer.render(scene, camera);

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
      composer?.setSize(w, h);
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
      window.removeEventListener("nolo:music-beat", onMusicBeat);
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      bloomPass?.dispose();
      composer?.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

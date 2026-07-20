"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Escenas rituales de los álbumes II y III:
 * - "corcel": llanura nocturna azul con un corcel anatómico galopando en
 *   círculo bajo una luna enorme, con crin y cola espectrales de fuego
 *   azul y polvo tras los cascos.
 * - "phoenix": páramo de brasas con un ave hecha íntegramente de fuego
 *   (siluetas enmascaradas con ruido FBM) ascendiendo en espiral.
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

/** Dibuja una silueta blanca sobre canvas transparente y la devuelve como textura. */
function makeMaskTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  draw(g, width, height);
  return new THREE.CanvasTexture(canvas);
}

export default function RitualScene({
  variant,
  onReady,
}: {
  variant: "corcel" | "phoenix";
  onReady?: () => void;
}) {
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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.75 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const isCorcel = variant === "corcel";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isCorcel ? 0x050a18 : 0x0b0503);
    scene.fog = new THREE.FogExp2(isCorcel ? 0x0a1430 : 0x160903, 0.028);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      220
    );
    camera.position.set(isCorcel ? 9 : 7, 3.2, isCorcel ? 11 : 9);

    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isCoarse) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        isCorcel ? 0.4 : 0.45,
        0.55,
        isCorcel ? 0.7 : 0.7
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, isCorcel ? 1.4 : 2.4, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.4;
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopAutoRotate);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(obj: T): T => {
      disposables.push(obj);
      return obj;
    };

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

    // ---------- Fuego enmascarado: silueta + FBM (alas, crin, colas) ----------
    const fireUniforms = { uTime: { value: 0 } };
    const makeFireMaterial = (
      mask: THREE.Texture,
      deep: THREE.Color,
      mid: THREE.Color,
      core: THREE.Color,
      speed: number,
      alpha = 0.9,
      ripple = 0
    ) =>
      track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: fireUniforms.uTime,
            uMask: { value: mask },
            uDeep: { value: deep },
            uMid: { value: mid },
            uCore: { value: core },
            uSpeed: { value: speed },
            uAlpha: { value: alpha },
            uRipple: { value: ripple },
          },
          vertexShader: /* glsl */ `
            uniform float uTime;
            uniform float uRipple;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 p = position;
              // Ondeo tipo bandera: crece hacia el extremo libre
              float edge = abs(uv.x - 0.5) * 2.0;
              p.z += sin(uTime * 3.2 + uv.x * 7.0) * uRipple * edge;
              p.y += cos(uTime * 2.4 + uv.x * 5.0) * uRipple * 0.5 * edge;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform sampler2D uMask;
            uniform float uTime;
            uniform float uSpeed;
            uniform float uAlpha;
            uniform vec3 uDeep;
            uniform vec3 uMid;
            uniform vec3 uCore;
            varying vec2 vUv;
            ${SIMPLEX_2D}
            void main() {
              float mask = texture2D(uMask, vUv).a;
              if (mask < 0.02) discard;
              float n = fbm(vec2(vUv.x * 3.5 - uTime * uSpeed, vUv.y * 3.5 - uTime * uSpeed * 0.55));
              n = n * 0.5 + 0.5;
              float d = mask * (0.45 + 0.65 * n);
              float alpha = smoothstep(0.18, 0.5, d);
              if (alpha < 0.01) discard;
              vec3 col = mix(uDeep, uMid, smoothstep(0.25, 0.62, d));
              col = mix(col, uCore, smoothstep(0.68, 0.98, d));
              gl_FragColor = vec4(col, alpha * uAlpha);
            }
          `,
        })
      );

    // ---------- Estrellas ----------
    {
      const N = 500;
      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 90 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.95);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi) + 2;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      scene.add(
        new THREE.Points(
          geo,
          track(
            new THREE.PointsMaterial({
              color: isCorcel ? 0xcdd8ff : 0xffd9b0,
              map: glowTexture,
              size: 0.55,
              sizeAttenuation: true,
              fog: false,
              transparent: true,
              opacity: isCorcel ? 0.9 : 0.5,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          )
        )
      );
    }

    // ---------- Suelo ----------
    {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const g = canvas.getContext("2d")!;
      g.fillStyle = isCorcel ? "#0b1526" : "#140b06";
      g.fillRect(0, 0, 256, 256);
      const spotColors = isCorcel
        ? ["#0e1c33", "#081020"]
        : ["#241107", "#0c0603", "#3a1505"];
      for (const color of spotColors) {
        g.globalAlpha = 0.4;
        g.fillStyle = color;
        for (let i = 0; i < 180; i++) {
          const r = 1 + Math.random() * 8;
          g.beginPath();
          g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      const tex = track(new THREE.CanvasTexture(canvas));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(12, 12);
      tex.colorSpace = THREE.SRGBColorSpace;

      const geo = track(new THREE.PlaneGeometry(200, 200, 48, 48));
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const dist = Math.hypot(x, y);
        const flatten = THREE.MathUtils.smoothstep(dist, 8, 20);
        pos.setZ(i, (Math.sin(x * 0.15) * Math.cos(y * 0.12) * 1.4) * flatten);
      }
      geo.computeVertexNormals();
      const mat = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 1,
          ...(isCorcel
            ? {}
            : {
                emissive: 0xff4d1a,
                emissiveMap: tex,
                emissiveIntensity: 0.5,
              }),
        })
      );
      const ground = new THREE.Mesh(geo, mat);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
    }

    // ---------- Luces ----------
    if (isCorcel) {
      scene.add(new THREE.HemisphereLight(0x33508f, 0x060a14, 1.0));
      const moonLight = new THREE.DirectionalLight(0x9db4ff, 1.8);
      moonLight.position.set(-25, 22, -35);
      scene.add(moonLight);
      // Contraluz cálido tenue para despegar la silueta del fondo
      const rim = new THREE.DirectionalLight(0x4a5f9e, 0.8);
      rim.position.set(20, 8, 25);
      scene.add(rim);
    } else {
      scene.add(new THREE.HemisphereLight(0x4a2410, 0x140a05, 0.7));
    }

    // ---------- Estela compartida (polvo azul o fuego) ----------
    const TRAIL_N = isCoarse ? 90 : 160;
    const trailGeo = track(new THREE.BufferGeometry());
    const trailPositions = new Float32Array(TRAIL_N * 3);
    const trailLife = new Float32Array(TRAIL_N).fill(99);
    const trailVel = new Float32Array(TRAIL_N * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = track(
      new THREE.PointsMaterial({
        map: glowTexture,
        color: isCorcel ? 0x5f7db8 : 0xff6b35,
        size: isCorcel ? 0.3 : 0.24,
        transparent: true,
        opacity: isCorcel ? 0.35 : 0.75,
        blending: isCorcel ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(new THREE.Points(trailGeo, trailMat));
    let trailCursor = 0;
    const emitTrail = (x: number, y: number, z: number) => {
      const i = trailCursor++ % TRAIL_N;
      trailPositions[i * 3] = x;
      trailPositions[i * 3 + 1] = y;
      trailPositions[i * 3 + 2] = z;
      trailLife[i] = 0;
      trailVel[i * 3] = (Math.random() - 0.5) * 0.4;
      trailVel[i * 3 + 1] = isCorcel
        ? 0.3 + Math.random() * 0.4
        : -(0.2 + Math.random() * 0.3);
      trailVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    };

    // ---------- CORCEL: anatomía y galope ----------
    const horse = new THREE.Group();
    // Piernas: [pivote superior, pivote inferior (rodilla/corvejón)]
    const legs: { upper: THREE.Group; lower: THREE.Group; phase: number; front: boolean }[] =
      [];
    const headGroup = new THREE.Group();
    if (isCorcel) {
      // Luna gigante
      const moon = new THREE.Mesh(
        track(new THREE.SphereGeometry(9, 28, 28)),
        track(new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }))
      );
      moon.position.set(-38, 20, -55);
      scene.add(moon);
      const halo = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0x9db4ff,
            transparent: true,
            opacity: 0.55,
            fog: false,
            depthWrite: false,
          })
        )
      );
      halo.scale.setScalar(55);
      halo.position.copy(moon.position);
      scene.add(halo);

      // Siluetas de pinos en el horizonte
      const N = 70;
      const coneGeo = track(new THREE.ConeGeometry(1.6, 5.5, 6));
      coneGeo.translate(0, 2.75, 0);
      const coneMat = track(
        new THREE.MeshStandardMaterial({ color: 0x060c18, roughness: 1 })
      );
      const cones = new THREE.InstancedMesh(coneGeo, coneMat, N);
      const m = new THREE.Matrix4();
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 32 + Math.random() * 45;
        const s = 0.8 + Math.random() * 1.8;
        m.makeScale(s, s, s);
        m.setPosition(Math.cos(a) * r, 0, Math.sin(a) * r);
        cones.setMatrixAt(i, m);
      }
      scene.add(cones);

      const coat = track(
        new THREE.MeshStandardMaterial({ color: 0x151f38, roughness: 0.6 })
      );

      // Cuerpo: barril + pecho + grupa
      const barrel = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.3, 0.85, 4, 12)),
        coat
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.y = 1.14;
      horse.add(barrel);
      const chest = new THREE.Mesh(track(new THREE.SphereGeometry(0.32, 12, 12)), coat);
      chest.scale.set(1, 0.95, 0.85);
      chest.position.set(0.5, 1.16, 0);
      horse.add(chest);
      const hind = new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 12, 12)), coat);
      hind.scale.set(1.05, 1, 0.85);
      hind.position.set(-0.46, 1.2, 0);
      horse.add(hind);

      // Cuello curvo (tubo sobre una curva)
      const neckCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.5, 1.25, 0),
        new THREE.Vector3(0.78, 1.58, 0),
        new THREE.Vector3(0.95, 1.88, 0),
      ]);
      const neck = new THREE.Mesh(
        track(new THREE.TubeGeometry(neckCurve, 8, 0.13, 8)),
        coat
      );
      horse.add(neck);

      // Cabeza articulada
      headGroup.position.set(0.97, 1.92, 0);
      const skull = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 10, 10)), coat);
      skull.scale.set(1.15, 0.95, 0.8);
      headGroup.add(skull);
      const muzzle = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.065, 0.17, 4, 8)),
        coat
      );
      muzzle.rotation.z = -1.15;
      muzzle.position.set(0.17, -0.06, 0);
      headGroup.add(muzzle);
      const earGeo = track(new THREE.ConeGeometry(0.032, 0.11, 4));
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, coat);
        ear.position.set(-0.04, 0.13, side * 0.055);
        ear.rotation.x = side * 0.25;
        headGroup.add(ear);
      }
      horse.add(headGroup);

      // Patas articuladas: muslo + caña con rodilla/corvejón + casco
      const upperGeo = track(new THREE.CapsuleGeometry(0.05, 0.34, 4, 8));
      upperGeo.translate(0, -0.19, 0);
      const lowerGeo = track(new THREE.CapsuleGeometry(0.034, 0.32, 4, 8));
      lowerGeo.translate(0, -0.17, 0);
      const hoofGeo = track(new THREE.CylinderGeometry(0.048, 0.055, 0.07, 8));
      // Galope rotatorio: delanteras casi juntas, traseras en contrafase
      const legSpecs = [
        { x: 0.48, z: 0.16, phase: 0.0, front: true },
        { x: 0.52, z: -0.16, phase: 0.85, front: true },
        { x: -0.44, z: 0.17, phase: 3.3, front: false },
        { x: -0.48, z: -0.17, phase: 4.1, front: false },
      ];
      for (const spec of legSpecs) {
        const upper = new THREE.Group();
        upper.position.set(spec.x, 1.08, spec.z);
        upper.add(new THREE.Mesh(upperGeo, coat));
        const lower = new THREE.Group();
        lower.position.y = -0.38;
        lower.add(new THREE.Mesh(lowerGeo, coat));
        const hoof = new THREE.Mesh(hoofGeo, coat);
        hoof.position.y = -0.36;
        lower.add(hoof);
        upper.add(lower);
        horse.add(upper);
        legs.push({ upper, lower, phase: spec.phase, front: spec.front });
      }

      // Cola física (tubo) rematada en fuego azul
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.6, 1.32, 0),
        new THREE.Vector3(-0.85, 1.1, 0),
        new THREE.Vector3(-0.98, 0.85, 0),
      ]);
      horse.add(
        new THREE.Mesh(track(new THREE.TubeGeometry(tailCurve, 6, 0.045, 6)), coat)
      );

      // Crin y cola espectrales: cintas de fuego azul
      const ribbonMask = track(
        makeMaskTexture(128, 256, (g, w, h) => {
          g.beginPath();
          g.moveTo(w * 0.5, 0);
          g.quadraticCurveTo(w * 0.95, h * 0.35, w * 0.6, h);
          g.lineTo(w * 0.4, h);
          g.quadraticCurveTo(w * 0.05, h * 0.35, w * 0.5, 0);
          g.fill();
        })
      );
      const blueFire = makeFireMaterial(
        ribbonMask,
        new THREE.Color(0.04, 0.1, 0.38),
        new THREE.Color(0.25, 0.45, 1.0),
        new THREE.Color(0.8, 0.92, 1.0),
        1.4
      );
      const maneGeo = track(new THREE.PlaneGeometry(0.34, 0.95, 1, 8));
      const mane = new THREE.Mesh(maneGeo, blueFire);
      mane.position.set(0.62, 1.78, 0);
      mane.rotation.z = 2.25;
      horse.add(mane);
      const tailFireGeo = track(new THREE.PlaneGeometry(0.4, 1.3, 1, 8));
      const tailFire = new THREE.Mesh(tailFireGeo, blueFire);
      tailFire.position.set(-1.0, 0.9, 0);
      tailFire.rotation.z = 2.7;
      horse.add(tailFire);

      horse.scale.setScalar(1.5);
      scene.add(horse);
    }

    // ---------- PHOENIX: ave hecha de fuego ----------
    const bird = new THREE.Group();
    const wingFlaps: THREE.Group[] = [];
    const tailFeathers: THREE.Mesh[] = [];
    let birdLight: THREE.PointLight | null = null;
    let emberGeoRef: THREE.BufferGeometry | null = null;
    if (!isCorcel) {
      const deep = new THREE.Color(0.55, 0.09, 0.02);
      const mid = new THREE.Color(1.0, 0.42, 0.08);
      const core = new THREE.Color(1.0, 0.86, 0.48);

      // Silueta del cuerpo (perfil de ave con cresta y pico)
      const bodyMask = track(
        makeMaskTexture(256, 160, (g, w, h) => {
          g.beginPath();
          // pecho y vientre
          g.moveTo(w * 0.16, h * 0.55);
          g.quadraticCurveTo(w * 0.3, h * 0.92, w * 0.62, h * 0.78);
          // cola hacia atrás
          g.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.3, h * 0.62);
          g.closePath();
          g.fill();
          // cuerpo principal
          g.beginPath();
          g.ellipse(w * 0.45, h * 0.55, w * 0.28, h * 0.26, -0.15, 0, Math.PI * 2);
          g.fill();
          // cuello y cabeza
          g.beginPath();
          g.ellipse(w * 0.72, h * 0.34, w * 0.1, h * 0.13, 0.3, 0, Math.PI * 2);
          g.fill();
          // pico
          g.beginPath();
          g.moveTo(w * 0.8, h * 0.28);
          g.lineTo(w * 0.94, h * 0.34);
          g.lineTo(w * 0.8, h * 0.4);
          g.closePath();
          g.fill();
          // cresta
          g.beginPath();
          g.moveTo(w * 0.68, h * 0.24);
          g.quadraticCurveTo(w * 0.6, h * 0.05, w * 0.5, h * 0.12);
          g.quadraticCurveTo(w * 0.62, h * 0.18, w * 0.64, h * 0.3);
          g.closePath();
          g.fill();
        })
      );

      // Silueta de ala con plumas recortadas en el borde de fuga
      const wingMask = track(
        makeMaskTexture(256, 128, (g, w, h) => {
          g.beginPath();
          g.moveTo(0, h * 0.45);
          // borde de ataque hacia la punta
          g.quadraticCurveTo(w * 0.55, h * 0.02, w * 0.98, h * 0.22);
          // plumas del borde de fuga
          const feathers = 5;
          for (let i = 0; i < feathers; i++) {
            const fx = w * (0.98 - (i / feathers) * 0.8);
            const nx = w * (0.98 - ((i + 1) / feathers) * 0.8);
            g.quadraticCurveTo(
              (fx + nx) / 2 + w * 0.03,
              h * (0.6 + i * 0.09),
              nx,
              h * (0.52 + i * 0.07)
            );
          }
          g.lineTo(0, h * 0.62);
          g.closePath();
          g.fill();
        })
      );

      // Cinta larga para las plumas de la cola
      const ribbonMask = track(
        makeMaskTexture(256, 64, (g, w, h) => {
          g.beginPath();
          g.moveTo(0, h * 0.2);
          g.quadraticCurveTo(w * 0.6, 0, w, h * 0.42);
          g.quadraticCurveTo(w * 0.6, h, 0, h * 0.8);
          g.closePath();
          g.fill();
        })
      );

      const bodyMat = makeFireMaterial(bodyMask, deep, mid, core, 1.1, 0.6);
      const wingMat = makeFireMaterial(wingMask, deep, mid, core, 1.5, 0.75, 0.08);
      const ribbonMat = makeFireMaterial(ribbonMask, deep, mid, core, 0.9, 0.7, 0.2);

      // Cuerpo: dos planos cruzados para verse desde todo ángulo
      const bodyGeo = track(new THREE.PlaneGeometry(1.9, 1.2, 1, 1));
      for (const rotY of [0, Math.PI / 2]) {
        const b = new THREE.Mesh(bodyGeo, bodyMat);
        b.rotation.y = rotY;
        bird.add(b);
      }

      // Alas horizontales que baten
      const wingGeo = track(new THREE.PlaneGeometry(2.4, 1.15, 12, 3));
      wingGeo.translate(1.2, 0, 0);
      for (const side of [-1, 1]) {
        const flap = new THREE.Group();
        const yaw = new THREE.Group();
        yaw.rotation.y = (side * Math.PI) / 2;
        const mesh = new THREE.Mesh(wingGeo, wingMat);
        mesh.rotation.x = -Math.PI / 2;
        yaw.add(mesh);
        flap.add(yaw);
        flap.position.set(-0.1, 0.12, 0);
        bird.add(flap);
        wingFlaps.push(flap);
      }

      // Cola: tres cintas largas ondeando
      const featherGeo = track(new THREE.PlaneGeometry(2.0, 0.3, 14, 1));
      featherGeo.translate(-1.0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(featherGeo, ribbonMat);
        feather.position.set(-0.75, -0.05, 0);
        feather.rotation.y = (i - 1) * 0.3;
        feather.rotation.z = -0.12 - i * 0.05;
        bird.add(feather);
        tailFeathers.push(feather);
      }

      const glow = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xff8c3a,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      glow.scale.setScalar(3.2);
      (glow.material as THREE.SpriteMaterial).opacity = 0.22;
      bird.add(glow);
      birdLight = new THREE.PointLight(0xff8c3a, 14, 30, 2);
      bird.add(birdLight);
      scene.add(bird);

      // Rocas oscuras del páramo
      const N = 30;
      const rockGeo = track(new THREE.DodecahedronGeometry(0.8, 0));
      const rockMat = track(
        new THREE.MeshStandardMaterial({ color: 0x0f0805, roughness: 1 })
      );
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, N);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 30;
        q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0));
        const s = 0.5 + Math.random() * 1.8;
        m.compose(
          new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r),
          q,
          new THREE.Vector3(s, s * 0.7, s)
        );
        rocks.setMatrixAt(i, m);
      }
      scene.add(rocks);

      // Brasas que ascienden por todo el páramo
      const EMBERS = isCoarse ? 120 : 220;
      const emberGeo = track(new THREE.BufferGeometry());
      const emberPositions = new Float32Array(EMBERS * 3);
      for (let i = 0; i < EMBERS; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 30;
        emberPositions[i * 3] = Math.cos(a) * r;
        emberPositions[i * 3 + 1] = Math.random() * 8;
        emberPositions[i * 3 + 2] = Math.sin(a) * r;
      }
      emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
      const emberMat = track(
        new THREE.PointsMaterial({
          map: glowTexture,
          color: 0xff6b35,
          size: 0.12,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      scene.add(new THREE.Points(emberGeo, emberMat));
      emberGeoRef = emberGeo;
    }

    // ---------- Bucle ----------
    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;
    let notifiedReady = false;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      controls.update();
      fireUniforms.uTime.value = t;

      if (isCorcel) {
        // Galope en círculo con fase de suspensión
        const a = t * 0.42;
        const stride = t * 9;
        const bounce = Math.abs(Math.sin(stride * 0.5)) * 0.2;
        horse.position.set(Math.cos(a) * 6.5, bounce, Math.sin(a) * 6.5);
        horse.rotation.y = -a + Math.PI / 2;
        // Cabeceo del cuerpo y del cuello al ritmo de la zancada
        horse.rotation.z = Math.sin(stride * 0.5) * 0.055;
        headGroup.rotation.z = Math.sin(stride * 0.5 + Math.PI) * 0.14;
        for (const leg of legs) {
          const ph = stride * 0.5 + leg.phase;
          // Muslo: barrido adelante-atrás
          leg.upper.rotation.z = Math.sin(ph) * (leg.front ? 0.7 : 0.8);
          // Caña: se pliega en la fase de recuperación
          const fold = Math.max(0, Math.sin(ph - 1.1));
          leg.lower.rotation.z = leg.front ? -fold * 1.15 : fold * 0.9 - 0.15;
        }
        // Polvo tras los cascos al pisar
        if (Math.random() < dt * 30) {
          emitTrail(
            horse.position.x - Math.cos(-horse.rotation.y) * 0.7,
            0.12,
            horse.position.z - Math.sin(-horse.rotation.y) * 0.7
          );
        }
      } else {
        // Ascenso en espiral del fénix
        const b = t * 0.35;
        const y = 2.6 + Math.sin(t * 0.22) * 1.4;
        bird.position.set(Math.cos(b) * 3.8, y, Math.sin(b) * 3.8);
        bird.rotation.y = -b + Math.PI;
        bird.rotation.z = Math.sin(t * 0.22) * 0.18;
        const flap = Math.sin(t * 4.6);
        wingFlaps[0].rotation.x = flap * 0.6;
        wingFlaps[1].rotation.x = -flap * 0.6;
        tailFeathers.forEach((feather, i) => {
          feather.rotation.z = -0.12 - i * 0.05 + Math.sin(t * 2.6 + i * 1.3) * 0.13;
        });
        if (birdLight) birdLight.intensity = 12 + flap * 3.5;
        if (Math.random() < dt * 55) {
          emitTrail(
            bird.position.x - Math.cos(-bird.rotation.y + Math.PI) * 1.1,
            bird.position.y - 0.1,
            bird.position.z - Math.sin(-bird.rotation.y + Math.PI) * 1.1
          );
        }
        if (emberGeoRef) {
          const ep = emberGeoRef.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < ep.count; i++) {
            let py = ep.getY(i) + dt * (0.25 + (i % 5) * 0.1);
            if (py > 8) py = 0;
            ep.setY(i, py);
          }
          ep.needsUpdate = true;
        }
      }

      // Estela compartida
      for (let i = 0; i < TRAIL_N; i++) {
        if (trailLife[i] < 2) {
          trailLife[i] += dt;
          trailPositions[i * 3] += trailVel[i * 3] * dt;
          trailPositions[i * 3 + 1] += trailVel[i * 3 + 1] * dt;
          trailPositions[i * 3 + 2] += trailVel[i * 3 + 2] * dt;
        } else {
          trailPositions[i * 3 + 1] = -50;
        }
      }
      trailGeo.attributes.position.needsUpdate = true;

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
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      bloomPass?.dispose();
      composer?.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [variant]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

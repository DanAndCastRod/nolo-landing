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
 * - "corcel": llanura nocturna azul con un corcel galopando en círculo
 *   bajo una luna enorme, con estela de polvo.
 * - "phoenix": páramo de brasas con un ave de fuego ascendiendo en espiral,
 *   dejando un rastro de partículas incandescentes.
 * Comparten la infraestructura (render, controles, visibilidad, limpieza).
 */
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

    // Bloom en desktop: la luna y el fuego resplandecen
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isCoarse) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        isCorcel ? 0.35 : 0.7,
        0.6,
        isCorcel ? 0.75 : 0.55
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, isCorcel ? 1 : 2.4, 0);
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
              size: 0.55,
              sizeAttenuation: true,
              fog: false,
              transparent: true,
              opacity: isCorcel ? 0.9 : 0.5,
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
    } else {
      scene.add(new THREE.HemisphereLight(0x4a2410, 0x140a05, 0.7));
    }

    // ---------- Corcel: luna gigante y silueta a contraluz ----------
    const horse = new THREE.Group();
    const horseLegs: THREE.Mesh[] = [];
    let horseTail: THREE.Mesh | null = null;
    // Polvo / estela compartida (polvo azul o fuego)
    const TRAIL_N = isCoarse ? 90 : 150;
    const trailGeo = track(new THREE.BufferGeometry());
    const trailPositions = new Float32Array(TRAIL_N * 3);
    const trailLife = new Float32Array(TRAIL_N).fill(99);
    const trailVel = new Float32Array(TRAIL_N * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = track(
      new THREE.PointsMaterial({
        map: glowTexture,
        color: isCorcel ? 0x5f7db8 : 0xff6b35,
        size: isCorcel ? 0.3 : 0.22,
        transparent: true,
        opacity: isCorcel ? 0.35 : 0.7,
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
      trailVel[i * 3 + 1] = isCorcel ? 0.3 + Math.random() * 0.4 : -(0.2 + Math.random() * 0.3);
      trailVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    };

    if (isCorcel) {
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

      // El corcel (silueta oscura con canto de luna)
      horse.scale.setScalar(1.45);
      const mat = track(
        new THREE.MeshStandardMaterial({ color: 0x16233f, roughness: 0.75 })
      );
      const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.28, 0.75, 4, 10)), mat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 1.05;
      horse.add(body);
      const chest = new THREE.Mesh(track(new THREE.SphereGeometry(0.3, 10, 10)), mat);
      chest.position.set(0.42, 1.1, 0);
      horse.add(chest);
      const neck = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.14, 0.42, 4, 8)), mat);
      neck.position.set(0.62, 1.5, 0);
      neck.rotation.z = -0.7;
      horse.add(neck);
      const head = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8)), mat);
      head.position.set(0.92, 1.78, 0);
      head.rotation.z = Math.PI / 2 - 0.35;
      horse.add(head);
      const earGeo = track(new THREE.ConeGeometry(0.035, 0.12, 4));
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, mat);
        ear.position.set(0.82, 1.95, side * 0.06);
        horse.add(ear);
      }
      // Crin al viento
      const mane = new THREE.Mesh(track(new THREE.ConeGeometry(0.1, 0.55, 5)), mat);
      mane.position.set(0.5, 1.68, 0);
      mane.rotation.z = 2.4;
      horse.add(mane);
      // Cola
      horseTail = new THREE.Mesh(track(new THREE.ConeGeometry(0.09, 0.7, 5)), mat);
      horseTail.position.set(-0.62, 1.15, 0);
      horseTail.rotation.z = 2.0;
      horse.add(horseTail);
      // Patas con articulación simple
      const legGeo = track(new THREE.CapsuleGeometry(0.05, 0.62, 4, 6));
      legGeo.translate(0, -0.36, 0);
      for (const [lx, lz] of [
        [0.4, 0.14],
        [0.4, -0.14],
        [-0.38, 0.14],
        [-0.38, -0.14],
      ]) {
        const leg = new THREE.Mesh(legGeo, mat);
        leg.position.set(lx, 1.0, lz);
        horse.add(leg);
        horseLegs.push(leg);
      }
      scene.add(horse);
    }

    // ---------- Phoenix: ave de fuego ----------
    const bird = new THREE.Group();
    const wings: THREE.Group[] = [];
    const tailFeathers: THREE.Mesh[] = [];
    let birdLight: THREE.PointLight | null = null;
    if (!isCorcel) {
      const fireMat = track(
        new THREE.MeshBasicMaterial({
          color: 0xffb347,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      const wingMat = track(
        new THREE.MeshBasicMaterial({
          color: 0xff8c3a,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.14, 0.55, 4, 10)), fireMat);
      body.rotation.z = Math.PI / 2;
      bird.add(body);
      const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 8, 8)), fireMat);
      head.position.set(0.42, 0.06, 0);
      bird.add(head);
      const beak = new THREE.Mesh(track(new THREE.ConeGeometry(0.04, 0.14, 4)), fireMat);
      beak.position.set(0.56, 0.05, 0);
      beak.rotation.z = -Math.PI / 2;
      bird.add(beak);
      const crest = new THREE.Mesh(track(new THREE.ConeGeometry(0.04, 0.2, 4)), wingMat);
      crest.position.set(0.38, 0.2, 0);
      crest.rotation.z = 0.6;
      bird.add(crest);

      const wingGeo = track(new THREE.PlaneGeometry(1.5, 0.55, 4, 1));
      {
        const wp = wingGeo.attributes.position;
        for (let i = 0; i < wp.count; i++) {
          // Afila la punta del ala
          const x = wp.getX(i);
          wp.setY(i, wp.getY(i) * (1 - Math.abs(x) / 1.9));
        }
      }
      for (const side of [-1, 1]) {
        const wing = new THREE.Group();
        const mesh = new THREE.Mesh(wingGeo, wingMat);
        mesh.position.z = side * 0.78;
        mesh.rotation.x = Math.PI / 2;
        wing.add(mesh);
        wing.position.set(0.05, 0.05, 0);
        bird.add(wing);
        wings.push(wing);
      }
      const featherGeo = track(new THREE.PlaneGeometry(1.1, 0.09));
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(featherGeo, wingMat);
        feather.position.set(-0.85, 0, (i - 1) * 0.12);
        feather.rotation.y = (i - 1) * 0.25;
        bird.add(feather);
        tailFeathers.push(feather);
      }
      const glow = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xff8c3a,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      glow.scale.setScalar(2.6);
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
      // Guardamos referencia para animar en el loop
      (bird.userData as { emberGeo?: THREE.BufferGeometry }).emberGeo = emberGeo;
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

      if (isCorcel) {
        // Galope en círculo alrededor del claro
        const a = t * 0.42;
        const stride = t * 9;
        const bounce = Math.abs(Math.sin(stride)) * 0.14;
        horse.position.set(Math.cos(a) * 6.5, bounce, Math.sin(a) * 6.5);
        horse.rotation.y = -a - Math.PI / 2 + Math.PI;
        horseLegs.forEach((leg, i) => {
          const phase = i < 2 ? 0 : Math.PI * 0.9;
          leg.rotation.z = Math.sin(stride + phase + (i % 2) * 0.4) * 0.75;
        });
        if (horseTail) horseTail.rotation.z = 2.0 + Math.sin(stride * 0.5) * 0.15;
        // Polvo tras los cascos
        if (Math.random() < dt * 30) {
          emitTrail(
            horse.position.x - Math.cos(-horse.rotation.y) * 0.5,
            0.15,
            horse.position.z - Math.sin(-horse.rotation.y) * 0.5
          );
        }
      } else {
        // Ascenso en espiral del fénix
        const b = t * 0.35;
        const y = 2.6 + Math.sin(t * 0.22) * 1.4;
        bird.position.set(Math.cos(b) * 3.8, y, Math.sin(b) * 3.8);
        bird.rotation.y = -b - Math.PI / 2 + Math.PI;
        bird.rotation.z = Math.sin(t * 0.22) * 0.18;
        const flap = Math.sin(t * 5.2);
        wings[0].rotation.x = flap * 0.55;
        wings[1].rotation.x = -flap * 0.55;
        tailFeathers.forEach((feather, i) => {
          feather.rotation.z = Math.sin(t * 3 + i) * 0.15;
        });
        if (birdLight) birdLight.intensity = 12 + flap * 3;
        if (Math.random() < dt * 40) {
          emitTrail(
            bird.position.x - Math.cos(-bird.rotation.y) * 0.9,
            bird.position.y,
            bird.position.z - Math.sin(-bird.rotation.y) * 0.9
          );
        }
        // Brasas del páramo subiendo
        const emberGeo = (bird.userData as { emberGeo?: THREE.BufferGeometry }).emberGeo;
        if (emberGeo) {
          const ep = emberGeo.attributes.position as THREE.BufferAttribute;
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
          trailPositions[i * 3 + 1] = -50; // fuera de vista
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

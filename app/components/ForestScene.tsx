"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Bosque nocturno interactivo: fogata con llamas, chispas y humo, árboles
 * low-poly instanciados, luciérnagas, luna y cielo estrellado. Todo es
 * procedural (sin cargar modelos ni texturas) para que pese poco y cargue
 * rápido tanto en desktop como en mobile.
 */
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
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a16);
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

    // ---------- Luces ----------
    scene.add(new THREE.HemisphereLight(0x2a3b6e, 0x0c1408, 0.5));

    const moonLight = new THREE.DirectionalLight(0x8fa8ff, 0.35);
    moonLight.position.set(-30, 40, -20);
    scene.add(moonLight);

    const fireLight = new THREE.PointLight(0xff6b35, 30, 40, 2);
    fireLight.position.set(0, 1.2, 0);
    scene.add(fireLight);

    // ---------- Cielo: estrellas y luna ----------
    {
      const starCount = 900;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 90 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.95); // hemisferio superior
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi) + 2;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = track(
        new THREE.PointsMaterial({
          color: 0xcdd8ff,
          size: 0.55,
          sizeAttenuation: true,
          fog: false,
          transparent: true,
          opacity: 0.9,
        })
      );
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

    // ---------- Suelo con relieve suave ----------
    {
      const geo = track(new THREE.PlaneGeometry(140, 140, 72, 72));
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const dist = Math.hypot(x, y);
        const flatten = THREE.MathUtils.smoothstep(dist, 4, 14); // claro plano junto al fuego
        const bump =
          Math.sin(x * 0.35) * Math.cos(y * 0.3) * 0.5 +
          Math.sin(x * 0.09 + y * 0.13) * 1.1;
        pos.setZ(i, bump * flatten);
      }
      geo.computeVertexNormals();
      const mat = track(
        new THREE.MeshStandardMaterial({ color: 0x17251a, roughness: 1 })
      );
      const ground = new THREE.Mesh(geo, mat);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
    }

    // ---------- Bosque de pinos (instanciado) ----------
    {
      const TREES = isCoarse ? 90 : 140;
      const trunkGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 1, 6));
      trunkGeo.translate(0, 0.5, 0);
      const trunkMat = track(
        new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 })
      );
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);

      const layers = [
        { radius: 1.15, height: 1.7, y: 0.9, color: 0x14351f },
        { radius: 0.9, height: 1.5, y: 1.75, color: 0x1a4327 },
        { radius: 0.62, height: 1.3, y: 2.6, color: 0x225231 },
      ].map((l) => {
        const geo = track(new THREE.ConeGeometry(l.radius, l.height, 7));
        geo.translate(0, l.y + l.height / 2, 0);
        const mat = track(
          new THREE.MeshStandardMaterial({ color: l.color, roughness: 1 })
        );
        return new THREE.InstancedMesh(geo, mat, TREES);
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

    // ---------- Fogata: piedras, troncos y llamas ----------
    {
      // Anillo de piedras
      const STONES = 11;
      const stoneGeo = track(new THREE.DodecahedronGeometry(0.22, 0));
      const stoneMat = track(
        new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.95 })
      );
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, STONES);
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

    // Troncos cruzados y brasas
    {
      const logGeo = track(new THREE.CylinderGeometry(0.11, 0.13, 1.5, 6));
      const logMat = track(
        new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 })
      );
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        const a = (i / 5) * Math.PI * 2;
        log.position.set(Math.cos(a) * 0.28, 0.32, Math.sin(a) * 0.28);
        log.rotation.z = Math.PI / 2.6;
        log.rotation.y = -a + Math.PI / 2;
        scene.add(log);
      }
      // Brasas
      const embers = new THREE.Mesh(
        track(new THREE.CircleGeometry(0.55, 16)),
        track(
          new THREE.MeshBasicMaterial({
            color: 0xff5a1f,
            transparent: true,
            opacity: 0.8,
          })
        )
      );
      embers.rotation.x = -Math.PI / 2;
      embers.position.y = 0.06;
      scene.add(embers);
    }

    // Llamas: tres conos aditivos que ondulan a distinto ritmo
    const flames: THREE.Mesh[] = [];
    {
      const flameSpecs = [
        { r: 0.42, h: 1.5, color: 0xe0491f, opacity: 0.55 },
        { r: 0.3, h: 1.15, color: 0xff6b35, opacity: 0.7 },
        { r: 0.18, h: 0.8, color: 0xfbbf24, opacity: 0.9 },
      ];
      for (const spec of flameSpecs) {
        const geo = track(new THREE.ConeGeometry(spec.r, spec.h, 8));
        geo.translate(0, spec.h / 2, 0);
        const mat = track(
          new THREE.MeshBasicMaterial({
            color: spec.color,
            transparent: true,
            opacity: spec.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        const flame = new THREE.Mesh(geo, mat);
        flame.position.y = 0.25;
        scene.add(flame);
        flames.push(flame);
      }
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
    const SPARKS = 70;
    const sparkData = new Float32Array(SPARKS * 4); // vx, vy, vz, vida
    const sparkGeo = track(new THREE.BufferGeometry());
    const sparkPositions = new Float32Array(SPARKS * 3);
    const resetSpark = (i: number) => {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 1] = 0.3 + Math.random() * 0.3;
      sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      sparkData[i * 4] = (Math.random() - 0.5) * 0.5;
      sparkData[i * 4 + 1] = 1.2 + Math.random() * 1.6;
      sparkData[i * 4 + 2] = (Math.random() - 0.5) * 0.5;
      sparkData[i * 4 + 3] = Math.random() * 2; // desfase inicial de vida
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

      // Llamas: parpadeo y ondulación
      flames.forEach((flame, i) => {
        const speed = 7 + i * 3;
        const flick =
          1 +
          Math.sin(t * speed + i * 1.7) * 0.08 +
          Math.sin(t * speed * 2.3 + i) * 0.05;
        flame.scale.set(
          1 + Math.sin(t * 5 + i * 2) * 0.08,
          flick,
          1 + Math.cos(t * 6 + i) * 0.08
        );
        flame.rotation.y = t * (0.6 + i * 0.3);
        flame.position.x = Math.sin(t * 3.2 + i) * 0.04;
        flame.position.z = Math.cos(t * 2.7 + i * 2) * 0.04;
      });

      // Luz del fuego: parpadeo natural
      fireLight.intensity =
        26 + Math.sin(t * 11) * 3 + Math.sin(t * 23 + 1.3) * 2 + Math.random() * 2;
      fireLight.position.x = Math.sin(t * 7.3) * 0.06;
      fireLight.position.z = Math.cos(t * 6.1) * 0.06;

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
        sprite.position.y += dt * (0.5 + seed * 0.4);
        if (sprite.position.y > 6) sprite.position.y = 1;
        const life = (sprite.position.y - 1) / 5;
        sprite.position.x = Math.sin(t * 0.7 + seed * 20) * (0.2 + life * 0.9);
        sprite.position.z = Math.cos(t * 0.6 + seed * 17) * (0.2 + life * 0.9);
        sprite.scale.setScalar(0.7 + life * 2.4);
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
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Flame, Volume2, VolumeX, Move3d } from "lucide-react";
import type { CampfireAudio } from "../lib/campfire-audio";

const ForestScene = dynamic(() => import("./ForestScene"), { ssr: false });

/**
 * El Ritual de la Fogata: experiencia 3D inmersiva del álbum I.
 * Monta la escena solo cuando el usuario se acerca (IntersectionObserver)
 * y gestiona el audio de la fogata, que se crea dentro del click para
 * respetar las políticas de autoplay.
 */
export default function ForestSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const audioRef = useRef<CampfireAudio | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onStoke = () => audioRef.current?.stoke();
    window.addEventListener("nolo:fire-stoke", onStoke);
    return () => {
      window.removeEventListener("nolo:fire-stoke", onStoke);
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const toggleSound = async () => {
    if (!audioRef.current) {
      const { CampfireAudio } = await import("../lib/campfire-audio");
      audioRef.current = new CampfireAudio();
    }
    if (soundOn) {
      audioRef.current.pause();
      setSoundOn(false);
    } else {
      await audioRef.current.resume();
      setSoundOn(true);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="fogata-ritual"
      aria-label="El ritual de la fogata: bosque interactivo en 3D"
      className="relative h-[100svh] w-full overflow-hidden bg-nolo-void"
    >
      {mounted && <ForestScene onReady={() => setReady(true)} />}

      {/* Pantalla de carga */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-nolo-void transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <Flame className="h-10 w-10 animate-pulse text-nolo-fogata" />
        <p className="font-label text-xs uppercase tracking-[0.2em] text-gray-400">
          Encendiendo la fogata…
        </p>
      </div>

      {/* Degradados para integrar la escena con el resto de la página */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-nolo-void to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-nolo-void to-transparent" />

      {/* Título de la sección */}
      <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex flex-col items-center gap-3 px-6 text-center">
        <span className="font-label text-xs uppercase tracking-widest text-nolo-fogata">
          Ritual I — Fogata
        </span>
        <h2 className="font-display text-4xl uppercase text-white drop-shadow-lg sm:text-6xl">
          El Refugio
        </h2>
        <p className="font-hand text-base text-white/80 sm:text-xl">
          &ldquo;Si arde, es porque estás vivo.&rdquo;
        </p>
      </div>

      {/* Controles y ayuda */}
      <div className="absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-4 px-6">
        <div className="pointer-events-none flex items-center gap-3 border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
          <Move3d className="h-4 w-4 shrink-0 text-nolo-fogata" />
          <span className="hidden font-label text-xs uppercase tracking-widest text-gray-300 sm:inline">
            Arrastra para mirar · rueda para acercarte · toca la fogata para avivarla
          </span>
          <span className="font-label text-xs uppercase tracking-widest text-gray-300 sm:hidden">
            Desliza · pellizca · toca el fuego para avivarlo
          </span>
        </div>
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          className={`flex items-center gap-3 border px-6 py-3 font-label text-xs font-bold uppercase tracking-[0.2em] backdrop-blur transition-colors ${
            soundOn
              ? "border-nolo-fogata bg-nolo-fogata/20 text-nolo-fogata"
              : "border-white/30 bg-black/40 text-white hover:bg-white hover:text-black"
          }`}
        >
          {soundOn ? (
            <>
              <Volume2 className="h-4 w-4" /> Silenciar fogata
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4" /> Escuchar la fogata
            </>
          )}
        </button>
      </div>
    </section>
  );
}

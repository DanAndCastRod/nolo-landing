"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Flame, Volume2, VolumeX, Move3d } from "lucide-react";
import type { CampfireAudio } from "../lib/campfire-audio";

const ForestScene = dynamic(() => import("./ForestScene"), { ssr: false });

/**
 * Sección inmersiva del bosque: monta la escena 3D solo cuando el usuario
 * se acerca (IntersectionObserver) y gestiona el audio de la fogata, que
 * se crea dentro del click para respetar las políticas de autoplay.
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
    return () => {
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
      id="bosque"
      aria-label="Bosque interactivo en 3D con fogata"
      className="relative h-[100svh] w-full overflow-hidden bg-[#060a16]"
    >
      {mounted && <ForestScene onReady={() => setReady(true)} />}

      {/* Pantalla de carga */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#060a16] transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <Flame className="h-10 w-10 animate-pulse text-orange-400" />
        <p className="text-sm text-slate-400">Encendiendo la fogata…</p>
      </div>

      {/* Degradados para integrar la escena con el resto de la página */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#060a16] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#060a16] to-transparent" />

      {/* Título de la sección */}
      <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex flex-col items-center gap-2 px-6 text-center">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-orange-200/90 backdrop-blur">
          Experiencia inmersiva
        </span>
        <h2 className="text-3xl font-semibold text-white drop-shadow-lg sm:text-4xl">
          Una noche junto al fuego
        </h2>
      </div>

      {/* Controles y ayuda */}
      <div className="absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-4 px-6">
        <div className="pointer-events-none flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-slate-300 backdrop-blur sm:text-sm">
          <Move3d className="h-4 w-4 shrink-0 text-orange-300" />
          <span className="hidden sm:inline">
            Arrastra para mirar alrededor · usa la rueda para acercarte al fuego
          </span>
          <span className="sm:hidden">
            Desliza para mirar · pellizca para acercarte
          </span>
        </div>
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors ${
            soundOn
              ? "border-orange-400/60 bg-orange-500/20 text-orange-100"
              : "border-white/15 bg-black/40 text-slate-200 hover:bg-black/60"
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

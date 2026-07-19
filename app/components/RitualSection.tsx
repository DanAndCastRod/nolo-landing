"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Bird, Moon, Move3d } from "lucide-react";

const RitualScene = dynamic(() => import("./RitualScene"), { ssr: false });

const CONTENT = {
  corcel: {
    id: "corcel-ritual",
    label: "Ritual II — Corcel",
    title: "La Batalla",
    quote: "“Seguir en movimiento aun cuando el camino arde.”",
    accent: "text-nolo-corcel",
    icon: Moon,
    loading: "Ensillando el corcel…",
  },
  phoenix: {
    id: "phoenix-ritual",
    label: "Ritual III — Phoenix",
    title: "Renacer",
    quote: "“Morir para volver a encender las alas.”",
    accent: "text-nolo-phoenix",
    icon: Bird,
    loading: "Encendiendo las alas…",
  },
} as const;

/** Sección inmersiva de los rituales II y III, con carga diferida. */
export default function RitualSection({
  variant,
}: {
  variant: keyof typeof CONTENT;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const content = CONTENT[variant];
  const Icon = content.icon;

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

  return (
    <section
      ref={sectionRef}
      id={content.id}
      aria-label={`${content.label}: escena interactiva en 3D`}
      className="relative h-[100svh] w-full overflow-hidden bg-nolo-void"
    >
      {mounted && <RitualScene variant={variant} onReady={() => setReady(true)} />}

      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-nolo-void transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <Icon className={`h-10 w-10 animate-pulse ${content.accent}`} />
        <p className="font-label text-xs uppercase tracking-[0.2em] text-gray-400">
          {content.loading}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-nolo-void to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-nolo-void to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex flex-col items-center gap-3 px-6 text-center">
        <span className={`font-label text-xs uppercase tracking-widest ${content.accent}`}>
          {content.label}
        </span>
        <h2 className="font-display text-4xl uppercase text-white drop-shadow-lg sm:text-6xl">
          {content.title}
        </h2>
        <p className="font-hand text-base text-white/80 sm:text-xl">{content.quote}</p>
      </div>

      <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center px-6">
        <div className="pointer-events-none flex items-center gap-3 border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
          <Move3d className={`h-4 w-4 shrink-0 ${content.accent}`} />
          <span className="font-label text-xs uppercase tracking-widest text-gray-300">
            Arrastra para mirar · rueda o pellizca para acercarte
          </span>
        </div>
      </div>
    </section>
  );
}

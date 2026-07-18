"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Play } from "lucide-react";

type Album = {
  id: string;
  numeral: string;
  tab: string;
  title: string;
  quote: string;
  cover: string;
  coverAlt: string;
  accentText: string;
  activeTab: string;
  trackHover: string;
  tracks: { name: string; duration: string }[];
};

const ALBUMS: Album[] = [
  {
    id: "fogata",
    numeral: "I",
    tab: "I. Fogata",
    title: "El Refugio",
    quote: "“El regreso a la raíz. Un llamado al pulso de la tierra.”",
    cover: "/assets/fogata_portada.png",
    coverAlt: "Portada del álbum Fogata",
    accentText: "text-nolo-fogata",
    activeTab:
      "data-[state=active]:border-nolo-fogata data-[state=active]:text-nolo-fogata",
    trackHover:
      "group-hover/track:border-nolo-fogata group-hover/track:text-nolo-fogata",
    tracks: [
      { name: "01. Cenizas (Intro)", duration: "03:42" },
      { name: "02. Madera Seca", duration: "04:15" },
    ],
  },
  {
    id: "corcel",
    numeral: "II",
    tab: "II. Corcel",
    title: "La Batalla",
    quote: "“Resistencia pura. Seguir en movimiento aun cuando el camino arde.”",
    cover: "/assets/corcel_portada.png",
    coverAlt: "Portada del álbum Corcel",
    accentText: "text-nolo-corcel",
    activeTab:
      "data-[state=active]:border-nolo-corcel data-[state=active]:text-nolo-corcel",
    trackHover:
      "group-hover/track:border-nolo-corcel group-hover/track:text-nolo-corcel",
    tracks: [
      { name: "01. Galope", duration: "03:10" },
      { name: "02. Azul Profundo", duration: "05:01" },
    ],
  },
  {
    id: "phoenix",
    numeral: "III",
    tab: "III. Phoenix",
    title: "Renacer",
    quote: "“Morir para volver a encender las alas. Oro líquido.”",
    cover: "/assets/phoenix_portada.png",
    coverAlt: "Portada del álbum Phoenix",
    accentText: "text-nolo-phoenix",
    activeTab:
      "data-[state=active]:border-nolo-phoenix data-[state=active]:text-nolo-phoenix",
    trackHover:
      "group-hover/track:border-nolo-phoenix group-hover/track:text-nolo-phoenix",
    tracks: [{ name: "01. Alas de Fuego", duration: "04:20" }],
  },
];

export default function TrilogyTabs() {
  return (
    <Tabs.Root defaultValue="fogata">
      <Tabs.List className="no-scrollbar mb-12 flex overflow-x-auto border-b border-white/10 md:justify-center">
        {ALBUMS.map((album) => (
          <Tabs.Trigger
            key={album.id}
            value={album.id}
            className={`whitespace-nowrap border-b-2 border-transparent px-6 py-3 font-display text-lg uppercase tracking-widest text-white/40 transition-all hover:text-white md:px-8 md:py-4 md:text-xl ${album.activeTab}`}
          >
            {album.tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {ALBUMS.map((album) => (
        <Tabs.Content
          key={album.id}
          value={album.id}
          className="animate-fade-in grid gap-12 md:grid-cols-2"
        >
          <div className="group relative overflow-hidden border border-white/5 bg-neutral-900 p-8">
            <div
              className={`pointer-events-none absolute right-0 top-0 select-none p-4 font-display text-9xl font-bold opacity-20 transition-opacity group-hover:opacity-40 ${album.accentText}`}
            >
              {album.numeral}
            </div>
            <h3 className={`mb-2 font-display text-4xl ${album.accentText}`}>
              {album.title}
            </h3>
            <p className="mb-8 italic text-gray-400">{album.quote}</p>
            <ul className="space-y-4">
              {album.tracks.map((track) => (
                <li
                  key={track.name}
                  className="group/track flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/20 ${album.trackHover}`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </span>
                    <span className="font-label text-sm">{track.name}</span>
                  </div>
                  <span className="text-xs text-white/30">{track.duration}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="group relative h-96 overflow-hidden border border-white/10 md:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={album.cover}
              alt={album.coverAlt}
              className="h-full w-full object-cover opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

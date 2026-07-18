"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#origen", label: "Origen", underline: "bg-nolo-fogata" },
  { href: "#trilogia", label: "Trilogía", underline: "bg-nolo-corcel" },
  { href: "#fogata-ritual", label: "La Fogata", underline: "bg-nolo-phoenix" },
  { href: "#rituales", label: "Rituales", underline: "bg-nolo-fogata" },
  { href: "#prensa", label: "Prensa", underline: "bg-nolo-corcel" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-nolo-void/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-20 items-center justify-between">
          <a href="#" className="group flex items-center gap-2">
            <span className="font-display text-2xl tracking-tighter text-white transition-all group-hover:bg-gradient-to-r group-hover:from-nolo-fogata group-hover:to-nolo-phoenix group-hover:bg-clip-text group-hover:text-transparent">
              NOLO CHAVES
            </span>
          </a>

          <div className="hidden space-x-12 md:flex">
            {LINKS.map(({ href, label, underline }) => (
              <a
                key={href}
                href={href}
                className="group relative text-xs font-bold uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-white"
              >
                <span className="relative z-10">{label}</span>
                <span
                  className={`absolute -bottom-1 left-0 h-[2px] w-0 transition-all duration-300 group-hover:w-full ${underline}`}
                />
              </a>
            ))}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="text-white focus:outline-none md:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            {open ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-nolo-void/95 md:hidden">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

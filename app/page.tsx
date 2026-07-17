import { Flame, Headphones, MousePointerClick, Smartphone, Sparkles, TreePine } from "lucide-react";
import ForestSection from "./components/ForestSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#060a16] text-slate-100">
      {/* Navegación */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#060a16]/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <TreePine className="h-5 w-5 text-emerald-400" />
            Nolo
          </a>
          <div className="hidden items-center gap-8 text-sm text-slate-300 sm:flex">
            <a href="#bosque" className="transition-colors hover:text-white">
              El bosque
            </a>
            <a href="#experiencia" className="transition-colors hover:text-white">
              Experiencia
            </a>
          </div>
          <a
            href="#bosque"
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400"
          >
            Entrar al bosque
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#16234a_0%,#060a16_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-[120vw] -translate-x-1/2 rounded-[100%] bg-orange-500/10 blur-3xl"
        />
        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-widest text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Ahora con una experiencia 3D interactiva
          </span>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            Detén el ruido.
            <br />
            <span className="bg-gradient-to-r from-orange-300 via-amber-200 to-emerald-300 bg-clip-text text-transparent">
              Escucha el bosque.
            </span>
          </h1>
          <p className="max-w-xl text-pretty text-base text-slate-400 sm:text-lg">
            Nolo te lleva a un claro en medio del bosque, de noche, junto a una
            fogata encendida. Explora la escena en 3D, escucha el crepitar del
            fuego y quédate el tiempo que necesites.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#bosque"
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-7 py-3 font-medium text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-orange-400"
            >
              <Flame className="h-4 w-4" />
              Explorar el bosque
            </a>
            <a
              href="#experiencia"
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3 font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              Cómo funciona
            </a>
          </div>
        </div>
        <a
          href="#bosque"
          aria-hidden
          className="absolute bottom-8 z-10 animate-bounce text-slate-500"
        >
          ↓
        </a>
      </section>

      {/* Sección 3D: bosque con fogata */}
      <ForestSection />

      {/* Experiencia */}
      <section id="experiencia" className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="mb-14 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Una pausa hecha a mano
          </h2>
          <p className="max-w-2xl text-slate-400">
            Cada detalle de la escena —los árboles, las llamas, las luciérnagas
            y hasta el sonido— se genera en tiempo real en tu navegador. Sin
            descargas, sin esperas.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: MousePointerClick,
              title: "Navegación libre",
              body: "Gira alrededor de la fogata, acércate a las llamas o aléjate hacia los árboles. Con mouse en desktop y gestos táctiles en mobile.",
            },
            {
              icon: Headphones,
              title: "Sonido envolvente",
              body: "El crepitar de la leña y el viento entre los pinos se sintetizan al momento. Actívalo con un toque y ponte los audífonos.",
            },
            {
              icon: Smartphone,
              title: "Ligera y fluida",
              body: "La escena está optimizada para funcionar con suavidad en celulares: solo se renderiza cuando la tienes a la vista.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-orange-400/30 hover:bg-white/[0.05]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15">
                <Icon className="h-5 w-5 text-orange-300" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,#2a1608_0%,#060a16_65%)]"
        />
        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-6">
          <Flame className="h-8 w-8 text-orange-400" />
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            La fogata ya está encendida
          </h2>
          <p className="text-slate-400">
            Vuelve arriba cuando quieras: el bosque te espera a cualquier hora.
          </p>
          <a
            href="#bosque"
            className="rounded-full bg-orange-500 px-8 py-3 font-medium text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-orange-400"
          >
            Volver al bosque
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <span className="flex items-center gap-2">
            <TreePine className="h-4 w-4 text-emerald-500" />
            Nolo © {new Date().getFullYear()}
          </span>
          <span>Hecho con Three.js y Web Audio</span>
        </div>
      </footer>
    </div>
  );
}

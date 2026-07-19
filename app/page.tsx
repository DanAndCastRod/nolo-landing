/* eslint-disable @next/next/no-img-element */
import SiteNav from "./components/SiteNav";
import TrilogyTabs from "./components/TrilogyTabs";
import ForestSection from "./components/ForestSection";
import RitualSection from "./components/RitualSection";

const WAVE_FOGATA =
  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDEyMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMGgwdjYwaDEyMDBWNDBsLTEyMDAgMjB6IiBmaWxsPSIjZmY2YjM1IiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4=')";
const WAVE_CORCEL =
  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDEyMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTIwVjEwMGgxMjAwdjEwbC0xMjAwIDEweiIgZmlsbD0iIzFlM2E4YSIgb3BhY2l0eT0iMC4zIi8+PC9zdmc+')";

export default function Home() {
  return (
    <div className="min-h-screen bg-nolo-void text-nolo-light">
      {/* Grano análogo global */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-[100] opacity-20 mix-blend-overlay" />

      <SiteNav />

      {/* Hero: Fábrica de Sonidos */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 bg-nolo-void/40 mix-blend-multiply" />
          <img
            src="/assets/sound_factory.png"
            alt="Fábrica de Sonidos"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Ondas animadas */}
        <div className="absolute inset-0 z-0 opacity-30">
          <div
            className="animate-wave-slow absolute left-0 top-1/2 h-64 w-[200%] bg-repeat-x"
            style={{ backgroundImage: WAVE_FOGATA }}
          />
          <div
            className="animate-wave-fast absolute left-0 top-1/2 h-64 w-[200%] bg-repeat-x mix-blend-screen"
            style={{ backgroundImage: WAVE_CORCEL }}
          />
        </div>

        <div className="relative z-10 mt-16 flex h-full flex-col items-center justify-center px-4 text-center md:mt-0">
          <div className="flex flex-col items-center">
            <div className="relative z-20 w-full max-w-[260px] transition-transform duration-500 hover:scale-105 md:mb-[-5.5rem] md:max-w-[540px]">
              <img
                src="/assets/nolo_wordmark_v1.png"
                alt="NOLO"
                className="h-auto w-full object-contain brightness-0 invert drop-shadow-2xl"
              />
            </div>
            <h1 className="relative z-10 font-display text-5xl uppercase leading-none tracking-tight text-white md:text-[7rem]">
              Chaves
            </h1>
          </div>

          <div className="animate-fade-in-delayed mt-8 flex flex-col items-center gap-6">
            <p className="font-subtitle text-lg font-light italic text-nolo-light/90 md:text-2xl">
              Folk Alternativo <span className="mx-2 text-nolo-fogata">|</span>{" "}
              Pereira, Col
            </p>
            <a
              href="#fogata-ritual"
              className="border border-white/30 px-8 py-3 font-label text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
            >
              Vive el ritual en 3D
            </a>
            <div className="h-16 w-[1px] bg-gradient-to-b from-nolo-fogata to-transparent opacity-50" />
          </div>
        </div>
      </section>

      {/* Origen: El Viajero */}
      <section id="origen" className="relative overflow-hidden bg-nolo-ash py-32">
        <div className="absolute inset-0 bg-[url('/assets/lore_traveler.png')] bg-cover bg-fixed bg-center opacity-20 grayscale mix-blend-overlay" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-20 px-6 md:grid-cols-2">
          <div>
            <div className="relative border-2 border-nolo-light/10 p-2">
              <div className="absolute -left-4 -top-4 h-12 w-12 border-l-4 border-t-4 border-nolo-fogata" />
              <div className="group relative aspect-[3/4] overflow-hidden bg-neutral-950">
                <img
                  src="/assets/lore_traveler.png"
                  alt="El Viajero"
                  className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-overlay transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="rotate-90 scale-150 select-none font-display text-9xl font-bold text-white/10">
                    ORIGEN
                  </h3>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 h-12 w-12 border-b-4 border-r-4 border-nolo-phoenix" />
            </div>
          </div>

          <div>
            <h2 className="mb-8 font-display text-6xl uppercase font-bold text-white">
              El Viajero <br />
              <span className="align-top text-4xl text-nolo-fogata">01</span>
            </h2>
            <div className="space-y-6 text-lg font-light leading-relaxed text-gray-300">
              <p>
                <span className="font-bold text-nolo-phoenix">
                  El Rebelde Mágico.
                </span>{" "}
                Un arquetipo forjado en las montañas de los Andes. Nolo Chaves
                no es solo música, es la decisión de dejar de ser víctima para
                convertirse en el héroe de su propia historia.
              </p>
              <p>
                Desde su debut en 2017 en la escena de Pereira, su sonido
                &ldquo;Folk Alternativo&rdquo; con matices Grunge ha sido un
                grito de madera y electricidad. Aquí venimos a desarmar el dolor
                y a volverlo a armar como algo que brilla.
              </p>
              <p className="pt-4 font-hand text-2xl text-white">
                &ldquo;Si arde, es porque estás vivo.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trilogía: El Ciclo del Fuego */}
      <section id="trilogia" className="relative py-24">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-nolo-void via-transparent to-nolo-void" />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <span className="mb-2 block font-label text-xs uppercase tracking-widest text-white/50">
              Discografía Selecta
            </span>
            <h2 className="font-display text-5xl uppercase font-bold text-white md:text-7xl">
              El Ciclo del Fuego
            </h2>
          </div>
          <TrilogyTabs />
        </div>
      </section>

      {/* Los tres rituales: experiencias 3D interactivas */}
      <ForestSection />
      <RitualSection variant="corcel" />
      <RitualSection variant="phoenix" />

      {/* Rituales: fechas y trayectoria */}
      <section
        id="rituales"
        className="relative border-t-2 border-nolo-ash bg-nolo-void py-24"
      >
        <div className="absolute inset-0 bg-[url('/assets/rituales_background.png')] bg-cover bg-center opacity-10 mix-blend-luminosity" />

        <div className="relative z-10 mx-auto max-w-5xl px-6">
          <h2 className="mb-12 select-none text-center font-display text-6xl uppercase font-bold text-nolo-ash opacity-30 md:text-8xl">
            Rituales
          </h2>

          <h3 className="mb-6 border-l-4 border-nolo-phoenix pl-4 font-display text-2xl uppercase text-white">
            Próximos
          </h3>
          <div className="mb-20 space-y-4">
            <div className="group flex flex-col items-center justify-between border-b border-white/10 px-4 py-6 transition-colors hover:bg-white/5 md:flex-row">
              <div className="mb-4 text-center md:mb-0 md:text-left">
                <div className="font-display text-3xl text-white">15 NOV</div>
                <div className="font-label text-sm uppercase tracking-widest text-nolo-fogata">
                  Festival Andantes
                </div>
              </div>
              <div className="font-label text-sm uppercase text-gray-400">
                Pereira, Risaralda
              </div>
              <button className="mt-4 border border-white/30 px-6 py-2 text-xs font-bold uppercase text-white transition-all hover:bg-white hover:text-black md:mt-0">
                Tickets
              </button>
            </div>

            <div className="group flex flex-col items-center justify-between border-b border-white/10 px-4 py-6 transition-colors hover:bg-white/5 md:flex-row">
              <div className="mb-4 text-center md:mb-0 md:text-left">
                <div className="font-display text-3xl text-white">21 DIC</div>
                <div className="font-label text-sm uppercase tracking-widest text-nolo-corcel">
                  Solsticio Fest
                </div>
              </div>
              <div className="font-label text-sm uppercase text-gray-400">
                Manizales, Caldas
              </div>
              <button className="mt-4 border border-white/30 px-6 py-2 text-xs font-bold uppercase text-white transition-all hover:bg-white hover:text-black md:mt-0">
                Sold Out
              </button>
            </div>
          </div>

          <h3 className="mb-6 border-l-4 border-nolo-corcel pl-4 font-display text-2xl uppercase text-white">
            Trayectoria
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                name: "Festival Andantes",
                role: "Organizador & Artista",
                hover: "hover:border-nolo-corcel",
              },
              {
                name: "Solsticio Rock",
                role: "Invitado Especial (Manizales)",
                hover: "hover:border-nolo-phoenix",
              },
              {
                name: "Halloween Party Tour",
                role: "Armenia, Bogotá, Pereira",
                hover: "hover:border-nolo-fogata",
              },
              {
                name: "Emergentes Elementales",
                role: "Cámara de Comercio Pereira",
                hover: "hover:border-white",
              },
            ].map(({ name, role, hover }) => (
              <div
                key={name}
                className={`border border-white/5 bg-white/5 p-6 transition-colors ${hover}`}
              >
                <div className="mb-1 font-display text-xl text-nolo-light">
                  {name}
                </div>
                <div className="font-label text-sm uppercase text-gray-500">
                  {role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prensa / Media Kit */}
      <section
        id="prensa"
        className="relative overflow-hidden border-t-2 border-nolo-ash bg-black py-24"
      >
        <div className="absolute inset-0 bg-[url('/assets/prensa_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-16 px-6 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <span className="mb-4 block font-label text-xs uppercase tracking-widest text-nolo-phoenix">
              Zona de Medios
            </span>
            <h2 className="mb-8 font-display text-6xl uppercase font-bold text-white">
              Prensa & <br /> Recursos
            </h2>
            <p className="mb-8 max-w-md text-lg font-light text-gray-400">
              Descarga el Press Kit oficial, fotos en alta resolución y
              comunicados para difusión. Conoce lo que se dice sobre el
              &ldquo;Rebelde Mágico&rdquo;.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="mailto:nolomeetings@gmail.com?subject=Press%20Kit%20NOLO%20CHAVES"
                className="bg-white px-8 py-4 font-display font-bold uppercase tracking-wider text-black transition-colors hover:bg-nolo-phoenix hover:text-black"
              >
                Solicitar Press Kit
              </a>
              <a
                href="mailto:nolomeetings@gmail.com?subject=Entrevista"
                className="border border-white/30 px-8 py-4 font-display font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
              >
                Solicitar Entrevista
              </a>
            </div>
          </div>

          <div className="order-1 flex justify-center md:order-2 md:justify-end">
            <div className="group relative transition-transform duration-500 hover:-rotate-2">
              <div className="absolute inset-0 bg-nolo-fogata opacity-20 blur-xl transition-opacity group-hover:opacity-40" />
              <img
                src="/assets/nota_prensa.png"
                alt="Nota de prensa destacada"
                className="relative w-72 rotate-3 border-4 border-white/10 shadow-2xl transition-transform duration-500 group-hover:rotate-0 md:w-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <div className="border-t border-white/5 bg-nolo-void py-16 text-center">
        <form className="group relative inline-block w-full max-w-md border-2 border-nolo-ash p-2">
          <input
            type="email"
            placeholder="Únete a la caravana (Email)"
            className="w-full bg-transparent p-3 font-label text-white placeholder-gray-600 focus:outline-none"
          />
          <button
            type="button"
            className="absolute bottom-2 right-2 top-2 bg-nolo-ash px-6 font-bold uppercase text-white transition-colors hover:bg-nolo-phoenix hover:text-nolo-void"
          >
            Join
          </button>
        </form>
      </div>

      {/* Footer */}
      <footer className="border-t border-nolo-ash/30 bg-black py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <span className="mb-2 font-display text-2xl font-bold tracking-tighter text-white">
              NOLO CHAVES
            </span>
            <span className="font-label text-xs text-gray-500">
              nolomeetings@gmail.com
            </span>
            <span className="font-label text-xs text-gray-500">
              (+57) 316 051 1821
            </span>
          </div>
          <div className="flex space-x-6">
            <a
              href="https://www.instagram.com/soynolosoy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 transition-colors hover:text-nolo-fogata"
            >
              Instagram
            </a>
            <a
              href="#"
              className="text-gray-500 transition-colors hover:text-nolo-fogata"
            >
              Spotify
            </a>
            <a
              href="#"
              className="text-gray-500 transition-colors hover:text-nolo-fogata"
            >
              Youtube
            </a>
          </div>
          <p className="font-label text-xs uppercase text-gray-600">
            © {new Date().getFullYear()}. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

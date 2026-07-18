import type { Metadata } from "next";
import {
  Montserrat,
  Oswald,
  Playfair_Display,
  Rock_Salt,
  Uncial_Antiqua,
} from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["200", "400", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "700"],
});

const uncial = Uncial_Antiqua({
  variable: "--font-uncial",
  subsets: ["latin"],
  weight: "400",
});

const rockSalt = Rock_Salt({
  variable: "--font-rock-salt",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "NOLO CHAVES | Fábrica de Sonidos",
  description:
    "Nolo Chaves. Folk Alternativo desde Pereira, Colombia. El Ciclo del Fuego: Fogata, Corcel, Phoenix. Vive el ritual de la fogata en una experiencia 3D interactiva.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body
        className={`${montserrat.variable} ${oswald.variable} ${playfair.variable} ${uncial.variable} ${rockSalt.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

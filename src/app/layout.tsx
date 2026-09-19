import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Mismas fuentes que GastroCore (Inter + JetBrains Mono para números), para
 * que Gastro Central se sienta igual. No hace falta ninguna dependencia
 * nueva: next/font/google ya las trae.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gastro Central",
  description: "Sistema de costeo de recetas multi-marca y multi-sede.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        {/* Aplica el modo oscuro guardado ANTES de pintar, para que no haya
            destello de claro→oscuro al cargar (igual que en GastroCore). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('gc_tema')==='oscuro')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}

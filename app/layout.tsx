import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ACOFI - Evaluación e Ingresos",
  description: "Sistema de Ingreso a Actividades y Evaluación de Ponencias ACOFI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ACOFI App",
  },
};

// Esta configuración optimiza la visualización móvil para que se sienta nativa
export const viewport: Viewport = {
  themeColor: "#c81474",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAPELEC",
  description: "Sistema de gestión de mantenimiento preventivo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

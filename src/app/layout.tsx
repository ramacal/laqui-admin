import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laqui Admin",
  description: "Captura guiada de jugadas por agencia",
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


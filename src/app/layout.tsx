import type { Metadata } from "next";
import { Raleway, Barlow } from "next/font/google";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRTIC Agenda",
  description: "Sistema de reserva de licencias compartidas para cursos y residencias de CRTIC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${raleway.variable} ${barlow.variable} min-h-screen bg-background font-sans antialiased`}
        style={{ fontFamily: "var(--font-raleway), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}

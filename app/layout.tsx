import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Direta Cursos · Gestão Escolar",
  description:
    "Sistema de gestão comercial da Direta Cursos Industriais e Preparatórios — Módulo de Vendas",
  icons: {
    icon: "/logo-direta.png",
    apple: "/logo-direta.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              borderRadius: "0.5rem",
            },
          }}
        />
      </body>
    </html>
  );
}

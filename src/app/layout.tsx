import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Arcoplay — Beach Tennis",
  description: "Gestão de plays e ranking de beach tennis",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} h-full`}>
      <body className="relative flex min-h-full flex-col antialiased">
        <SiteHeader />
        <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}

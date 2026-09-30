import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PaperVars } from "@/components/PaperVars";
import { SITE_URL } from "@/lib/site";

// Korean glyphs come as unicode-range slices; preloading them all would be heavy.
const plexSans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// only for the one word "명함" on the card box label
const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-nserif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "zanviq — Jaemin Seo",
  description: "Jaemin Seo — freelance web and AI development. Portfolio of recent work.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "zanviq — Jaemin Seo",
    description: "Freelance web and AI development. Portfolio of recent work.",
    url: SITE_URL,
    siteName: "zanviq.dev",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} ${notoSerif.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="font-ui">
        <LanguageProvider>
          <PaperVars />
          <Header />
          <main>{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}

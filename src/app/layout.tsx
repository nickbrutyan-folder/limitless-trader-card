import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mdNichrome = localFont({
  src: "../../public/fonts/MDNichrome-Dark.otf",
  variable: "--font-nichrome",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trader Identity | Limitless",
  description: "Discover your trader archetype on Limitless — the prediction market for everything.",
  icons: {
    icon: "/limitless-icon.png",
    apple: "/limitless-icon.png",
  },
  openGraph: {
    title: "Trader Identity | Limitless",
    description: "Discover your trader archetype on Limitless",
    siteName: "Limitless",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trader Identity | Limitless",
    description: "Discover your trader archetype on Limitless",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mdNichrome.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

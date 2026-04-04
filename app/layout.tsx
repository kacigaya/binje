import type { Metadata } from "next";
import { Space_Grotesk, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AdBlockerProvider from "@/components/AdBlockerProvider";

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "b!nje — Stream Movies",
  description:
    "Discover and stream thousands of movies. Your cinematic journey starts here.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} dark`}>
      <body className="min-h-dvh flex flex-col bg-background text-foreground antialiased">
        <AdBlockerProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </AdBlockerProvider>
      </body>
    </html>
  );
}

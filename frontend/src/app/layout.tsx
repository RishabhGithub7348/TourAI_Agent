import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TourGuide AI - Your Personal Travel Companion",
  description: "Experience cities like never before with our AI-powered voice tour guide. Get real-time insights, engaging stories, and personalized recommendations in your native language.",
  keywords: ["AI tour guide", "travel companion", "voice assistant", "city exploration", "travel technology"],
  authors: [{ name: "TourGuide AI" }],
  openGraph: {
    title: "TourGuide AI - Your Personal Travel Companion",
    description: "Experience cities like never before with our AI-powered voice tour guide",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} font-sans antialiased bg-black text-white overflow-x-hidden`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

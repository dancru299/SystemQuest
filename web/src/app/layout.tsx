import type { Metadata } from "next";
import { Cinzel, Cinzel_Decorative, Geist_Mono, Noto_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Nhiem Vu He Thong",
  description: "AI-powered daily quest system for personal plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${notoSans.variable} ${geistMono.variable} ${cinzel.variable} ${cinzelDecorative.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full system-bg" suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Parity — Fair price for tokenized stocks",
    template: "%s · Parity",
  },
  description:
    "Compare bStocks, Ondo, and xStocks on BNB. True price per share, premium vs last close, best spot route.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/parity-logo.svg",
  },
  openGraph: {
    title: "Parity — Fair price for tokenized stocks",
    description:
      "Fair-price router across bStocks, Ondo, and xStocks on BNB Chain.",
    images: [{ url: "/parity-logo.svg" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}

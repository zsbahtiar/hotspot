import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans } from 'next/font/google';
import 'react-tooltip/dist/react-tooltip.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import OfflineBanner from "./components/OfflineBanner";

config.autoAddCss = false;

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta', 
  display: 'swap'
})

export const metadata: Metadata = {
  title: "OLAP Hotspot",
  description: "",
  icons: {
    icon: "/fire.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} ${plusJakarta.variable} antialiased`}
      >
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}

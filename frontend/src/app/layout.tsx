import type { Metadata } from "next";
import { JetBrains_Mono, VT323 } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";

// Workhorse mono — UI, body, code. The app's heritage face, refined.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Signature CRT face — used sparingly for the wordmark and big stamps.
const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
  display: "swap",
});

export const metadata: Metadata = {
  title: "O(1)_PREP // mock interview terminal",
  description:
    "A terminal for grinding coding interviews — problems, mock interviews, voice, and an AI tutor.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${vt323.variable}`}>
      <body>
        <AuthGate>{children}</AuthGate>
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}

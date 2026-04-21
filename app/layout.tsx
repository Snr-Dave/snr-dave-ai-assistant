import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "@xterm/xterm/css/xterm.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Snr-Dave AI Assistant | Command Center",
  description: "Personal AI-powered dashboard with chat interface, GitHub integration, and project management.",
  keywords: ["AI Assistant", "Dashboard", "Next.js", "GitHub", "Command Center"],
  authors: [{ name: "Snr-Dave" }],
}

export const viewport: Viewport = {
  themeColor: "#00d9ff",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}

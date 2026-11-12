import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Task Monitor", description: "Create tasks, record by voice, prove with photos, report in one click" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "light", themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}

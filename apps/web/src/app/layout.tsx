import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SketchForge 3D editor",
  description: "Browser-based SketchForge editor workspace",
  icons: {
    icon: "assets/sketchforge/sketchforge-logo.png",
    apple: "assets/sketchforge/sketchforge-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

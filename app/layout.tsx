import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Engine — Sync Lead Digital",
  description: "Lead generation and CRM for 7 Figures Funding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

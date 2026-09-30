import type { Metadata } from "next";
import "./globals.css";
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: "Rootlink — Knowledge Graph & Trust Verification",
  description: "Track information provenance, verify trust chains, and visualize knowledge connections with AI-powered summarization.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}

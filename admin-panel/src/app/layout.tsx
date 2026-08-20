import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "RedResumes | Admin Control Engine",
  description: "Secure administrative console and support center for RedResumes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100 selection:bg-rose-500/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alumex Plant Maintenance Portal | Extrusion & VPC",
  description: "Industrial Maintenance Portal for Alumex Extrusion (CH/MT/102) and VPC (LS/MT/102)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen overflow-x-hidden w-full max-w-full selection:bg-amber-500 selection:text-slate-950">
        <Toaster richColors position="top-right" closeButton theme="dark" />
        {children}
      </body>
    </html>
  );
}

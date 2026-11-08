import type { Metadata } from "next";
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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="bg-slate-50 text-slate-800 min-h-screen">
        {children}
      </body>
    </html>
  );
}

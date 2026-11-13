import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITStart · Construiește ceva real.",
  description:
    "Comunitatea în care construiești proiecte reale cu AI și le lansezi public.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}

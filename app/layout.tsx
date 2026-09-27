import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HandOver — role-bound undertakings",
  description: "Bind an undertaking to a role, preserve its performance trail, and transfer the seat through GenLayer accepted state.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

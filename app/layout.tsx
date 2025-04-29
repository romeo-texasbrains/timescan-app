import type { Metadata } from "next";
import "./globals.css";
import ClientRootLayout from "@/components/ClientRootLayout";
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "TimeScan - Attendance Tracking",
  description: "Internal employee attendance tracking application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
      </head>
      <body>
        <Toaster position="top-center" reverseOrder={false} />
        <ClientRootLayout
          bodyClassName="font-sans antialiased"
        >
          {children}
        </ClientRootLayout>
      </body>
    </html>
  );
}

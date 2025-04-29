import type { Metadata } from "next";
import "./globals.css";
import ClientRootLayout from "@/components/ClientRootLayout";

export const metadata: Metadata = {
  title: "TimeScan",
  description: "Internal Attendance Tracking App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientRootLayout
      bodyClassName="font-sans antialiased"
    >
      {children}
    </ClientRootLayout>
  );
}

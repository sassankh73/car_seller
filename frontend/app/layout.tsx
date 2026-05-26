import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AutoStudio AI",
  description: "Turn car photos into premium studio shots with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

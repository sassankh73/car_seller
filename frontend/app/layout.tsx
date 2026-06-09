import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AutoStudio — AI Automotive Photography",
  description:
    "Transform your automotive photography with AI-powered studio processing. Background removal, color grading, and professional finishing in seconds.",
  openGraph: {
    title: "AutoStudio — AI Automotive Photography",
    description:
      "Transform your automotive photography with AI-powered studio processing.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AutoStudio",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

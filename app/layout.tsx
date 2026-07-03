import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "clusterscape",
  description: "A 3D explorer for the home cluster — walk around your Kubernetes resources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "CONV_ANSIS", description: "Converter lining scans judged against limits" };

export default function FurnaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

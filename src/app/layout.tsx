import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import "./style.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: "Food Memory",
  description: "Public, first-person food experience records — MVP foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

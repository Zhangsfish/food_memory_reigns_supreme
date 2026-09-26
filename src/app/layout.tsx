import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Food Memory",
  description: "Public, first-person food experience records — MVP foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

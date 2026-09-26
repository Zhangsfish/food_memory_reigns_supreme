export function siteUrl(path: string): string {
  const base = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(path, `${base.replace(/\/$/, "")}/`).toString();
}

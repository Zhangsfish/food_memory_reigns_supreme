import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// S01 has only synthetic records; public entry points are discoverable without
// submitting fictitious experience/contributor URLs to search indexes.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl("/") }, { url: siteUrl("/search") }];
}

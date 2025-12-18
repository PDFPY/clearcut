import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // disallow: ["/api/private"], // only if you truly need it
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

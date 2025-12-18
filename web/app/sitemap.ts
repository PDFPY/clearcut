import type { MetadataRoute } from "next";

const useCases = [
  "logo",
  "product-photo",
  "profile-picture",
  "headshot",
  "passport-photo",
  "id-photo",
  "signature",
  "ecommerce",
  "etsy-listing",
  "amazon-listing",
  "real-estate",
  "car-photo",
  "pet-photo",
  "wedding-photo",
  "youtube-thumbnail",
  "instagram",
  "tiktok",
  "linkedin",
  "resume-photo",
  "school-photo",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/remove-background`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const longTail: MetadataRoute.Sitemap = useCases.map((slug) => ({
    url: `${baseUrl}/remove-background/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...core, ...longTail];
}

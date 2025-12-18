import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://clearcuttools.com",
      lastModified: new Date(),
    },
    {
      url: "https://clearcuttools.com/remove-background",
      lastModified: new Date(),
    },
    {
      url: "https://clearcuttools.com/privacy",
      lastModified: new Date(),
    },
    {
      url: "https://clearcuttools.com/terms",
      lastModified: new Date(),
    },
    {
      url: "https://clearcuttools.com/contact",
      lastModified: new Date(),
    },
  ];
}

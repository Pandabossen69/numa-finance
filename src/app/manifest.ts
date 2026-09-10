import type { MetadataRoute } from "next";
import {
  BRAND_ICON_192,
  BRAND_ICON_512,
  BRAND_ICON_MASKABLE_512,
} from "@/lib/brand-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Same-origin paths so Safari / Chrome accept the PWA on localhost,
    // preview, and production. CanonicalHostRedirect only bounces leftover
    // team / other-app *.vercel.app hosts, not this project's aliases.
    id: "/",
    name: "NUMA",
    short_name: "NUMA",
    description: "Personlig ekonomisk kontroll",
    start_url: "/idag",
    scope: "/",
    display: "standalone",
    background_color: "#05090b",
    theme_color: "#05090b",
    lang: "sv",
    orientation: "portrait-primary",
    icons: [
      {
        src: BRAND_ICON_192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_ICON_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_ICON_MASKABLE_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";
import { PRODUCTION_ORIGIN } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${PRODUCTION_ORIGIN}/`,
    name: "NUMA",
    short_name: "NUMA",
    description: "Personlig ekonomisk kontroll",
    start_url: `${PRODUCTION_ORIGIN}/idag`,
    scope: `${PRODUCTION_ORIGIN}/`,
    display: "standalone",
    background_color: "#e6e4de",
    theme_color: "#e6e4de",
    lang: "sv",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

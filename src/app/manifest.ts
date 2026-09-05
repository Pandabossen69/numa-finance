import type { MetadataRoute } from "next";

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
    background_color: "#ece4d6",
    theme_color: "#ece4d6",
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

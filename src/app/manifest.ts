import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sugar.no Live Scanner",
    short_name: "Sugar.no Scan",
    description: "Private Latvia scanner proof of concept.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2ede4",
    theme_color: "#f2ede4",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}

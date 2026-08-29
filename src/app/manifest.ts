import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Specify",
    short_name: "Specify",
    description: "Learn plant names and characteristics, one quiz at a time.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f0",
    theme_color: "#4c6429",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

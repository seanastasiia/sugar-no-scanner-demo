export function GET() {
  return Response.json({ id: "/pilot/shelf", name: "Sugar.no Personal Shelf", short_name: "Personal Shelf", start_url: "/pilot/shelf", scope: "/pilot/shelf", display: "standalone", background_color: "#f2f2f7", theme_color: "#f2f2f7", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }] }, { headers: { "content-type": "application/manifest+json" } });
}

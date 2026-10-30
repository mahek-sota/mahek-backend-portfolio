import { ImageResponse } from "next/og";

import { profile } from "@/content/site";

export const alt = `${profile.name}, engineering deep dives`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f7f3ec",
          color: "#1f1c18",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#8a3510", letterSpacing: 2 }}>ENGINEERING DEEP DIVES</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{profile.name}</div>
          <div style={{ fontSize: 36, color: "#5c564d", marginTop: 20, maxWidth: 920, lineHeight: 1.35 }}>
            Durable runs, permission boundaries, graph expansion behind a rate-limited API, and moderation that fails closed.
          </div>
        </div>
        <div style={{ display: "flex", width: 160, height: 8, background: "#8a3510" }} />
      </div>
    ),
    size,
  );
}

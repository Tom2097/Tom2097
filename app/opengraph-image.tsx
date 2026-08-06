import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1120 0%, #0f1a2e 55%, #0b1120 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "linear-gradient(135deg, #22d3ee, #0891b2)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 700,
              color: "#04141a",
            }}
          >
            D
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#f8fafc" }}>DigiT</div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 32,
            color: "#94a3b8",
            maxWidth: 820,
            textAlign: "center",
          }}
        >
          AI-Powered Enterprise Operations
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 22,
            color: "#22d3ee",
            letterSpacing: 2,
          }}
        >
          DIGIT-AI.ORG
        </div>
      </div>
    ),
    { ...size }
  )
}

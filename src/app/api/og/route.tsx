import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { CONFIG } from "@/site.config";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Dynamic params
    const title = searchParams.get("title")?.slice(0, 100) || CONFIG.site.title;
    const category =
      searchParams.get("category") ||
      (CONFIG.site.locale === "ko" ? "블로그 포스트" : "Blog Post");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            backgroundColor: "#fff",
            backgroundImage: "radial-gradient(circle at 25px 25px, lightgray 2%, transparent 0%), radial-gradient(circle at 75px 75px, lightgray 2%, transparent 0%)",
            backgroundSize: "100px 100px",
            padding: "80px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                backgroundColor: "#000",
                color: "#fff",
                padding: "8px 24px",
                borderRadius: "100px",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {category}
            </div>
          </div>
          <div
            style={{
              fontSize: 80,
              fontStyle: "normal",
              fontWeight: 800,
              color: "#000",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: "30px",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              fontSize: 32,
              fontWeight: 500,
              color: "#666",
            }}
          >
            NoLog
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(`[OG Route Error] ${e.message}`);
    return new Response("Failed to generate image", { status: 500 });
  }
}

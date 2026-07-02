import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  createAssetTag,
  getAssetTags,
  bulkTagAssets,
  recordTagScan,
} from "@/lib/resources/qr-rfid"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const assetId = req.nextUrl.searchParams.get("assetId") || undefined
      const tags = await getAssetTags(organizationId, assetId)
      return NextResponse.json({ tags })
    }

    const body = await req.json() as {
      action: "create" | "bulk" | "scan"
      assetId?: string
      assetIds?: string[]
      tagType?: "qr" | "rfid"
      tagValue?: string
      location?: string
    }

    switch (body.action) {
      case "create": {
        if (!body.assetId || !body.tagType) {
          return NextResponse.json({ error: "assetId and tagType required" }, { status: 400 })
        }
        const tag = await createAssetTag(organizationId, body.assetId, body.tagType)
        if (!tag) return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
        return NextResponse.json({ tag })
      }
      case "bulk": {
        if (!body.assetIds?.length || !body.tagType) {
          return NextResponse.json({ error: "assetIds and tagType required" }, { status: 400 })
        }
        const tags = await bulkTagAssets(organizationId, body.assetIds, body.tagType)
        return NextResponse.json({ tags })
      }
      case "scan": {
        if (!body.tagValue) {
          return NextResponse.json({ error: "tagValue required" }, { status: 400 })
        }
        const scan = await recordTagScan(organizationId, body.tagValue, userId, body.location || null)
        if (!scan) return NextResponse.json({ error: "No asset found for this tag" }, { status: 404 })
        return NextResponse.json({ scan })
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[tags] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }

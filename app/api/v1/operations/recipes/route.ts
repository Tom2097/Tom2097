import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { BUILTIN_RECIPES, executeRecipe, type Recipe } from "@/lib/operational/recipes"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const db = createServiceClient()
    const { data: customRecipes } = await db.from("recipes")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    const builtins = BUILTIN_RECIPES.map((r) => ({
      id: `builtin-${r.name.toLowerCase().replace(/\s+/g, "-")}`,
      ...r, is_builtin: true,
    }))

    return NextResponse.json({
      success: true,
      data: {
        builtin: builtins,
        custom: customRecipes ?? [],
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch recipes"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId || !userId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { recipeId, documentId, content } = await request.json()
    if (!recipeId || !documentId || !content) {
      return NextResponse.json({ error: "recipeId, documentId, and content are required" }, { status: 400 })
    }

    const builtin = BUILTIN_RECIPES.find((r) =>
      `builtin-${r.name.toLowerCase().replace(/\s+/g, "-")}` === recipeId,
    )

    if (!builtin) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    const recipe: Recipe = {
      ...builtin, id: recipeId,
      created_by: userId, created_at: new Date().toISOString(),
    }

    const results = await executeRecipe(recipe, orgId, documentId, content, userId)
    return NextResponse.json({ success: true, data: { results } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to execute recipe"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

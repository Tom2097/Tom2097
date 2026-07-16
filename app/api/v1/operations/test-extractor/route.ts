import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { extractFields, type ExtractionSchema } from '@/lib/extraction/engine'

const SAMPLE_TEXT: Record<string, string> = {
  pharma: 'Batch Record BR-2024-0192. Product: Amoxicillin 500mg Capsules. Manufacturing date: 2026-06-01. Parameters: temperature 22C, humidity 45%. Reviewed and signed off by QA Manager J. Patel on 2026-06-03.',
  renewables: 'Site Survey Report SSR-441. Coordinates: 26.9124N, 75.7873E. Terrain: flat, agricultural. Grid access confirmed within 2km. Zoning: industrial-agricultural mixed use.',
  logistics: 'Proof of Delivery POD-88213. Consignment: CN-99201. Recipient: Sharma Logistics Pvt Ltd. Delivered 2026-06-05 14:32. Signed by: R. Sharma.',
}

// The extractor catalog is illustrative (per-vertical field lists, not tied
// to a specific document), so "Test" runs the real extraction engine
// against a short representative sample instead of a live upload -- a
// genuine model call, not a scripted response.
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const { extractor, vertical, fields } = await request.json()

    if (!extractor || typeof extractor !== 'string') {
      return NextResponse.json({ error: 'extractor is required' }, { status: 400 })
    }

    const fieldNames: string[] = typeof fields === 'string'
      ? fields.split(',').map((f: string) => f.trim()).filter(Boolean)
      : []

    const schema: ExtractionSchema = {
      name: extractor,
      fields: fieldNames.length
        ? fieldNames.map((name) => ({ name, type: 'string' as const, description: name }))
        : [{ name: 'summary', type: 'string' as const, description: 'Key information in the document' }],
    }

    const sampleText = SAMPLE_TEXT[vertical as string] ?? SAMPLE_TEXT.pharma
    const results = await extractFields(sampleText, schema)

    return NextResponse.json({ extractor, results })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

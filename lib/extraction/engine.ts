import { generateText, generateObject } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

export interface ExtractedField {
  name: string
  value: string
  confidence: number
  source: string
}

export interface ExtractionSchema {
  name: string
  fields: Array<{ name: string; type: "string" | "number" | "date" | "money" | "email" | "phone"; description: string }>
}

export const INVOICE_SCHEMA: ExtractionSchema = {
  name: "invoice",
  fields: [
    { name: "invoice_number", type: "string", description: "Invoice or document number" },
    { name: "vendor_name", type: "string", description: "Name of the vendor/supplier" },
    { name: "vendor_address", type: "string", description: "Vendor address" },
    { name: "bill_to", type: "string", description: "Customer/bill-to name" },
    { name: "invoice_date", type: "date", description: "Invoice date" },
    { name: "due_date", type: "date", description: "Payment due date" },
    { name: "total_amount", type: "money", description: "Total invoice amount" },
    { name: "tax_amount", type: "money", description: "Tax amount" },
    { name: "currency", type: "string", description: "Currency code" },
    { name: "line_items", type: "string", description: "Itemized line items with quantities and amounts" },
    { name: "po_number", type: "string", description: "Purchase order number" },
  ],
}

export const CONTRACT_SCHEMA: ExtractionSchema = {
  name: "contract",
  fields: [
    { name: "contract_title", type: "string", description: "Contract title or name" },
    { name: "parties", type: "string", description: "All parties to the contract" },
    { name: "effective_date", type: "date", description: "Contract effective date" },
    { name: "expiry_date", type: "date", description: "Contract expiry or renewal date" },
    { name: "renewal_terms", type: "string", description: "Auto-renewal, notice period, terms" },
    { name: "obligations", type: "string", description: "Key obligations of each party" },
    { name: "penalty_clauses", type: "string", description: "Penalties, liquidated damages, termination fees" },
    { name: "governing_law", type: "string", description: "Governing law and jurisdiction" },
    { name: "signatories", type: "string", description: "Names and titles of signatories" },
    { name: "contract_value", type: "money", description: "Total contract value" },
  ],
}

export async function extractFields(
  text: string,
  schema: ExtractionSchema,
): Promise<ExtractedField[]> {
  const fieldDescriptions = schema.fields
    .map((f) => `- ${f.name} (${f.type}): ${f.description}`)
    .join("\n")

  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a document extraction engine. Extract structured fields from the given text using the schema below.

Schema: ${schema.name}
Fields:
${fieldDescriptions}

Return ONLY a JSON array of objects with this structure:
[{ "name": "field_name", "value": "extracted_value", "confidence": 85, "source": "exact text from document" }]

Set confidence 0-100. Set source to the exact text snippet the value was extracted from.
If a field cannot be found, omit it from the array.`

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: `Document text:\n"""\n${text.slice(0, 15000)}\n"""\n\nExtract fields for schema "${schema.name}":`,
    temperature: 0.1,
    maxOutputTokens: 2000,
  })

  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as ExtractedField[]
  } catch {}

  return []
}

export interface ExtractedLineItem {
  description: string
  quantity: number
  sku?: string
}

const LineItemsSchema = z.object({
  items: z.array(
    z.object({
      description: z.string().describe("The item name/description exactly as written on the invoice or PO"),
      quantity: z.number().describe("The quantity of this line item (a plain number, e.g. 4)"),
      sku: z.string().nullable().describe("The SKU/item code for this line, if one is printed on the document, otherwise null"),
    })
  ),
})

/**
 * Extracts a structured list of line items (description + quantity + SKU)
 * from an invoice/PO, separately from extractFields()'s single free-text
 * "line_items" field -- callers that need to match individual items against
 * other records (e.g. inventory) need them split out, not as one blob.
 */
export async function extractLineItems(text: string): Promise<ExtractedLineItem[]> {
  try {
    const { object } = await generateObject({
      model: DEFAULT_CHAT_MODEL,
      schema: LineItemsSchema,
      prompt: `${BASE_SYSTEM_PROMPT}

Extract every line item from this invoice or purchase order as a structured list. Each entry should be one product/service line with its quantity and SKU if present. If there are no itemized line items, return an empty list -- do not invent one.

Document text:
"""
${text.slice(0, 15000)}
"""`,
    })
    return object.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      sku: item.sku ?? undefined,
    }))
  } catch {
    return []
  }
}

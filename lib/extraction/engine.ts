import { generateText } from "ai"
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

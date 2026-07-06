"use server"

export interface VerticalExtractorSchema {
  name: string
  vertical: string
  description: string
  fields: Array<{
    name: string
    type: "string" | "number" | "date" | "currency" | "enum"
    required: boolean
    description: string
    enumValues?: string[]
  }>
}

export interface ExtractionResult {
  schema: string
  vertical: string
  confidence: number
  fields: Record<string, unknown>
  rawText: string
}

export const PHARMA_BATCH_RECORD_SCHEMA: VerticalExtractorSchema = {
  name: "Pharma Batch Record",
  vertical: "pharmaceuticals",
  description: "Extract batch manufacturing record data from pharmaceutical production documents",
  fields: [
    { name: "batchNumber", type: "string", required: true, description: "Batch/Lot number" },
    { name: "productName", type: "string", required: true, description: "Product name" },
    { name: "manufacturingDate", type: "date", required: true, description: "Date of manufacture" },
    { name: "expiryDate", type: "date", required: true, description: "Expiry/retest date" },
    { name: "batchSize", type: "number", required: true, description: "Batch size (units/kg/L)" },
    { name: "status", type: "enum", required: true, description: "Batch status", enumValues: ["released", "quarantine", "rejected", "in_progress"] },
    { name: "manufacturingSite", type: "string", required: false, description: "Site of manufacture" },
    { name: "equipmentUsed", type: "string", required: false, description: "Equipment used" },
    { name: "operatorName", type: "string", required: false, description: "Operator name" },
    { name: "yield", type: "number", required: false, description: "Actual yield percentage" },
  ],
}

export const SECI_REPORT_SCHEMA: VerticalExtractorSchema = {
  name: "SECI Solar Report",
  vertical: "renewables",
  description: "Extract data from Solar Energy Corporation of India reports and solar plant performance documents",
  fields: [
    { name: "plantName", type: "string", required: true, description: "Solar plant name" },
    { name: "reportPeriod", type: "string", required: true, description: "Reporting period" },
    { name: "totalGeneration", type: "number", required: true, description: "Total generation (kWh/MWh)" },
    { name: "capacityUtilization", type: "number", required: true, description: "Capacity utilization factor (%)" },
    { name: "plantAvailability", type: "number", required: true, description: "Plant availability (%)" },
    { name: "irradiation", type: "number", required: false, description: "Solar irradiation (kWh/m²)" },
    { name: "downtimeHours", type: "number", required: false, description: "Total downtime hours" },
    { name: "inverterEfficiency", type: "number", required: false, description: "Inverter efficiency (%)" },
    { name: "gridAvailability", type: "number", required: false, description: "Grid availability (%)" },
  ],
}

export const EWAY_BILL_SCHEMA: VerticalExtractorSchema = {
  name: "E-Way Bill",
  vertical: "logistics",
  description: "Extract data from Indian GST e-way bills for logistics tracking",
  fields: [
    { name: "ewayBillNumber", type: "string", required: true, description: "E-way bill number" },
    { name: "generatedDate", type: "date", required: true, description: "Bill generation date" },
    { name: "validUntil", type: "date", required: true, description: "Validity end date" },
    { name: "fromGSTIN", type: "string", required: true, description: "Consignor GSTIN" },
    { name: "toGSTIN", type: "string", required: true, description: "Consignee GSTIN" },
    { name: "invoiceNumber", type: "string", required: true, description: "Related invoice number" },
    { name: "invoiceValue", type: "currency", required: true, description: "Invoice value" },
    { name: "transportMode", type: "enum", required: true, description: "Mode of transport", enumValues: ["road", "rail", "air", "ship"] },
    { name: "vehicleNumber", type: "string", required: false, description: "Vehicle registration number" },
    { name: "approximateDistance", type: "number", required: false, description: "Approximate distance (km)" },
    { name: "itemCount", type: "number", required: false, description: "Number of items" },
  ],
}

export const VERTICAL_SCHEMAS: Record<string, VerticalExtractorSchema> = {
  "pharma-batch": PHARMA_BATCH_RECORD_SCHEMA,
  "seci-report": SECI_REPORT_SCHEMA,
  "eway-bill": EWAY_BILL_SCHEMA,
}

export function getVerticalSchema(verticalId: string): VerticalExtractorSchema | undefined {
  return VERTICAL_SCHEMAS[verticalId]
}

export function listVerticalSchemas(): VerticalExtractorSchema[] {
  return Object.values(VERTICAL_SCHEMAS)
}

export async function extractVerticalDocument(
  schemaId: string,
  text: string
): Promise<ExtractionResult> {
  const schema = VERTICAL_SCHEMAS[schemaId]
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaId}`)
  }

  await new Promise(r => setTimeout(r, 500))

  const extracted: Record<string, unknown> = {}
  let confidence = 0.7 + Math.random() * 0.25

  for (const field of schema.fields) {
    if (field.type === "date") {
      const dateMatch = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/)
      if (dateMatch) {
        extracted[field.name] = dateMatch[0]
      }
    } else if (field.type === "number" || field.type === "currency") {
      const numMatch = text.match(new RegExp(`(${field.name}[\\s:]+)?(\\d+[,.]?\\d*)`, "i"))
      if (numMatch) {
        extracted[field.name] = parseFloat(numMatch[2].replace(/,/g, ""))
      }
    } else if (field.type === "enum" && field.enumValues) {
      for (const val of field.enumValues) {
        if (text.toLowerCase().includes(val.replace(/_/g, " ").toLowerCase())) {
          extracted[field.name] = val
          break
        }
      }
    } else {
      const match = text.match(new RegExp(`(${field.name}[\\s:]+)?([A-Za-z0-9\\s\\-\\/\\.]+)`, "i"))
      if (match) {
        extracted[field.name] = match[2].trim().substring(0, 100)
      }
    }
  }

  return {
    schema: schema.name,
    vertical: schema.vertical,
    confidence: Math.round(confidence * 100),
    fields: extracted,
    rawText: text.substring(0, 500),
  }
}

import { createServiceClient } from "@/lib/supabase/service"

export interface ExtractableEntity {
  type: string
  text: string
  confidence: number
}

export interface ExtractionResult {
  entities: ExtractableEntity[]
  counts: Record<string, number>
}

/**
 * Parse extracted entities from a document and create CRM contacts/companies.
 * Returns counts of what was created, plus the ids of the created rows
 * (needed by callers -- e.g. the document pipeline -- that publish a
 * downstream event referencing the actual linked record).
 */
export async function populateCrmFromExtraction(
  organizationId: string,
  documentId: string,
  extraction: ExtractionResult,
): Promise<{ contacts: number; companies: number; createdContactIds: string[]; createdCompanyIds: string[] }> {
  const db = createServiceClient()

  const emails = extraction.entities
    .filter((e) => e.type === "EMAIL" && e.confidence > 60)
    .map((e) => e.text.toLowerCase())

  const phones = extraction.entities
    .filter((e) => e.type === "PHONE")
    .map((e) => e.text)

  const names = extraction.entities
    .filter((e) => e.type === "PERSON" && e.confidence > 70)
    .map((e) => e.text)

  const organizations = extraction.entities
    .filter((e) => e.type === "ORGANIZATION" && e.confidence > 60)
    .map((e) => e.text)

  let contactsCreated = 0
  let companiesCreated = 0
  const createdContactIds: string[] = []
  const createdCompanyIds: string[] = []

  for (const email of emails) {
    const { data: existing } = await db
      .from("crm_contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle()

    if (existing) continue

    const bestName = names.find((n) => email.toLowerCase().includes(n.split(" ")[0]?.toLowerCase() ?? "")) ?? email.split("@")[0]

    const { data: inserted, error } = await db.from("crm_contacts").insert({
      organization_id: organizationId,
      name: bestName,
      email,
      phone: phones[0] ?? null,
      source: "document_extraction",
      metadata: { extracted_from_document: documentId },
    }).select("id").single()
    if (!error) {
      contactsCreated++
      if (inserted?.id) createdContactIds.push(inserted.id as string)
    }
  }

  for (const orgName of organizations) {
    const { data: existing } = await db
      .from("crm_companies")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", orgName)
      .maybeSingle()

    if (existing) continue

    const { data: inserted, error } = await db.from("crm_companies").insert({
      organization_id: organizationId,
      name: orgName,
      domain: `${orgName.toLowerCase().replace(/\s+/g, "")}.com`,
      source: "document_extraction",
      metadata: { extracted_from_document: documentId },
    }).select("id").single()
    if (!error) {
      companiesCreated++
      if (inserted?.id) createdCompanyIds.push(inserted.id as string)
    }
  }

  return { contacts: contactsCreated, companies: companiesCreated, createdContactIds, createdCompanyIds }
}

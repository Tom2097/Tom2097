import { NextResponse, type NextRequest } from "next/server"
import * as xlsx from "xlsx"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseContactRows } from "@/lib/crm/contact-import"
import { importContacts } from "@/lib/crm/engine"
import { recordCrmEvent } from "@/lib/crm/smart-layer"

/**
 * POST /api/v1/crm/contacts/import -- multipart form with a `file` CSV.
 * Skips rows whose email is already in the workspace, so re-uploading the
 * same file does not create duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const form = await request.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a CSV file to import" }, { status: 400 })
    if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Only .csv files can be imported" }, { status: 400 })
    if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "The file is larger than 2 MB" }, { status: 400 })

    // raw: keep phone numbers and similar values as written, not as numbers.
    const workbook = xlsx.read(await file.text(), { type: "string", raw: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = sheet ? xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }) : []
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `The file has more than ${MAX_IMPORT_ROWS} rows` }, { status: 400 })
    }

    const parsed = parseContactRows(rows)
    const { contacts, existing } = await importContacts(organizationId, user.id, parsed.contacts)
    if (contacts.length > 0) {
      await recordCrmEvent(organizationId, "contacts_imported", { properties: { count: contacts.length } })
    }

    return NextResponse.json({
      contacts,
      imported: contacts.length,
      duplicates: parsed.duplicates + existing,
      invalid: parsed.invalid,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

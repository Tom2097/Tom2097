import { CONTACT_STATUSES, type ContactInput, type ContactStatus } from "@/lib/crm/types"

export const MAX_IMPORT_ROWS = 1000
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

type Field = "name" | "first_name" | "last_name" | "email" | "phone" | "title" | "status" | "source" | "notes"

// Header spellings from common exports (Google Contacts, Zoho, Excel lists),
// compared after lowercasing and removing spaces and punctuation.
const HEADER_ALIASES: Record<string, Field> = {
  name: "name",
  fullname: "name",
  contactname: "name",
  firstname: "first_name",
  givenname: "first_name",
  lastname: "last_name",
  surname: "last_name",
  familyname: "last_name",
  email: "email",
  emailaddress: "email",
  email1value: "email",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  phone1value: "phone",
  title: "title",
  jobtitle: "title",
  designation: "title",
  status: "status",
  source: "source",
  leadsource: "source",
  notes: "notes",
  note: "notes",
}

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "")
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface ParsedContacts {
  contacts: ContactInput[]
  /** Rows with neither a name nor an email, or with a malformed email. */
  invalid: number
  /** Rows repeating an email from earlier in the same file. */
  duplicates: number
}

/** Maps spreadsheet rows onto contact fields. Pure, so it is unit-testable. */
export function parseContactRows(rows: Array<Record<string, unknown>>): ParsedContacts {
  const contacts: ContactInput[] = []
  const seen = new Set<string>()
  let invalid = 0
  let duplicates = 0

  for (const row of rows) {
    const fields: Partial<Record<Field, string>> = {}
    for (const [header, raw] of Object.entries(row)) {
      const field = HEADER_ALIASES[normalizeHeader(header)]
      const value = String(raw ?? "").trim()
      if (field && value && !fields[field]) fields[field] = value
    }

    if (Object.keys(fields).length === 0) {
      // Entirely blank spreadsheet rows are not worth reporting as errors.
      if (Object.values(row).some((v) => String(v ?? "").trim())) invalid++
      continue
    }

    let first = fields.first_name ?? ""
    let last = fields.last_name ?? ""
    if (!first && !last && fields.name) {
      const [head, ...rest] = fields.name.split(/\s+/)
      first = head
      last = rest.join(" ")
    }

    const email = fields.email?.toLowerCase()
    if ((email && !EMAIL_RE.test(email)) || (!first && !last && !email)) {
      invalid++
      continue
    }
    if (email) {
      if (seen.has(email)) {
        duplicates++
        continue
      }
      seen.add(email)
    }

    const status = fields.status?.toLowerCase() as ContactStatus | undefined
    contacts.push({
      first_name: first,
      last_name: last,
      email: email ?? null,
      phone: fields.phone ?? null,
      title: fields.title ?? null,
      status: status && CONTACT_STATUSES.includes(status) ? status : "lead",
      source: fields.source ?? "csv_import",
      notes: fields.notes ?? null,
    })
  }

  return { contacts, invalid, duplicates }
}

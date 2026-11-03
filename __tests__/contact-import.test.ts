import { describe, it, expect } from "vitest"
import { parseContactRows } from "@/lib/crm/contact-import"

describe("parseContactRows", () => {
  it("maps common header spellings", () => {
    const { contacts } = parseContactRows([
      { "First Name": "Asha", Surname: "Rao", "E-mail Address": "ASHA@Example.com", Mobile: "98765", Designation: "CFO", Status: "Active" },
    ])
    expect(contacts[0]).toMatchObject({ first_name: "Asha", last_name: "Rao", email: "asha@example.com", phone: "98765", title: "CFO", status: "active" })
  })

  it("splits a full name and defaults status and source", () => {
    const { contacts } = parseContactRows([{ Name: "Ravi Kumar Singh", Status: "vip" }])
    expect(contacts[0]).toMatchObject({ first_name: "Ravi", last_name: "Kumar Singh", status: "lead", source: "csv_import", email: null })
  })

  it("counts invalid rows and in-file duplicates, ignores blank rows", () => {
    const result = parseContactRows([
      { email: "a@b.co" },
      { email: "A@B.co", name: "Repeat" },
      { email: "not-an-email", name: "Bad" },
      { company: "No usable column" },
      { email: "", name: "" },
    ])
    expect(result.contacts).toHaveLength(1)
    expect(result.duplicates).toBe(1)
    expect(result.invalid).toBe(2)
  })
})

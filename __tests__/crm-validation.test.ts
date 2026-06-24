import { describe, it, expect } from "vitest"
import { validateContact, validateCompany, validateDeal } from "@/lib/crm/engine"

describe("validateContact", () => {
  it("accepts valid contact with first_name", () => {
    const result = validateContact({ first_name: "John", email: "john@test.com", status: "lead" })
    expect(result).toBeNull()
  })

  it("rejects empty input", () => {
    const result = validateContact(null)
    expect(result).toBe("contact must be an object")
  })

  it("rejects missing name and email", () => {
    const result = validateContact({})
    expect(result).toBe("a name or email is required")
  })

  it("rejects invalid email", () => {
    const result = validateContact({ first_name: "John", email: "not-an-email" })
    expect(result).toBe("invalid email")
  })

  it("rejects invalid status", () => {
    const result = validateContact({ first_name: "John", status: "vip" })
    expect(result).toBe("invalid status")
  })
})

describe("validateCompany", () => {
  it("accepts valid company", () => {
    const result = validateCompany({ name: "Acme Corp" })
    expect(result).toBeNull()
  })

  it("rejects missing name", () => {
    const result = validateCompany({})
    expect(result).toBe("name is required")
  })

  it("rejects empty name", () => {
    const result = validateCompany({ name: "" })
    expect(result).toBe("name is required")
  })
})

describe("validateDeal", () => {
  it("accepts valid deal", () => {
    const result = validateDeal({ title: "Big Deal", value: 10000 })
    expect(result).toBeNull()
  })

  it("rejects missing title", () => {
    const result = validateDeal({ value: 10000 })
    expect(result).toBe("title is required")
  })

  it("rejects negative value", () => {
    const result = validateDeal({ title: "Deal", value: -1 })
    expect(result).toBe("value must be >= 0")
  })

  it("rejects invalid probability", () => {
    const result = validateDeal({ title: "Deal", probability: 150 })
    expect(result).toBe("probability must be between 0 and 100")
  })
})

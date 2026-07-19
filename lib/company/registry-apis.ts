export type RegistryProvider = "mca" | "gst" | "companies_house" | "acra" | "simulated"

export interface RegistryConfig {
  provider: RegistryProvider
  apiKey: string
  apiUrl: string
}

export interface RegistryLookupResult {
  found: boolean
  simulated?: boolean
  companyName?: string
  registrationNumber?: string
  address?: string
  status?: "active" | "inactive" | "suspended" | "dissolved"
  companyType?: string
  incorporationDate?: string
  directors?: Array<{ name: string; din?: string }>
  registeredAddress?: string
}

export function getRegistryConfig(country: string): RegistryConfig | null {
  const countryProviderMap: Record<string, RegistryProvider> = {
    in: "mca",
    uk: "companies_house",
    sg: "acra",
  }

  const provider = countryProviderMap[country.toLowerCase()] || "simulated"
  const envKey = `REGISTRY_${provider.toUpperCase()}_API_KEY`
  const envUrl = `REGISTRY_${provider.toUpperCase()}_API_URL`
  const apiKey = process.env[envKey]
  const apiUrl = process.env[envUrl]

  if (provider !== "simulated" && (!apiKey || !apiUrl)) {
    return null
  }

  return {
    provider,
    apiKey: apiKey || "simulated",
    apiUrl: apiUrl || "https://api.simulated.local",
  }
}

export async function lookupRegistry(
  registrationNumber: string,
  country: string
): Promise<RegistryLookupResult> {
  const config = getRegistryConfig(country)
  if (!config || config.provider === "simulated") {
    if (process.env.NODE_ENV === "production") return { found: false }
    return simulatedLookup(registrationNumber, country)
  }

  switch (config.provider) {
    case "mca":
      return mcaLookup(config, registrationNumber)
    case "companies_house":
      return companiesHouseLookup(config, registrationNumber)
    case "acra":
      return acraLookup(config, registrationNumber)
    default:
      if (process.env.NODE_ENV === "production") return { found: false }
      return simulatedLookup(registrationNumber, country)
  }
}

async function mcaLookup(config: RegistryConfig, cin: string): Promise<RegistryLookupResult> {
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/company/${cin}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-API-Version": "1.0",
      },
    })
    if (!response.ok) {
      return { found: false }
    }
    const data = await response.json()
    return {
      found: true,
      companyName: data.company_name,
      registrationNumber: data.cin,
      address: data.registered_address,
      status: data.status?.toLowerCase() === "active" ? "active" : "inactive",
      companyType: data.company_type,
      incorporationDate: data.date_of_incorporation,
      directors: data.directors?.map((d: { name: string; din?: string }) => ({
        name: d.name,
        din: d.din,
      })),
      registeredAddress: data.registered_address,
    }
  } catch {
    return { found: false }
  }
}

async function companiesHouseLookup(
  config: RegistryConfig,
  companyNumber: string
): Promise<RegistryLookupResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Simulated registry lookups are disabled in production")
  }
  try {
    const response = await fetch(
      `${config.apiUrl}/company/${companyNumber}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
      }
    )
    if (!response.ok) return { found: false }
    const data = await response.json()
    return {
      found: true,
      companyName: data.company_name,
      registrationNumber: data.company_number,
      address: data.registered_office_address
        ? `${data.registered_office_address.address_line_1}, ${data.registered_office_address.locality}, ${data.registered_office_address.country}`
        : undefined,
      status: data.status === "active" ? "active" : "inactive",
      companyType: data.type,
      incorporationDate: data.date_of_creation,
    }
  } catch {
    return { found: false }
  }
}

async function acraLookup(config: RegistryConfig, uen: string): Promise<RegistryLookupResult> {
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/entities/${uen}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })
    if (!response.ok) return { found: false }
    const data = await response.json()
    return {
      found: true,
      companyName: data.name,
      registrationNumber: data.uen,
      address: data.registeredAddress,
      status: data.status === "LIVE" ? "active" : "inactive",
      companyType: data.entityType,
      incorporationDate: data.incorporationDate,
    }
  } catch {
    return { found: false }
  }
}

async function simulatedLookup(
  registrationNumber: string,
  _country: string
): Promise<RegistryLookupResult> {
  await new Promise((r) => setTimeout(r, 800))
  const found = /^[A-Z0-9]{6,}/.test(registrationNumber) && Math.random() > 0.2
  if (!found) return { found: false }
  return {
    found: true,
    simulated: true,
    companyName: `Verified Company ${registrationNumber.slice(0, 6)}`,
    registrationNumber,
    address: "123 Verified Street, Business District",
    status: "active",
    companyType: "Private Limited",
    incorporationDate: "2020-01-15",
    directors: [{ name: "John Director", din: "DIN12345678" }],
    registeredAddress: "123 Verified Street, Business District",
  }
}

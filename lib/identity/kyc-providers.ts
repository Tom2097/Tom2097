export type KycProviderName = "onfido" | "jumio" | "trulioo" | "shuftipro" | "sumsub" | "simulated"

export interface KycProviderConfig {
  name: KycProviderName
  apiKey: string
  apiUrl: string
  webhookSecret?: string
}

export interface KycCheckResult {
  checkId: string
  provider: KycProviderName
  status: "pending" | "complete" | "error"
  result: "clear" | "consider" | "unidentified"
  breakdown: Record<string, boolean | number>
  score: number
  completedAt: string
  rawResponse: Record<string, unknown>
}

export interface DocumentCheckOptions {
  documentFront: string
  documentBack?: string
  documentType: "passport" | "driving_licence" | "national_identity_card" | "residence_permit"
  country?: string
}

export interface FaceCheckOptions {
  selfieImage: string
  liveness?: boolean
}

export function getKycProviderConfig(provider: KycProviderName): KycProviderConfig | null {
  const envPrefix = `KYC_${provider.toUpperCase()}`
  const apiKey = process.env[`${envPrefix}_API_KEY`]
  const apiUrl = process.env[`${envPrefix}_API_URL`]

  if (!apiKey || !apiUrl) {
    return null
  }

  return {
    name: provider,
    apiKey,
    apiUrl,
    webhookSecret: process.env[`${envPrefix}_WEBHOOK_SECRET`],
  }
}

export function getActiveKycProvider(): KycProviderName {
  const providers: KycProviderName[] = ["onfido", "jumio", "trulioo", "shuftipro", "sumsub"]
  for (const provider of providers) {
    const config = getKycProviderConfig(provider)
    if (config) return provider
  }
  return "simulated"
}

export async function createDocumentCheck(
  config: KycProviderConfig,
  options: DocumentCheckOptions
): Promise<KycCheckResult> {
  switch (config.name) {
    case "onfido":
      return onfidoDocumentCheck(config, options)
    case "jumio":
      return jumioDocumentCheck(config, options)
    default:
      if (process.env.NODE_ENV === "production") {
        throw new Error(`KYC document checks are not implemented for ${config.name}`)
      }
      return simulatedCheck("document", options)
  }
}

export async function createFaceCheck(
  config: KycProviderConfig,
  options: FaceCheckOptions
): Promise<KycCheckResult> {
  switch (config.name) {
    case "onfido":
      return onfidoFaceCheck(config, options)
    case "jumio":
      return jumioFaceCheck(config, options)
    default:
      if (process.env.NODE_ENV === "production") {
        throw new Error(`KYC face checks are not implemented for ${config.name}`)
      }
      return simulatedCheck("face", options)
  }
}

async function onfidoDocumentCheck(
  config: KycProviderConfig,
  options: DocumentCheckOptions
): Promise<KycCheckResult> {
  const response = await fetch(`${config.apiUrl}/v3.6/checks`, {
    method: "POST",
    headers: {
      Authorization: `Token token=${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      applicant_id: "placeholder",
      report_names: ["document"],
      document: {
        front: options.documentFront,
        back: options.documentBack,
        type: options.documentType,
      },
    }),
  })
  const data = await response.json()
  return {
    checkId: data.id,
    provider: "onfido",
    status: "complete",
    result: data.result === "clear" ? "clear" : "consider",
    breakdown: data.breakdown || {},
    score: data.score || 0,
    completedAt: new Date().toISOString(),
    rawResponse: data,
  }
}

async function onfidoFaceCheck(
  config: KycProviderConfig,
  options: FaceCheckOptions
): Promise<KycCheckResult> {
  const response = await fetch(`${config.apiUrl}/v3.6/live_photos`, {
    method: "POST",
    headers: {
      Authorization: `Token token=${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      applicant_id: "placeholder",
      file: options.selfieImage,
    }),
  })
  if (!response.ok) throw new Error(`Onfido face check failed (${response.status})`)
  const data = await response.json()
  return {
    checkId: data.id,
    provider: "onfido",
    status: "complete",
    result: data.result === "clear" ? "clear" : "consider",
    breakdown: data.breakdown || {},
    score: data.score || 0,
    completedAt: new Date().toISOString(),
    rawResponse: data,
  }
}

async function jumioDocumentCheck(
  config: KycProviderConfig,
  _options: DocumentCheckOptions
): Promise<KycCheckResult> {
  const response = await fetch(`${config.apiUrl}/api/v1/accounts/${config.apiKey}/scan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "DigiT/1.0",
    },
    body: JSON.stringify({
      merchantId: config.apiKey,
      merchantScanReference: `scan-${Date.now()}`,
      customerId: "placeholder",
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/kyc/callback`,
      errorUrl: `${process.env.NEXT_PUBLIC_APP_URL}/kyc/error`,
    }),
  })
  const data = await response.json()
  return {
    checkId: data.timestamp,
    provider: "jumio",
    status: data.status === "SUCCESS" ? "complete" : "error",
    result: data.verification?.overallResult === "PASSED" ? "clear" : "consider",
    breakdown: data.verification || {},
    score: data.verification?.confidence || 0,
    completedAt: new Date().toISOString(),
    rawResponse: data,
  }
}

async function jumioFaceCheck(
  _config: KycProviderConfig,
  _options: FaceCheckOptions
): Promise<KycCheckResult> {
  throw new Error("Jumio face verification is not implemented")
}

async function simulatedCheck(
  type: "document" | "face",
  _options: DocumentCheckOptions | FaceCheckOptions
): Promise<KycCheckResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Simulated KYC checks are disabled in production")
  }
  await new Promise((r) => setTimeout(r, 1000))
  const confidence = 0.7 + Math.random() * 0.25
  return {
    checkId: `sim-${type}-${Date.now()}`,
    provider: "simulated",
    status: "complete",
    result: confidence > 0.8 ? "clear" : "consider",
    breakdown: type === "document"
      ? { document_valid: true, expiry_valid: true, name_match: confidence > 0.75 }
      : { face_match: confidence > 0.75, liveness: true },
    score: Math.round(confidence * 100),
    completedAt: new Date().toISOString(),
    rawResponse: { simulated: true, confidence },
  }
}

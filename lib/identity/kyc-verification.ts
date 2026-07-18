"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import {
  getActiveKycProvider,
  getKycProviderConfig,
  createDocumentCheck,
  createFaceCheck,
} from "@/lib/identity/kyc-providers"
import type {
  KycProviderConfig,
  DocumentCheckOptions,
  FaceCheckOptions,
} from "@/lib/identity/kyc-providers"

interface KYCVerificationResult {
  verified: boolean
  confidenceScore: number
  faceMatch?: boolean
  idValid?: boolean
  idType?: string
  idNumber?: string
  nameMatch?: boolean
  nameOnId?: string
  dateOfBirth?: string
  addressMatch?: boolean
  addressOnId?: string
  verificationMethod?: "automated" | "manual"
  requiresManualReview?: boolean
  manualReviewNotes?: string
  simulated?: boolean
}

interface KYCVerificationOptions {
  userId: string
  selfieImage: string // base64 data URL
  idType: string // passport, drivers_license, national_id
  idNumber?: string
  idFrontImage?: string // base64 data URL
  idBackImage?: string // base64 data URL
  fullName?: string
  dateOfBirth?: string
  address?: string
}

/**
 * Verify identity using KYC-grade photo-to-ID matching
 */
export async function verifyIdentityWithKYC(
  options: KYCVerificationOptions
): Promise<KYCVerificationResult> {
  const user = await getAuthenticatedUser()
  const { selfieImage, idType } = options

  // Validate required fields
  if (!selfieImage || !idType) {
    return {
      verified: false,
      confidenceScore: 0,
      requiresManualReview: true,
      manualReviewNotes: "Missing required verification data"
    }
  }

  const providerName = getActiveKycProvider()

  if (providerName !== "simulated") {
    const config = getKycProviderConfig(providerName)
    if (config) {
      const result = await performProviderKycCheck(config, options)
      await storeKYCVerificationResult(user.id, result)
      return result
    }
  }

  if (process.env.NODE_ENV === "production") {
    const result: KYCVerificationResult = {
      verified: false,
      confidenceScore: 0,
      requiresManualReview: true,
      manualReviewNotes: "KYC provider is not configured",
    }
    await storeKYCVerificationResult(user.id, result)
    return result
  }

  // Explicit development-only demo verification.
  const result = await simulateKYCVerification(options)
  await storeKYCVerificationResult(user.id, result)
  return result
}

async function performProviderKycCheck(
  config: KycProviderConfig,
  options: KYCVerificationOptions
): Promise<KYCVerificationResult> {
  const documentType = mapIdTypeToDocumentType(options.idType)
  const documentOptions: DocumentCheckOptions = {
    documentFront: options.idFrontImage || "",
    documentBack: options.idBackImage,
    documentType,
    country: options.address?.split(",").pop()?.trim(),
  }
  const faceOptions: FaceCheckOptions = {
    selfieImage: options.selfieImage,
    liveness: true,
  }

  const [docResult, faceResult] = await Promise.all([
    createDocumentCheck(config, documentOptions),
    createFaceCheck(config, faceOptions),
  ])

  const score = Math.round((docResult.score + faceResult.score) / 2) / 100
  const requiresManualReview = score < 0.8

  return {
    verified: score >= 0.8,
    confidenceScore: score,
    faceMatch: faceResult.result === "clear",
    idValid: docResult.result === "clear",
    idType: options.idType,
    idNumber: options.idNumber,
    nameMatch: docResult.breakdown.name_match === true,
    verificationMethod: requiresManualReview ? undefined : "automated",
    requiresManualReview,
    manualReviewNotes: requiresManualReview ? "Confidence score below threshold" : undefined,
  }
}

function mapIdTypeToDocumentType(
  idType: string
): DocumentCheckOptions["documentType"] {
  switch (idType) {
    case "passport":
      return "passport"
    case "drivers_license":
      return "driving_licence"
    case "national_id":
      return "national_identity_card"
    default:
      return "passport"
  }
}

/**
 * Simulate KYC verification with a KYC provider
 */
async function simulateKYCVerification(
  options: KYCVerificationOptions
): Promise<KYCVerificationResult> {
  // Simulate different confidence levels based on provided data
  let confidenceScore = 0
  let faceMatch = false
  let idValid = false
  let nameMatch = false
  
  // Face match (selfie to ID)
  if (options.selfieImage && options.idFrontImage) {
    faceMatch = Math.random() > 0.2 // 80% chance of face match
    confidenceScore += faceMatch ? 0.4 : 0.1
  }
  
  // ID validation
  if (options.idNumber) {
    idValid = validateIDNumber(options.idNumber, options.idType)
    confidenceScore += idValid ? 0.3 : 0.1
  }
  
  // Name matching
  if (options.fullName && options.idFrontImage) {
    nameMatch = Math.random() > 0.3 // 70% chance of name match
    confidenceScore += nameMatch ? 0.2 : 0.1
  }
  
  // Cap confidence score at 0.95 (never 100% automated)
  confidenceScore = Math.min(confidenceScore, 0.95)
  
  // Determine if manual review is needed
  const requiresManualReview = confidenceScore < 0.8
  
  return {
    verified: confidenceScore >= 0.8,
    confidenceScore,
    faceMatch,
    idValid,
    idType: options.idType,
    idNumber: options.idNumber,
    nameMatch,
    nameOnId: options.fullName,
    verificationMethod: requiresManualReview ? undefined : "automated",
    requiresManualReview,
    manualReviewNotes: "SIMULATED DEVELOPMENT RESULT — not a KYC decision",
    simulated: true,
  }
}

/**
 * Validate ID number format based on ID type
 */
function validateIDNumber(idNumber: string, idType: string): boolean {
  switch (idType) {
    case "passport":
      // Passport format varies by country, but generally 6-9 alphanumeric characters
      return /^[A-Z0-9]{6,9}$/.test(idNumber)
    case "drivers_license":
      // Driver's license format varies by country/state
      return /^[A-Z0-9]{6,20}$/.test(idNumber)
    case "national_id":
      // National ID format varies by country
      return /^[A-Z0-9]{6,20}$/.test(idNumber)
    default:
      return idNumber.trim().length > 0
  }
}

/**
 * Store KYC verification result in database
 */
async function storeKYCVerificationResult(
  userId: string,
  result: KYCVerificationResult
) {
  const db = createServiceClient()

  try {
    await db.from("kyc_verification_results").insert({
      user_id: userId,
      verified: result.verified,
      confidence_score: result.confidenceScore,
      face_match: result.faceMatch,
      id_valid: result.idValid,
      id_type: result.idType,
      id_number: result.idNumber,
      name_match: result.nameMatch,
      name_on_id: result.nameOnId,
      date_of_birth: result.dateOfBirth,
      address_match: result.addressMatch,
      address_on_id: result.addressOnId,
      verification_method: result.verificationMethod,
      requires_manual_review: result.requiresManualReview,
      manual_review_notes: result.manualReviewNotes,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    logger.logError("[kyc] Failed to store verification result:", { error: err })
  }
}

/**
 * Request manual review for KYC verification
 */
export async function requestKYCManualReview(
  _userId: string,
  options: KYCVerificationOptions,
  notes?: string
): Promise<{ success: boolean; reviewId?: string }> {
  const user = await getAuthenticatedUser()
  const db = createServiceClient()

  try {
    const { data: review, error } = await db
      .from("kyc_verification_reviews")
      .insert({
        user_id: user.id,
        selfie_image: options.selfieImage,
        id_type: options.idType,
        id_number: options.idNumber,
        id_front_image: options.idFrontImage,
        id_back_image: options.idBackImage,
        full_name: options.fullName,
        date_of_birth: options.dateOfBirth,
        address: options.address,
        status: "pending",
        notes: notes || "Manual review requested",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single()

    if (error) throw error

    return { success: true, reviewId: review.id }
  } catch (err) {
    logger.logError("[kyc] Manual review request failed:", { error: err })
    return { success: false }
  }
}

/**
 * Get KYC verification status for a user
 */
export async function getKYCVerificationStatus(userId: string): Promise<KYCVerificationResult | null> {
  const user = await getAuthenticatedUser()
  if (user.id !== userId) throw new Error("Forbidden")
  const db = createServiceClient()

  try {
    const { data: result } = await db
      .from("kyc_verification_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!result) return null

    return {
      verified: result.verified,
      confidenceScore: result.confidence_score,
      faceMatch: result.face_match,
      idValid: result.id_valid,
      idType: result.id_type,
      idNumber: result.id_number,
      nameMatch: result.name_match,
      nameOnId: result.name_on_id,
      dateOfBirth: result.date_of_birth,
      addressMatch: result.address_match,
      addressOnId: result.address_on_id,
      verificationMethod: result.verification_method,
      requiresManualReview: result.requires_manual_review,
      manualReviewNotes: result.manual_review_notes
    }
  } catch (err) {
    logger.logError("[kyc] Failed to get verification status:", { error: err })
    return null
  }
}

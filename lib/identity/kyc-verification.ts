"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

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
  // In a real implementation, this would integrate with a KYC provider like:
  // - Onfido
  // - Jumio
  // - Trulioo
  // - Shufti Pro
  // - Sumsub
  // For now, we'll simulate the behavior

  const { userId, selfieImage, idType, idNumber, idFrontImage, fullName } = options

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Validate required fields
  if (!selfieImage || !idType) {
    return {
      verified: false,
      confidenceScore: 0,
      requiresManualReview: true,
      manualReviewNotes: "Missing required verification data"
    }
  }

  // Simulate KYC verification
  const result = await simulateKYCVerification(options)

  // Store verification result
  await storeKYCVerificationResult(userId, result)

  return result
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
    manualReviewNotes: requiresManualReview ? "Confidence score below threshold" : undefined
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
  userId: string,
  options: KYCVerificationOptions,
  notes?: string
): Promise<{ success: boolean; reviewId?: string }> {
  const db = createServiceClient()

  try {
    const { data: review, error } = await db
      .from("kyc_verification_reviews")
      .insert({
        user_id: userId,
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
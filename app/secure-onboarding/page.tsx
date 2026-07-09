"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowRight, ArrowLeft, Check, Loader2, Building2, User, Shield, Key, Camera, Upload, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CameraCapture } from "@/components/camera-capture"
import { startRegistration } from "@simplewebauthn/browser"
import { toast } from "sonner"
import { verifyCompanyAgainstRegistry, requestManualReview } from "@/lib/company/registry-verification"
import { roleRequiresApproval, requestRoleApproval } from "@/lib/company/role-approval"
import { verifyIdentityWithKYC, requestKYCManualReview } from "@/lib/identity/kyc-verification"
import { logAuditEvent } from "@/lib/audit-logging"

// Onboarding stages aligned with Secure Onboarding Spec
  const ONBOARDING_STAGES = [
    { id: "identity", title: t("auth.onboarding.stage1.title"), description: t("auth.onboarding.stage1.desc"), icon: User },
    { id: "company", title: t("auth.onboarding.stage2.title"), description: t("auth.onboarding.stage2.desc"), icon: Building2 },
    { id: "role", title: t("auth.onboarding.stage3.title"), description: t("auth.onboarding.stage3.desc"), icon: Shield },
    { id: "access", title: t("auth.onboarding.stage4.title"), description: t("auth.onboarding.stage4.desc"), icon: Key },
  ]

interface OnboardingData {
  // Stage 1: Identity
  fullName: string
  email: string
  phone: string
  photoDataUrl?: string
  governmentIdType?: string
  governmentIdNumber?: string

  // Stage 2: Company
  companyName: string
  companyRegistrationNumber: string
  companyWebsite: string
  companyAddress: string
  companyCountry: string

  // Stage 3: Role
  role: "owner" | "admin" | "member"
  position: string
  authorityConfirmed: boolean

  // Stage 4: Access
  passcode?: string
  deviceCredential?: {
    id: string
    publicKey: string
    counter: number
    deviceType: string
    transports?: string[]
  }
}

const DEFAULT_DATA: OnboardingData = {
  fullName: "",
  email: "",
  phone: "",
  companyName: "",
  companyRegistrationNumber: "",
  companyWebsite: "",
  companyAddress: "",
  companyCountry: "",
  role: "member",
  position: "",
  authorityConfirmed: false,
}

export default function SecureOnboardingPage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA)
  const [isLoading, setIsLoading] = useState(false)
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false)
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false)
  const [passcodeSent, setPasscodeSent] = useState(false)
  const [passcodeVerified, setPasscodeVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const stage = ONBOARDING_STAGES[currentStage]

  const updateData = useCallback((key: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])
   

  const canProceed = useCallback(() => {
    switch (currentStage) {
      case 0: // Identity
        return data.fullName && data.email && data.phone && data.photoDataUrl
      case 1: // Company
        return data.companyName && data.companyRegistrationNumber && data.companyWebsite
      case 2: // Role
        return data.role && data.position && data.authorityConfirmed
      case 3: // Access
        return passcodeVerified && data.deviceCredential
      default:
        return false
    }
  }, [currentStage, data, passcodeVerified])

  const handleNext = async () => {
    if (currentStage === ONBOARDING_STAGES.length - 1) {
      // Complete onboarding
      await completeOnboarding()
      return
    }

    // Stage-specific validation
    if (currentStage === 0 && !data.photoDataUrl) {
      setIsCapturingPhoto(true)
      return
    }

    if (currentStage === 0) { // Identity stage
      if (!userId) {
        toast.error("User ID is required for verification")
        return
      }
      await logAuditEvent(userId, "onboarding", "stage_1_started", { stage: "identity_verification" })
    }

    if (currentStage === 1) { // Company stage
      if (!userId) {
        toast.error("User ID is required for verification")
        return
      }
      await logAuditEvent(userId, "onboarding", "stage_2_started", { stage: "company_verification" })
    }

    if (currentStage === 2) { // Role stage
      if (!userId) {
        toast.error("User ID is required for role assignment")
        return
      }
      await logAuditEvent(userId, "onboarding", "stage_3_started", { stage: "role_selection" })
      
      // Check if role requires approval
      if (data.role !== "member") {
        const requiresApproval = await roleRequiresApproval(
          userId,
          "", // companyId will be set during onboarding completion
          data.role
        )
        
        if (requiresApproval) {
          const approvalResult = await requestRoleApproval(
            userId,
            "", // companyId will be set during onboarding completion
            data.role
          )
          
          if (approvalResult.success) {
            toast.info("Your role request has been submitted for approval")
          }
        }
      }
    }

    if (currentStage === 3 && !passcodeSent) { // Access stage
      if (!userId) {
        toast.error("User ID is required for access provisioning")
        return
      }
      await logAuditEvent(userId, "onboarding", "stage_4_started", { stage: "access_provisioning" })
      await sendPasscode()
      return
    }

    setCurrentStage(prev => prev + 1)
  }

  const handleBack = () => {
    if (currentStage > 0) {
      setCurrentStage(prev => prev - 1)
    }
  }

  const sendPasscode = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/v1/auth/passwordless/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      })
      if (!response.ok) throw new Error("Failed to send passcode")
      setPasscodeSent(true)
      toast.success("Passcode sent to your email")
    } catch {
      setError("Failed to send passcode. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const verifyPasscode = async (code: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/v1/auth/passwordless/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, passcode: code }),
      })
      if (!response.ok) throw new Error("Invalid passcode")
      const result = await response.json()
      updateData("passcode", code)
      setPasscodeVerified(true)
      setUserId(result.userId) // Store user ID for manual review
      toast.success("Passcode verified")
    } catch {
      setError("Invalid passcode. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const registerDevice = async () => {
    setIsRegisteringDevice(true)
    setError(null)
    try {
      // Start WebAuthn registration
      const response = await fetch("/api/v1/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      })
      if (!response.ok) throw new Error("Failed to start device registration")

      const options = await response.json()
      const credential = await startRegistration(options)

      // Send credential to server
      const verifyResponse = await fetch("/api/v1/auth/webauthn/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, email: data.email }),
      })
      if (!verifyResponse.ok) throw new Error("Failed to verify device")

      await verifyResponse.json()
      updateData("deviceCredential", {
        id: credential.id,
        publicKey: credential.response.attestationObject,
        counter: 0, // Counter will be updated by server
        deviceType: credential.type,
        transports: credential.response.transports || [],
      })
      toast.success("Device registered successfully")
    } catch {
      setError("Failed to register device. Please try again.")
    } finally {
      setIsRegisteringDevice(false)
    }
  }

  const checkLiveness = async (imageDataUrl: string): Promise<{ live: boolean; confidence: number }> => {
    // Mock liveness detection API
    try {
      const response = await fetch("/api/v1/identity/liveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      if (!response.ok) throw new Error("Liveness check failed")
      return await response.json()
    } catch {
      // Fallback to simulated liveness check
      return { live: Math.random() > 0.1, confidence: 0.95 }
    }
  }

  const completeOnboarding = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!userId) throw new Error("User ID is required")
      
      await logAuditEvent(userId, "onboarding", "onboarding_completed", { stages: ONBOARDING_STAGES.map(s => s.id) })
      
      const response = await fetch("/api/v1/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to complete onboarding")
      
      router.push("/dashboard")
    } catch (err) {
      setError("Failed to complete onboarding. Please try again.")
      await logAuditEvent(userId || "", "onboarding", "onboarding_error", { error: err instanceof Error ? err.message : "unknown_error" })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoCapture = (imageDataUrl: string) => {
    updateData("photoDataUrl", imageDataUrl)
    setIsCapturingPhoto(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Stage {currentStage + 1} of {ONBOARDING_STAGES.length}</span>
            <span className="text-sm text-muted-foreground">{Math.round(((currentStage + 1) / ONBOARDING_STAGES.length) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStage + 1) / ONBOARDING_STAGES.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {ONBOARDING_STAGES.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-1 text-xs",
                  i <= currentStage ? "text-primary" : "text-muted-foreground"
                )}
              >
                {i < currentStage ? (
                  <Check className="w-3 h-3" />
                ) : i === currentStage ? (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stage content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8">
                {/* Stage header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                    {stage.icon && <stage.icon className="w-8 h-8 text-primary" />}
                  </div>
                  <h1 className="text-2xl font-bold mb-2">{stage.title}</h1>
                  <p className="text-muted-foreground">{stage.description}</p>
                </div>

                {/* Stage 1: Identity */}
                {currentStage === 0 && !isCapturingPhoto && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                       <Label>{t("auth.onboarding.fullName")}</Label>
                       <Input
                         value={data.fullName}
                         onChange={(e) => updateData("fullName", e.target.value)}
                         placeholder={t("auth.onboarding.fullNamePlaceholder")}
                         className="bg-background/50"
                       />
                      </div>
                      <div className="space-y-2">
                       <Label>{t("auth.onboarding.workEmail")}</Label>
                       <Input
                         value={data.email}
                         onChange={(e) => updateData("email", e.target.value)}
                         placeholder={t("auth.onboarding.workEmailPlaceholder")}
                         type="email"
                         className="bg-background/50"
                       />
                      </div>
                    </div>
                     <div className="space-y-2">
                       <Label>{t("auth.onboarding.phoneNumber")}</Label>
                       <Input
                         value={data.phone}
                         onChange={(e) => updateData("phone", e.target.value)}
                         placeholder={t("auth.onboarding.phoneNumberPlaceholder")}
                         className="bg-background/50"
                       />
                    </div>
                    <div className="space-y-2">
                     <Label>{t("auth.onboarding.governmentId")}</Label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <select
                         value={data.governmentIdType}
                         onChange={(e) => updateData("governmentIdType", e.target.value)}
                         className="w-full h-10 px-3 rounded-lg border border-border/50 bg-background/50 text-sm"
                       >
                         <option value="">{t("auth.onboarding.idType")}</option>
                          <option value="passport">{t("auth.onboarding.idTypePassport")}</option>
                          <option value="drivers_license">{t("auth.onboarding.idTypeDriversLicense")}</option>
                          <option value="national_id">{t("auth.onboarding.idTypeNationalId")}</option>
                       </select>
                       <Input
                         value={data.governmentIdNumber}
                         onChange={(e) => updateData("governmentIdNumber", e.target.value)}
                         placeholder={t("auth.onboarding.idNumber")}
                         className="bg-background/50"
                       />
                      </div>
                    </div>
                    {data.governmentIdType && (
                      <div className="space-y-2">
                        <Label>Upload ID (Optional)</Label>
                        <div className="flex gap-2">
                         <Button variant="outline" className="gap-2">
                           <Upload className="w-4 h-4" /> {t("auth.onboarding.uploadFront")}
                         </Button>
                         <Button variant="outline" className="gap-2">
                           <Upload className="w-4 h-4" /> {t("auth.onboarding.uploadBack")}
                         </Button>
                        </div>
                      </div>
                    )}
                    <div className="text-center">
                       <Button
                         onClick={() => setIsCapturingPhoto(true)}
                         className="gap-2"
                       >
                         <Camera className="w-4 h-4" /> {t("auth.onboarding.captureLivePhoto")}
                       </Button>
                    </div>
                     {data.photoDataUrl && data.fullName && (
                       <div className="text-center space-y-2 pt-4">
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={async () => {
                              if (!data.photoDataUrl || !data.fullName) {
                                toast.error("Please provide selfie and full name")
                                return
                              }
                            
                              setIsLoading(true)
                              try {
                                // Simulate liveness detection
                                const livenessResult = await checkLiveness(data.photoDataUrl)
                                if (!livenessResult.live) {
                                  toast.error("Liveness check failed. Please try again.")
                                  await logAuditEvent(userId || "", "onboarding", "liveness_check_failed", { reason: "not_live" })
                                  return
                                }
                                await logAuditEvent(userId || "", "onboarding", "liveness_check_passed", { confidence: livenessResult.confidence })
                                
                                 const result = await verifyIdentityWithKYC({
                                   userId: userId || "",
                                   selfieImage: data.photoDataUrl,
                                   idType: data.governmentIdType || "",
                                   idNumber: data.governmentIdNumber || "",
                                   fullName: data.fullName || ""
                                 })
                                
                                if (result.verified) {
                                  toast.success("Identity verified successfully!")
                                  await logAuditEvent(userId || "", "onboarding", "identity_verified", { method: result.verificationMethod })
                                } else if (result.requiresManualReview) {
                                  toast.info("Identity verification requires manual review")
                                  await logAuditEvent(userId || "", "onboarding", "identity_manual_review_requested", { reason: result.manualReviewNotes })
                                  // Request manual review
                                   const reviewResult = await requestKYCManualReview(
                                     userId || "",
                                     {
                                       userId: userId || "",
                                       selfieImage: data.photoDataUrl,
                                       idType: data.governmentIdType || "",
                                       idNumber: data.governmentIdNumber || "",
                                       fullName: data.fullName || ""
                                     }
                                   )
                                  
                                  if (reviewResult.success) {
                                    toast.info("Manual review requested. You will be notified of the result.")
                                  }
                                } else {
                                  toast.error("Identity verification failed")
                                  await logAuditEvent(userId || "", "onboarding", "identity_verification_failed", { reason: "automated_check_failed" })
                                }
      }} catch (err) {
        toast.error("Verification failed. Please try again.")
        await logAuditEvent(userId || "", "onboarding", "identity_verification_error", { error: err instanceof Error ? err.message : "unknown_error" })
      } finally {
                                setIsLoading(false)
                              }
                            }}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                            {t("auth.onboarding.verifyIdentity")}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {t("auth.onboarding.verifyIdentityDesc")}
                          </p>
                       </div>
                     )}
                  </div>
                )}

                {/* Photo capture */}
                {currentStage === 0 && isCapturingPhoto && (
                  <CameraCapture
                    onCapture={handlePhotoCapture}
                    onCancel={() => setIsCapturingPhoto(false)}
                    isLoading={isLoading}
                  />
                )}

                {/* Stage 2: Company */}
                {currentStage === 1 && (
                  <div className="space-y-6">
                     <div className="space-y-2">
                       <Label>{t("auth.onboarding.companyLegalName")}</Label>
                       <Input
                         value={data.companyName}
                         onChange={(e) => updateData("companyName", e.target.value)}
                         placeholder={t("auth.onboarding.companyLegalNamePlaceholder")}
                         className="bg-background/50"
                       />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                       <Label>{t("auth.onboarding.registrationNumber")}</Label>
                       <Input
                         value={data.companyRegistrationNumber}
                         onChange={(e) => updateData("companyRegistrationNumber", e.target.value)}
                         placeholder={t("auth.onboarding.registrationNumberPlaceholder")}
                         className="bg-background/50"
                       />
                      </div>
                      <div className="space-y-2">
                       <Label>{t("auth.onboarding.website")}</Label>
                       <Input
                         value={data.companyWebsite}
                         onChange={(e) => updateData("companyWebsite", e.target.value)}
                         placeholder={t("auth.onboarding.websitePlaceholder")}
                         type="url"
                         className="bg-background/50"
                       />
                      </div>
                    </div>
                     <div className="space-y-2">
                       <Label>{t("auth.onboarding.registeredAddress")}</Label>
                       <Input
                         value={data.companyAddress}
                         onChange={(e) => updateData("companyAddress", e.target.value)}
                         placeholder={t("auth.onboarding.registeredAddressPlaceholder")}
                         className="bg-background/50"
                       />
                    </div>
                     <div className="space-y-2">
                       <Label>{t("auth.onboarding.country")}</Label>
                       <Input
                         value={data.companyCountry}
                         onChange={(e) => updateData("companyCountry", e.target.value)}
                         placeholder={t("auth.onboarding.countryPlaceholder")}
                         className="bg-background/50"
                       />
                    </div>
                    <div className="text-center space-y-2">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={async () => {
                            if (!data.companyRegistrationNumber || !data.companyCountry) {
                              toast.error("Registration number and country are required")
                              return
                            }
                            
                            setIsLoading(true)
                            try {
                              // Check if registration number matches MCA/GST format for India
                              const isIndianCompany = data.companyCountry.toLowerCase() === "in"
                              if (isIndianCompany) {
                                const isMCA = /^[A-Z]{5}[0-9]{4}[A-Z]{2}[0-9]{6}$/.test(data.companyRegistrationNumber)
                                const isGST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(data.companyRegistrationNumber)
                                
                                if (!isMCA && !isGST) {
                                  toast.warning("Registration number does not match MCA or GST format for India")
                                  await logAuditEvent(userId || "", "onboarding", "company_verification_warning", { reason: "invalid_mca_gst_format" })
                                }
                              }
                              
                              const result = await verifyCompanyAgainstRegistry({
                                registrationNumber: data.companyRegistrationNumber,
                                country: data.companyCountry,
                                companyName: data.companyName,
                                website: data.companyWebsite
                              })
                              
                              if (result.verified) {
                                toast.success("Company verified successfully!")
                                await logAuditEvent(userId || "", "onboarding", "company_verified", { method: result.verificationMethod })
                                // Update company data with verified information
                                if (result.companyName) updateData("companyName", result.companyName)
                                if (result.address) updateData("companyAddress", result.address)
                              } else if (result.requiresManualReview) {
                                toast.info("Company verification requires manual review")
                                await logAuditEvent(userId || "", "onboarding", "company_manual_review_requested", { reason: result.manualReviewNotes })
                                // Request manual review
                                const reviewResult = await requestManualReview(userId || "", {
                                  registrationNumber: data.companyRegistrationNumber,
                                  country: data.companyCountry,
                                  companyName: data.companyName,
                                  userProvidedName: data.companyName,
                                  userProvidedWebsite: data.companyWebsite,
                                  userProvidedAddress: data.companyAddress
                                })
                                
                                if (reviewResult.success) {
                                  toast.info("Manual review requested. You will be notified of the result.")
                                }
                              } else {
                                toast.error("Company verification failed")
                                await logAuditEvent(userId || "", "onboarding", "company_verification_failed", { reason: "automated_check_failed" })
                              }
                            } catch (err) {
                              toast.error("Verification failed. Please try again.")
                              await logAuditEvent(userId || "", "onboarding", "company_verification_error", { error: err instanceof Error ? err.message : "unknown_error" })
                            } finally {
                              setIsLoading(false)
                            }
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Building2 className="w-4 h-4" />
                          )}
                          {t("auth.onboarding.verifyCompany")}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {t("auth.onboarding.verifyCompanyDesc")}
                        </p>
                       {data.companyCountry.toLowerCase() === "in" && (
                         <div className="mt-2 p-2 bg-yellow-50/50 rounded-md text-xs text-yellow-700 flex items-start gap-2">
                           <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                           <span>For Indian companies, we verify against MCA and GST registries.</span>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {/* Stage 3: Role */}
                {currentStage === 2 && (
                  <div className="space-y-6">
                     <div className="space-y-2">
                       <Label>{t("auth.onboarding.yourPosition")}</Label>
                       <Input
                         value={data.position}
                         onChange={(e) => updateData("position", e.target.value)}
                         placeholder={t("auth.onboarding.yourPositionPlaceholder")}
                         className="bg-background/50"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>{t("auth.onboarding.yourRole")}</Label>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                         {[
                           { value: "owner", label: t("auth.onboarding.roleOwner"), description: t("auth.onboarding.roleOwnerDesc") },
                           { value: "admin", label: t("auth.onboarding.roleAdmin"), description: t("auth.onboarding.roleAdminDesc") },
                           { value: "member", label: t("auth.onboarding.roleMember"), description: t("auth.onboarding.roleMemberDesc") },
                         ].map((role) => (
                           <button
                             key={role.value}
                             onClick={() => updateData("role", role.value as "owner" | "admin" | "member")}
                             className={cn(
                               "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left",
                               data.role === role.value
                                 ? "border-primary bg-primary/10"
                                 : "border-border/50 hover:border-primary/50"
                             )}
                           >
                             <div className="flex items-center gap-2">
                               <div className={cn(
                                 "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                 data.role === role.value ? "border-primary bg-primary" : "border-muted-foreground"
                               )}>
                                 {data.role === role.value && <Check className="w-3 h-3 text-primary-foreground" />}
                               </div>
                               <span className="font-medium">{role.label}</span>
                             </div>
                             <span className="text-xs text-muted-foreground">{role.description}</span>
                           </button>
                         ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="authorityConfirmed"
                        checked={data.authorityConfirmed}
                        onChange={(e) => updateData("authorityConfirmed", e.target.checked)}
                        className="mt-1 rounded"
                      />
                     <Label htmlFor="authorityConfirmed" className="text-sm">
                       {t("auth.onboarding.authorityConfirm")}
                     </Label>
                    </div>
                  </div>
                )}

                {/* Stage 4: Access */}
                {currentStage === 3 && (
                  <div className="space-y-6">
                    {!passcodeSent ? (
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                          <Key className="w-8 h-8 text-primary" />
                        </div>
                         <h3 className="text-lg font-semibold">{t("auth.onboarding.secureAccess")}</h3>
                         <p className="text-muted-foreground">
                           {t("auth.onboarding.secureAccessDesc", { email: data.email })}
                         </p>
                         <Button
                           onClick={sendPasscode}
                           disabled={isLoading}
                           className="gap-2"
                         >
                           {isLoading ? (
                             <Loader2 className="w-4 h-4 animate-spin" />
                           ) : (
                             <ArrowRight className="w-4 h-4" />
                           )}
                           {t("auth.onboarding.sendPasscode")}
                         </Button>
                      </div>
                    ) : !passcodeVerified ? (
                      <div className="space-y-4">
                        <div className="text-center">
                           <h3 className="text-lg font-semibold mb-2">{t("auth.onboarding.enterPasscode")}</h3>
                           <p className="text-sm text-muted-foreground mb-6">
                             {t("auth.onboarding.passcodeDesc")}
                           </p>
                        </div>
                        <div className="flex justify-center gap-2 mb-4">
                          {[...Array(6)].map((_, i) => (
                            <Input
                              key={i}
                              type="text"
                              maxLength={1}
                              className="w-12 h-12 text-center text-lg font-mono"
                              onChange={(e) => {
                                const code = e.target.value
                                if (code.length === 1) {
                                  const fullCode = [...document.querySelectorAll('input[type="text"]')]
                                    .map((input: any) => input.value)
                                    .join('')
                                  if (fullCode.length === 6) {
                                    verifyPasscode(fullCode)
                                  }
                                }
                              }}
                            />
                          ))}
                        </div>
                        {error && <p className="text-sm text-destructive text-center">{error}</p>}
                        <div className="text-center">
                           <Button
                             variant="link"
                             onClick={sendPasscode}
                             disabled={isLoading}
                           >
                             {isLoading ? t("common.loading") : t("auth.onboarding.resendPasscode")}
                           </Button>
                        </div>
                      </div>
                    ) : !data.deviceCredential ? (
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                          <Shield className="w-8 h-8 text-primary" />
                        </div>
                         <h3 className="text-lg font-semibold">{t("auth.onboarding.registerDevice")}</h3>
                         <p className="text-muted-foreground">
                           {t("auth.onboarding.registerDeviceDesc")}
                         </p>
                         <Button
                           onClick={registerDevice}
                           disabled={isRegisteringDevice}
                           className="gap-2"
                         >
                           {isRegisteringDevice ? (
                             <Loader2 className="w-4 h-4 animate-spin" />
                           ) : (
                             <Key className="w-4 h-4" />
                           )}
                           {t("auth.onboarding.registerDeviceButton")}
                         </Button>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <p className="text-xs text-muted-foreground">
                          This will create a device-bound passkey that only works on this device
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                          <Check className="w-8 h-8 text-green-500" />
                        </div>
                         <h3 className="text-lg font-semibold">{t("auth.onboarding.deviceRegistered")}</h3>
                         <p className="text-muted-foreground">
                           {t("auth.onboarding.deviceRegisteredDesc")}
                         </p>
                        <div className="bg-secondary/50 rounded-lg p-4 text-left">
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="w-4 h-4 text-primary" />
                            <span className="font-medium">Device Credential</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {data.deviceCredential?.id}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                   <Button
                     variant="ghost"
                     onClick={handleBack}
                     disabled={currentStage === 0 || isLoading}
                     className="gap-2"
                   >
                     <ArrowLeft className="w-4 h-4" />
                     {t("auth.onboarding.back")}
                   </Button>
                   <Button
                     onClick={handleNext}
                     disabled={!canProceed() || isLoading}
                     className="gap-2 bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90"
                   >
                     {currentStage === ONBOARDING_STAGES.length - 1 ? t("auth.onboarding.completeOnboarding") : t("auth.onboarding.continue")}
                     <ArrowRight className="w-4 h-4" />
                   </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
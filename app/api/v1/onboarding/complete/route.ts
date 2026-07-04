"use server"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { registerWebAuthnCredential } from "@/lib/auth/webauthn/service"

export async function POST(request: Request) {
  const data = await request.json()

  const db = createServiceClient()

  try {
    // Get user by email
    const { data: user } = await db
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .single()

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Update user profile with onboarding data
    await db.from("profiles").update({
      full_name: data.fullName,
      phone: data.phone,
      photo_url: data.photoDataUrl,
      government_id_type: data.governmentIdType,
      government_id_number: data.governmentIdNumber,
      company_name: data.companyName,
      company_registration_number: data.companyRegistrationNumber,
      company_website: data.companyWebsite,
      company_address: data.companyAddress,
      company_country: data.companyCountry,
      role: data.role,
      position: data.position,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq("id", user.id)

    // Register WebAuthn credential if provided
    if (data.deviceCredential) {
      await registerWebAuthnCredential({
        userId: user.id,
        credential: data.deviceCredential,
        deviceName: `Device registered during onboarding`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    )
  }
}
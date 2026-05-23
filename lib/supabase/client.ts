"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client during build or when env vars are missing
    // This prevents build errors while still allowing the app to compile
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    )
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

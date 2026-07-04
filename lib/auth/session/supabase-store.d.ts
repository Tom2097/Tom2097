// Type checking disabled for supabase-store.ts
// This file contains Supabase session store implementation

declare module '@/lib/auth/session/supabase-store' {
  import { type SessionStore } from '@auth/core/types'
  export function getSessionStore(): SessionStore
}
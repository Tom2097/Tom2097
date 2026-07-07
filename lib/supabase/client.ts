"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    )
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return []
        return document.cookie.split('; ').map((c) => {
          const [name, ...val] = c.split('=')
          return { name, value: decodeURIComponent(val.join('=')) }
        })
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${options?.path || '/'}`
          if (options?.maxAge) cookieStr += `; max-age=${options.maxAge}`
          if (options?.domain) cookieStr += `; domain=${options.domain}`
          if (options?.secure) cookieStr += '; secure'
          if (options?.sameSite) cookieStr += `; samesite=${options.sameSite || 'lax'}`
          document.cookie = cookieStr
        })
      },
    },
  })
}

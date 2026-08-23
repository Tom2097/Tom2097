import { createServiceClient } from "@/lib/supabase/service"

/**
 * Push delivery (FCM) for the mobile app. Lazily initialized so this module
 * is safe to import even when Firebase isn't configured yet -- every
 * exported function no-ops instead of throwing until FIREBASE_PROJECT_ID /
 * FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are all set (e.g. in Coolify).
 */

type MessagingApp = import("firebase-admin/messaging").Messaging

let messagingPromise: Promise<MessagingApp | null> | null = null

async function getMessaging(): Promise<MessagingApp | null> {
  if (messagingPromise) return messagingPromise

  messagingPromise = (async () => {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    // Firebase console downloads the key with literal "\n" sequences in the
    // JSON string; env vars carry that through as literal backslash-n rather
    // than real newlines, so it has to be unescaped here.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!projectId || !clientEmail || !privateKey) {
      console.log("[push] Firebase not configured (missing env vars) -- push notifications disabled")
      return null
    }

    const { initializeApp, getApps, cert } = await import("firebase-admin/app")
    const { getMessaging: getMessagingSdk } = await import("firebase-admin/messaging")

    const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    return getMessagingSdk(app)
  })()

  return messagingPromise
}

interface PushPayload {
  title: string
  body?: string | null
  data?: Record<string, unknown>
}

/** Remove device tokens FCM reports as dead so they stop being retried forever. */
async function pruneTokens(tokens: string[]) {
  if (tokens.length === 0) return
  const db = createServiceClient()
  await db.from("device_tokens").delete().in("token", tokens)
}

/** Send a push notification to every device a user has registered. Silently no-ops if push isn't configured or the user has no devices. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const messaging = await getMessaging()
  if (!messaging) return

  const db = createServiceClient()
  const { data: devices, error } = await db.from("device_tokens").select("token").eq("user_id", userId)
  if (error) {
    console.error("[push] failed to look up device tokens:", error.message)
    return
  }
  const tokens = (devices ?? []).map((d: { token: string }) => d.token)
  if (tokens.length === 0) return

  // FCM's data payload values must all be strings.
  const stringData = Object.fromEntries(
    Object.entries(payload.data ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
  )

  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body ?? undefined },
      data: stringData,
    })

    const deadTokens = result.responses
      .map((r, i) => (!r.success && isDeadTokenError(r.error?.code) ? tokens[i] : null))
      .filter((t): t is string => t !== null)
    await pruneTokens(deadTokens)
  } catch (err) {
    console.error("[push] sendEachForMulticast failed:", err instanceof Error ? err.message : String(err))
  }
}

function isDeadTokenError(code: string | undefined): boolean {
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
}

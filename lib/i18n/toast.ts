import { toast as sonner, type ExternalToast } from "sonner"
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config"
import { getCookie } from "@/lib/i18n/cookies"
import { translatePhrase } from "@/lib/i18n/phrases"

// Drop-in for sonner's `toast` that translates string messages through the
// phrase table. Text with no translation (such as a server error) stays as is.
function tr<T>(message: T): T {
  if (typeof message !== "string" || typeof document === "undefined") return message
  return translatePhrase(resolveLocale(getCookie(LOCALE_COOKIE)), message) as T
}

type Message = Parameters<typeof sonner.success>[0]

export const toast = {
  success: (message: Message, data?: ExternalToast) => sonner.success(tr(message), data),
  error: (message: Message, data?: ExternalToast) => sonner.error(tr(message), data),
  info: (message: Message, data?: ExternalToast) => sonner.info(tr(message), data),
  warning: (message: Message, data?: ExternalToast) => sonner.warning(tr(message), data),
}

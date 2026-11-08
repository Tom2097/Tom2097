"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { T } from "@/components/i18n/t"
import { DIWALI_OFFER_ENDS_AT } from "@/lib/products"

// Checked in the browser after mount, so a cached or statically rendered page
// stops showing the offer as soon as it ends (11 Nov 2026, end of day IST).
const noopSubscribe = () => () => {}

function useDiwaliOfferActive() {
  return useSyncExternalStore(
    noopSubscribe,
    () => Date.now() < DIWALI_OFFER_ENDS_AT.getTime(),
    () => false,
  )
}

export function DiwaliOfferBanner() {
  const active = useDiwaliOfferActive()
  if (!active) return null
  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium">
        <span aria-hidden>🪔</span>
        <span><T>Diwali offer: sign up by 11 November and get a 3-month free trial.</T></span>
        <Link href="/checkout" className="underline underline-offset-2 hover:no-underline">
          <T>Start now</T>
        </Link>
      </div>
    </div>
  )
}

export function TrialLengthLabel() {
  const active = useDiwaliOfferActive()
  return active ? <T>3-month free trial (Diwali offer)</T> : <T>1-month free trial</T>
}

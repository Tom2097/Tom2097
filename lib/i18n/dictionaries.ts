import en from './translations/en.json'
import hi from './translations/hi.json'
import pa from './translations/pa.json'
import type { Locale } from './config'

export const dictionaries: Record<Locale, typeof en> = { en, hi, pa }

declare module "speakeasy" {
  interface GeneratedSecret {
    ascii: string
    hex: string
    base32: string
    otpauth_url?: string
  }
  interface TotpOptions {
    secret: string
    encoding: string
    token?: string
    step?: number
    algorithm?: string
    digits?: number
    window?: number
  }
  export function generateSecret(options?: { name?: string; length?: number; issuer?: string }): GeneratedSecret
  export function totp(options: TotpOptions): string
  export namespace totp {
    export function verify(options: TotpOptions & { token: string }): boolean
    export function generate(options: TotpOptions): string
  }
}

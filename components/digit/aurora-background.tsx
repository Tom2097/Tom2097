/**
 * Replaces the flat grid-overlay background (used elsewhere in the app)
 * for the public landing page only: three soft, blurred color fields in
 * the brand's actual triad (teal/green/blue, from the logo's three dots --
 * previously never used together anywhere in the product) plus a faint
 * grain layer so it doesn't read as a flat gradient.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: '#3ce0e2' }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full opacity-[0.13] blur-[130px]"
        style={{ background: '#00c875' }}
      />
      <div
        className="absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full opacity-[0.14] blur-[130px]"
        style={{ background: '#1a56db' }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay">
        <filter id="digit-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#digit-grain)" />
      </svg>
    </div>
  )
}

'use client'

import { motion, type Variants } from 'framer-motion'

interface InViewProps {
  children: React.ReactNode
  className?: string
  /** Seconds to delay this element's animation after it enters view. */
  delay?: number
}

// Opacity only -- no "y" translate. Framer Motion animates y via
// `transform`, and it can't be cleanly unset back to "none" afterwards
// (even a literal y: 0 target leaves transform: translateY(0px) applied).
// A lingering transform other than "none" permanently creates a new CSS
// stacking context, silently trapping any absolutely-positioned, z-indexed
// descendant (a dropdown, popover, select menu) inside whatever section
// this wraps -- it can never appear above a later sibling again. This is
// used on ~50 pages, many with real dropdowns/popovers inside the wrapped
// sections, so this isn't a one-page fix.
const defaultVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/**
 * Fades an element in the first time it scrolls into view, in the style of
 * Motion-Primitives' InView. Fires once (won't replay on scroll back up).
 */
export function InView({ children, className, delay = 0 }: InViewProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={defaultVariants}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}

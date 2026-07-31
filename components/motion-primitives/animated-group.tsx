'use client'

import { Children } from 'react'
import { motion, type Variants } from 'framer-motion'

interface AnimatedGroupProps {
  children: React.ReactNode
  className?: string
  /** Seconds to wait before the first child starts animating in. */
  delay?: number
}

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

// Deliberately opacity/filter only -- no "y" translate. Framer Motion
// animates y via `transform`, and unlike filter there is no clean way to
// unset transform back to "none" once Framer Motion has touched it (even
// transitionEnd still leaves a literal translateY(0px)). A lingering
// transform *or* filter value other than "none" permanently creates a new
// CSS stacking context, which silently traps any absolutely-positioned,
// z-indexed descendant (e.g. a dropdown/popover) so it can never appear
// above a later sibling section again -- this broke the Performance page's
// "Run Report" popover. filter is still safe to use because it's cleared
// back to "none" via transitionEnd once the transition settles.
const item: Variants = {
  hidden: { opacity: 0, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
    transitionEnd: { filter: 'none' },
  },
}

/**
 * Staggers each direct child in on mount, in the style of Motion-Primitives'
 * AnimatedGroup -- used for above-the-fold content (hero) that should
 * animate immediately rather than waiting for scroll (see InView for that).
 */
export function AnimatedGroup({ children, className, delay = 0 }: AnimatedGroupProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={container}
      transition={{ delayChildren: delay }}
    >
      {Children.map(children, (child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

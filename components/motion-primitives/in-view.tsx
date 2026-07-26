'use client'

import { motion, type Variants } from 'framer-motion'

interface InViewProps {
  children: React.ReactNode
  className?: string
  /** Seconds to delay this element's animation after it enters view. */
  delay?: number
}

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
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

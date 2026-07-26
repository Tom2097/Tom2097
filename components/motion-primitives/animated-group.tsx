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

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
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

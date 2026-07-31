'use client'

import { motion, type Variants } from 'framer-motion'

interface TextEffectProps {
  text: string
  className?: string
  /** Seconds to wait before the first word starts animating in. */
  delay?: number
}

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.045 },
  },
}

// No "y" translate -- see the detailed comment in animated-group.tsx. A
// lingering transform (which Framer Motion can't cleanly unset once a "y"
// motion value has been touched) creates a permanent stacking context just
// like a lingering filter does, silently trapping any positioned/z-indexed
// descendant behind later sibling content.
const word: Variants = {
  hidden: { opacity: 0, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
    transitionEnd: { filter: 'none' },
  },
}

/**
 * Word-by-word reveal, in the style of Motion-Primitives' TextEffect.
 * Splits on whitespace and staggers each word in independently rather than
 * animating the whole string as one block.
 */
export function TextEffect({ text, className, delay = 0 }: TextEffectProps) {
  const words = text.split(' ')

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={container}
      transition={{ delayChildren: delay }}
      style={{ display: 'inline' }}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          variants={word}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {w}
          {i !== words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.span>
  )
}

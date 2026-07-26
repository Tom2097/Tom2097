'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, type Variants } from 'framer-motion'

interface FeedItem {
  label: string
  detail: string
  color: string
}

const feed: FeedItem[] = [
  { label: 'Smart CRM', detail: 'Lead scored 92 -- routed to sales', color: '#3ce0e2' },
  { label: 'Compliance', detail: 'SOC 2 evidence check passed', color: '#00c875' },
  { label: 'Operations', detail: 'Anomaly resolved in checkout flow', color: '#1a56db' },
]

const sparkPoints = [4, 18, 12, 26, 20, 34, 28, 40, 36, 48]

function buildPath(points: number[], width: number, height: number) {
  const max = Math.max(...points)
  const step = width / (points.length - 1)
  return points
    .map((p, i) => {
      const x = i * step
      const y = height - (p / max) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString('en-US'))

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 1.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [value, motionValue])

  useEffect(() => rounded.on('change', (v) => {
    if (ref.current) ref.current.textContent = `${prefix}${v}`
  }), [rounded, prefix])

  return <span ref={ref} className="font-mono tabular-nums">{prefix}0</span>
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

export function HeroSignalPanel() {
  const path = buildPath(sparkPoints, 220, 56)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="digit-glass digit-glow-sm relative w-full max-w-md rounded-3xl border border-border/50 p-6"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Live operations
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#00c875]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c875] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00c875]" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">Revenue today</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            <AnimatedNumber value={128400} prefix="$" />
          </span>
          <span className="rounded-md bg-[#00c875]/10 px-1.5 py-0.5 text-xs font-medium text-[#00c875]">
            +12.4%
          </span>
        </div>
      </div>

      <svg viewBox="0 0 220 56" className="mt-4 h-14 w-full" fill="none">
        <motion.path
          d={path}
          stroke="#3ce0e2"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
        <motion.circle
          cx={220}
          cy={56 - (sparkPoints[sparkPoints.length - 1] / Math.max(...sparkPoints)) * 56}
          r={3}
          fill="#3ce0e2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.7 }}
        />
      </svg>

      <div className="mt-5 space-y-3 border-t border-border/50 pt-4">
        {feed.map((f, i) => (
          <motion.div
            key={f.label}
            variants={item}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.9 + i * 0.15 }}
            className="flex items-start gap-2.5"
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: f.color }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{f.label}</p>
              <p className="truncate text-xs text-muted-foreground">{f.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/**
 * A Haikei-style layered wave divider between the hero and feature grid --
 * three translucent wave shapes in the brand triad, each generated from a
 * sampled sine curve rather than hand-authored path data (see buildWavePath).
 */
function buildWavePath(
  width: number,
  height: number,
  amplitude: number,
  cycles: number,
  phase: number,
  baseline: number,
) {
  const steps = 48
  const points: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width
    const y = baseline + amplitude * Math.sin((i / steps) * Math.PI * 2 * cycles + phase)
    points.push([x, y])
  }

  let d = `M0,${height} L${points[0][0].toFixed(1)},${points[0][1].toFixed(1)} `
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    d += `Q${x0.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)} `
  }
  const last = points[points.length - 1]
  d += `L${width},${last[1].toFixed(1)} L${width},${height} Z`
  return d
}

const WIDTH = 1440
const HEIGHT = 160

const layers = [
  { amplitude: 22, cycles: 1.5, phase: 0, baseline: 70, color: '#3ce0e2', opacity: 0.1 },
  { amplitude: 26, cycles: 1.2, phase: 1.8, baseline: 95, color: '#3b7cf5', opacity: 0.09 },
  { amplitude: 18, cycles: 2, phase: 3.4, baseline: 115, color: '#00c875', opacity: 0.1 },
]

export function WaveDivider() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="block h-24 w-full sm:h-32"
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <path
          key={layer.color}
          d={buildWavePath(WIDTH, HEIGHT, layer.amplitude, layer.cycles, layer.phase, layer.baseline)}
          fill={layer.color}
          opacity={layer.opacity}
        />
      ))}
    </svg>
  )
}

import { useRef } from 'react'
import type { CupDefinition, ProfilePoint } from '../types'

type Props = { cup: CupDefinition; onChange: (points: ProfilePoint[]) => void }

export function ProfileEditor({ cup, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const width = 150
  const height = 420
  const x = (radius: number) => 18 + (radius / (cup.maxDiameterMm / 2)) * 105
  const y = (heightMm: number) => height - 15 - (heightMm / cup.heightMm) * (height - 30)
  const path = cup.outerProfile.map((point, index) => `${index ? 'L' : 'M'} ${x(point.radiusMm)} ${y(point.yMm)}`).join(' ')
  const movePoint = (id: string, event: React.PointerEvent<SVGCircleElement>) => {
    const svg = svgRef.current
    if (!svg) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = svg.getBoundingClientRect()
    const update = (clientX: number, clientY: number) => {
      const pointIndex = cup.outerProfile.findIndex((point) => point.id === id)
      if (pointIndex < 0) return
      const next = cup.outerProfile.map((point) => ({ ...point }))
      next[pointIndex].radiusMm = Math.max(cup.wallThicknessMm + 1, Math.min(cup.maxDiameterMm / 2, ((clientX - rect.left) / rect.width * width - 18) / 105 * (cup.maxDiameterMm / 2)))
      if (pointIndex > 0 && pointIndex < next.length - 1) {
        const rawY = (1 - (((clientY - rect.top) / rect.height * height) - 15) / (height - 30)) * cup.heightMm
        next[pointIndex].yMm = Math.max(next[pointIndex - 1].yMm + 0.5, Math.min(next[pointIndex + 1].yMm - 0.5, rawY))
      }
      onChange(next)
    }
    const onMove = (move: PointerEvent) => update(move.clientX, move.clientY)
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }
  return <div className="profile-editor" aria-label="杯子截面编辑器">
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line className="profile-axis" x1="18" x2="18" y1="10" y2={height - 8} />
      <path className="profile-inner-line" d={path} transform="translate(-7 0)" />
      <path className="profile-outer-line" d={path} />
      {cup.outerProfile.map((point) => <circle key={point.id} className="profile-handle" cx={x(point.radiusMm)} cy={y(point.yMm)} r="5" tabIndex={0} onPointerDown={(event) => movePoint(point.id, event)} />)}
    </svg>
    <div className="profile-legend"><span><i />外轮廓</span><span><i />内轮廓（壁厚）</span></div>
  </div>
}

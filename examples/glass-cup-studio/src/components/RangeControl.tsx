type RangeControlProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (next) => next.toFixed(step < 0.1 ? 2 : 1),
}: RangeControlProps) {
  const progress = ((value - min) / (max - min)) * 100

  return (
    <label className="range-control">
      <span className="range-control__meta">
        <span>{label}</span>
        <output>{format(value)}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-progress': `${progress}%` } as CSSProperties}
      />
    </label>
  )
}
import type { CSSProperties } from 'react'

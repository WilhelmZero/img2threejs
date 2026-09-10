import { describe, expect, it } from 'vitest'
import { BUILTIN_CUPS, getDecalBounds } from './cup'
import { getDecalCanvasSize, getDecalV } from './decal'

describe('decal texture aspect', () => {
  it('uses one fixed full-cup canvas so changing the crop region cannot resize artwork', () => {
    const first = getDecalCanvasSize(BUILTIN_CUPS['cola-can'])
    const second = getDecalCanvasSize(BUILTIN_CUPS['cola-can'])
    expect(second).toEqual(first)
    expect(first.width).toBeGreaterThan(first.height)
  })

  it('keeps area bounds as a subrange of full-cup UVs for true cropping', () => {
    const cup = BUILTIN_CUPS['cola-can']
    const short = getDecalBounds(cup, 0.35, 0)
    const tall = getDecalBounds(cup, 0.9, 0)
    const shortRange = getDecalV(short.topMm, cup.heightMm) - getDecalV(short.bottomMm, cup.heightMm)
    const tallRange = getDecalV(tall.topMm, cup.heightMm) - getDecalV(tall.bottomMm, cup.heightMm)
    expect(shortRange).toBeCloseTo(0.35)
    expect(tallRange).toBeCloseTo(0.9)
  })
})

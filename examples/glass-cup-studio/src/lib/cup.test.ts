import { describe, expect, it } from 'vitest'
import { BUILTIN_CUPS, cloneCup, fromMm, getDecalBounds, getDecalProfile, sanitizeCup, toMm, updateCupDimension } from './cup'

describe('cup geometry utilities', () => {
  it('keeps the default cola-can decal on the body below the shoulder', () => {
    const cup = BUILTIN_CUPS['cola-can']
    const bounds = getDecalBounds(cup, 0.68, -0.1)
    const profile = getDecalProfile(cup, 0.68, -0.1)
    expect(bounds.bottomMm).toBeGreaterThan(cup.baseThicknessMm)
    expect(bounds.topMm).toBeLessThan(cup.shoulderStartMm)
    expect(profile[0].yMm).toBe(bounds.bottomMm)
    expect(profile.at(-1)?.yMm).toBe(bounds.topMm)
  })

  it('converts all display units without losing the canonical millimetres', () => {
    for (const unit of ['mm', 'cm', 'in'] as const) expect(toMm(fromMm(137.25, unit), unit)).toBeCloseTo(137.25, 8)
  })

  it('scales profile heights and radii with primary dimensions', () => {
    const cup = cloneCup(BUILTIN_CUPS['cola-can'])
    const taller = updateCupDimension(cup, 'heightMm', cup.heightMm * 2)
    expect(taller.outerProfile.at(-1)?.yMm).toBe(cup.heightMm * 2)
    const wider = updateCupDimension(cup, 'maxDiameterMm', cup.maxDiameterMm * 1.5)
    expect(wider.outerProfile[3].radiusMm).toBeCloseTo(cup.outerProfile[3].radiusMm * 1.5)
  })

  it('keeps wall, opening and ordered profile inside a valid cup', () => {
    const input = cloneCup(BUILTIN_CUPS.tumbler)
    input.wallThicknessMm = 500
    input.openingDiameterMm = 999
    input.outerProfile.reverse()
    const cup = sanitizeCup(input)
    expect(cup.openingDiameterMm).toBeLessThanOrEqual(cup.maxDiameterMm - cup.wallThicknessMm * 2)
    expect(cup.outerProfile[0].yMm).toBe(0)
    expect(cup.outerProfile.at(-1)?.yMm).toBe(cup.heightMm)
  })

  it('preserves the measured can-like height to diameter ratio', () => {
    const cup = BUILTIN_CUPS['cola-can']
    expect(cup.heightMm / cup.maxDiameterMm).toBeCloseTo(5.43 / 2.55, 1)
  })

  it('includes the validated high-clarity can model dimensions', () => {
    const cup = BUILTIN_CUPS['clear-cola-can']
    expect(cup.heightMm).toBeCloseTo(137.922, 3)
    expect(cup.maxDiameterMm).toBe(75)
    expect(cup.openingDiameterMm).toBeCloseTo(61.01, 2)
    expect(cup.wallThicknessMm).toBe(1.6)
    expect(cup.outerProfile.at(-1)?.yMm).toBeCloseTo(cup.heightMm, 3)
  })

  it('moves the shoulder section and synchronizes the editable cup opening', () => {
    const cup = cloneCup(BUILTIN_CUPS['cola-can'])
    const moved = updateCupDimension(cup, 'shoulderStartMm', 100)
    expect(moved.outerProfile.some((point) => Math.abs(point.yMm - 100) < 0.01)).toBe(true)
    const opened = updateCupDimension(cup, 'openingDiameterMm', 50)
    expect(opened.outerProfile.at(-1)?.radiusMm).toBeCloseTo(50 / 2 + cup.wallThicknessMm)
  })
})

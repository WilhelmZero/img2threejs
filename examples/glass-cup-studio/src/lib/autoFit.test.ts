import { describe, expect, it } from 'vitest'
import { buildAutoFitPlan, clampAutoFitRounds } from './autoFit'

describe('automatic cup fitting plan', () => {
  it('defaults and clamps the round limit to 1–8', () => {
    expect(clampAutoFitRounds(Number.NaN)).toBe(4)
    expect(clampAutoFitRounds(0)).toBe(1)
    expect(clampAutoFitRounds(99)).toBe(8)
  })

  it('builds targeted steps in order', () => {
    const plan = buildAutoFitPlan(4)
    expect(plan).toHaveLength(4)
    expect(plan.map((step) => step.title)).toEqual(['尺寸与总体比例', '杯口与上半部', '腰部与杯底', '整体对照验收'])
  })
})

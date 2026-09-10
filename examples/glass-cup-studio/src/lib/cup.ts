import type { CupDefinition, CupModel, LengthUnit, ProfilePoint } from '../types'

export const MM_PER_WORLD_UNIT = 30
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function points(values: Array<[number, number]>): ProfilePoint[] {
  return values.map(([yMm, radiusMm], index) => ({ id: `p-${index}`, yMm, radiusMm }))
}

export const BUILTIN_CUPS: Record<CupModel, CupDefinition> = {
  tumbler: {
    id: 'tumbler', name: '玻璃直筒杯', source: 'builtin', heightMm: 100, maxDiameterMm: 98,
    openingDiameterMm: 91, wallThicknessMm: 4, baseThicknessMm: 10, shoulderStartMm: 88,
    rimRadiusMm: 2.5, bottomRadiusMm: 4,
    outerProfile: points([[0, 46], [3, 47.5], [10, 48], [88, 48.5], [97, 48], [100, 47.5]]),
  },
  'cola-can': {
    id: 'cola-can', name: '可乐罐', source: 'builtin', heightMm: 138, maxDiameterMm: 65,
    openingDiameterMm: 57, wallThicknessMm: 2.5, baseThicknessMm: 7, shoulderStartMm: 116,
    rimRadiusMm: 1.6, bottomRadiusMm: 2.5,
    outerProfile: points([[0, 29.8], [2, 31.2], [7, 32.3], [112, 32.5], [119, 31.7], [126, 29.8], [132, 28.9], [138, 28.7]]),
  },
  'clear-cola-can': {
    id: 'clear-cola-can', name: '高透可乐罐', source: 'builtin', heightMm: 137.922, maxDiameterMm: 75,
    openingDiameterMm: 61.01, wallThicknessMm: 1.6, baseThicknessMm: 5.1, shoulderStartMm: 106,
    rimRadiusMm: 0.94, bottomRadiusMm: 7.4,
    outerProfile: points([
      [0, 31.2], [0.1, 32.7], [2.03, 35.72], [5.59, 37.1], [7.4, 37.3], [16, 37.5],
      [62.5, 37.5], [106, 37.5], [110.54, 37.27], [114.36, 36.65], [118.36, 35.49],
      [123.5, 33.5], [128.84, 31.98], [132.5, 31.65], [134.97, 32.02], [136.98, 32.385], [137.922, 31.445],
    ]),
  },
  'tall-wine-glass': {
    id: 'tall-wine-glass', name: '高透高脚杯', source: 'builtin', heightMm: 242, maxDiameterMm: 80.6,
    openingDiameterMm: 57.6, wallThicknessMm: 1.2, baseThicknessMm: 3.2, shoulderStartMm: 220,
    rimRadiusMm: 0.8, bottomRadiusMm: 3.2,
    modelAsset: 'models/tall-clear-wine-glass-60x242.glb',
    modelDimensionsMm: { height: 242, diameter: 80.6 },
    printAreaMm: { bottom: 148.4, top: 236 },
    // A compact metadata profile is retained for decal wrapping and the maker
    // cross-section. The rendered glass itself comes from the validated GLB.
    outerProfile: points([
      [0, 39.5], [3.2, 39.5], [4.2, 3.1], [105, 3.1], [109.5, 4.2], [121.5, 6],
      [128, 17.3], [136, 29.3], [142, 36.5], [148.4, 39.55], [152, 40.2], [156, 40.3],
      [166, 39.7], [180, 37.6], [200, 34.8], [220, 32.2], [230, 31], [236, 30.25], [242, 30],
    ]),
  },
}

export function cloneCup(cup: CupDefinition): CupDefinition {
  return {
    ...cup,
    outerProfile: cup.outerProfile.map((point) => ({ ...point })),
    modelDimensionsMm: cup.modelDimensionsMm ? { ...cup.modelDimensionsMm } : undefined,
    printAreaMm: cup.printAreaMm ? { ...cup.printAreaMm } : undefined,
  }
}

export function sanitizeCup(input: CupDefinition): CupDefinition {
  const heightMm = clamp(Number(input.heightMm) || 100, 30, 500)
  const maxDiameterMm = clamp(Number(input.maxDiameterMm) || 70, 20, 250)
  const wallThicknessMm = clamp(Number(input.wallThicknessMm) || 2.5, 0.5, Math.max(1, maxDiameterMm * 0.2))
  const baseThicknessMm = clamp(Number(input.baseThicknessMm) || 5, 1, Math.min(40, heightMm * 0.3))
  const outerProfile = [...input.outerProfile]
    .map((point, index) => ({
      id: point.id || `p-${index}`,
      yMm: clamp(Number(point.yMm) || 0, 0, heightMm),
      radiusMm: clamp(Number(point.radiusMm) || maxDiameterMm / 2, wallThicknessMm + 1, maxDiameterMm / 2),
    }))
    .sort((a, b) => a.yMm - b.yMm)
  if (outerProfile.length < 4) return cloneCup(BUILTIN_CUPS.tumbler)
  outerProfile[0].yMm = 0
  outerProfile[outerProfile.length - 1].yMm = heightMm
  return {
    ...input, heightMm, maxDiameterMm, wallThicknessMm, baseThicknessMm, outerProfile,
    openingDiameterMm: clamp(Number(input.openingDiameterMm) || maxDiameterMm - wallThicknessMm * 2, 5, maxDiameterMm - wallThicknessMm * 2),
    shoulderStartMm: clamp(Number(input.shoulderStartMm) || heightMm * 0.82, baseThicknessMm, heightMm),
    rimRadiusMm: clamp(Number(input.rimRadiusMm) || 1.5, 0.4, 12),
    bottomRadiusMm: clamp(Number(input.bottomRadiusMm) || 2.5, 0.4, 20),
  }
}

export function updateCupDimension(cup: CupDefinition, key: keyof CupDefinition, value: number): CupDefinition {
  if (key === 'heightMm') {
    const ratio = value / cup.heightMm
    return sanitizeCup({
      ...cup,
      heightMm: value,
      outerProfile: cup.outerProfile.map((point) => ({ ...point, yMm: point.yMm * ratio })),
      printAreaMm: cup.printAreaMm ? { bottom: cup.printAreaMm.bottom * ratio, top: cup.printAreaMm.top * ratio } : undefined,
    })
  }
  if (key === 'maxDiameterMm') {
    const ratio = value / cup.maxDiameterMm
    return sanitizeCup({ ...cup, maxDiameterMm: value, openingDiameterMm: cup.openingDiameterMm * ratio, outerProfile: cup.outerProfile.map((point) => ({ ...point, radiusMm: point.radiusMm * ratio })) })
  }
  if (key === 'openingDiameterMm') {
    const openingDiameterMm = clamp(value, 5, cup.maxDiameterMm - cup.wallThicknessMm * 2)
    const topRadius = openingDiameterMm / 2 + cup.wallThicknessMm
    return sanitizeCup({ ...cup, openingDiameterMm, outerProfile: cup.outerProfile.map((point, index) => index === cup.outerProfile.length - 1 ? { ...point, radiusMm: topRadius } : point) })
  }
  if (key === 'shoulderStartMm') {
    const shoulderStartMm = clamp(value, cup.baseThicknessMm, cup.heightMm - 1)
    const upper = cup.outerProfile
      .filter((point) => point.yMm > cup.shoulderStartMm)
      .map((point) => ({ ...point, yMm: shoulderStartMm + ((point.yMm - cup.shoulderStartMm) / Math.max(1, cup.heightMm - cup.shoulderStartMm)) * (cup.heightMm - shoulderStartMm) }))
    const lower = cup.outerProfile.filter((point) => point.yMm < Math.min(cup.shoulderStartMm, shoulderStartMm))
    const shoulderPoint = { id: `shoulder-${Date.now()}`, yMm: shoulderStartMm, radiusMm: cup.maxDiameterMm / 2 }
    return sanitizeCup({ ...cup, shoulderStartMm, outerProfile: [...lower, shoulderPoint, ...upper] })
  }
  return sanitizeCup({ ...cup, [key]: value })
}

export function fromMm(value: number, unit: LengthUnit) {
  return unit === 'cm' ? value / 10 : unit === 'in' ? value / 25.4 : value
}

export function toMm(value: number, unit: LengthUnit) {
  return unit === 'cm' ? value * 10 : unit === 'in' ? value * 25.4 : value
}

export function unitStep(unit: LengthUnit) {
  return unit === 'mm' ? 0.1 : unit === 'cm' ? 0.01 : 0.001
}

export function getOuterRadiusAt(cup: CupDefinition, yMm: number) {
  const profile = cup.outerProfile
  for (let index = 1; index < profile.length; index += 1) {
    const left = profile[index - 1]
    const right = profile[index]
    if (yMm <= right.yMm) {
      const t = (yMm - left.yMm) / Math.max(right.yMm - left.yMm, 0.001)
      return left.radiusMm + (right.radiusMm - left.radiusMm) * clamp(t, 0, 1)
    }
  }
  return profile[profile.length - 1].radiusMm
}

export function getDecalBounds(cup: CupDefinition, areaHeight: number, areaCenterY: number) {
  const heightRatio = clamp(Number(areaHeight) || 0.68, 0.15, 1)
  const centerPosition = clamp(Number(areaCenterY) || 0, -1, 1)
  const freeRatio = 1 - heightRatio
  const centerRatio = 0.5 + centerPosition * freeRatio / 2
  const rangeBottomMm = cup.printAreaMm?.bottom ?? 0
  const rangeTopMm = cup.printAreaMm?.top ?? cup.heightMm
  const printableHeightMm = rangeTopMm - rangeBottomMm
  return {
    bottomMm: rangeBottomMm + printableHeightMm * (centerRatio - heightRatio / 2),
    topMm: rangeBottomMm + printableHeightMm * (centerRatio + heightRatio / 2),
  }
}

export function getDecalProfile(cup: CupDefinition, areaHeight: number, areaCenterY: number) {
  const { bottomMm, topMm } = getDecalBounds(cup, areaHeight, areaCenterY)
  const middle = cup.outerProfile.filter((point) => point.yMm > bottomMm && point.yMm < topMm)
  return [
    { id: 'decal-bottom', yMm: bottomMm, radiusMm: getOuterRadiusAt(cup, bottomMm) },
    ...middle,
    { id: 'decal-top', yMm: topMm, radiusMm: getOuterRadiusAt(cup, topMm) },
  ]
}

export function cupToWorldProfile(cup: CupDefinition, insetMm = 0) {
  return cup.outerProfile.map((point) => ({ radius: Math.max(0.1, point.radiusMm - insetMm) / MM_PER_WORLD_UNIT, y: (point.yMm - cup.heightMm / 2) / MM_PER_WORLD_UNIT }))
}

export function createManualCup(): CupDefinition {
  const base = cloneCup(BUILTIN_CUPS['cola-can'])
  return { ...base, id: `custom-${Date.now()}`, name: '未命名杯型', source: 'manual' }
}

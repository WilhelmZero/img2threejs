import { getOuterRadiusAt } from './cup'
import type { CupDefinition } from '../types'

export function getDecalCanvasSize(cup: CupDefinition, maxTextureSize = 2048) {
  const bottomMm = cup.printAreaMm?.bottom ?? 0
  const topMm = cup.printAreaMm?.top ?? cup.heightMm
  const physicalHeight = Math.max(1, topMm - bottomMm)
  const middleRadius = getOuterRadiusAt(cup, bottomMm + physicalHeight / 2)
  const physicalWidth = Math.max(1, Math.PI * 2 * middleRadius)
  const aspect = physicalWidth / physicalHeight
  return aspect >= 1
    ? { width: maxTextureSize, height: Math.max(1, Math.round(maxTextureSize / aspect)) }
    : { width: Math.max(1, Math.round(maxTextureSize * aspect)), height: maxTextureSize }
}

export function getDecalV(yMm: number, cup: CupDefinition) {
  const bottomMm = cup.printAreaMm?.bottom ?? 0
  const topMm = cup.printAreaMm?.top ?? cup.heightMm
  return Math.min(1, Math.max(0, (yMm - bottomMm) / Math.max(1, topMm - bottomMm)))
}

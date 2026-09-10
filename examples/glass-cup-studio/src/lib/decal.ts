import { getOuterRadiusAt } from './cup'
import type { CupDefinition } from '../types'

export function getDecalCanvasSize(cup: CupDefinition, maxTextureSize = 2048) {
  const physicalHeight = Math.max(1, cup.heightMm)
  const middleRadius = getOuterRadiusAt(cup, cup.heightMm / 2)
  const physicalWidth = Math.max(1, Math.PI * 2 * middleRadius)
  const aspect = physicalWidth / physicalHeight
  return aspect >= 1
    ? { width: maxTextureSize, height: Math.max(1, Math.round(maxTextureSize / aspect)) }
    : { width: Math.max(1, Math.round(maxTextureSize * aspect)), height: maxTextureSize }
}

export function getDecalV(yMm: number, cupHeightMm: number) {
  return Math.min(1, Math.max(0, yMm / Math.max(1, cupHeightMm)))
}

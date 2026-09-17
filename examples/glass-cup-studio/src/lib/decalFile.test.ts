import { describe, expect, it } from 'vitest'
import { isSupportedDecalFile } from './decalFile'

describe('decal file support', () => {
  it('accepts raster images and PDF artwork', () => {
    expect(isSupportedDecalFile({ name: 'art.png', type: 'image/png' })).toBe(true)
    expect(isSupportedDecalFile({ name: 'art.pdf', type: 'application/pdf' })).toBe(true)
    expect(isSupportedDecalFile({ name: 'ART.PDF', type: '' })).toBe(true)
    expect(isSupportedDecalFile({ name: 'model.obj', type: 'text/plain' })).toBe(false)
  })
})

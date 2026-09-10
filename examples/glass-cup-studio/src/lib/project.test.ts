import { describe, expect, it } from 'vitest'
import { createProject, projectWithoutSecrets, validateProject } from './project'
import type { SceneSettings } from '../types'

const scene: SceneSettings = { preset: 'studio', backgroundColor: '#111111', floorColor: '#222222', environmentIntensity: 1, keyLightIntensity: 2, rimLightIntensity: 3, keyLightColor: '#ffffff', rimLightColor: '#ffffff', lightRigRotation: 0, keyLightAzimuth: 138, keyLightElevation: 1.25, rimLightAzimuth: -36, rimLightElevation: 0.82, lightDistance: 1, lightSoftness: 1, floorReflective: true }

describe('project format', () => {
  it('round-trips a complete v1 project', () => {
    const original = createProject(scene)
    original.decal = { name: 'mark.png', dataUrl: 'data:image/png;base64,abc' }
    const restored = validateProject(JSON.parse(JSON.stringify(original)))
    expect(restored.schema).toBe('glass-studio.project.v1')
    expect(restored.cup.outerProfile).toEqual(original.cup.outerProfile)
    expect(restored.decal).toEqual(original.decal)
    expect(restored.scene).toEqual(original.scene)
  })

  it('rejects unknown schema versions', () => {
    expect(() => validateProject({ schema: 'glass-studio.project.v2' })).toThrow(/版本/)
  })

  it('adds decal-region defaults to older v1 projects', () => {
    const legacy = JSON.parse(JSON.stringify(createProject(scene)))
    delete legacy.texture.areaHeight
    delete legacy.texture.areaCenterY
    const restored = validateProject(legacy)
    expect(restored.texture.areaHeight).toBe(0.68)
    expect(restored.texture.areaCenterY).toBe(-0.1)
  })

  it('adds stage-light defaults to older v1 projects', () => {
    const legacy = JSON.parse(JSON.stringify(createProject(scene)))
    delete legacy.scene.lightDistance
    delete legacy.scene.lightSoftness
    const restored = validateProject(legacy)
    expect(restored.scene.lightDistance).toBe(1)
    expect(restored.scene.lightSoftness).toBe(1)
  })

  it('adds an empty AI refinement history to older v1 projects', () => {
    const legacy = JSON.parse(JSON.stringify(createProject(scene)))
    delete legacy.refinements
    expect(validateProject(legacy).refinements).toEqual([])
  })

  it('restores and clamps the automatic fitting round limit', () => {
    const legacy = JSON.parse(JSON.stringify(createProject(scene)))
    delete legacy.aiSettings
    expect(validateProject(legacy).aiSettings.maxAutoRounds).toBe(4)
    legacy.aiSettings = { maxAutoRounds: 99 }
    expect(validateProject(legacy).aiSettings.maxAutoRounds).toBe(8)
  })

  it('never invents or exports an API key field', () => {
    const unsafe = { ...createProject(scene), apiKey: 'sk-test', nestedSecret: { apiKey: 'sk-test' } }
    const serialized = JSON.stringify(projectWithoutSecrets(unsafe))
    expect(serialized.toLowerCase()).not.toContain('apikey')
    expect(serialized).not.toContain('sk-test')
  })
})

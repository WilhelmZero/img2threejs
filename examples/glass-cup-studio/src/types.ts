export type TextureSettings = {
  engraving?: boolean
  scale: number
  repeat: boolean
  areaHeight: number
  areaCenterY: number
  offsetX: number
  offsetY: number
  rotation: number
  intensity: number
}

export type GlassSettings = {
  transmission: number
  roughness: number
  ior: number
  color: string
}

export type LengthUnit = 'mm' | 'cm' | 'in'
export type WorkspaceMode = 'decal' | 'maker'
export type CupSource = 'builtin' | 'manual' | 'ai' | 'glb'

export type ProfilePoint = { id: string; yMm: number; radiusMm: number }

export type CupDefinition = {
  id: string
  name: string
  source: CupSource
  heightMm: number
  maxDiameterMm: number
  openingDiameterMm: number
  wallThicknessMm: number
  baseThicknessMm: number
  shoulderStartMm: number
  rimRadiusMm: number
  bottomRadiusMm: number
  outerProfile: ProfilePoint[]
  modelAsset?: string
  modelDimensionsMm?: { height: number; diameter: number }
  printAreaMm?: { bottom: number; top: number }
}

export type CupModel = 'tumbler' | 'cola-can' | 'clear-cola-can' | 'tall-wine-glass'
export type ScenePreset = 'studio' | 'daylight' | 'midnight'

export type SceneSettings = {
  preset: ScenePreset
  backgroundColor: string
  floorColor: string
  environmentIntensity: number
  keyLightIntensity: number
  rimLightIntensity: number
  keyLightColor: string
  rimLightColor: string
  lightRigRotation: number
  keyLightAzimuth: number
  keyLightElevation: number
  rimLightAzimuth: number
  rimLightElevation: number
  lightDistance: number
  lightSoftness: number
  floorReflective: boolean
}

export type ReferenceRole = 'front' | 'side' | 'top' | 'bottom' | 'detail-1' | 'detail-2'
export type ReferenceImage = { id: string; role: ReferenceRole; name: string; dataUrl: string }
export type Calibration = { dimension: 'height' | 'diameter' | 'opening'; valueMm: number }
export type AiAnalysis = { confidence: number; assumptions: string[]; warnings: string[]; model: string; createdAt: string }
export type AiRefinement = { id: string; instruction: string; summary: string; confidence: number; createdAt: string }
export type AiSettings = { maxAutoRounds: number }

export type GlassStudioProjectV1 = {
  schema: 'glass-studio.project.v1'
  id: string
  name: string
  updatedAt: string
  cup: CupDefinition
  glass: GlassSettings
  texture: TextureSettings
  scene: SceneSettings
  decal: { name: string; dataUrl: string }
  references: ReferenceImage[]
  calibration: Calibration
  analysis: AiAnalysis | null
  refinements: AiRefinement[]
  aiSettings: AiSettings
}

export type MakerStage = 'idle' | 'compressing' | 'sending' | 'validating' | 'building' | 'done' | 'error'

export type SceneHandle = {
  resetCamera: () => void
  exportPng: () => Promise<boolean>
  exportGlb: (project: GlassStudioProjectV1) => Promise<boolean>
}

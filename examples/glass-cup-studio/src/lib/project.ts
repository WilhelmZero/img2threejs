import { BUILTIN_CUPS, cloneCup, sanitizeCup } from './cup'
import type { Calibration, GlassSettings, GlassStudioProjectV1, ReferenceImage, SceneSettings, TextureSettings } from '../types'

export const DEFAULT_TEXTURE: TextureSettings = {
  scale: 1,
  repeat: false,
  areaHeight: 0.68,
  areaCenterY: -0.1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  intensity: 0.9,
}
export const DEFAULT_GLASS: GlassSettings = { transmission: 0.985, roughness: 0.035, ior: 1.48, color: '#ffffff' }
export const DEFAULT_CALIBRATION: Calibration = { dimension: 'height', valueMm: 138 }
export const DEFAULT_AI_SETTINGS = { maxAutoRounds: 4 }
export const DEFAULT_LIGHT_RIG = {
  lightRigRotation: 0,
  keyLightAzimuth: 138,
  keyLightElevation: 1.25,
  rimLightAzimuth: -36,
  rimLightElevation: 0.82,
  lightDistance: 1,
  lightSoftness: 1,
}

export function createProject(scene: SceneSettings): GlassStudioProjectV1 {
  return {
    schema: 'glass-studio.project.v1', id: crypto.randomUUID(), name: '我的玻璃杯', updatedAt: new Date().toISOString(),
    cup: cloneCup(BUILTIN_CUPS['cola-can']), glass: { ...DEFAULT_GLASS }, texture: { ...DEFAULT_TEXTURE }, scene: { ...scene },
    decal: { name: '默认矿物纹理', dataUrl: '' }, references: [], calibration: { ...DEFAULT_CALIBRATION }, analysis: null, refinements: [], aiSettings: { ...DEFAULT_AI_SETTINGS },
  }
}

export function validateProject(value: unknown): GlassStudioProjectV1 {
  if (!value || typeof value !== 'object') throw new Error('工程文件不是有效对象')
  const project = value as Partial<GlassStudioProjectV1>
  if (project.schema !== 'glass-studio.project.v1') throw new Error('不支持的工程文件版本')
  if (!project.cup || !project.glass || !project.texture || !project.scene) throw new Error('工程文件缺少必要字段')
  return {
    schema: 'glass-studio.project.v1',
    id: typeof project.id === 'string' ? project.id : crypto.randomUUID(),
    name: typeof project.name === 'string' ? project.name : '导入的玻璃杯',
    cup: sanitizeCup(project.cup),
    glass: { ...project.glass },
    texture: { ...DEFAULT_TEXTURE, ...project.texture },
    scene: { ...DEFAULT_LIGHT_RIG, ...project.scene },
    decal: project.decal && typeof project.decal.name === 'string' && typeof project.decal.dataUrl === 'string' ? { ...project.decal } : { name: '', dataUrl: '' },
    references: Array.isArray(project.references) ? project.references.slice(0, 6) : [],
    calibration: project.calibration && project.calibration.valueMm > 0 ? { ...project.calibration } : { ...DEFAULT_CALIBRATION },
    analysis: project.analysis ?? null,
    refinements: Array.isArray(project.refinements) ? project.refinements.slice(-12) : [],
    aiSettings: { maxAutoRounds: Math.min(8, Math.max(1, Math.round(project.aiSettings?.maxAutoRounds ?? DEFAULT_AI_SETTINGS.maxAutoRounds))) },
    updatedAt: new Date().toISOString(),
  }
}

export function projectWithoutSecrets(project: GlassStudioProjectV1) {
  return validateProject({
    schema: project.schema, id: project.id, name: project.name, updatedAt: new Date().toISOString(), cup: project.cup,
    glass: project.glass, texture: project.texture, scene: project.scene, decal: project.decal,
    references: project.references, calibration: project.calibration, analysis: project.analysis, refinements: project.refinements, aiSettings: project.aiSettings,
  })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportProjectJson(project: GlassStudioProjectV1) {
  downloadBlob(new Blob([JSON.stringify(projectWithoutSecrets(project), null, 2)], { type: 'application/json' }), `${safeName(project.name)}.glass.json`)
}

export async function importProjectJson(file: File) {
  return validateProject(JSON.parse(await file.text()))
}

export async function fileToReference(file: File, role: ReferenceImage['role']): Promise<ReferenceImage> {
  if (!file.type.startsWith('image/')) throw new Error('请选择 JPG、PNG 或 WebP 图片')
  if (file.size > 10 * 1024 * 1024) throw new Error('单张图片不能超过 10MB')
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(sourceUrl)
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理图片')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { id: crypto.randomUUID(), role, name: file.name, dataUrl: canvas.toDataURL('image/webp', 0.84) }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = url
  })
}

function safeName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'glass-cup'
}

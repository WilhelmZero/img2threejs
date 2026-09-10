import { sanitizeCup } from './cup'
import type { AiAnalysis, AiRefinement, Calibration, CupDefinition, MakerStage, ReferenceImage } from '../types'

type AiCupResult = {
  confidence: number
  heightToDiameter: number
  openingToDiameter: number
  wallToDiameter: number
  baseToHeight: number
  shoulderStartRatio: number
  rimRadiusRatio: number
  bottomRadiusRatio: number
  profile: Array<{ yRatio: number; radiusRatio: number }>
  assumptions: string[]
  warnings: string[]
  summary: string
}

const schema = {
  type: 'object', additionalProperties: false,
  required: ['confidence', 'heightToDiameter', 'openingToDiameter', 'wallToDiameter', 'baseToHeight', 'shoulderStartRatio', 'rimRadiusRatio', 'bottomRadiusRatio', 'profile', 'assumptions', 'warnings', 'summary'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    heightToDiameter: { type: 'number', minimum: 0.3, maximum: 8 },
    openingToDiameter: { type: 'number', minimum: 0.2, maximum: 1 },
    wallToDiameter: { type: 'number', minimum: 0.005, maximum: 0.2 },
    baseToHeight: { type: 'number', minimum: 0.005, maximum: 0.3 },
    shoulderStartRatio: { type: 'number', minimum: 0.2, maximum: 1 },
    rimRadiusRatio: { type: 'number', minimum: 0.003, maximum: 0.15 },
    bottomRadiusRatio: { type: 'number', minimum: 0.003, maximum: 0.2 },
    profile: { type: 'array', minItems: 6, maxItems: 32, items: { type: 'object', additionalProperties: false, required: ['yRatio', 'radiusRatio'], properties: { yRatio: { type: 'number', minimum: 0, maximum: 1 }, radiusRatio: { type: 'number', minimum: 0.05, maximum: 0.5 } } } },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    warnings: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    summary: { type: 'string', maxLength: 240 },
  },
}

export async function analyzeCupImages(options: {
  apiKey: string
  model: string
  references: ReferenceImage[]
  calibration: Calibration
  signal?: AbortSignal
  onStage: (stage: MakerStage) => void
  sampledProfile?: Array<{ yRatio: number; radiusRatio: number }>
  currentCup?: CupDefinition
  refinementInstruction?: string
  refinementHistory?: AiRefinement[]
  analysisFocus?: string
}) {
  const { apiKey, model, references, calibration, signal, onStage, sampledProfile, currentCup, refinementInstruction, refinementHistory = [], analysisFocus } = options
  if (!apiKey.trim()) throw new Error('请先配置 API Key')
  if (!sampledProfile && references.length < 1) throw new Error('AI 识别至少需要一张参考图片')
  if (!(calibration.valueMm > 0)) throw new Error('请填写一项真实尺寸')
  if (refinementInstruction !== undefined && !refinementInstruction.trim()) throw new Error('请输入希望 AI 如何调整杯型')
  onStage('compressing')
  await Promise.resolve()
  const content: Array<Record<string, unknown>> = [{
    type: 'input_text',
    text: buildPrompt({ calibration, sampledProfile, currentCup, refinementInstruction, refinementHistory, analysisFocus }),
  }]
  references.forEach((reference) => content.push({ type: 'input_image', image_url: reference.dataUrl, detail: 'high' }))
  onStage('sending')
  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), 60000)
  const abort = () => timeout.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      signal: timeout.signal,
      body: JSON.stringify({ model, store: false, input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'cup_profile', strict: true, schema } } }),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) throw new Error(apiError(response.status, payload))
    onStage('validating')
    const text = extractOutputText(payload)
    const result = JSON.parse(text) as AiCupResult
    const cup = resultToCup(result, calibration)
    if (result.confidence < 0.45) throw new Error('参考图置信度过低，请补充正面或侧面照片')
    onStage('building')
    await Promise.resolve()
    const analysis: AiAnalysis = { confidence: result.confidence, assumptions: result.assumptions, warnings: result.warnings, model, createdAt: new Date().toISOString() }
    onStage('done')
    return { cup, analysis, summary: result.summary }
  } catch (error) {
    onStage('error')
    if (timeout.signal.aborted) throw new Error(signal?.aborted ? '分析已取消' : '分析超时，请重试')
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function buildPrompt(options: {
  calibration: Calibration
  sampledProfile?: Array<{ yRatio: number; radiusRatio: number }>
  currentCup?: CupDefinition
  refinementInstruction?: string
  refinementHistory: AiRefinement[]
  analysisFocus?: string
}) {
  const { calibration, sampledProfile, currentCup, refinementInstruction, refinementHistory, analysisFocus } = options
  const common = `Model one rotationally symmetric, handle-free drinking glass from the reference images. Extract the OUTER GLASS SILHOUETTE only. Ignore logos, engraving, liquid, ice, highlights, shadows, perspective background and dimension arrows. Read any printed dimensions in the images and use them as strong evidence. The confirmed calibration is ${calibration.dimension}=${calibration.valueMm} mm. Return a smooth lathe profile with extra points at every curvature transition. radiusRatio is radius divided by maximum diameter, so its largest valid value is 0.5. Preserve asymmetric-looking perspective only as camera distortion; the physical model must remain rotationally symmetric.`
  const sampled = sampledProfile ? ` A locally sampled GLB silhouette is ${JSON.stringify(sampledProfile)}.` : ''
  const focus = analysisFocus?.trim() ? ` Workflow focus for this round: ${analysisFocus.trim()}` : ''
  if (!currentCup || refinementInstruction === undefined) return `${common}${sampled}${focus} In summary, briefly state the recognized shape and the most important dimensions.`
  const current = {
    heightMm: currentCup.heightMm,
    maxDiameterMm: currentCup.maxDiameterMm,
    openingDiameterMm: currentCup.openingDiameterMm,
    wallThicknessMm: currentCup.wallThicknessMm,
    baseThicknessMm: currentCup.baseThicknessMm,
    shoulderStartMm: currentCup.shoulderStartMm,
    rimRadiusMm: currentCup.rimRadiusMm,
    bottomRadiusMm: currentCup.bottomRadiusMm,
    profile: currentCup.outerProfile.map((point) => ({ yRatio: point.yMm / currentCup.heightMm, radiusRatio: point.radiusMm / currentCup.maxDiameterMm })),
  }
  const prior = refinementHistory.slice(-5).map((item) => ({ instruction: item.instruction, result: item.summary }))
  return `${common}${sampled}${focus}\nThis is a refinement turn. Compare the CURRENT MODEL against every reference image and correct the model rather than starting from a generic cylinder. Current editable model: ${JSON.stringify(current)}. Previous refinements: ${JSON.stringify(prior)}. User instruction: ${refinementInstruction.trim()}. If the instruction is "对照原图再优化", independently identify the largest remaining silhouette mismatch. Preserve confirmed dimensions unless the images contain a more explicit printed measurement. In summary, describe exactly what geometric changes were made.`
}

export async function testApiConnection(apiKey: string, model: string) {
  if (!apiKey.trim()) throw new Error('请输入 API Key')
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${apiKey.trim()}` } })
  if (!response.ok) throw new Error(apiError(response.status, await response.json().catch(() => null)))
}

function extractOutputText(payload: Record<string, unknown> | null) {
  const output = payload?.output
  if (!Array.isArray(output)) throw new Error('API 没有返回可解析结果')
  for (const item of output) {
    if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue
    for (const content of (item as { content: unknown[] }).content) {
      if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') return (content as { text: string }).text
    }
  }
  throw new Error('API 没有返回杯型参数')
}

function resultToCup(result: AiCupResult, calibration: Calibration): CupDefinition {
  let heightMm: number
  let diameterMm: number
  if (calibration.dimension === 'height') { heightMm = calibration.valueMm; diameterMm = heightMm / result.heightToDiameter }
  else if (calibration.dimension === 'diameter') { diameterMm = calibration.valueMm; heightMm = diameterMm * result.heightToDiameter }
  else { diameterMm = calibration.valueMm / result.openingToDiameter; heightMm = diameterMm * result.heightToDiameter }
  return sanitizeCup({
    id: `ai-${Date.now()}`, name: 'AI 生成杯型', source: 'ai', heightMm, maxDiameterMm: diameterMm,
    openingDiameterMm: diameterMm * result.openingToDiameter, wallThicknessMm: diameterMm * result.wallToDiameter,
    baseThicknessMm: heightMm * result.baseToHeight, shoulderStartMm: heightMm * result.shoulderStartRatio,
    rimRadiusMm: diameterMm * result.rimRadiusRatio, bottomRadiusMm: diameterMm * result.bottomRadiusRatio,
    outerProfile: result.profile.map((point, index) => ({ id: `ai-p-${index}`, yMm: point.yRatio * heightMm, radiusMm: point.radiusRatio * diameterMm })).sort((a, b) => a.yMm - b.yMm),
  })
}

function apiError(status: number, payload: Record<string, unknown> | null) {
  const apiMessage = payload && typeof payload.error === 'object' && payload.error && 'message' in payload.error ? String((payload.error as { message: unknown }).message) : ''
  if (status === 401) return 'API Key 无效或没有权限'
  if (status === 429) return 'API 请求过于频繁或额度不足'
  return apiMessage || `API 请求失败（${status}）`
}

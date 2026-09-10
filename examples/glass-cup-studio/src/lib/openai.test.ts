import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeCupImages } from './openai'

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI cup analysis', () => {
  it('uses image input, structured output and store false', async () => {
    vi.stubGlobal('window', globalThis)
    const result = {
      confidence: 0.92, heightToDiameter: 2, openingToDiameter: 0.88, wallToDiameter: 0.035,
      baseToHeight: 0.05, shoulderStartRatio: 0.82, rimRadiusRatio: 0.02, bottomRadiusRatio: 0.04,
      profile: Array.from({ length: 6 }, (_, index) => ({ yRatio: index / 5, radiusRatio: index > 3 ? 0.44 : 0.5 })),
      assumptions: [], warnings: [], summary: '识别为轻微收肩杯型',
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }) })
    vi.stubGlobal('fetch', fetchMock)
    const stages: string[] = []
    const output = await analyzeCupImages({
      apiKey: 'sk-test', model: 'gpt-test', calibration: { dimension: 'height', valueMm: 120 }, onStage: (stage) => stages.push(stage),
      references: [
        { id: '1', role: 'front', name: 'front.jpg', dataUrl: 'data:image/jpeg;base64,a' },
        { id: '2', role: 'side', name: 'side.jpg', dataUrl: 'data:image/jpeg;base64,b' },
      ],
      analysisFocus: '本轮只校准总体比例',
    })
    const request = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(request.store).toBe(false)
    expect(request.text.format.type).toBe('json_schema')
    expect(request.input[0].content.filter((item: { type: string }) => item.type === 'input_image')).toHaveLength(2)
    expect(request.input[0].content[0].text).toContain('本轮只校准总体比例')
    expect(output.cup.heightMm).toBe(120)
    expect(stages).toEqual(['compressing', 'sending', 'validating', 'building', 'done'])
  })

  it('requires at least one photo for image analysis', async () => {
    await expect(analyzeCupImages({ apiKey: 'x', model: 'gpt-test', calibration: { dimension: 'height', valueMm: 100 }, references: [], onStage: () => undefined })).rejects.toThrow(/一张/)
  })
})

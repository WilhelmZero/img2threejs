import { useRef, useState } from 'react'
import { BUILTIN_CUPS, fromMm, toMm, unitStep } from '../lib/cup'
import { buildAutoFitPlan } from '../lib/autoFit'
import type { AiRefinement, Calibration, CupModel, LengthUnit, MakerStage, ReferenceImage, ReferenceRole } from '../types'

const slots: Array<{ role: ReferenceRole; label: string }> = [
  { role: 'front', label: '正面' }, { role: 'side', label: '侧面' }, { role: 'top', label: '顶部' },
  { role: 'bottom', label: '底部' }, { role: 'detail-1', label: '细节一' }, { role: 'detail-2', label: '细节二' },
]

const stages: Record<MakerStage, string> = {
  idle: '', compressing: '正在压缩参考图片…', sending: '正在发送分析请求…', validating: '正在校验杯型参数…',
  building: '正在生成三维杯体…', done: '杯型生成完成', error: '识别未完成',
}

type Props = {
  references: ReferenceImage[]
  calibration: Calibration
  unit: LengthUnit
  stage: MakerStage
  message: string
  onUnit: (unit: LengthUnit) => void
  onCalibration: (calibration: Calibration) => void
  onFiles: (files: File[], role: ReferenceRole) => void
  onRemove: (id: string) => void
  onAnalyze: () => void
  canRefine: boolean
  refinements: AiRefinement[]
  onRefine: (instruction: string) => void
  onCancel: () => void
  onBuiltin: (model: CupModel) => void
  autoRounds: number
  onAutoRounds: (rounds: number) => void
  autoRunning: boolean
  autoSteps: Array<{ id: string; title: string; status: 'pending' | 'running' | 'done' | 'error'; summary?: string }>
  onAutoFit: () => void
}

export function MakerReferencePanel(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<ReferenceRole>('front')
  const [dragRole, setDragRole] = useState<ReferenceRole | null>(null)
  const [refinement, setRefinement] = useState('')
  const busy = !['idle', 'done', 'error'].includes(props.stage)
  const choose = (role: ReferenceRole) => { roleRef.current = role; inputRef.current?.click() }
  const accept = (files: FileList | null, role: ReferenceRole) => {
    if (files?.length) props.onFiles(Array.from(files), role)
  }
  return (
    <aside className="side-panel maker-left">
      <div className="panel-scroll maker-scroll">
        <section>
          <div className="maker-heading"><span>1</span><h2>参考照片（同一只杯子）</h2></div>
          <div className="reference-grid">
            {slots.map((slot) => {
              const image = props.references.find((item) => item.role === slot.role)
              return <div key={slot.role} className="reference-slot-wrap">
                <label>{slot.label}</label>
                <button
                  className={`reference-slot ${image ? 'has-image' : ''} ${dragRole === slot.role ? 'is-dragging' : ''}`}
                  type="button" onClick={() => choose(slot.role)}
                  onDragOver={(event) => { event.preventDefault(); setDragRole(slot.role) }}
                  onDragLeave={() => setDragRole(null)}
                  onDrop={(event) => { event.preventDefault(); setDragRole(null); accept(event.dataTransfer.files, slot.role) }}
                >
                  {image ? <><img src={image.dataUrl} alt={`${slot.label}参考图`} /><i onClick={(event) => { event.stopPropagation(); props.onRemove(image.id) }}>×</i></> : <><strong>＋</strong><span>添加照片</span></>}
                </button>
              </div>
            })}
          </div>
          <input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { accept(event.target.files, roleRef.current); event.currentTarget.value = '' }} />
          <p className="maker-help">支持 JPG / PNG / WEBP，最多 6 张。1 张即可识别，建议补充侧面或顶部提高准确度。</p>
        </section>

        <section>
          <div className="maker-heading"><span>2</span><h2>尺寸校准（至少一个真实尺寸）</h2></div>
          <div className="unit-tabs" role="radiogroup" aria-label="长度单位">
            {(['mm', 'cm', 'in'] as LengthUnit[]).map((unit) => <button key={unit} className={props.unit === unit ? 'is-selected' : ''} type="button" onClick={() => props.onUnit(unit)}>{unit}</button>)}
          </div>
          <div className="calibration-row">
            <select value={props.calibration.dimension} onChange={(event) => props.onCalibration({ ...props.calibration, dimension: event.target.value as Calibration['dimension'] })} aria-label="校准尺寸类型">
              <option value="height">总高</option><option value="diameter">最大直径</option><option value="opening">杯口直径</option>
            </select>
            <input type="number" min={unitStep(props.unit)} step={unitStep(props.unit)} value={Number(fromMm(props.calibration.valueMm, props.unit).toFixed(props.unit === 'in' ? 3 : props.unit === 'cm' ? 2 : 1))} onChange={(event) => props.onCalibration({ ...props.calibration, valueMm: toMm(Number(event.target.value), props.unit) })} />
            <span>{props.unit}</span>
          </div>
          <p className="maker-help">请选择照片中最容易准确测量的尺寸。</p>
        </section>

        <section>
          <div className="maker-heading"><span>3</span><h2>AI 识别杯型（可选）</h2></div>
          <div className="auto-fit">
            <div className="auto-fit__heading">
              <div><h3>自动拟合</h3><p>按区域逐轮识别、修正并验收</p></div>
              <label>最多
                <select aria-label="自动调整次数上限" value={props.autoRounds} disabled={busy} onChange={(event) => props.onAutoRounds(Number(event.target.value))}>
                  {Array.from({ length: 8 }, (_, index) => index + 1).map((rounds) => <option key={rounds} value={rounds}>{rounds} 轮</option>)}
                </select>
              </label>
            </div>
            <ol className="auto-fit__plan">
              {(props.autoSteps.length ? props.autoSteps : buildAutoFitPlan(props.autoRounds).map((step) => ({ ...step, status: 'pending' as const, summary: undefined }))).map((step, index) => <li key={step.id} className={`is-${step.status}`}>
                <i>{step.status === 'done' ? '✓' : step.status === 'error' ? '!' : index + 1}</i>
                <div><strong>{step.title}</strong>{step.summary ? <span>{step.summary}</span> : null}</div>
              </li>)}
            </ol>
            <button className="primary-button maker-ai-button" type="button" disabled={busy || !props.references.length} onClick={props.onAutoFit}>{props.autoRunning ? '正在自动拟合…' : `开始自动拟合（${props.autoRounds} 轮）`}</button>
            <small>每轮产生一次 API 请求；可随时取消，已完成结果会保留。</small>
          </div>
          <button className="secondary-button maker-ai-button" type="button" disabled={busy || !props.references.length} onClick={props.onAnalyze}>{busy ? '正在处理…' : '仅做单轮快速识别'}</button>
          {busy ? <button className="text-button" type="button" onClick={props.onCancel}>{props.autoRunning ? '取消自动拟合' : '取消分析'}</button> : null}
          {props.stage !== 'idle' ? <div className={`maker-status maker-status--${props.stage}`}><i /> <div><strong>{stages[props.stage]}</strong>{props.message ? <small>{props.message}</small> : null}</div></div> : null}
          {props.canRefine ? <div className="ai-refinement">
            <div className="ai-refinement__heading"><h3>手动追加调整</h3><span>{props.refinements.length} 条记录</span></div>
            <p>AI 会重新对照原图、当前模型和前几轮记录，只修改杯型参数。</p>
            {props.refinements.length ? <ol className="ai-refinement__history">
              {props.refinements.slice(-3).reverse().map((item) => <li key={item.id}><strong>{item.instruction}</strong><span>{item.summary}</span></li>)}
            </ol> : null}
            <div className="ai-refinement__quick">
              {['对照原图再优化', '上半部更宽', '底部收窄并加大圆角'].map((prompt) => <button key={prompt} type="button" disabled={busy} onClick={() => setRefinement(prompt)}>{prompt}</button>)}
            </div>
            <textarea aria-label="AI 调整要求" value={refinement} onChange={(event) => setRefinement(event.target.value)} placeholder="例如：杯口保持 72.9mm，腰部更鼓，底部快速收窄到约 39.9mm" rows={3} />
            <button className="primary-button" type="button" disabled={busy || !refinement.trim()} onClick={() => { props.onRefine(refinement); setRefinement('') }}>{busy ? '正在调整…' : '提交本轮调整'}</button>
            <small>每次提交都会产生一次新的 API 请求。</small>
          </div> : null}
        </section>

        <section>
          <h3>从内置杯型开始</h3>
          <div className="builtin-row">
            {(Object.keys(BUILTIN_CUPS) as CupModel[]).map((id) => <button type="button" key={id} onClick={() => props.onBuiltin(id)}>{BUILTIN_CUPS[id].name}</button>)}
          </div>
        </section>
      </div>
    </aside>
  )
}

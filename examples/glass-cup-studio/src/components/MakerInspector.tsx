import { fromMm, toMm, unitStep } from '../lib/cup'
import type { CupDefinition, LengthUnit } from '../types'

type NumericKey = 'heightMm' | 'maxDiameterMm' | 'openingDiameterMm' | 'wallThicknessMm' | 'baseThicknessMm' | 'shoulderStartMm' | 'rimRadiusMm' | 'bottomRadiusMm'

const groups: Array<{ title: string; fields: Array<{ key: NumericKey; label: string; min: number; max: number }> }> = [
  { title: '整体尺寸', fields: [
    { key: 'heightMm', label: '总高', min: 30, max: 500 }, { key: 'maxDiameterMm', label: '最大直径', min: 20, max: 250 },
    { key: 'openingDiameterMm', label: '口径（内径）', min: 10, max: 230 }, { key: 'shoulderStartMm', label: '收肩高度', min: 5, max: 490 },
  ] },
  { title: '杯壁结构', fields: [
    { key: 'wallThicknessMm', label: '壁厚（平均）', min: 0.5, max: 20 }, { key: 'baseThicknessMm', label: '底厚', min: 1, max: 40 },
  ] },
  { title: '杯口与杯底', fields: [
    { key: 'rimRadiusMm', label: '口部圆角', min: 0.4, max: 12 }, { key: 'bottomRadiusMm', label: '底部圆角', min: 0.4, max: 20 },
  ] },
]

type Props = { cup: CupDefinition; unit: LengthUnit; onUnit: (unit: LengthUnit) => void; onChange: (key: NumericKey, valueMm: number) => void; onReset: () => void }

export function MakerInspector({ cup, unit, onUnit, onChange, onReset }: Props) {
  const valid = cup.wallThicknessMm * 2 < cup.openingDiameterMm && cup.baseThicknessMm < cup.heightMm * 0.35
  return <aside className="side-panel side-panel--right maker-inspector">
    <div className="panel-scroll maker-scroll">
      <div className="section-heading"><div><p className="section-index">单位</p><h2>精确参数</h2></div><span className="live-indicator"><i />实时</span></div>
      <div className="unit-tabs" role="radiogroup" aria-label="检查器长度单位">
        {(['mm', 'cm', 'in'] as LengthUnit[]).map((item) => <button key={item} className={unit === item ? 'is-selected' : ''} type="button" onClick={() => onUnit(item)}>{item}</button>)}
      </div>
      {groups.map((group) => <section className="maker-parameter-group" key={group.title}>
        <h3>{group.title}</h3>
        {group.fields.map((field) => {
          const display = fromMm(cup[field.key], unit)
          const maxMm = field.key === 'shoulderStartMm' ? cup.heightMm : field.key === 'openingDiameterMm' ? cup.maxDiameterMm - cup.wallThicknessMm * 2 : field.max
          return <div className="dimension-row" key={field.key}>
            <label htmlFor={`dimension-${field.key}`}>{field.label}</label>
            <div className="dimension-input"><input id={`dimension-${field.key}`} type="number" step={unitStep(unit)} value={Number(display.toFixed(unit === 'in' ? 3 : unit === 'cm' ? 2 : 1))} onChange={(event) => onChange(field.key, toMm(Number(event.target.value), unit))} /><span>{unit}</span></div>
            <input aria-label={`${field.label}滑块`} type="range" min={fromMm(field.min, unit)} max={fromMm(maxMm, unit)} step={unitStep(unit)} value={display} onChange={(event) => onChange(field.key, toMm(Number(event.target.value), unit))} />
          </div>
        })}
      </section>)}
      <div className={`structure-status ${valid ? 'is-valid' : 'is-invalid'}`}>
        <strong>{valid ? '✓ 结构校验：通过' : '! 结构参数需要调整'}</strong>
        <small>最小壁厚：{fromMm(cup.wallThicknessMm, unit).toFixed(unit === 'in' ? 3 : 1)} {unit} · 最小底厚：{fromMm(cup.baseThicknessMm, unit).toFixed(unit === 'in' ? 3 : 1)} {unit}</small>
      </div>
    </div>
    <button className="secondary-button panel-reset" type="button" onClick={onReset}>重置杯型</button>
  </aside>
}

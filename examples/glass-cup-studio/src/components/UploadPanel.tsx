import { useRef, useState } from 'react'
import { RangeControl } from './RangeControl'
import { BUILTIN_CUPS, cloneCup } from '../lib/cup'
import type { CupDefinition, CupModel, TextureSettings } from '../types'

const modelLabels: Record<CupModel, { title: string; subtitle: string; silhouette: string }> = {
  tumbler: { title: '直筒杯', subtitle: '宽口 · 厚底', silhouette: 'tumbler' },
  'cola-can': { title: '可乐罐', subtitle: '高杯 · 收肩', silhouette: 'can' },
  'clear-cola-can': { title: '高透可乐罐', subtitle: '75mm · 精细收肩', silhouette: 'can-premium' },
  'tall-wine-glass': { title: '高透高脚杯', subtitle: '60×242mm · 圆足', silhouette: 'wine' },
}

type UploadPanelProps = {
  cup: CupDefinition
  imageUrl: string
  fileName: string
  settings: TextureSettings
  onFile: (file: File) => void
  onCup: (cup: CupDefinition) => void
  onSettings: (settings: TextureSettings) => void
  onReset: () => void
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 4.6-4.6 3.3 3.2 2.2-2.2L20 19" />
    </svg>
  )
}

export function UploadPanel({
  cup,
  imageUrl,
  fileName,
  settings,
  onFile,
  onCup,
  onSettings,
  onReset,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const acceptFile = (file?: File) => {
    if (file?.type.startsWith('image/')) onFile(file)
  }

  const update = (key: keyof TextureSettings, value: number) => {
    onSettings({ ...settings, [key]: value })
  }

  return (
    <aside className="side-panel side-panel--left">
      <div className="panel-scroll">
        <section className="model-section">
          <div className="section-heading">
            <div>
              <p className="section-index">01</p>
              <h2>选择杯型</h2>
            </div>
            <span className="file-type">{cup.source === 'builtin' ? '内置模型' : '自定义模型'}</span>
          </div>
          <div className="model-options" role="radiogroup" aria-label="杯子模型">
            {(Object.keys(BUILTIN_CUPS) as CupModel[]).map((id) => {
              const label = modelLabels[id]
              return <button
                className={`model-choice ${cup.id === id ? 'is-selected' : ''}`}
                type="button" role="radio" aria-checked={cup.id === id} key={id}
                onClick={() => onCup(cloneCup(BUILTIN_CUPS[id]))}
              >
                <span className={`model-silhouette model-silhouette--${label.silhouette}`} aria-hidden="true" />
                <span><strong>{label.title}</strong><small>{label.subtitle}</small></span>
              </button>
            })}
          </div>
          {cup.source !== 'builtin' ? <button className="custom-model-choice is-selected" type="button"><strong>{cup.name}</strong><small>来自杯子制作工作区</small></button> : null}
          {cup.id === 'cola-can' || cup.id === 'clear-cola-can' ? <p className="model-helper">默认显示纯透明杯体；参考图中的 Logo 不属于模型。</p> : null}
          {cup.id === 'tall-wine-glass' ? <p className="model-helper">使用验证通过的空杯 GLB；酒液不属于内置模型，贴纸仅覆盖杯腹安全区域。</p> : null}
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="section-index">02</p>
              <h2>导入图片</h2>
            </div>
            <span className="file-type">JPG · PNG · WEBP</span>
          </div>

          <button
            className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              acceptFile(event.dataTransfer.files[0])
            }}
          >
            <ImageIcon />
            <strong>拖放图片到这里</strong>
            <span>或点击浏览本地文件</span>
          </button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
          <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
            选择图片
          </button>
          <p className="model-helper">透明背景 PNG 能清楚显示杯身背面的反向图案；JPG 的整张背景也会作为贴纸内容。</p>
        </section>

        <section className="source-preview">
          <div className="section-title-row">
            <h3>源图片</h3>
            <span title={fileName}>{fileName}</span>
          </div>
          <div className="preview-frame">
            <img src={imageUrl} alt="当前杯身贴图预览" />
          </div>
        </section>

        <section className="controls-section">
          <h3>图片调整</h3>
          <RangeControl label="缩放" value={settings.scale} min={0.55} max={2.4} step={0.05} onChange={(value) => update('scale', value)} />
          <label className="switch-control">
            <span><strong>重复铺贴</strong><small>开启后图案会在贴纸区域循环出现</small></span>
            <input
              type="checkbox"
              checked={settings.repeat}
              onChange={(event) => onSettings({ ...settings, repeat: event.target.checked })}
            />
            <i aria-hidden="true" />
          </label>
          <RangeControl label="贴纸区域高度" value={settings.areaHeight} min={0.15} max={1} step={0.01} onChange={(value) => update('areaHeight', value)} format={(value) => `${Math.round(value * 100)}%`} />
          <RangeControl label="贴纸区域位置" value={settings.areaCenterY} min={-1} max={1} step={0.01} onChange={(value) => update('areaCenterY', value)} />
          <p className="model-helper">区域控制贴纸实际覆盖的杯身范围；图案位置只移动区域内的图片。</p>
          <RangeControl label="图案水平位置" value={settings.offsetX} min={-1} max={1} step={0.01} onChange={(value) => update('offsetX', value)} />
          <RangeControl label="图案垂直位置" value={settings.offsetY} min={-1} max={1} step={0.01} onChange={(value) => update('offsetY', value)} />
          <RangeControl label="旋转" value={settings.rotation} min={-180} max={180} step={1} onChange={(value) => update('rotation', value)} format={(value) => `${Math.round(value)}°`} />
        </section>
      </div>
      <button className="secondary-button panel-reset" type="button" onClick={onReset}>重置参数</button>
    </aside>
  )
}

import type { CSSProperties } from 'react'
import { RangeControl } from './RangeControl'
import type { GlassSettings, ScenePreset, SceneSettings, TextureSettings } from '../types'

type InspectorPanelProps = {
  texture: TextureSettings
  glass: GlassSettings
  scene: SceneSettings
  onTexture: (settings: TextureSettings) => void
  onGlass: (settings: GlassSettings) => void
  onScene: (settings: SceneSettings) => void
  onScenePreset: (preset: ScenePreset) => void
}

const SCENE_OPTIONS: { id: ScenePreset; label: string }[] = [
  { id: 'studio', label: '影棚' },
  { id: 'daylight', label: '日光' },
  { id: 'midnight', label: '夜景' },
]

export function InspectorPanel({ texture, glass, scene, onTexture, onGlass, onScene, onScenePreset }: InspectorPanelProps) {
  return (
    <aside className="side-panel side-panel--right">
      <div className="panel-scroll">
        <div className="section-heading">
          <div>
            <p className="section-index">03</p>
            <h2>材质</h2>
          </div>
          <span className="live-indicator"><i />实时</span>
        </div>

        <section className="inspector-group">
          <h3>图案</h3>
          <RangeControl label="图案强度" value={texture.intensity} min={0} max={1} step={0.01} onChange={(value) => onTexture({ ...texture, intensity: value })} format={(value) => `${Math.round(value * 100)}%`} />
        </section>

        <section className="inspector-group inspector-group--divided">
          <h3>环境与灯光</h3>
          <div className="scene-presets" role="radiogroup" aria-label="环境预设">
            {SCENE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={scene.preset === option.id}
                className={scene.preset === option.id ? 'is-selected' : ''}
                onClick={() => onScenePreset(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="compact-colors">
            <label><span>背景色</span><input aria-label="背景颜色" type="color" value={scene.backgroundColor} onChange={(event) => onScene({ ...scene, backgroundColor: event.target.value })} /></label>
            <label><span>地面色</span><input aria-label="地面颜色" type="color" value={scene.floorColor} onChange={(event) => onScene({ ...scene, floorColor: event.target.value })} /></label>
          </div>
          <label className="switch-control switch-control--compact">
            <span><strong>地板反光</strong><small>关闭后使用哑光地面</small></span>
            <input
              type="checkbox"
              checked={scene.floorReflective}
              onChange={(event) => onScene({ ...scene, floorReflective: event.target.checked })}
            />
            <i aria-hidden="true" />
          </label>
          <RangeControl label="环境反射" value={scene.environmentIntensity} min={0.2} max={3} step={0.05} onChange={(value) => onScene({ ...scene, environmentIntensity: value })} />
          <RangeControl label="主光亮度" value={scene.keyLightIntensity} min={0} max={16} step={0.1} onChange={(value) => onScene({ ...scene, keyLightIntensity: value })} />
          <RangeControl label="轮廓光亮度" value={scene.rimLightIntensity} min={0} max={16} step={0.1} onChange={(value) => onScene({ ...scene, rimLightIntensity: value })} />
          <div className="light-rig-heading">
            <h4>舞台灯位</h4>
            <small>围绕杯体调整方向、高度、距离与光斑大小</small>
          </div>
          <div className="compact-colors compact-colors--lights">
            <label><span>主光颜色</span><input aria-label="主光颜色" type="color" value={scene.keyLightColor} onChange={(event) => onScene({ ...scene, keyLightColor: event.target.value })} /></label>
            <label><span>轮廓光颜色</span><input aria-label="轮廓光颜色" type="color" value={scene.rimLightColor} onChange={(event) => onScene({ ...scene, rimLightColor: event.target.value })} /></label>
          </div>
          <RangeControl label="灯组整体旋转" value={scene.lightRigRotation} min={-180} max={180} step={1} onChange={(value) => onScene({ ...scene, lightRigRotation: value })} format={(value) => `${Math.round(value)}°`} />
          <RangeControl label="主光方向" value={scene.keyLightAzimuth} min={-180} max={180} step={1} onChange={(value) => onScene({ ...scene, keyLightAzimuth: value })} format={(value) => `${Math.round(value)}°`} />
          <RangeControl label="主光高度" value={scene.keyLightElevation} min={0.25} max={1.6} step={0.01} onChange={(value) => onScene({ ...scene, keyLightElevation: value })} />
          <RangeControl label="轮廓光方向" value={scene.rimLightAzimuth} min={-180} max={180} step={1} onChange={(value) => onScene({ ...scene, rimLightAzimuth: value })} format={(value) => `${Math.round(value)}°`} />
          <RangeControl label="轮廓光高度" value={scene.rimLightElevation} min={0.2} max={1.5} step={0.01} onChange={(value) => onScene({ ...scene, rimLightElevation: value })} />
          <RangeControl label="灯光距离" value={scene.lightDistance} min={0.55} max={1.7} step={0.01} onChange={(value) => onScene({ ...scene, lightDistance: value })} />
          <RangeControl label="光源柔和度" value={scene.lightSoftness} min={0.35} max={1.8} step={0.01} onChange={(value) => onScene({ ...scene, lightSoftness: value })} />
        </section>

        <section className="inspector-group inspector-group--divided">
          <h3>玻璃</h3>
          <RangeControl label="玻璃透明度" value={glass.transmission} min={0.15} max={1} step={0.01} onChange={(value) => onGlass({ ...glass, transmission: value })} format={(value) => `${Math.round(value * 100)}%`} />
          <RangeControl label="粗糙度" value={glass.roughness} min={0} max={0.65} step={0.01} onChange={(value) => onGlass({ ...glass, roughness: value })} />
          <RangeControl label="折射率" value={glass.ior} min={1} max={2.33} step={0.01} onChange={(value) => onGlass({ ...glass, ior: value })} />
          <label className="color-control">
            <span className="color-control__meta">
              <span>玻璃颜色</span>
              <output>{glass.color}</output>
            </span>
            <span className="color-swatch" style={{ '--glass-color': glass.color } as CSSProperties}>
              <input aria-label="玻璃颜色" type="color" value={glass.color} onChange={(event) => onGlass({ ...glass, color: event.target.value })} />
            </span>
          </label>
          <p className="material-note">图片仅包裹杯身外壁；杯沿、内壁与厚杯底保持独立折射，让透明材质在任何视角下都保有真实层次。</p>
        </section>
      </div>
    </aside>
  )
}

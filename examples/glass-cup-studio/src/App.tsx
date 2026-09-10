import { useEffect, useRef, useState } from 'react'
import { ApiKeyDialog } from './components/ApiKeyDialog'
import { GlassScene } from './components/GlassScene'
import { InspectorPanel } from './components/InspectorPanel'
import { MakerInspector } from './components/MakerInspector'
import { MakerReferencePanel } from './components/MakerReferencePanel'
import { ProfileEditor } from './components/ProfileEditor'
import { UploadPanel } from './components/UploadPanel'
import { analyzeCupImages } from './lib/openai'
import { buildAutoFitPlan, clampAutoFitRounds } from './lib/autoFit'
import { BUILTIN_CUPS, cloneCup, sanitizeCup, updateCupDimension } from './lib/cup'
import { createProject, DEFAULT_TEXTURE, exportProjectJson, fileToReference, importProjectJson } from './lib/project'
import { inspectGlb } from './lib/glb'
import { loadDraft, saveDraft } from './lib/storage'
import type { CupDefinition, CupModel, GlassStudioProjectV1, LengthUnit, MakerStage, ReferenceRole, SceneHandle, ScenePreset, SceneSettings, WorkspaceMode } from './types'

const SCENE_PRESETS: Record<ScenePreset, SceneSettings> = {
  studio: { preset: 'studio', backgroundColor: '#171b1c', floorColor: '#252a2b', environmentIntensity: 1.6, keyLightIntensity: 8, rimLightIntensity: 6, keyLightColor: '#f5ead7', rimLightColor: '#9fd9d1', lightRigRotation: 0, keyLightAzimuth: 138, keyLightElevation: 1.25, rimLightAzimuth: -36, rimLightElevation: 0.82, lightDistance: 1, lightSoftness: 1, floorReflective: true },
  daylight: { preset: 'daylight', backgroundColor: '#d9e3e1', floorColor: '#b8c4c0', environmentIntensity: 2.05, keyLightIntensity: 10, rimLightIntensity: 4.5, keyLightColor: '#fff5dc', rimLightColor: '#b9dcff', lightRigRotation: -12, keyLightAzimuth: 148, keyLightElevation: 1.35, rimLightAzimuth: -24, rimLightElevation: 0.92, lightDistance: 1.08, lightSoftness: 1.3, floorReflective: true },
  midnight: { preset: 'midnight', backgroundColor: '#07131f', floorColor: '#101b28', environmentIntensity: 1.25, keyLightIntensity: 6.5, rimLightIntensity: 10, keyLightColor: '#8cb8ff', rimLightColor: '#31d6c8', lightRigRotation: 8, keyLightAzimuth: 126, keyLightElevation: 1.05, rimLightAzimuth: -48, rimLightElevation: 0.72, lightDistance: 0.92, lightSoftness: 0.7, floorReflective: true },
}

const defaultImageUrl = `${import.meta.env.BASE_URL}default-texture.png`
const HIGH_CLARITY_GLASS = { transmission: 1, roughness: 0.018, ior: 1.46, color: '#f7fffd' }
const referenceOrder: ReferenceRole[] = ['front', 'side', 'top', 'bottom', 'detail-1', 'detail-2']
type AutoFitStepState = { id: string; title: string; status: 'pending' | 'running' | 'done' | 'error'; summary?: string }

function ResetIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4m0 0h5M4 4l3.7 3.7a7 7 0 1 1-1.2 7.8" /></svg> }
function DownloadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></svg> }

function App() {
  const sceneRef = useRef<SceneHandle>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const baselineCupRef = useRef(cloneCup(BUILTIN_CUPS['cola-can']))
  const analysisAbortRef = useRef<AbortController | null>(null)
  const hydratedRef = useRef(false)
  const [project, setProject] = useState<GlassStudioProjectV1>(() => createProject(SCENE_PRESETS.studio))
  const [workspace, setWorkspace] = useState<WorkspaceMode>('decal')
  const [unit, setUnit] = useState<LengthUnit>('mm')
  const [apiKey, setApiKey] = useState('')
  const [apiModel, setApiModel] = useState('gpt-5.6-terra')
  const [apiOpen, setApiOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [makerStage, setMakerStage] = useState<MakerStage>('idle')
  const [makerMessage, setMakerMessage] = useState('')
  const [autoFitSteps, setAutoFitSteps] = useState<AutoFitStepState[]>([])
  const [autoFitRunning, setAutoFitRunning] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadDraft().then((draft) => {
      if (draft) { setProject(draft); baselineCupRef.current = cloneCup(draft.cup) }
    }).catch(() => undefined).finally(() => { hydratedRef.current = true })
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    const timer = window.setTimeout(() => saveDraft(project).catch(() => showToast('参数已保存，但参考图片可能超过浏览器存储空间')), 500)
    return () => window.clearTimeout(timer)
  }, [project])

  const updateProject = (updates: Partial<GlassStudioProjectV1>) => setProject((current) => ({ ...current, ...updates, updatedAt: new Date().toISOString() }))
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const setCup = (cup: CupDefinition) => updateProject({ cup: sanitizeCup(cup), analysis: cup.source === 'builtin' ? null : project.analysis, refinements: cup.source === 'builtin' ? [] : project.refinements })
  const applyCupEdit = (cup: CupDefinition) => setCup(cup.source === 'builtin' ? { ...cup, id: `custom-${Date.now()}`, name: `${cup.name}副本`, source: 'manual' } : cup)
  const selectBuiltin = (id: CupModel) => {
    const cup = cloneCup(BUILTIN_CUPS[id]); baselineCupRef.current = cloneCup(cup)
    updateProject({ cup, analysis: null, refinements: [], glass: id === 'clear-cola-can' ? { ...HIGH_CLARITY_GLASS } : project.glass, texture: { ...project.texture, intensity: workspace === 'decal' && id !== 'cola-can' ? 0.9 : 0 } })
  }
  const selectScenePreset = (preset: ScenePreset) => updateProject({ scene: SCENE_PRESETS[preset] })

  const selectDecal = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file)
    })
    updateProject({ decal: { name: file.name, dataUrl }, texture: { ...project.texture, intensity: Math.max(project.texture.intensity, 0.9) } })
  }

  const addReferences = async (files: File[], startRole: ReferenceRole) => {
    const start = referenceOrder.indexOf(startRole)
    const roles = [...referenceOrder.slice(start), ...referenceOrder.slice(0, start)].filter((role) => !project.references.some((image) => image.role === role))
    try {
      const next = await Promise.all(files.slice(0, Math.min(6 - project.references.length, roles.length)).map((file, index) => fileToReference(file, roles[index])))
      updateProject({ references: [...project.references, ...next] })
    } catch (error) { showToast(error instanceof Error ? error.message : '图片导入失败') }
  }

  const runAnalysis = async (sampledProfile?: Array<{ yRatio: number; radiusRatio: number }>, refinementInstruction?: string) => {
    analysisAbortRef.current?.abort()
    const controller = new AbortController(); analysisAbortRef.current = controller; setMakerMessage('')
    try {
      const result = await analyzeCupImages({
        apiKey, model: apiModel, references: project.references, calibration: project.calibration, signal: controller.signal,
        onStage: setMakerStage, sampledProfile, currentCup: refinementInstruction ? project.cup : undefined,
        refinementInstruction, refinementHistory: project.refinements,
      })
      baselineCupRef.current = cloneCup(result.cup)
      const refinements = refinementInstruction ? [...project.refinements, {
        id: crypto.randomUUID(), instruction: refinementInstruction, summary: result.summary,
        confidence: result.analysis.confidence, createdAt: new Date().toISOString(),
      }].slice(-12) : []
      updateProject({ cup: result.cup, analysis: result.analysis, refinements })
      setMakerMessage(`置信度 ${Math.round(result.analysis.confidence * 100)}% · ${result.summary}`)
    } catch (error) { setMakerStage('error'); setMakerMessage(error instanceof Error ? error.message : '识别失败') }
  }

  const runAutoFit = async () => {
    if (!apiKey.trim()) {
      setApiOpen(true)
      setMakerStage('error')
      setMakerMessage('请先配置 API Key，再开始自动拟合')
      return
    }
    if (!project.references.length) {
      setMakerStage('error')
      setMakerMessage('自动拟合至少需要一张参考图片')
      return
    }
    analysisAbortRef.current?.abort()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    const plan = buildAutoFitPlan(project.aiSettings.maxAutoRounds)
    let workingCup = project.cup
    let history = project.refinements
    setAutoFitSteps(plan.map(({ id, title }) => ({ id, title, status: 'pending' })))
    setAutoFitRunning(true)
    setMakerMessage(`已规划 ${plan.length} 轮针对性拟合`)
    try {
      for (let index = 0; index < plan.length; index += 1) {
        const step = plan[index]
        setAutoFitSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'running' } : item))
        setMakerMessage(`第 ${index + 1}/${plan.length} 轮 · ${step.title}`)
        const result = await analyzeCupImages({
          apiKey, model: apiModel, references: project.references, calibration: project.calibration, signal: controller.signal,
          onStage: setMakerStage, currentCup: index === 0 ? undefined : workingCup,
          refinementInstruction: index === 0 ? undefined : step.instruction,
          refinementHistory: history, analysisFocus: step.instruction,
        })
        workingCup = result.cup
        const record = {
          id: crypto.randomUUID(), instruction: `自动 ${index + 1}/${plan.length} · ${step.title}`, summary: result.summary,
          confidence: result.analysis.confidence, createdAt: new Date().toISOString(),
        }
        history = [...history, record].slice(-12)
        baselineCupRef.current = cloneCup(workingCup)
        updateProject({ cup: workingCup, analysis: result.analysis, refinements: history })
        setAutoFitSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'done', summary: result.summary } : item))
      }
      setMakerStage('done')
      setMakerMessage(`${plan.length} 轮自动拟合完成，可继续手动细调或追加 AI 调整`)
    } catch (error) {
      setAutoFitSteps((current) => current.map((item) => item.status === 'running' ? { ...item, status: 'error', summary: error instanceof Error ? error.message : '本轮失败' } : item))
      setMakerStage('error')
      setMakerMessage(controller.signal.aborted ? '自动拟合已取消，已保留完成轮次的结果' : error instanceof Error ? error.message : '自动拟合失败')
    } finally {
      setAutoFitRunning(false)
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setExportOpen(false)
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const imported = await importProjectJson(file); setProject(imported); baselineCupRef.current = cloneCup(imported.cup); showToast('工程已导入')
      } else if (file.name.toLowerCase().endsWith('.glb')) {
        const result = await inspectGlb(file)
        if (result.project) { setProject(result.project); baselineCupRef.current = cloneCup(result.project.cup); showToast('可编辑 GLB 已导入') }
        else if (result.sample) {
          setWorkspace('maker')
          if (!apiKey) { setApiOpen(true); setMakerStage('error'); setMakerMessage('普通 GLB 需要配置 API Key 后重新拟合') }
          else await runAnalysis(result.sample.profile)
        }
      } else throw new Error('请选择工程 JSON 或 GLB 文件')
    } catch (error) { showToast(error instanceof Error ? error.message : '模型导入失败') }
  }

  const exportPng = async () => {
    try { showToast(await sceneRef.current?.exportPng() ? 'PNG 已生成' : '导出失败，请重试') }
    catch (error) { showToast(error instanceof Error ? error.message : 'PNG 导出失败') }
  }
  const exportGlb = async () => {
    setExportOpen(false)
    try { showToast(await sceneRef.current?.exportGlb(project) ? 'GLB 已生成' : '导出失败，请重试') }
    catch (error) { showToast(error instanceof Error ? error.message : 'GLB 导出失败') }
  }

  return <main className={`app-shell app-shell--${workspace}`}>
    <header className="topbar maker-topbar">
      <a className="brand" href="./" aria-label="Glass Studio 首页"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>Glass Studio</span></a>
      <nav className="workspace-tabs" aria-label="工作区">
        <button className={workspace === 'decal' ? 'is-selected' : ''} type="button" onClick={() => setWorkspace('decal')}>贴图设计</button>
        <button className={workspace === 'maker' ? 'is-selected' : ''} type="button" onClick={() => setWorkspace('maker')}>杯子制作</button>
      </nav>
      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={() => importRef.current?.click()}>导入模型</button>
        <input ref={importRef} className="visually-hidden" type="file" accept=".json,.glb,application/json,model/gltf-binary" onChange={(event) => { importFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <div className="export-menu-wrap">
          <button className="export-button" type="button" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)}><DownloadIcon />导出模型</button>
          {exportOpen ? <div className="export-menu">
            <button type="button" onClick={() => { exportProjectJson(project); setExportOpen(false); showToast('工程 JSON 已生成') }}><strong>工程 JSON</strong><span>.json</span></button>
            <button type="button" onClick={exportGlb}><strong>GLB 模型</strong><span>.glb</span></button>
            <button type="button" onClick={() => { setExportOpen(false); exportPng() }}><strong>渲染 PNG</strong><span>.png</span></button>
          </div> : null}
        </div>
        <button className="api-key-button" type="button" onClick={() => setApiOpen(true)}><span aria-hidden="true">⚙</span> API Key <i className={apiKey ? 'is-connected' : ''} /></button>
      </div>
    </header>

    {workspace === 'decal' ? <div className="workspace">
      <UploadPanel cup={project.cup} imageUrl={project.decal.dataUrl || defaultImageUrl} fileName={project.decal.name} settings={project.texture} onFile={selectDecal} onCup={(cup) => { baselineCupRef.current = cloneCup(cup); if (cup.id === 'clear-cola-can') updateProject({ cup, glass: { ...HIGH_CLARITY_GLASS }, analysis: null, refinements: [] }); else setCup(cup) }} onSettings={(texture) => updateProject({ texture })} onReset={() => updateProject({ texture: { ...DEFAULT_TEXTURE }, glass: { transmission: 0.985, roughness: 0.035, ior: 1.48, color: '#ffffff' }, scene: SCENE_PRESETS.studio })} />
      <section className="canvas-panel">
        <GlassScene ref={sceneRef} cup={project.cup} imageUrl={project.decal.dataUrl || defaultImageUrl} textureSettings={project.texture} glassSettings={project.glass} sceneSettings={project.scene} />
        <div className="canvas-title"><span>实时预览</span><strong>{project.cup.name}</strong></div>
        <div className="canvas-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="5" /><path d="M12 3v6" /></svg>拖动旋转 <i /> 滚轮缩放</div>
      </section>
      <InspectorPanel texture={project.texture} glass={project.glass} scene={project.scene} onTexture={(texture) => updateProject({ texture })} onGlass={(glass) => updateProject({ glass })} onScene={(scene) => updateProject({ scene })} onScenePreset={selectScenePreset} />
    </div> : <div className="workspace maker-workspace">
      <MakerReferencePanel references={project.references} calibration={project.calibration} unit={unit} stage={makerStage} message={makerMessage} onUnit={setUnit} onCalibration={(calibration) => updateProject({ calibration })} onFiles={addReferences} onRemove={(id) => updateProject({ references: project.references.filter((image) => image.id !== id) })} onAnalyze={() => runAnalysis()} canRefine={Boolean(project.references.length)} refinements={project.refinements} onRefine={(instruction) => runAnalysis(undefined, instruction)} onCancel={() => analysisAbortRef.current?.abort()} onBuiltin={selectBuiltin} autoRounds={project.aiSettings.maxAutoRounds} onAutoRounds={(maxAutoRounds) => updateProject({ aiSettings: { maxAutoRounds: clampAutoFitRounds(maxAutoRounds) } })} autoRunning={autoFitRunning} autoSteps={autoFitSteps} onAutoFit={runAutoFit} />
      <section className="canvas-panel maker-canvas">
        <GlassScene ref={sceneRef} cup={project.cup} imageUrl={project.decal.dataUrl || defaultImageUrl} textureSettings={{ ...project.texture, intensity: 0 }} glassSettings={project.glass} sceneSettings={project.scene} />
        <div className="canvas-title"><span>程序化杯型</span><strong>{project.cup.name}</strong></div>
        <ProfileEditor cup={project.cup} onChange={(outerProfile) => applyCupEdit({ ...project.cup, outerProfile })} />
        <div className="canvas-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="5" /><path d="M12 3v6" /></svg>拖动旋转 <i /> 拖动截面控制点</div>
        <div className="maker-canvas-actions"><button type="button" onClick={() => sceneRef.current?.resetCamera()}><ResetIcon />重置视图</button><button type="button" onClick={() => setWorkspace('decal')}>用于贴图设计</button></div>
      </section>
      <MakerInspector cup={project.cup} unit={unit} onUnit={setUnit} onChange={(key, value) => applyCupEdit(updateCupDimension(project.cup, key, value))} onReset={() => setCup(cloneCup(baselineCupRef.current))} />
    </div>}

    <ApiKeyDialog open={apiOpen} apiKey={apiKey} model={apiModel} onKey={setApiKey} onModel={setApiModel} onClose={() => setApiOpen(false)} />
    {toast ? <div className="toast" role="status">{toast}</div> : null}
  </main>
}

export default App

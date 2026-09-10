import { frostedPixels } from "../lib/engravingBridge"
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MM_PER_WORLD_UNIT, cupToWorldProfile, getDecalProfile, getOuterRadiusAt } from '../lib/cup'
import { getDecalCanvasSize, getDecalV } from '../lib/decal'
import { downloadBlob, projectWithoutSecrets } from '../lib/project'
import type { CupDefinition, GlassSettings, GlassStudioProjectV1, SceneHandle, SceneSettings, TextureSettings } from '../types'

type GlassSceneProps = {
  cup: CupDefinition
  onTextureReady?: (url:string) => void
  imageUrl: string
  textureSettings: TextureSettings
  glassSettings: GlassSettings
  sceneSettings: SceneSettings
}

type Materials = {
  outer: THREE.MeshPhysicalMaterial
  inner: THREE.MeshPhysicalMaterial
  base: THREE.MeshPhysicalMaterial
  rim: THREE.MeshPhysicalMaterial
  decalFront: THREE.MeshPhysicalMaterial
  decalRear: THREE.MeshPhysicalMaterial
}

function paintDecalCanvas(canvas: HTMLCanvasElement, image: HTMLImageElement, settings: TextureSettings) {
  const context = canvas.getContext('2d')
  if (!context) return
  const imageAspect = image.naturalWidth / Math.max(image.naturalHeight, 1)
  // Scale is anchored to the cup circumference. Changing the vertical decal
  // region only reveals or clips more transparent canvas; it must not resize art.
  const baseWidth = canvas.width
  const baseHeight = canvas.width / imageAspect
  const drawWidth = baseWidth * settings.scale
  const drawHeight = baseHeight * settings.scale
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width * (0.5 + settings.offsetX * 0.45), canvas.height * (0.5 - settings.offsetY * 0.45))
  context.rotate(THREE.MathUtils.degToRad(settings.rotation))
  if (settings.repeat) {
    const columns = Math.ceil((canvas.width * 2.5) / drawWidth) + 2
    const rows = Math.ceil((canvas.height * 2.5) / drawHeight) + 2
    for (let column = -columns; column <= columns; column += 1) {
      for (let row = -rows; row <= rows; row += 1) context.drawImage(image, column * drawWidth - drawWidth / 2, row * drawHeight - drawHeight / 2, drawWidth, drawHeight)
    }
  } else context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  context.restore()
  if(settings.engraving) { const pixels=context.getImageData(0,0,canvas.width,canvas.height); frostedPixels(pixels.data); context.putImageData(pixels,0,0) }
}

function latheGeometry(cup: CupDefinition, insetMm = 0, outsetMm = 0) {
  const points = cupToWorldProfile(cup, insetMm).map((point) => new THREE.Vector2(point.radius + outsetMm / MM_PER_WORLD_UNIT, point.y))
  return new THREE.LatheGeometry(points, 160)
}

function decalLatheGeometry(cup: CupDefinition, settings: TextureSettings, outsetMm = 0) {
  const profile = getDecalProfile(cup, settings.areaHeight, settings.areaCenterY)
  const points = profile.map((point) => new THREE.Vector2(
    (point.radiusMm + outsetMm) / MM_PER_WORLD_UNIT,
    (point.yMm - cup.heightMm / 2) / MM_PER_WORLD_UNIT,
  ))
  const segments = 160
  const geometry = new THREE.LatheGeometry(points, segments)
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  for (let segment = 0; segment <= segments; segment += 1) {
    for (let pointIndex = 0; pointIndex < profile.length; pointIndex += 1) {
      // Keep UVs in the full-cup coordinate system. The decal mesh bounds now
      // crop that fixed image instead of remapping it to fill the selected area.
      uv.setY(segment * profile.length + pointIndex, getDecalV(profile[pointIndex].yMm, cup))
    }
  }
  uv.needsUpdate = true
  return geometry
}

function resizeDecalCanvas(canvas: HTMLCanvasElement, cup: CupDefinition) {
  const size = getDecalCanvasSize(cup)
  if (canvas.width !== size.width) canvas.width = size.width
  if (canvas.height !== size.height) canvas.height = size.height
}

function innerLatheGeometry(cup: CupDefinition) {
  const basePoint = { radius: Math.max(0.1, getOuterRadiusAt(cup, cup.baseThicknessMm) - cup.wallThicknessMm) / MM_PER_WORLD_UNIT, y: (cup.baseThicknessMm - cup.heightMm / 2) / MM_PER_WORLD_UNIT }
  const points = [basePoint, ...cupToWorldProfile(cup, cup.wallThicknessMm).filter((point) => point.y > basePoint.y + 0.0001)]
  points[points.length - 1].radius = cup.openingDiameterMm / 2 / MM_PER_WORLD_UNIT
  return new THREE.LatheGeometry(points.map((point) => new THREE.Vector2(point.radius, point.y)), 160)
}

function disposeChildren(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children.pop()
    child?.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
  }
}

function cameraPositionFor(cup: CupDefinition) {
  const height = cup.heightMm / MM_PER_WORLD_UNIT
  const radius = cup.maxDiameterMm / MM_PER_WORLD_UNIT / 2
  const heightFraming = cup.modelAsset ? 3.08 : 2.68
  const distance = Math.max(height * heightFraming, radius * 6.2)
  return new THREE.Vector3(distance * 0.32, height * 0.24, distance)
}

function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const environmentScene = new THREE.Scene()
  environmentScene.background = new THREE.Color('#050708')
  const resources: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = []
  const addReflectionPanel = (
    color: string,
    intensity: number,
    width: number,
    height: number,
    position: [number, number, number],
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    panel.position.set(...position)
    panel.lookAt(0, 0.3, 0)
    environmentScene.add(panel)
    resources.push(panel)
  }
  addReflectionPanel('#fff8e9', 4.2, 0.75, 6.5, [-4.2, 1.2, 3.5])
  addReflectionPanel('#ffffff', 3.2, 0.42, 5.2, [3.8, 0.6, 3.2])
  addReflectionPanel('#8ee6df', 2.1, 1.1, 4.8, [3.2, 1.1, -4.2])
  addReflectionPanel('#fff4dc', 2.4, 4.6, 1.1, [0, 5.3, 1.2])
  addReflectionPanel('#afc9ff', 1.4, 2.4, 3.5, [-3.6, 0.2, -4.5])

  const generator = new THREE.PMREMGenerator(renderer)
  const texture = generator.fromScene(environmentScene, 0.025, 0.1, 100).texture
  generator.dispose()
  resources.forEach((panel) => { panel.geometry.dispose(); panel.material.dispose() })
  return texture
}

function positionStageLight(
  light: THREE.RectAreaLight,
  cup: CupDefinition,
  azimuthDeg: number,
  elevationRatio: number,
  distanceRatio: number,
) {
  const cupHeight = cup.heightMm / MM_PER_WORLD_UNIT
  const distance = Math.max(5.2, cupHeight * 1.15) * distanceRatio
  const azimuth = THREE.MathUtils.degToRad(azimuthDeg)
  light.position.set(Math.cos(azimuth) * distance, cupHeight * elevationRatio, Math.sin(azimuth) * distance)
  light.lookAt(0, cupHeight * 0.04, 0)
}

export const GlassScene = forwardRef<SceneHandle, GlassSceneProps>(function GlassScene(
  { cup, imageUrl, textureSettings, glassSettings, sceneSettings, onTextureReady }, ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const materialsRef = useRef<Materials | null>(null)
  const floorRef = useRef<THREE.Mesh | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const decalCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const backdropRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const keyLightRef = useRef<THREE.RectAreaLight | null>(null)
  const rimLightRef = useRef<THREE.RectAreaLight | null>(null)
  const fillLightRef = useRef<THREE.RectAreaLight | null>(null)
  const cupRef = useRef(cup)
  const readyRef = useRef(onTextureReady); readyRef.current = onTextureReady
  const textureSettingsRef = useRef(textureSettings)
  cupRef.current = cup
  textureSettingsRef.current = textureSettings

  useImperativeHandle(ref, () => ({
    resetCamera() {
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!camera || !controls) return
      camera.position.copy(cameraPositionFor(cupRef.current))
      controls.target.set(0, 0, 0)
      controls.update()
    },
    exportPng() {
      const renderer = rendererRef.current
      if (!renderer) return Promise.resolve(false)
      return new Promise((resolve) => renderer.domElement.toBlob((blob) => {
        if (!blob) return resolve(false)
        downloadBlob(blob, `glass-studio-${new Date().toISOString().slice(0, 10)}.png`)
        resolve(true)
      }, 'image/png'))
    },
    async exportGlb(project: GlassStudioProjectV1) {
      const group = groupRef.current
      if (!group) return false
      const exportGroup = group.clone(true)
      exportGroup.rotation.set(0, 0, 0)
      exportGroup.scale.setScalar(MM_PER_WORLD_UNIT / 1000)
      exportGroup.name = project.cup.name
      exportGroup.userData.glassStudioProject = projectWithoutSecrets(project)
      exportGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry = object.geometry.clone()
          object.geometry.normalizeNormals()
        }
      })
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
      try {
        const result = await new GLTFExporter().parseAsync(exportGroup, { binary: true, onlyVisible: true })
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        downloadBlob(blob, `${project.name || 'glass-cup'}.glb`)
        return true
      } finally {
        exportGroup.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
      }
    },
  }), [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(sceneSettings.backgroundColor)
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.copy(cameraPositionFor(cupRef.current))
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.AgXToneMapping
    renderer.toneMappingExposure = 1.24
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer
    const environment = createStudioEnvironment(renderer)
    scene.environment = environment
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.zoomSpeed = 1.25
    controls.zoomToCursor = true
    controls.maxPolarAngle = Math.PI * 0.62
    controls.minPolarAngle = Math.PI * 0.18
    controls.target.set(0, 0, 0)
    controls.update()
    controlsRef.current = controls

    const glass = (options: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => new THREE.MeshPhysicalMaterial({
      color: glassSettings.color, roughness: glassSettings.roughness, metalness: 0, transmission: glassSettings.transmission,
      // The cup is assembled from separate outer-wall, inner-wall, base and rim
      // meshes.  Transparent depth writes would make the first layer hide every
      // glass layer behind it, most noticeably the bottom seen through the wall.
      transparent: true, opacity: 1, depthTest: true, depthWrite: false,
      ior: glassSettings.ior, thickness: cupRef.current.wallThicknessMm / MM_PER_WORLD_UNIT,
      envMapIntensity: sceneSettings.environmentIntensity, clearcoat: 0.42, clearcoatRoughness: 0.025,
      specularIntensity: 1, specularColor: '#ffffff', attenuationDistance: 18,
      attenuationColor: new THREE.Color(glassSettings.color), ...options,
    })
    const decal = (side: THREE.Side, opacity: number, depthTest: boolean) => new THREE.MeshPhysicalMaterial({
      transparent: true, opacity, roughness: 0.26, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.28,
      side, depthTest, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    })
    materialsRef.current = {
      outer: glass({ side: THREE.FrontSide }),
      inner: glass({ side: THREE.BackSide, thickness: Math.max(0.025, cupRef.current.wallThicknessMm / MM_PER_WORLD_UNIT * 0.55), roughness: glassSettings.roughness + 0.008 }),
      base: glass({ roughness: Math.max(0.045, glassSettings.roughness), thickness: cupRef.current.baseThicknessMm / MM_PER_WORLD_UNIT }),
      rim: glass({ transmission: 0.995, roughness: 0.018, thickness: cupRef.current.rimRadiusMm * 2 / MM_PER_WORLD_UNIT }),
      decalFront: decal(THREE.FrontSide, textureSettings.intensity, true), decalRear: decal(THREE.BackSide, textureSettings.intensity * 0.34, false),
    }
    const group = new THREE.Group()
    group.rotation.y = textureSettings.engraving ? Math.PI - 0.22 : -0.22
    groupRef.current = group
    scene.add(group)
    const floorMaterial = new THREE.MeshPhysicalMaterial({ color: sceneSettings.floorColor, roughness: 0.3, metalness: 0.12, clearcoat: 0.2 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floorRef.current = floor
    scene.add(floor)
    const backdropMaterial = new THREE.MeshBasicMaterial({ color: sceneSettings.backgroundColor, side: THREE.BackSide })
    backdropRef.current = backdropMaterial
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(24, 64, 32), backdropMaterial))
    const keyLight = new THREE.RectAreaLight(sceneSettings.keyLightColor, sceneSettings.keyLightIntensity, 1.15, 6.8)
    positionStageLight(keyLight, cupRef.current, sceneSettings.keyLightAzimuth + sceneSettings.lightRigRotation, sceneSettings.keyLightElevation, sceneSettings.lightDistance)
    scene.add(keyLight); keyLightRef.current = keyLight
    const rimLight = new THREE.RectAreaLight(sceneSettings.rimLightColor, sceneSettings.rimLightIntensity, 0.72, 5.4)
    positionStageLight(rimLight, cupRef.current, sceneSettings.rimLightAzimuth + sceneSettings.lightRigRotation, sceneSettings.rimLightElevation, sceneSettings.lightDistance)
    scene.add(rimLight); rimLightRef.current = rimLight
    const fillLight = new THREE.RectAreaLight('#f7fbff', sceneSettings.keyLightIntensity * 0.28, 4.4, 1.1)
    positionStageLight(fillLight, cupRef.current, 86 + sceneSettings.lightRigRotation, 1.12, sceneSettings.lightDistance * 0.92)
    scene.add(fillLight); fillLightRef.current = fillLight
    const spot = new THREE.SpotLight('#ffc48a', 4.5, 14, Math.PI / 5, 0.65, 1.3)
    spot.position.set(2.5, 5, 4.5); spot.target.position.set(0, -0.4, 0); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); scene.add(spot, spot.target)
    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight, false)
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      camera.zoom = camera.aspect < 0.9 ? 0.72 : 1
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount); resize()
    let frame = 0
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render) }
    render()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); textureRef.current?.dispose(); environment.dispose()
      disposeChildren(group)
      Object.values(materialsRef.current ?? {}).forEach((material) => material.dispose())
      scene.traverse((object) => { if (object instanceof THREE.Mesh && object.parent !== group) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose()); else object.material.dispose() } })
      renderer.dispose(); renderer.domElement.remove()
      rendererRef.current = null; cameraRef.current = null; controlsRef.current = null; groupRef.current = null; materialsRef.current = null
    }
  // Scene ownership stays stable; prop updates are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const group = groupRef.current
    const materials = materialsRef.current
    if (!group || !materials) return
    let cancelled = false
    disposeChildren(group)
    if (cup.modelAsset) {
      const assetUrl = `${import.meta.env.BASE_URL}${cup.modelAsset}`
      import('three/examples/jsm/loaders/GLTFLoader.js')
        .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(assetUrl))
        .then((gltf) => {
          if (cancelled) {
            gltf.scene.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return
              object.geometry.dispose()
              const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
              sourceMaterials.forEach((material) => material.dispose())
            })
            return
          }
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return
            const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
            sourceMaterials.forEach((material) => material.dispose())
            object.material = materials.outer
            object.castShadow = true
            object.receiveShadow = true
            object.renderOrder = 1
          })
          const sourceDimensions = cup.modelDimensionsMm ?? { height: cup.heightMm, diameter: cup.maxDiameterMm }
          const metresToWorld = 1000 / MM_PER_WORLD_UNIT
          gltf.scene.scale.set(
            metresToWorld * cup.maxDiameterMm / sourceDimensions.diameter,
            metresToWorld * cup.heightMm / sourceDimensions.height,
            metresToWorld * cup.maxDiameterMm / sourceDimensions.diameter,
          )
          gltf.scene.position.y = -cup.heightMm / MM_PER_WORLD_UNIT / 2
          group.add(gltf.scene)
        })
        .catch((error) => console.error('内置高脚杯模型加载失败', error))
    } else {
      const outer = new THREE.Mesh(latheGeometry(cup), materials.outer)
      outer.castShadow = true; outer.receiveShadow = true; outer.renderOrder = 1; group.add(outer)
      const inner = new THREE.Mesh(innerLatheGeometry(cup), materials.inner)
      inner.renderOrder = 2; group.add(inner)
      const baseRadius = getOuterRadiusAt(cup, cup.baseThicknessMm * 0.5) / MM_PER_WORLD_UNIT
      const base = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius, Math.max(0.1, baseRadius - cup.bottomRadiusMm / MM_PER_WORLD_UNIT * 0.3), cup.baseThicknessMm / MM_PER_WORLD_UNIT, 128, 2), materials.base)
      base.position.y = -cup.heightMm / MM_PER_WORLD_UNIT / 2 + cup.baseThicknessMm / MM_PER_WORLD_UNIT / 2
      // Render internal glass after the walls. MeshPhysicalMaterial transmission
      // only samples the opaque scene, so explicit ordering is needed for the
      // separately-modelled bottom to remain visible through the cup body.
      base.castShadow = true; base.renderOrder = 3; group.add(base)
      const rimRadius = (cup.openingDiameterMm / 2 + cup.wallThicknessMm / 2) / MM_PER_WORLD_UNIT
      const rim = new THREE.Mesh(new THREE.TorusGeometry(rimRadius, cup.rimRadiusMm / MM_PER_WORLD_UNIT, 24, 160), materials.rim)
      rim.rotation.x = Math.PI / 2; rim.position.y = cup.heightMm / MM_PER_WORLD_UNIT / 2; rim.renderOrder = 5; group.add(rim)
      const innerRim = new THREE.Mesh(new THREE.TorusGeometry(cup.openingDiameterMm / 2 / MM_PER_WORLD_UNIT, Math.max(0.45, cup.rimRadiusMm * 0.34) / MM_PER_WORLD_UNIT, 18, 160), materials.rim)
      innerRim.rotation.x = Math.PI / 2; innerRim.position.y = cup.heightMm / MM_PER_WORLD_UNIT / 2 - 0.012; innerRim.renderOrder = 5; group.add(innerRim)
      const bottomTube = Math.max(0.6, cup.bottomRadiusMm * 0.52) / MM_PER_WORLD_UNIT
      const bottomRingRadius = Math.max(bottomTube * 1.5, getOuterRadiusAt(cup, cup.bottomRadiusMm) / MM_PER_WORLD_UNIT - bottomTube)
      const bottomRing = new THREE.Mesh(new THREE.TorusGeometry(bottomRingRadius, bottomTube, 20, 160), materials.rim)
      bottomRing.rotation.x = Math.PI / 2
      bottomRing.position.y = -cup.heightMm / MM_PER_WORLD_UNIT / 2 + bottomTube * 0.82
      bottomRing.renderOrder = 4
      group.add(bottomRing)
    }
    materials.outer.thickness = cup.wallThicknessMm / MM_PER_WORLD_UNIT
    materials.inner.thickness = Math.max(0.025, cup.wallThicknessMm / MM_PER_WORLD_UNIT * 0.55)
    materials.base.thickness = cup.baseThicknessMm / MM_PER_WORLD_UNIT
    materials.rim.thickness = cup.rimRadiusMm * 2 / MM_PER_WORLD_UNIT
    const rear = new THREE.Mesh(decalLatheGeometry(cup, textureSettings, 0.45), materials.decalRear)
    rear.renderOrder = 10; group.add(rear)
    const front = new THREE.Mesh(decalLatheGeometry(cup, textureSettings, 0.5), materials.decalFront)
    front.renderOrder = 11; group.add(front)
    if (floorRef.current) floorRef.current.position.y = -cup.heightMm / MM_PER_WORLD_UNIT / 2 - 0.18
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (camera && controls) {
      const distance = cameraPositionFor(cup).length()
      const surfaceRadius = cup.maxDiameterMm / MM_PER_WORLD_UNIT / 2
      controls.minDistance = Math.max(camera.near * 3, surfaceRadius * 1.08)
      controls.maxDistance = distance * 2
      controls.target.set(0, 0, 0); controls.update()
    }
    const decalCanvas = decalCanvasRef.current
    const decalImage = sourceImageRef.current
    const decalTexture = textureRef.current
    if (decalCanvas && decalImage && decalTexture) {
      resizeDecalCanvas(decalCanvas, cup)
      paintDecalCanvas(decalCanvas, decalImage, textureSettings)
      decalTexture.needsUpdate = true
    }
    return () => { cancelled = true }
  }, [cup, textureSettings.areaCenterY, textureSettings.areaHeight])

  useEffect(() => {
    const materials = materialsRef.current
    if (!materials) return
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      resizeDecalCanvas(canvas, cupRef.current)
      paintDecalCanvas(canvas, image, textureSettingsRef.current)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.premultiplyAlpha = true
      const previous = textureRef.current
      textureRef.current = texture; sourceImageRef.current = image; decalCanvasRef.current = canvas
      materials.decalFront.map = texture; materials.decalRear.map = texture; materials.decalFront.needsUpdate = true; materials.decalRear.needsUpdate = true
      previous?.dispose()
      requestAnimationFrame(() => { if (!cancelled) readyRef.current?.(imageUrl) })
    }
    image.src = imageUrl
    return () => { cancelled = true; image.onload = null }
  }, [imageUrl])

  useEffect(() => {
    const texture = textureRef.current; const canvas = decalCanvasRef.current; const image = sourceImageRef.current
    if (texture && canvas && image) { resizeDecalCanvas(canvas, cupRef.current); paintDecalCanvas(canvas, image, textureSettings); texture.needsUpdate = true }
    const materials = materialsRef.current
    if (materials) { materials.decalFront.opacity = textureSettings.intensity; materials.decalRear.opacity = textureSettings.intensity * 0.34; for(const m of [materials.decalFront,materials.decalRear]) { m.roughness=textureSettings.engraving ? .92 : .26; m.clearcoat=textureSettings.engraving ? 0 : .35; m.needsUpdate=true } }
  }, [textureSettings])

  useEffect(() => {
    if (groupRef.current) groupRef.current.rotation.y = textureSettings.engraving ? Math.PI - 0.22 : -0.22
  }, [textureSettings.engraving])

  useEffect(() => {
    const materials = materialsRef.current
    if (!materials) return
    const tint = new THREE.Color(glassSettings.color)
    ;[materials.outer, materials.inner, materials.base, materials.rim].forEach((material) => {
      material.color.copy(tint); material.attenuationColor.copy(tint); material.transmission = glassSettings.transmission; material.roughness = glassSettings.roughness; material.ior = glassSettings.ior; material.needsUpdate = true
    })
    // Keep a slight highlight on the thick base without turning high-clarity
    // glass into a frosted grey slab.
    materials.base.roughness = Math.max(0.025, glassSettings.roughness)
    materials.rim.transmission = Math.max(0.9, glassSettings.transmission)
  }, [glassSettings])

  useEffect(() => {
    const scene = sceneRef.current
    const background = new THREE.Color(sceneSettings.backgroundColor)
    if (scene) scene.background = background
    backdropRef.current?.color.copy(background)
    const floorMaterial = floorRef.current?.material
    if (floorMaterial instanceof THREE.MeshPhysicalMaterial) {
      floorMaterial.color.set(sceneSettings.floorColor); floorMaterial.roughness = sceneSettings.floorReflective ? 0.3 : 0.92
      floorMaterial.metalness = sceneSettings.floorReflective ? 0.12 : 0; floorMaterial.clearcoat = sceneSettings.floorReflective ? 0.2 : 0
      floorMaterial.envMapIntensity = sceneSettings.floorReflective ? sceneSettings.environmentIntensity : 0.15; floorMaterial.needsUpdate = true
    }
    if (keyLightRef.current) {
      keyLightRef.current.color.set(sceneSettings.keyLightColor)
      keyLightRef.current.intensity = sceneSettings.keyLightIntensity
      keyLightRef.current.width = 1.15 * sceneSettings.lightSoftness
      keyLightRef.current.height = 6.8 * sceneSettings.lightSoftness
      positionStageLight(keyLightRef.current, cup, sceneSettings.keyLightAzimuth + sceneSettings.lightRigRotation, sceneSettings.keyLightElevation, sceneSettings.lightDistance)
    }
    if (rimLightRef.current) {
      rimLightRef.current.color.set(sceneSettings.rimLightColor)
      rimLightRef.current.intensity = sceneSettings.rimLightIntensity
      rimLightRef.current.width = 0.72 * sceneSettings.lightSoftness
      rimLightRef.current.height = 5.4 * sceneSettings.lightSoftness
      positionStageLight(rimLightRef.current, cup, sceneSettings.rimLightAzimuth + sceneSettings.lightRigRotation, sceneSettings.rimLightElevation, sceneSettings.lightDistance)
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = sceneSettings.keyLightIntensity * 0.28
      fillLightRef.current.width = 4.4 * sceneSettings.lightSoftness
      fillLightRef.current.height = 1.1 * sceneSettings.lightSoftness
      positionStageLight(fillLightRef.current, cup, 86 + sceneSettings.lightRigRotation, 1.12, sceneSettings.lightDistance * 0.92)
    }
    const materials = materialsRef.current
    if (materials) [materials.outer, materials.inner, materials.base, materials.rim].forEach((material) => { material.envMapIntensity = sceneSettings.environmentIntensity; material.needsUpdate = true })
  }, [cup, sceneSettings])

  return <div className="scene-mount" ref={mountRef} aria-label="可拖动旋转的 3D 玻璃杯预览" />
})

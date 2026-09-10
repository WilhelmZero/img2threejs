import * as THREE from 'three'
import type { GlassStudioProjectV1 } from '../types'
import { validateProject } from './project'

export type GenericGlbSample = {
  sizeMm: THREE.Vector3
  profile: Array<{ yRatio: number; radiusRatio: number }>
}

export async function inspectGlb(file: File): Promise<{ project?: GlassStudioProjectV1; sample?: GenericGlbSample }> {
  const buffer = await file.arrayBuffer()
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  let embedded: unknown
  gltf.scene.traverse((object) => {
    if (!embedded && object.userData?.glassStudioProject) embedded = object.userData.glassStudioProject
  })
  if (embedded) return { project: validateProject(embedded) }

  const box = new THREE.Box3().setFromObject(gltf.scene)
  if (box.isEmpty()) throw new Error('GLB 中没有可读取的网格')
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scaleToMm = Math.max(size.x, size.y, size.z) < 10 ? 1000 : 1
  const axes = [size.x, size.y, size.z]
  const verticalAxis = axes.indexOf(Math.max(...axes))
  const vertices: Array<{ y: number; radius: number }> = []
  const point = new THREE.Vector3()
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.geometry.attributes.position) return
    const position = object.geometry.attributes.position
    for (let index = 0; index < position.count; index += Math.max(1, Math.floor(position.count / 8000))) {
      point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld)
      const values = [point.x, point.y, point.z]
      const centerValues = [center.x, center.y, center.z]
      const y = values[verticalAxis] - box.min.getComponent(verticalAxis)
      const radialAxes = [0, 1, 2].filter((axis) => axis !== verticalAxis)
      vertices.push({ y, radius: Math.hypot(values[radialAxes[0]] - centerValues[radialAxes[0]], values[radialAxes[1]] - centerValues[radialAxes[1]]) })
    }
  })
  const height = axes[verticalAxis]
  const diameter = Math.max(...axes.filter((_, axis) => axis !== verticalAxis))
  const bins = 18
  const profile = Array.from({ length: bins }, (_, bin) => {
    const low = (bin / (bins - 1)) * height
    const halfBand = height / bins
    const band = vertices.filter((vertex) => Math.abs(vertex.y - low) <= halfBand)
    const radius = band.length ? Math.max(...band.map((vertex) => vertex.radius)) : diameter / 2
    return { yRatio: bin / (bins - 1), radiusRatio: Math.min(0.5, radius / diameter) }
  })
  return { sample: { sizeMm: size.multiplyScalar(scaleToMm), profile } }
}

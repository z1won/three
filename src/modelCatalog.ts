import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './modelThumbnails.css'

export type PublicModel = {
  name: string
  format: 'GLB' | 'GLTF'
  url: string
  description: string
}

export const publicModels: PublicModel[] = [
  { name: 'Damaged Helmet', format: 'GLB', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb', description: 'PBR material / texture sample' },
  { name: 'Flight Helmet', format: 'GLB', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/FlightHelmet/glTF-Binary/FlightHelmet.glb', description: 'Detailed hard-surface model' },
  { name: 'Cesium Man', format: 'GLB', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb', description: 'Animated character sample' },
  { name: 'Fox', format: 'GLB', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb', description: 'Character with animation clips' },
  { name: 'BoomBox', format: 'GLB', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb', description: 'PBR / normal-map sample' },
  { name: 'Duck', format: 'GLTF', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF/Duck.gltf', description: 'GLTF with external resources' },
  { name: 'Avocado', format: 'GLTF', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF/Avocado.gltf', description: 'Compact PBR asset' },
  { name: 'Lantern', format: 'GLTF', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF/Lantern.gltf', description: 'Metallic material sample' },
]

function mountThumbnail(card: Element, catalogModel: PublicModel) {
  if (card.querySelector('.live-model-thumbnail')) return

  const host = document.createElement('div')
  host.className = 'live-model-thumbnail'
  host.setAttribute('aria-hidden', 'true')
  card.prepend(host)

  const canvas = document.createElement('canvas')
  host.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000)
  camera.position.set(3, 1.8, 4)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x182033, 2.2))
  const key = new THREE.DirectionalLight(0xffffff, 3.2)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8eb6ff, 1.4)
  rim.position.set(-4, 2, -4)
  scene.add(rim)

  let previewModel: THREE.Object3D | null = null
  let frameId = 0
  let active = false
  let disposed = false
  let loadStarted = false

  const resize = () => {
    const width = Math.max(host.clientWidth, 1)
    const height = Math.max(host.clientHeight, 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const frameModel = (root: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z, 0.001)
    const distance = (maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.35
    camera.position.set(distance * 0.72, distance * 0.45, distance)
    camera.near = Math.max(maxSize / 100, 0.001)
    camera.far = maxSize * 100
    camera.lookAt(center)
    camera.updateProjectionMatrix()
  }

  const render = () => {
    if (disposed) return
    if (active && previewModel) {
      previewModel.rotation.y += 0.004
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(render)
  }

  const startLoad = () => {
    if (loadStarted || disposed) return
    loadStarted = true
    const loader = new GLTFLoader()
    loader.load(catalogModel.url, (gltf) => {
      if (disposed) return
      previewModel = gltf.scene
      previewModel.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true
          object.receiveShadow = true
        }
      })
      scene.add(previewModel)
      frameModel(previewModel)
      resize()
    }, undefined, () => {
      if (!disposed) host.classList.add('live-model-thumbnail-error')
    })
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting
    if (active) startLoad()
  }, { rootMargin: '80px' })
  visibilityObserver.observe(host)
  resize()
  const dispose = () => {
    disposed = true
    cancelAnimationFrame(frameId)
    resizeObserver.disconnect()
    visibilityObserver.disconnect()
    if (previewModel) {
      previewModel.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      scene.remove(previewModel)
    }
    renderer.dispose()
  }
  window.addEventListener('pagehide', dispose, { once: true })
  render()
}

function mountLivePreviews() {
  document.querySelectorAll('.public-model').forEach((card) => {
    const text = card.textContent ?? ''
    const catalogModel = publicModels.find((candidate) => text.includes(candidate.name))
    if (catalogModel) mountThumbnail(card, catalogModel)
  })
}

if (typeof window !== 'undefined') {
  const init = () => {
    mountLivePreviews()
    const observer = new MutationObserver(() => mountLivePreviews())
    observer.observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
}

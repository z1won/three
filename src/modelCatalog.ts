import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './modelThumbnails.css'

export type PublicModel = {
  name: string
  format: 'GLB' | 'GLTF'
  url: string
  description: string
}

const sampleAssets = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/'

export const publicModels: PublicModel[] = [
  { name: 'Damaged Helmet', format: 'GLB', url: `${sampleAssets}DamagedHelmet/glTF-Binary/DamagedHelmet.glb`, description: 'PBR material / texture sample' },
  { name: 'Flight Helmet', format: 'GLB', url: `${sampleAssets}FlightHelmet/glTF-Binary/FlightHelmet.glb`, description: 'Detailed hard-surface model' },
  { name: 'Cesium Man', format: 'GLB', url: `${sampleAssets}CesiumMan/glTF-Binary/CesiumMan.glb`, description: 'Animated character sample' },
  { name: 'Fox', format: 'GLB', url: `${sampleAssets}Fox/glTF-Binary/Fox.glb`, description: 'Character with animation clips' },
  { name: 'BoomBox', format: 'GLB', url: `${sampleAssets}BoomBox/glTF-Binary/BoomBox.glb`, description: 'PBR / normal-map sample' },
  { name: 'Duck', format: 'GLTF', url: `${sampleAssets}Duck/glTF/Duck.gltf`, description: 'GLTF with external resources' },
  { name: 'Avocado', format: 'GLTF', url: `${sampleAssets}Avocado/glTF/Avocado.gltf`, description: 'Compact PBR asset' },
  { name: 'Lantern', format: 'GLTF', url: `${sampleAssets}Lantern/glTF/Lantern.gltf`, description: 'Metallic material sample' },
  { name: 'Antique Camera', format: 'GLB', url: `${sampleAssets}AntiqueCamera/glTF-Binary/AntiqueCamera.glb`, description: 'Vintage camera on a tripod' },
  { name: 'Barramundi Fish', format: 'GLB', url: `${sampleAssets}BarramundiFish/glTF-Binary/BarramundiFish.glb`, description: 'Organic character-style asset' },
  { name: 'BrainStem', format: 'GLB', url: `${sampleAssets}BrainStem/glTF-Binary/BrainStem.glb`, description: 'Skinned animated character' },
  { name: 'Box', format: 'GLB', url: `${sampleAssets}Box/glTF-Binary/Box.glb`, description: 'Minimal one-mesh starter asset' },
  { name: 'Box Animated', format: 'GLB', url: `${sampleAssets}BoxAnimated/glTF-Binary/BoxAnimated.glb`, description: 'Rotation and translation animation' },
  { name: 'Box Textured', format: 'GLB', url: `${sampleAssets}BoxTextured/glTF-Binary/BoxTextured.glb`, description: 'Simple textured PBR box' },
  { name: 'Box Vertex Colors', format: 'GLB', url: `${sampleAssets}BoxVertexColors/glTF-Binary/BoxVertexColors.glb`, description: 'Vertex color attribute sample' },
  { name: 'Animated Cube', format: 'GLTF', url: `${sampleAssets}AnimatedCube/glTF/AnimatedCube.gltf`, description: 'Simple linear rotation animation' },
  { name: 'Animated Triangle', format: 'GLTF', url: `${sampleAssets}AnimatedTriangle/glTF/AnimatedTriangle.gltf`, description: 'Minimal animated transform sample' },
  { name: 'BoomBox with Axes', format: 'GLTF', url: `${sampleAssets}BoomBoxWithAxes/glTF/BoomBoxWithAxes.gltf`, description: 'X / Y / Z orientation reference' },
  { name: 'Cameras', format: 'GLTF', url: `${sampleAssets}Cameras/glTF/Cameras.gltf`, description: 'Scene containing multiple cameras' },
  { name: 'Cesium Milk Truck', format: 'GLB', url: `${sampleAssets}CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb`, description: 'Detailed vehicle with PBR materials' },
  { name: 'Gearbox Assembly', format: 'GLB', url: `${sampleAssets}GearboxAssy/glTF-Binary/GearboxAssy.glb`, description: 'Mechanical assembly sample' },
  { name: 'Toy Car', format: 'GLB', url: `${sampleAssets}ToyCar/glTF-Binary/ToyCar.glb`, description: 'Stylized vehicle model' },
]

function mountThumbnail(card: Element, catalogModel: PublicModel) {
  if (card.querySelector('.live-model-thumbnail')) return

  const host = document.createElement('div')
  host.className = 'live-model-thumbnail'
  host.setAttribute('aria-hidden', 'true')
  card.prepend(host)

  let renderer: THREE.WebGLRenderer | null = null
  let canvas: HTMLCanvasElement | null = null
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000)
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
    if (!renderer) return
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
    if (disposed || !active || !renderer) return
    if (previewModel) {
      previewModel.rotation.y += 0.004
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(render)
  }

  const createRenderer = () => {
    if (renderer || disposed) return
    canvas = document.createElement('canvas')
    host.appendChild(canvas)
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    resize()
    if (previewModel) {
      frameModel(previewModel)
      render()
    }
  }

  const disposeRenderer = () => {
    cancelAnimationFrame(frameId)
    frameId = 0
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
      renderer = null
    }
    canvas?.remove()
    canvas = null
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
      if (active) render()
    }, undefined, () => {
      if (!disposed) host.classList.add('live-model-thumbnail-error')
    })
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting
    if (active) {
      host.classList.remove('live-model-thumbnail-error')
      createRenderer()
      startLoad()
      render()
    } else {
      disposeRenderer()
    }
  }, { rootMargin: '120px 0px', threshold: 0.01 })
  visibilityObserver.observe(host)

  const dispose = () => {
    disposed = true
    resizeObserver.disconnect()
    visibilityObserver.disconnect()
    disposeRenderer()
    if (previewModel) {
      previewModel.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      scene.remove(previewModel)
      previewModel = null
    }
  }
  window.addEventListener('pagehide', dispose, { once: true })
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

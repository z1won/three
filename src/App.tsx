import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import './styles.css'

type TransformMode = 'translate' | 'rotate' | 'scale'
type TransformSpace = 'world' | 'local'
type SelectedObject = 'cube' | THREE.Object3D

type ModelProps = { url: string; onSelect: (object: THREE.Object3D) => void; onLoaded: (scene: THREE.Object3D) => void }

type SceneSettingsProps = {
  fov: number
  resetCamera: number
  ambientIntensity: number
  keyLightIntensity: number
  keyLightPosition: [number, number, number]
  fillLightIntensity: number
}

const resourceUrls = new Map<string, string>()

function resolveResource(url: string) {
  const normalized = url.split('?')[0].split('#')[0]
  for (const candidate of [normalized, normalized.replace(/^\.\//, ''), decodeURIComponent(normalized)]) {
    const direct = resourceUrls.get(candidate)
    if (direct) return direct
    const basename = candidate.split('/').pop()
    if (basename && resourceUrls.has(basename)) return resourceUrls.get(basename)!
  }
  return url
}

function configureLoader(loader: { manager: THREE.LoadingManager }) {
  loader.manager.setURLModifier(resolveResource)
}

function Cube({ selected, mode, space, onSelect }: { selected: boolean; mode: TransformMode; space: TransformSpace; onSelect: (object: THREE.Object3D) => void }) {
  const cube = <mesh position={[0, 1, 0]} onClick={(e) => { e.stopPropagation(); onSelect(e.object) }}><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color={selected ? '#22c55e' : '#4f46e5'} roughness={0.35} metalness={0.15} /></mesh>
  return selected ? <TransformControls mode={mode} space={space}>{cube}</TransformControls> : cube
}

function GLTFModel({ url, onSelect, onLoaded }: ModelProps) {
  const { scene } = useGLTF(url, true, true, configureLoader)
  useEffect(() => {
    scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.userData.editorSelectable = true; object.castShadow = true; object.receiveShadow = true } })
    onLoaded(scene)
  }, [scene, onLoaded])
  const handleClick = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.object instanceof THREE.Mesh) onSelect(event.object) }
  return <primitive object={scene} onClick={handleClick} />
}

function SceneSettings({ fov, resetCamera, ambientIntensity, keyLightIntensity, keyLightPosition, fillLightIntensity }: SceneSettingsProps) {
  const { camera } = useThree()
  useEffect(() => {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, fov])
  useEffect(() => {
    camera.position.set(5, 3.5, 7)
    camera.lookAt(0, 0, 0)
  }, [camera, resetCamera])
  return <>
    <ambientLight intensity={ambientIntensity} />
    <directionalLight position={keyLightPosition} intensity={keyLightIntensity} castShadow />
    <directionalLight position={[-4, 3, -4]} intensity={fillLightIntensity} />
  </>
}

function getMeshNodes(scene: THREE.Object3D) { const nodes: THREE.Mesh[] = []; scene.traverse((object) => { if (object instanceof THREE.Mesh) nodes.push(object) }); return nodes }

function getMaterial(mesh: THREE.Mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial ? material : null
}

export default function App() {
  const [selected, setSelected] = useState<SelectedObject | null>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [modelName, setModelName] = useState('')
  const [mode, setMode] = useState<TransformMode>('translate')
  const [space, setSpace] = useState<TransformSpace>('world')
  const [modelMeshes, setModelMeshes] = useState<THREE.Mesh[]>([])
  const [materialVersion, setMaterialVersion] = useState(0)
  const [fov, setFov] = useState(50)
  const [resetCamera, setResetCamera] = useState(0)
  const [ambientIntensity, setAmbientIntensity] = useState(0.55)
  const [keyLightIntensity, setKeyLightIntensity] = useState(2)
  const [keyLightX, setKeyLightX] = useState(5)
  const [keyLightY, setKeyLightY] = useState(8)
  const [keyLightZ, setKeyLightZ] = useState(5)
  const [fillLightIntensity, setFillLightIntensity] = useState(0.5)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'w') setMode('translate'); if (key === 'e') setMode('rotate'); if (key === 'r') setMode('scale'); if (key === 'q') setSpace((v) => v === 'world' ? 'local' : 'world'); if (key === 'escape') setSelected(null)
    }
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearResources = () => { for (const url of new Set(resourceUrls.values())) URL.revokeObjectURL(url); resourceUrls.clear() }
  useEffect(() => () => { clearResources() }, [])

  const loadModel = (url: string, name = 'Remote model') => { if (!url) return; setModelUrl(url); setModelName(name); setSelected(null); setModelMeshes([]); setMaterialVersion((v) => v + 1) }

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const mainFile = files.find((file) => /\.(gltf|glb)$/i.test(file.name))
    if (!mainFile) { if (files.length) window.alert('GLB 또는 GLTF 파일을 하나 이상 포함해야 합니다.'); event.target.value = ''; return }
    clearResources()
    for (const file of files) { const objectUrl = URL.createObjectURL(file); resourceUrls.set(file.name, objectUrl); resourceUrls.set(`./${file.name}`, objectUrl) }
    loadModel(resourceUrls.get(mainFile.name)!, mainFile.name)
    event.target.value = ''
  }

  const handleUrlSubmit = (event: React.FormEvent) => { event.preventDefault(); clearResources(); loadModel(urlInput.trim()) }
  const clearModel = () => { clearResources(); setModelUrl(''); setModelName(''); setModelMeshes([]); setSelected(null); setMaterialVersion((v) => v + 1) }
  const selectedMesh = selected instanceof THREE.Mesh ? selected : null
  const material = selectedMesh ? getMaterial(selectedMesh) : null
  void materialVersion

  const updateMaterial = (update: (material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) => void) => {
    if (!material) return
    update(material)
    material.needsUpdate = true
    setMaterialVersion((v) => v + 1)
  }

  const materialColor = material ? `#${material.color.getHexString()}` : '#ffffff'
  const materialRoughness = material?.roughness ?? 0.5
  const materialMetalness = material?.metalness ?? 0
  const materialOpacity = material?.opacity ?? 1

  return <main className="app"><header className="toolbar"><div><strong>Three.js Playground</strong><span>Browser-only 3D renderer</span></div><span className="status">React Three Fiber · Three.js · GLB/GLTF</span></header><section className="viewport">
    <Canvas camera={{ position: [5, 3.5, 7], fov }} shadows onPointerMissed={() => setSelected(null)}><color attach="background" args={['#0b1020']} /><SceneSettings fov={fov} resetCamera={resetCamera} ambientIntensity={ambientIntensity} keyLightIntensity={keyLightIntensity} keyLightPosition={[keyLightX, keyLightY, keyLightZ]} fillLightIntensity={fillLightIntensity} />
      {!modelUrl && <Cube selected={selected === 'cube'} mode={mode} space={space} onSelect={setSelected} />}
      {modelUrl && <Suspense fallback={null}><Bounds fit clip observe margin={1.2}><GLTFModel url={modelUrl} onSelect={setSelected} onLoaded={(scene) => setModelMeshes(getMeshNodes(scene))} /></Bounds></Suspense>}
      {selectedMesh && <TransformControls object={selectedMesh} mode={mode} space={space} />}<Grid args={[20, 20]} cellSize={1} cellThickness={0.6} sectionSize={5} sectionThickness={1.2} fadeDistance={30} fadeStrength={1} /><OrbitControls makeDefault enableDamping />
    </Canvas>
    <aside className="panel"><h2>Scene</h2>{!modelUrl && <button className={selected === 'cube' ? 'active scene-item' : 'scene-item'} onClick={() => setSelected('cube')}>Cube</button>}
      {modelUrl && <div className="hierarchy"><span className="section-label">Hierarchy</span><button className={!selected ? 'scene-item active' : 'scene-item'} onClick={() => setSelected(null)}>◈ {modelName || 'Model'}</button>{modelMeshes.length === 0 && <span className="empty-hierarchy">모델 로딩 중...</span>}{modelMeshes.map((mesh, index) => <button key={mesh.uuid} className={selected === mesh ? 'scene-item child active' : 'scene-item child'} onClick={() => setSelected(mesh)}>◇ {mesh.name || `Mesh ${index + 1}`}</button>)}</div>}
      <div className="model-loader"><label className="file-button">GLB / GLTF + 리소스 업로드<input type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,model/gltf-binary,model/gltf+json" onChange={handleFiles} /></label><span className="upload-hint">.gltf, .bin, 텍스처를 함께 선택하세요.</span><form onSubmit={handleUrlSubmit} className="url-form"><input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://.../model.glb" aria-label="GLB/GLTF URL" /><button type="submit">Load</button></form>{modelUrl && <div className="loaded-model"><span title={modelName}>{modelName}</span><button type="button" onClick={clearModel}>×</button></div>}</div>
      <div className="scene-tools"><span className="section-label">Camera</span><label className="material-row"><span>FOV <output>{fov}°</output></span><input type="range" min="20" max="100" step="1" value={fov} onChange={(e) => setFov(Number(e.target.value))} /></label><button className="full-button" onClick={() => setResetCamera((v) => v + 1)}>Reset camera</button></div>
      <div className="scene-tools"><span className="section-label">Lighting</span><label className="material-row"><span>Ambient <output>{ambientIntensity.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={ambientIntensity} onChange={(e) => setAmbientIntensity(Number(e.target.value))} /></label><label className="material-row"><span>Key light <output>{keyLightIntensity.toFixed(2)}</output></span><input type="range" min="0" max="5" step="0.01" value={keyLightIntensity} onChange={(e) => setKeyLightIntensity(Number(e.target.value))} /></label><div className="light-position"><label>X<input type="range" min="-10" max="10" step="0.5" value={keyLightX} onChange={(e) => setKeyLightX(Number(e.target.value))} /></label><label>Y<input type="range" min="-10" max="15" step="0.5" value={keyLightY} onChange={(e) => setKeyLightY(Number(e.target.value))} /></label><label>Z<input type="range" min="-10" max="10" step="0.5" value={keyLightZ} onChange={(e) => setKeyLightZ(Number(e.target.value))} /></label></div><label className="material-row"><span>Fill light <output>{fillLightIntensity.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={fillLightIntensity} onChange={(e) => setFillLightIntensity(Number(e.target.value))} /></label></div>
      {selected && <div className="transform-tools"><span className="section-label">Transform</span><div className="mode-buttons"><button className={mode === 'translate' ? 'active' : ''} onClick={() => setMode('translate')}>Move <kbd>W</kbd></button><button className={mode === 'rotate' ? 'active' : ''} onClick={() => setMode('rotate')}>Rotate <kbd>E</kbd></button><button className={mode === 'scale' ? 'active' : ''} onClick={() => setMode('scale')}>Scale <kbd>R</kbd></button></div><div className="mode-buttons"><button className={space === 'world' ? 'active' : ''} onClick={() => setSpace('world')}>World</button><button className={space === 'local' ? 'active' : ''} onClick={() => setSpace('local')}>Local</button></div></div>}
      {material && <div className="material-tools"><span className="section-label">Material</span><label className="material-row"><span>Color</span><input type="color" value={materialColor} onChange={(e) => updateMaterial((m) => m.color.set(e.target.value))} /></label><label className="material-row"><span>Roughness <output>{materialRoughness.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialRoughness} onChange={(e) => updateMaterial((m) => m.roughness = Number(e.target.value))} /></label><label className="material-row"><span>Metalness <output>{materialMetalness.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialMetalness} onChange={(e) => updateMaterial((m) => m.metalness = Number(e.target.value))} /></label><label className="material-row"><span>Opacity <output>{materialOpacity.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialOpacity} onChange={(e) => updateMaterial((m) => { m.opacity = Number(e.target.value); m.transparent = m.opacity < 1 })} /></label></div>}
      <div className="help"><p>오브젝트 클릭: Mesh 선택</p><p><kbd>W</kbd> 이동 · <kbd>E</kbd> 회전 · <kbd>R</kbd> 스케일</p><p><kbd>Q</kbd> World / Local · <kbd>Esc</kbd> 선택 해제</p><p>카메라 FOV와 조명 위치/강도를 조절할 수 있습니다.</p></div>
    </aside></section></main>
}

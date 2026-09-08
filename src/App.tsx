import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { Bounds, Environment, Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import './styles.css'

type TransformMode = 'translate' | 'rotate' | 'scale'
type TransformSpace = 'world' | 'local'
type SelectedObject = 'cube' | THREE.Object3D
type EnvironmentPreset = 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment'
type TransformSnapshot = { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
type HistoryEntry = { before: TransformSnapshot; after: TransformSnapshot }
type ProjectMaterial = { color: string; roughness: number; metalness: number; opacity: number }
type ProjectObject = { key: string; position: [number, number, number]; quaternion: [number, number, number, number]; scale: [number, number, number]; material?: ProjectMaterial }
type ProjectFile = { version: 1; type: 'three-playground-project'; savedAt: string; model?: { source: 'url'; url: string; name: string }; scene: { fov: number; ambientIntensity: number; keyLightIntensity: number; keyLightPosition: [number, number, number]; fillLightIntensity: number; environmentEnabled: boolean; environmentPreset: EnvironmentPreset; environmentIntensity: number; objects: ProjectObject[] } }

type ModelProps = { url: string; onSelect: (object: THREE.Object3D) => void; onLoaded: (scene: THREE.Object3D) => void }
type SceneSettingsProps = { fov: number; resetCamera: number; ambientIntensity: number; keyLightIntensity: number; keyLightPosition: [number, number, number]; fillLightIntensity: number; environmentEnabled: boolean; environmentPreset: EnvironmentPreset; environmentIntensity: number }

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
function configureLoader(loader: { manager: THREE.LoadingManager }) { loader.manager.setURLModifier(resolveResource) }
function captureTransform(object: THREE.Object3D): TransformSnapshot { return { object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() } }
function applyTransform(snapshot: TransformSnapshot) { snapshot.object.position.copy(snapshot.position); snapshot.object.quaternion.copy(snapshot.quaternion); snapshot.object.scale.copy(snapshot.scale); snapshot.object.updateMatrixWorld(true) }
function sameTransform(a: TransformSnapshot, b: TransformSnapshot) { return a.position.equals(b.position) && a.quaternion.equals(b.quaternion) && a.scale.equals(b.scale) }
function materialFor(mesh: THREE.Mesh) { const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; return material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial ? material : null }

function Cube({ selected, onSelect }: { selected: boolean; onSelect: (object: THREE.Object3D) => void }) {
  return <mesh position={[0, 1, 0]} onClick={(e) => { e.stopPropagation(); onSelect(e.object) }}><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color={selected ? '#22c55e' : '#4f46e5'} roughness={0.35} metalness={0.15} /></mesh>
}
function GLTFModel({ url, onSelect, onLoaded }: ModelProps) {
  const { scene } = useGLTF(url, true, true, configureLoader)
  useEffect(() => { scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.userData.editorSelectable = true; object.castShadow = true; object.receiveShadow = true } }); onLoaded(scene) }, [scene, onLoaded])
  const handleClick = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.object instanceof THREE.Mesh) onSelect(event.object) }
  return <primitive object={scene} onClick={handleClick} />
}
function SceneSettings({ fov, resetCamera, ambientIntensity, keyLightIntensity, keyLightPosition, fillLightIntensity, environmentEnabled, environmentPreset, environmentIntensity }: SceneSettingsProps) {
  const { camera } = useThree()
  useEffect(() => { if (camera instanceof THREE.PerspectiveCamera) { camera.fov = fov; camera.updateProjectionMatrix() } }, [camera, fov])
  useEffect(() => { camera.position.set(5, 3.5, 7); camera.lookAt(0, 0, 0) }, [camera, resetCamera])
  return <><ambientLight intensity={ambientIntensity} /><directionalLight position={keyLightPosition} intensity={keyLightIntensity} castShadow /><directionalLight position={[-4, 3, -4]} intensity={fillLightIntensity} />{environmentEnabled && <Environment key={environmentPreset} preset={environmentPreset} environmentIntensity={environmentIntensity} />}</>
}
function getMeshNodes(scene: THREE.Object3D) { const nodes: THREE.Mesh[] = []; scene.traverse((object) => { if (object instanceof THREE.Mesh) nodes.push(object) }); return nodes }
function downloadText(filename: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }
function downloadGlb(target: THREE.Object3D) { const exporter = new GLTFExporter(); exporter.parse(target, (result) => { const blob = result instanceof ArrayBuffer ? new Blob([result], { type: 'model/gltf-binary' }) : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'three-playground.glb'; anchor.click(); URL.revokeObjectURL(url) }, (error) => window.alert(`GLB export failed: ${error}`), { binary: true, onlyVisible: false }) }
function toTuple3(value: THREE.Vector3): [number, number, number] { return [value.x, value.y, value.z] }
function toTuple4(value: THREE.Quaternion): [number, number, number, number] { return [value.x, value.y, value.z, value.w] }
function projectObjectFromMesh(mesh: THREE.Mesh, key: string): ProjectObject { const material = materialFor(mesh); return { key, position: toTuple3(mesh.position), quaternion: toTuple4(mesh.quaternion), scale: toTuple3(mesh.scale), ...(material ? { material: { color: `#${material.color.getHexString()}`, roughness: material.roughness, metalness: material.metalness, opacity: material.opacity } } : {}) } }

export default function App() {
  const [selected, setSelected] = useState<SelectedObject | null>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [modelName, setModelName] = useState('')
  const [mode, setMode] = useState<TransformMode>('translate')
  const [space, setSpace] = useState<TransformSpace>('world')
  const [modelMeshes, setModelMeshes] = useState<THREE.Mesh[]>([])
  const [modelScene, setModelScene] = useState<THREE.Object3D | null>(null)
  const [exportTarget, setExportTarget] = useState<THREE.Object3D | null>(null)
  const [materialVersion, setMaterialVersion] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [fov, setFov] = useState(50)
  const [resetCamera, setResetCamera] = useState(0)
  const [ambientIntensity, setAmbientIntensity] = useState(0.55)
  const [keyLightIntensity, setKeyLightIntensity] = useState(2)
  const [keyLightX, setKeyLightX] = useState(5)
  const [keyLightY, setKeyLightY] = useState(8)
  const [keyLightZ, setKeyLightZ] = useState(5)
  const [fillLightIntensity, setFillLightIntensity] = useState(0.5)
  const [environmentEnabled, setEnvironmentEnabled] = useState(true)
  const [environmentPreset, setEnvironmentPreset] = useState<EnvironmentPreset>('studio')
  const [environmentIntensity, setEnvironmentIntensity] = useState(0.7)
  const [projectMessage, setProjectMessage] = useState('')
  const undoStack = useRef<HistoryEntry[]>([])
  const redoStack = useRef<HistoryEntry[]>([])

  const pushHistory = (before: TransformSnapshot, after: TransformSnapshot) => { if (sameTransform(before, after)) return; undoStack.current.push({ before, after }); redoStack.current = []; setHistoryVersion((v) => v + 1) }
  const undo = () => { const entry = undoStack.current.pop(); if (!entry) return; const current = captureTransform(entry.before.object); applyTransform(entry.before); redoStack.current.push({ before: current, after: entry.before }); setHistoryVersion((v) => v + 1) }
  const redo = () => { const entry = redoStack.current.pop(); if (!entry) return; const current = captureTransform(entry.after.object); applyTransform(entry.after); undoStack.current.push({ before: current, after: entry.after }); setHistoryVersion((v) => v + 1) }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redo(); return }
      if (key === 'w') setMode('translate'); if (key === 'e') setMode('rotate'); if (key === 'r') setMode('scale'); if (key === 'q') setSpace((v) => v === 'world' ? 'local' : 'world'); if (key === 'escape') setSelected(null)
    }
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearResources = () => { for (const url of new Set(resourceUrls.values())) URL.revokeObjectURL(url); resourceUrls.clear() }
  useEffect(() => () => { clearResources() }, [])
  const loadModel = (url: string, name = 'Remote model') => { if (!url) return; setModelUrl(url); setModelName(name); setSelected(null); setModelMeshes([]); setModelScene(null); setExportTarget(null); setMaterialVersion((v) => v + 1); undoStack.current = []; redoStack.current = []; setHistoryVersion((v) => v + 1); setProjectMessage('') }
  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); const mainFile = files.find((file) => /\.(gltf|glb)$/i.test(file.name)); if (!mainFile) { if (files.length) window.alert('GLB 또는 GLTF 파일을 하나 이상 포함해야 합니다.'); event.target.value = ''; return }; clearResources(); for (const file of files) { const objectUrl = URL.createObjectURL(file); resourceUrls.set(file.name, objectUrl); resourceUrls.set(`./${file.name}`, objectUrl) }; loadModel(resourceUrls.get(mainFile.name)!, mainFile.name); event.target.value = '' }
  const handleUrlSubmit = (event: React.FormEvent) => { event.preventDefault(); clearResources(); loadModel(urlInput.trim()) }
  const clearModel = () => { clearResources(); setModelUrl(''); setModelName(''); setModelMeshes([]); setModelScene(null); setExportTarget(null); setSelected(null); setMaterialVersion((v) => v + 1); undoStack.current = []; redoStack.current = []; setHistoryVersion((v) => v + 1); setProjectMessage('') }
  const selectedMesh = selected instanceof THREE.Mesh ? selected : null
  const material = selectedMesh ? materialFor(selectedMesh) : null
  void materialVersion; void historyVersion
  const updateMaterial = (update: (material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) => void) => { if (!material) return; update(material); material.needsUpdate = true; setMaterialVersion((v) => v + 1) }
  const handleSelect = (object: THREE.Object3D) => { setSelected(object); if (!modelUrl) setExportTarget(object) }
  const handleModelLoaded = (scene: THREE.Object3D) => { setModelScene(scene); setExportTarget(scene); setModelMeshes(getMeshNodes(scene)) }
  const handleTransformStart = (object: THREE.Object3D) => object.userData.historyBefore = captureTransform(object)
  const handleTransformEnd = (object: THREE.Object3D) => { const before = object.userData.historyBefore as TransformSnapshot | undefined; delete object.userData.historyBefore; if (before) pushHistory(before, captureTransform(object)) }

  const saveProject = () => {
    const objects: ProjectObject[] = []
    if (!modelUrl) { const cube = exportTarget instanceof THREE.Mesh ? exportTarget : null; if (cube) objects.push(projectObjectFromMesh(cube, 'cube')) } else modelMeshes.forEach((mesh) => objects.push(projectObjectFromMesh(mesh, mesh.uuid)))
    const project: ProjectFile = { version: 1, type: 'three-playground-project', savedAt: new Date().toISOString(), ...(modelUrl ? { model: { source: 'url', url: modelUrl, name: modelName || 'Remote model' } } : {}), scene: { fov, ambientIntensity, keyLightIntensity, keyLightPosition: [keyLightX, keyLightY, keyLightZ], fillLightIntensity, environmentEnabled, environmentPreset, environmentIntensity, objects } }
    downloadText('three-playground.project.json', JSON.stringify(project, null, 2), 'application/json')
    setProjectMessage('프로젝트 저장 완료')
  }

  const restoreProjectObjects = (objects: ProjectObject[]) => {
    const byKey = new Map<string, THREE.Mesh>()
    if (!modelUrl) { if (exportTarget instanceof THREE.Mesh) byKey.set('cube', exportTarget) } else modelMeshes.forEach((mesh) => byKey.set(mesh.uuid, mesh))
    for (const data of objects) {
      const mesh = byKey.get(data.key); if (!mesh) continue
      mesh.position.set(...data.position); mesh.quaternion.set(...data.quaternion); mesh.scale.set(...data.scale)
      if (data.material) { const target = materialFor(mesh); if (target) { target.color.set(data.material.color); target.roughness = data.material.roughness; target.metalness = data.material.metalness; target.opacity = data.material.opacity; target.transparent = target.opacity < 1; target.needsUpdate = true } }
      mesh.updateMatrixWorld(true)
    }
    setMaterialVersion((v) => v + 1)
  }
  const applyProjectSettings = (project: ProjectFile) => { setFov(project.scene.fov); setAmbientIntensity(project.scene.ambientIntensity); setKeyLightIntensity(project.scene.keyLightIntensity); setKeyLightX(project.scene.keyLightPosition[0]); setKeyLightY(project.scene.keyLightPosition[1]); setKeyLightZ(project.scene.keyLightPosition[2]); setFillLightIntensity(project.scene.fillLightIntensity); setEnvironmentEnabled(project.scene.environmentEnabled); setEnvironmentPreset(project.scene.environmentPreset); setEnvironmentIntensity(project.scene.environmentIntensity) }
  const applyProject = (project: ProjectFile) => { applyProjectSettings(project); setTimeout(() => restoreProjectObjects(project.scene.objects), 0); setProjectMessage('프로젝트 불러오기 완료') }
  const handleProjectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { try {
      const project = JSON.parse(String(reader.result)) as ProjectFile
      if (project?.type !== 'three-playground-project' || project.version !== 1) throw new Error('지원하지 않는 프로젝트 파일입니다.')
      if (project.model?.source === 'url' && project.model.url && project.model.url !== modelUrl) { clearResources(); setUrlInput(project.model.url); loadModel(project.model.url, project.model.name || 'Remote model'); setTimeout(() => applyProject(project), 300); return }
      applyProject(project)
    } catch (error) { window.alert(error instanceof Error ? error.message : '프로젝트 파일을 읽을 수 없습니다.') } }
    reader.readAsText(file)
  }

  const materialColor = material ? `#${material.color.getHexString()}` : '#ffffff'
  const materialRoughness = material?.roughness ?? 0.5
  const materialMetalness = material?.metalness ?? 0
  const materialOpacity = material?.opacity ?? 1
  const exportTargetObject = modelScene ?? exportTarget

  return <main className="app"><header className="toolbar"><div><strong>Three.js Playground</strong><span>Browser-only 3D renderer</span></div><span className="status">React Three Fiber · Three.js · GLB/GLTF</span></header><section className="viewport">
    <Canvas camera={{ position: [5, 3.5, 7], fov }} shadows onPointerMissed={() => setSelected(null)}><color attach="background" args={['#0b1020']} /><SceneSettings fov={fov} resetCamera={resetCamera} ambientIntensity={ambientIntensity} keyLightIntensity={keyLightIntensity} keyLightPosition={[keyLightX, keyLightY, keyLightZ]} fillLightIntensity={fillLightIntensity} environmentEnabled={environmentEnabled} environmentPreset={environmentPreset} environmentIntensity={environmentIntensity} />
      {!modelUrl && <Cube selected={selected === 'cube'} onSelect={handleSelect} />}
      {modelUrl && <Suspense fallback={null}><Bounds fit clip observe margin={1.2}><GLTFModel url={modelUrl} onSelect={handleSelect} onLoaded={handleModelLoaded} /></Bounds></Suspense>}
      {selectedMesh && <TransformControls object={selectedMesh} mode={mode} space={space} onMouseDown={() => handleTransformStart(selectedMesh)} onMouseUp={() => handleTransformEnd(selectedMesh)} />}<Grid args={[20, 20]} cellSize={1} cellThickness={0.6} sectionSize={5} sectionThickness={1.2} fadeDistance={30} fadeStrength={1} /><OrbitControls makeDefault enableDamping />
    </Canvas>
    <aside className="panel"><h2>Scene</h2>{!modelUrl && <button className={selected === 'cube' ? 'active scene-item' : 'scene-item'} onClick={() => setSelected('cube')}>Cube</button>}
      {modelUrl && <div className="hierarchy"><span className="section-label">Hierarchy</span><button className={!selected ? 'scene-item active' : 'scene-item'} onClick={() => setSelected(null)}>◈ {modelName || 'Model'}</button>{modelMeshes.length === 0 && <span className="empty-hierarchy">모델 로딩 중...</span>}{modelMeshes.map((mesh, index) => <button key={mesh.uuid} className={selected === mesh ? 'scene-item child active' : 'scene-item child'} onClick={() => setSelected(mesh)}>◇ {mesh.name || `Mesh ${index + 1}`}</button>)}</div>}
      <div className="model-loader"><label className="file-button">GLB / GLTF + 리소스 업로드<input type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,model/gltf-binary,model/gltf+json" onChange={handleFiles} /></label><span className="upload-hint">.gltf, .bin, 텍스처를 함께 선택하세요.</span><form onSubmit={handleUrlSubmit} className="url-form"><input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://.../model.glb" aria-label="GLB/GLTF URL" /><button type="submit">Load</button></form>{modelUrl && <div className="loaded-model"><span title={modelName}>{modelName}</span><button type="button" onClick={clearModel}>×</button></div>}{exportTargetObject && <button className="full-button export-button" type="button" onClick={() => downloadGlb(exportTargetObject)}>Export GLB</button>}</div>
      <div className="scene-tools"><span className="section-label">Project</span><div className="mode-buttons"><button type="button" onClick={saveProject}>Save JSON</button><label className="inline-file-button">Load JSON<input type="file" accept=".json,application/json" onChange={handleProjectFile} /></label></div>{projectMessage && <span className="project-message">{projectMessage}</span>}</div>
      <div className="scene-tools"><span className="section-label">History</span><div className="mode-buttons"><button type="button" onClick={undo} disabled={undoStack.current.length === 0}>Undo <kbd>Ctrl+Z</kbd></button><button type="button" onClick={redo} disabled={redoStack.current.length === 0}>Redo <kbd>Ctrl+Y</kbd></button></div></div>
      <div className="scene-tools"><span className="section-label">Camera</span><label className="material-row"><span>FOV <output>{fov}°</output></span><input type="range" min="20" max="100" step="1" value={fov} onChange={(e) => setFov(Number(e.target.value))} /></label><button className="full-button" onClick={() => setResetCamera((v) => v + 1)}>Reset camera</button></div>
      <div className="scene-tools"><span className="section-label">Lighting</span><label className="material-row"><span>Ambient <output>{ambientIntensity.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={ambientIntensity} onChange={(e) => setAmbientIntensity(Number(e.target.value))} /></label><label className="material-row"><span>Key light <output>{keyLightIntensity.toFixed(2)}</output></span><input type="range" min="0" max="5" step="0.01" value={keyLightIntensity} onChange={(e) => setKeyLightIntensity(Number(e.target.value))} /></label><div className="light-position"><label>X<input type="range" min="-10" max="10" step="0.5" value={keyLightX} onChange={(e) => setKeyLightX(Number(e.target.value))} /></label><label>Y<input type="range" min="-10" max="15" step="0.5" value={keyLightY} onChange={(e) => setKeyLightY(Number(e.target.value))} /></label><label>Z<input type="range" min="-10" max="10" step="0.5" value={keyLightZ} onChange={(e) => setKeyLightZ(Number(e.target.value))} /></label></div><label className="material-row"><span>Fill light <output>{fillLightIntensity.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={fillLightIntensity} onChange={(e) => setFillLightIntensity(Number(e.target.value))} /></label></div>
      <div className="scene-tools"><span className="section-label">Environment</span><button className={environmentEnabled ? 'active full-button' : 'full-button'} onClick={() => setEnvironmentEnabled((v) => !v)}>{environmentEnabled ? 'HDRI on' : 'HDRI off'}</button><label className="material-row"><span>Preset</span><select className="preset-select" value={environmentPreset} onChange={(e) => setEnvironmentPreset(e.target.value as EnvironmentPreset)}><option value="studio">Studio</option><option value="city">City</option><option value="sunset">Sunset</option><option value="dawn">Dawn</option><option value="night">Night</option><option value="warehouse">Warehouse</option><option value="forest">Forest</option><option value="apartment">Apartment</option></select></label><label className="material-row"><span>Intensity <output>{environmentIntensity.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={environmentIntensity} onChange={(e) => setEnvironmentIntensity(Number(e.target.value))} /></label></div>
      {selected && <div className="transform-tools"><span className="section-label">Transform</span><div className="mode-buttons"><button className={mode === 'translate' ? 'active' : ''} onClick={() => setMode('translate')}>Move <kbd>W</kbd></button><button className={mode === 'rotate' ? 'active' : ''} onClick={() => setMode('rotate')}>Rotate <kbd>E</kbd></button><button className={mode === 'scale' ? 'active' : ''} onClick={() => setMode('scale')}>Scale <kbd>R</kbd></button></div><div className="mode-buttons"><button className={space === 'world' ? 'active' : ''} onClick={() => setSpace('world')}>World</button><button className={space === 'local' ? 'active' : ''} onClick={() => setSpace('local')}>Local</button></div></div>}
      {material && <div className="material-tools"><span className="section-label">Material</span><label className="material-row"><span>Color</span><input type="color" value={materialColor} onChange={(e) => updateMaterial((m) => m.color.set(e.target.value))} /></label><label className="material-row"><span>Roughness <output>{materialRoughness.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialRoughness} onChange={(e) => updateMaterial((m) => m.roughness = Number(e.target.value))} /></label><label className="material-row"><span>Metalness <output>{materialMetalness.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialMetalness} onChange={(e) => updateMaterial((m) => m.metalness = Number(e.target.value))} /></label><label className="material-row"><span>Opacity <output>{materialOpacity.toFixed(2)}</output></span><input type="range" min="0" max="1" step="0.01" value={materialOpacity} onChange={(e) => updateMaterial((m) => { m.opacity = Number(e.target.value); m.transparent = m.opacity < 1 })} /></label></div>}
      <div className="help"><p>오브젝트 클릭: Mesh 선택</p><p><kbd>W</kbd> 이동 · <kbd>E</kbd> 회전 · <kbd>R</kbd> 스케일</p><p><kbd>Q</kbd> World / Local · <kbd>Esc</kbd> 선택 해제</p><p><kbd>Ctrl+Z</kbd> Undo · <kbd>Ctrl+Y</kbd> Redo</p><p>GLTF와 .bin/텍스처를 여러 파일로 함께 업로드할 수 있습니다.</p><p>프로젝트 JSON은 씬 설정과 현재 Mesh 변경값을 저장합니다.</p></div>
    </aside></section></main>
}
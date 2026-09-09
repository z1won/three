import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { Bounds, Environment, Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import './styles.css'

type TransformMode = 'translate' | 'rotate' | 'scale'
type TransformSpace = 'world' | 'local'
type SelectedObject = 'cube' | THREE.Object3D
type EnvironmentPreset = 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment'
type MaterialLike = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
type MaterialSnapshot = { color: string; roughness: number; metalness: number; opacity: number; transparent: boolean }
type ObjectSnapshot = { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; material?: MaterialSnapshot }
type HistoryEntry = { before: ObjectSnapshot; after: ObjectSnapshot }
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
function materialFor(mesh: THREE.Mesh): MaterialLike | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial ? material : null
}
function captureSnapshot(object: THREE.Object3D): ObjectSnapshot {
  const snapshot: ObjectSnapshot = { object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() }
  if (object instanceof THREE.Mesh) {
    const material = materialFor(object)
    if (material) snapshot.material = { color: `#${material.color.getHexString()}`, roughness: material.roughness, metalness: material.metalness, opacity: material.opacity, transparent: material.transparent }
  }
  return snapshot
}
function applySnapshot(snapshot: ObjectSnapshot) {
  snapshot.object.position.copy(snapshot.position)
  snapshot.object.quaternion.copy(snapshot.quaternion)
  snapshot.object.scale.copy(snapshot.scale)
  if (snapshot.object instanceof THREE.Mesh && snapshot.material) {
    const material = materialFor(snapshot.object)
    if (material) {
      material.color.set(snapshot.material.color)
      material.roughness = snapshot.material.roughness
      material.metalness = snapshot.material.metalness
      material.opacity = snapshot.material.opacity
      material.transparent = snapshot.material.transparent
      material.needsUpdate = true
    }
  }
  snapshot.object.updateMatrixWorld(true)
}
function sameSnapshot(a: ObjectSnapshot, b: ObjectSnapshot) {
  const materialSame = JSON.stringify(a.material) === JSON.stringify(b.material)
  return a.position.equals(b.position) && a.quaternion.equals(b.quaternion) && a.scale.equals(b.scale) && materialSame
}
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
  const materialHistoryBefore = useRef<ObjectSnapshot | null>(null)

  const pushHistory = useCallback((before: ObjectSnapshot, after: ObjectSnapshot) => { if (sameSnapshot(before, after)) return; undoStack.current.push({ before, after }); redoStack.current = []; setHistoryVersion((v) => v + 1) }, [])
  const undo = useCallback(() => { const entry = undoStack.current.pop(); if (!entry) return; const current = captureSnapshot(entry.before.object); applySnapshot(entry.before); redoStack.current.push({ before: current, after: entry.before }); setHistoryVersion((v) => v + 1); setMaterialVersion((v) => v + 1) }, [])
  const redo = useCallback(() => { const entry = redoStack.current.pop(); if (!entry) return; const current = captureSnapshot(entry.after.object); applySnapshot(entry.after); undoStack.current.push({ before: current, after: entry.after }); setHistoryVersion((v) => v + 1); setMaterialVersion((v) => v + 1) }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redo(); return }
      if (key === 'w') setMode('translate'); else if (key === 'e') setMode('rotate'); else if (key === 'r') setMode('scale'); else if (key === 'q') setSpace((v) => v === 'world' ? 'local' : 'world'); else if (key === 'escape') setSelected(null)
    }
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, undo])

  const clearResources = useCallback(() => { for (const url of new Set(resourceUrls.values())) URL.revokeObjectURL(url); resourceUrls.clear() }, [])
  useEffect(() => () => { clearResources() }, [clearResources])
  const loadModel = useCallback((url: string, name = 'Remote model') => { if (!url) return; setModelUrl(url); setModelName(name); setSelected(null); setModelMeshes([]); setModelScene(null); setExportTarget(null); setMaterialVersion((v) => v + 1); undoStack.current = []; redoStack.current = []; setHistoryVersion((v) => v + 1); setProjectMessage('') }, [])
  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); const mainFile = files.find((file) => /\.(gltf|glb)$/i.test(file.name)); if (!mainFile) { if (files.length) window.alert('GLB 또는 GLTF 파일을 하나 이상 포함해야 합니다.'); event.target.value = ''; return }; clearResources(); for (const file of files) { const objectUrl = URL.createObjectURL(file); resourceUrls.set(file.name, objectUrl); resourceUrls.set(`./${file.name}`, objectUrl) }; loadModel(resourceUrls.get(mainFile.name)!, mainFile.name); event.target.value = '' }
  const handleUrlSubmit = (event: React.FormEvent) => { event.preventDefault(); clearResources(); loadModel(urlInput.trim()) }
  const clearModel = () => { clearResources(); setModelUrl(''); setModelName(''); setModelMeshes([]); setModelScene(null); setExportTarget(null); setSelected(null); setMaterialVersion((v) => v + 1); undoStack.current = []; redoStack.current = []; setHistoryVersion((v) => v + 1); setProjectMessage('') }

  const selectedMesh = selected instanceof THREE.Mesh ? selected : null
  const material = selectedMesh ? materialFor(selectedMesh) : null
  void materialVersion; void historyVersion

  const beginMaterialHistory = () => { if (selectedMesh) materialHistoryBefore.current = captureSnapshot(selectedMesh) }
  const endMaterialHistory = () => { if (!selectedMesh || !materialHistoryBefore.current) return; const before = materialHistoryBefore.current; materialHistoryBefore.current = null; pushHistory(before, captureSnapshot(selectedMesh)) }
  const updateMaterial = (update: (material: MaterialLike) => void) => { if (!material) return; update(material); material.transparent = material.opacity < 1; material.needsUpdate = true; setMaterialVersion((v) => v + 1) }
  const handleSelect = (object: THREE.Object3D) => { setSelected(object); if (!modelUrl) setExportTarget(object) }
  const handleModelLoaded = useCallback((scene: THREE.Object3D) => { setModelScene(scene); setExportTarget(scene); setModelMeshes(getMeshNodes(scene)) }, [])
  const handleTransformStart = (object: THREE.Object3D) => object.userData.historyBefore = captureSnapshot(object)
  const handleTransformEnd = (object: THREE.Object3D) => { const before = object.userData.historyBefore as ObjectSnapshot | undefined; delete object.userData.historyBefore; if (before) pushHistory(before, captureSnapshot(object)) }

  const saveProject = () => {
    const objects: ProjectObject[] = []
    if (!modelUrl) { const cube = exportTarget instanceof THREE.Mesh ? exportTarget : null; if (cube) objects.push(projectObjectFromMesh(cube, 'cube')) } else modelMeshes.forEach((mesh) => objects.push(projectObjectFromMesh(mesh, mesh.uuid)))
    const project: ProjectFile = { version: 1, type: 'three-playground-project', savedAt: new Date().toISOString(), ...(modelUrl ? { model: { source: 'url', url: modelUrl, name: modelName || 'Remote model' } } : {}), scene: { fov, ambientIntensity, keyLightIntensity, keyLightPosition: [keyLightX, keyLightY, keyLightZ], fillLightIntensity, environmentEnabled, environmentPreset, environmentIntensity, objects } }
    downloadText('three-playground.project.json', JSON.stringify(project, null, 2), 'application/json'); setProjectMessage('프로젝트 저장 완료')
  }
  const restoreProjectObjects = (objects: ProjectObject[]) => {
    const byKey = new Map<string, THREE.Mesh>()
    if (!modelUrl) { if (exportTarget instanceof THREE.Mesh) byKey.set('cube', exportTarget) } else modelMeshes.forEach((mesh) => byKey.set(mesh.uuid, mesh))
    for (const data of objects) { const mesh = byKey.get(data.key); if (!mesh) continue; mesh.position.set(...data.position); mesh.quaternion.set(...data.quaternion); mesh.scale.set(...data.scale); if (data.material) { const target = materialFor(mesh); if (target) { target.color.set(data.material.color); target.roughness = data.material.roughness; target.metalness = data.material.metalness; target.opacity = data.material.opacity; target.transparent = target.opacity < 1; target.needsUpdate = true } } mesh.updateMatrixWorld(true) }
    setMaterialVersion((v) => v + 1)
  }
  const applyProjectSettings = (project: ProjectFile) => { setFov(project.scene.fov); setAmbientIntensity(project.scene.ambientIntensity); setKeyLightIntensity(project.scene.keyLightIntensity); setKeyLightX(project.scene.keyLightPosition[0]); setKeyLightY(project.scene.keyLightPosition[1]); setKeyLightZ(project.scene.keyLightPosition[2]); setFillLightIntensity(project.scene.fillLightIntensity); setEnvironmentEnabled(project.scene.environmentEnabled); setEnvironmentPreset(project.scene.environmentPreset); setEnvironmentIntensity(project.scene.environmentIntensity) }
  const applyProject = (project: ProjectFile) => { applyProjectSettings(project); setTimeout(() => restoreProjectObjects(project.scene.objects), 0); setProjectMessage('프로젝트 불러오기 완료') }
  const handleProjectFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const project = JSON.parse(String(reader.result)) as ProjectFile; if (project?.type !== 'three-playground-project' || project.version !== 1) throw new Error('지원하지 않는 프로젝트 파일입니다.'); if (project.model?.source === 'url' && project.model.url && project.model.url !== modelUrl) { clearResources(); setUrlInput(project.model.url); loadModel(project.model.url, project.model.name || 'Remote model'); setTimeout(() => applyProject(project), 300); return } applyProject(project) } catch (error) { window.alert(error instanceof Error ? error.message : '프로젝트 파일을 읽을 수 없습니다.') } }; reader.readAsText(file) }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><strong>Three Playground</strong><span>3D Scene Editor</span></div>
      <section className="panel"><span className="section-label">Model</span><label className="file-input">GLB / GLTF + 리소스 업로드<input type="file" accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2" multiple onChange={handleFiles} /></label><small>.gltf, .bin, 텍스처를 함께 선택하세요.</small><form onSubmit={handleUrlSubmit} className="url-form"><input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="GLB / GLTF URL" /><button type="submit">Load</button></form>{modelUrl && <div className="loaded-model"><span>{modelName || 'Model loaded'}</span><button onClick={clearModel}>Clear</button></div>}</section>
      {modelUrl && <section className="panel hierarchy"><span className="section-label">Hierarchy</span><button className={!selected ? 'scene-item active' : 'scene-item'} onClick={() => setSelected(null)}>◈ {modelName || 'Model'}</button>{modelMeshes.length === 0 ? <span className="empty-hierarchy">모델 로딩 중...</span> : modelMeshes.map((mesh, index) => <button key={mesh.uuid} className={selected === mesh ? 'scene-item child active' : 'scene-item child'} onClick={() => setSelected(mesh)}>◇ {mesh.name || `Mesh ${index + 1}`}</button>)}</section>}
      <section className="panel"><span className="section-label">History</span><div className="button-row"><button onClick={undo} disabled={!undoStack.current.length}>Undo</button><button onClick={redo} disabled={!redoStack.current.length}>Redo</button></div><small>Ctrl/Cmd+Z · Ctrl/Cmd+Y</small></section>
      <section className="panel"><span className="section-label">Transform</span><div className="button-row"><button className={mode === 'translate' ? 'active' : ''} onClick={() => setMode('translate')}>W Move</button><button className={mode === 'rotate' ? 'active' : ''} onClick={() => setMode('rotate')}>E Rotate</button><button className={mode === 'scale' ? 'active' : ''} onClick={() => setMode('scale')}>R Scale</button></div><button className="wide-button" onClick={() => setSpace((v) => v === 'world' ? 'local' : 'world')}>Q · {space} space</button></section>
      <section className="panel"><span className="section-label">Material</span>{material ? <><label>Color <input type="color" value={`#${material.color.getHexString()}`} onPointerDown={beginMaterialHistory} onPointerUp={endMaterialHistory} onChange={(e) => updateMaterial((m) => m.color.set(e.target.value))} /></label><label>Roughness <input type="range" min="0" max="1" step="0.01" value={material.roughness} onPointerDown={beginMaterialHistory} onPointerUp={endMaterialHistory} onChange={(e) => updateMaterial((m) => { m.roughness = Number(e.target.value) })} /><output>{material.roughness.toFixed(2)}</output></label><label>Metalness <input type="range" min="0" max="1" step="0.01" value={material.metalness} onPointerDown={beginMaterialHistory} onPointerUp={endMaterialHistory} onChange={(e) => updateMaterial((m) => { m.metalness = Number(e.target.value) })} /><output>{material.metalness.toFixed(2)}</output></label><label>Opacity <input type="range" min="0" max="1" step="0.01" value={material.opacity} onPointerDown={beginMaterialHistory} onPointerUp={endMaterialHistory} onChange={(e) => updateMaterial((m) => { m.opacity = Number(e.target.value) })} /><output>{material.opacity.toFixed(2)}</output></label><small>Material 변경도 Undo/Redo에 기록됩니다.</small></> : <small>Mesh를 선택하면 Material Editor가 활성화됩니다.</small>}</section>
      <section className="panel"><span className="section-label">Camera</span><label>FOV <input type="range" min="20" max="100" value={fov} onChange={(e) => setFov(Number(e.target.value))} /><output>{fov}°</output></label><button className="wide-button" onClick={() => setResetCamera((v) => v + 1)}>Reset camera</button></section>
      <section className="panel"><span className="section-label">Lighting</span><label>Ambient <input type="range" min="0" max="2" step="0.05" value={ambientIntensity} onChange={(e) => setAmbientIntensity(Number(e.target.value))} /><output>{ambientIntensity.toFixed(2)}</output></label><label>Key <input type="range" min="0" max="5" step="0.1" value={keyLightIntensity} onChange={(e) => setKeyLightIntensity(Number(e.target.value))} /><output>{keyLightIntensity.toFixed(1)}</output></label><label>Fill <input type="range" min="0" max="3" step="0.1" value={fillLightIntensity} onChange={(e) => setFillLightIntensity(Number(e.target.value))} /><output>{fillLightIntensity.toFixed(1)}</output></label></section>
      <section className="panel"><span className="section-label">Environment</span><label className="checkbox"><input type="checkbox" checked={environmentEnabled} onChange={(e) => setEnvironmentEnabled(e.target.checked)} /> HDRI</label><select value={environmentPreset} onChange={(e) => setEnvironmentPreset(e.target.value as EnvironmentPreset)}><option value="studio">studio</option><option value="city">city</option><option value="sunset">sunset</option><option value="dawn">dawn</option><option value="night">night</option><option value="warehouse">warehouse</option><option value="forest">forest</option><option value="apartment">apartment</option></select><label>Intensity <input type="range" min="0" max="2" step="0.05" value={environmentIntensity} onChange={(e) => setEnvironmentIntensity(Number(e.target.value))} /><output>{environmentIntensity.toFixed(2)}</output></label></section>
      <section className="panel"><span className="section-label">Project</span><div className="button-row"><button onClick={saveProject}>Save JSON</button><label className="file-button">Load JSON<input type="file" accept="application/json,.json" onChange={handleProjectFile} /></label></div>{projectMessage && <small>{projectMessage}</small>}</section>
      <section className="panel"><span className="section-label">Export</span><button className="wide-button" disabled={!exportTarget} onClick={() => exportTarget && downloadGlb(exportTarget)}>Export GLB</button></section>
      <small className="help">W/E/R: transform · Q: world/local · Esc: deselect</small>
    </aside>
    <main className="viewport"><Canvas camera={{ position: [5, 3.5, 7], fov }} shadows onPointerMissed={() => setSelected(null)}><color attach="background" args={['#0b1020']} /><SceneSettings fov={fov} resetCamera={resetCamera} ambientIntensity={ambientIntensity} keyLightIntensity={keyLightIntensity} keyLightPosition={[keyLightX, keyLightY, keyLightZ]} fillLightIntensity={fillLightIntensity} environmentEnabled={environmentEnabled} environmentPreset={environmentPreset} environmentIntensity={environmentIntensity} />{!modelUrl && <Cube selected={selected === 'cube'} onSelect={handleSelect} />}{modelUrl && <Suspense fallback={null}><Bounds fit clip observe margin={1.2}><GLTFModel url={modelUrl} onSelect={handleSelect} onLoaded={handleModelLoaded} /></Bounds></Suspense>}{selectedMesh && <TransformControls object={selectedMesh} mode={mode} space={space} onMouseDown={() => handleTransformStart(selectedMesh)} onMouseUp={() => handleTransformEnd(selectedMesh)} />}<Grid args={[20, 20]} cellSize={1} cellThickness={0.6} sectionSize={5} sectionThickness={1.2} fadeDistance={30} infiniteGrid /><OrbitControls makeDefault enableDamping /></Canvas></main>
  </div>
}
